// AI recommendation layer.
//
// Scope is deliberately narrow: the rule engine has already decided PASS/FAIL and
// computed the score. The model only turns that finding set into prose an officer
// can act on. It cannot change a status, a score or a recommendation - required by
// the problem statement, which reserves qualification for the Procurement Officer
// and demands an auditable record.
//
// Degrades in three steps: live OpenAI -> committed cache -> deterministic template.
// The demo therefore cannot be killed by a missing key or venue wifi.

import cache from '../data/ai-cache.json' with { type: 'json' };

const MODEL = process.env.OPENAI_MODEL || 'gpt-5';

const SYSTEM = `You advise a Government of India procurement officer evaluating bids on GeM (Government e-Marketplace) for a Central Public Sector Enterprise.

A deterministic rule engine has already verified the bidder against government portals and produced check results, a compliance score and a system recommendation. Do not re-decide any of it and do not invent facts: work only from what you are given.

Write for a busy officer who must justify the decision on file. Be specific, cite the actual registration numbers, amounts and dates in the findings, and name the governing rule where the finding states one. Neutral administrative register - no marketing language, no hedging padding.

Return ONLY a JSON object:
{
  "summary": "2-3 sentences. The bottom line and why.",
  "keyRisks": [{"title": "short label", "detail": "one sentence, cites the evidence", "severity": "HIGH"|"MEDIUM"|"LOW"}],
  "actionsForOfficer": ["concrete next step, imperative mood"],
  "curable": "Which deficiencies the bidder could remedy before award, and which are disqualifying in nature. One or two sentences."
}`;

function payloadFor(r) {
  return {
    tender: { id: r.tender.id, title: r.tender.title, requirements: r.tender.requirements },
    bidder: { name: r.bidder.legalName, quotedValue: r.bidder.quotedValue },
    score: r.score,
    risk: r.risk,
    systemRecommendation: r.recommendation,
    overriddenByGate: r.overriddenByGate,
    findings: r.checks
      .filter((c) => c.status !== 'NA')
      .map((c) => ({ check: c.label, status: c.status, gating: c.gate, detail: c.detail })),
    crossSourceFindings: r.cross.map((c) => ({ field: c.label, severity: c.severity, note: c.note })),
  };
}

/** Deterministic prose. Never fails, never needs a network. */
function template(r) {
  const fails = r.checks.filter((c) => c.status === 'FAIL');
  const warns = r.checks.filter((c) => c.status === 'WARN');
  const verdict = {
    QUALIFY: `${r.bidder.legalName} meets every verified requirement for ${r.tender.id}, scoring ${r.score}/100 with no failed checks.`,
    REVIEW_REQUIRED: `${r.bidder.legalName} scores ${r.score}/100 with ${fails.length} failed and ${warns.length} flagged check(s). Officer review is required before the bid can proceed.`,
    DO_NOT_QUALIFY: r.overriddenByGate
      ? `${r.bidder.legalName} scores ${r.score}/100 on documentation, but fails a gating requirement (${r.gateFailures.map((g) => g.label).join(', ')}), which cannot be cured by performance on other checks.`
      : `${r.bidder.legalName} scores ${r.score}/100 with ${fails.length} failed check(s), placing it in the CRITICAL risk band.`,
  }[r.recommendation];

  return {
    summary: `${verdict} This assessment is advisory; qualification remains with the Procurement Officer.`,
    keyRisks: fails.map((c) => ({ title: c.label, detail: c.detail, severity: c.gate ? 'HIGH' : 'MEDIUM' }))
      .concat(warns.map((c) => ({ title: c.label, detail: c.detail, severity: 'LOW' })))
      .slice(0, 6),
    actionsForOfficer: fails.length
      ? [
          ...r.gateFailures.map((g) => `Record the gating failure on ${g.label} in the evaluation note before any further processing.`),
          ...fails.filter((c) => !c.gate).slice(0, 3).map((c) => `Seek written clarification from the bidder on ${c.label}.`),
        ]
      : ['No deficiency identified. Proceed to technical evaluation.'],
    curable: fails.some((c) => c.gate)
      ? 'The gating deficiency is disqualifying in nature and is not curable by submitting further documents. Remaining observations are procedural.'
      : fails.length
        ? 'The identified deficiencies are documentary and may be curable if the bidder responds within the clarification window.'
        : 'No deficiencies to cure.',
    source: 'template',
  };
}

export async function recommend(r, { allowLive = true } = {}) {
  if (allowLive && process.env.OPENAI_API_KEY) {
    try {
      const { default: OpenAI } = await import('openai');
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const res = await client.chat.completions.create({
        model: MODEL,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: JSON.stringify(payloadFor(r)) },
        ],
      });
      const parsed = JSON.parse(res.choices[0].message.content);
      return { ...parsed, source: 'openai', model: MODEL };
    } catch (e) {
      // fall through to cache / template
      console.warn('[ai] live call failed, falling back:', e.message);
    }
  }
  const hit = cache[r.bidder.id ?? ''];
  if (hit) return { ...hit, source: 'cache', model: hit.model ?? MODEL };
  return template(r);
}

export { template as templateRecommendation, payloadFor };
