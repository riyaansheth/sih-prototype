// Audit trail.
//
// Every event is derived from the verification run itself, so the trail is
// reproducible from the inputs rather than depending on a writable disk (which a
// serverless deployment does not have). Officer decisions are appended by the
// client and persisted there.
//
// ponytail: derived + client-persisted. Swap for an append-only table with a
// hash chain when this runs against real portals and needs legal weight.

import { createHash } from 'node:crypto';

export const hashEvidence = (payload) =>
  createHash('sha256').update(JSON.stringify(payload)).digest('hex').slice(0, 16);

export function buildAuditTrail({ tender, bidder, portals, checks, scored, startedAt, finishedAt }) {
  const events = [];
  const push = (at, actor, action, detail, ref) => events.push({ at, actor, action, detail, ref });

  push(startedAt, 'SYSTEM', 'VERIFICATION_STARTED',
    `Compliance verification initiated for ${bidder.legalName} (${bidder.id}) against tender ${tender.id}.`,
    hashEvidence({ t: tender.id, b: bidder.id, at: startedAt }));

  for (const p of Object.values(portals)) {
    push(p.fetchedAt, `CONNECTOR:${p.source}`, 'PORTAL_QUERIED',
      `${p.label} returned ${p.status}.${p.mock ? ' [simulated source]' : ''}`,
      p.evidence?.ref ?? null);
  }

  for (const c of checks) {
    push(finishedAt, 'RULE_ENGINE', 'CHECK_EVALUATED',
      `${c.label} — ${c.status}${c.gate ? ' (gating check)' : ''}. ${c.detail}`,
      hashEvidence({ id: c.id, status: c.status, detail: c.detail }));
  }

  push(finishedAt, 'SCORING_ENGINE', 'SCORE_COMPUTED',
    `Compliance score ${scored.score}/100 from ${scored.earnedWeight}/${scored.totalWeight} weighted points. Risk ${scored.risk}.`
    + (scored.overriddenByGate ? ` Band overridden to CRITICAL by gating failure: ${scored.gateFailures.map((g) => g.label).join(', ')}.` : ''),
    hashEvidence(scored.breakdown));

  push(finishedAt, 'SYSTEM', 'RECOMMENDATION_ISSUED',
    `System recommendation: ${scored.recommendation}. Advisory only — qualification remains with the Procurement Officer.`,
    hashEvidence({ r: scored.recommendation, s: scored.score }));

  return events.sort((a, b) => new Date(a.at) - new Date(b.at));
}
