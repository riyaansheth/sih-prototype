import tender from '../data/tender.json' with { type: 'json' };
import { queryAll, getBidder, listBidders, SOURCES } from './connectors.js';
import { crossCheck } from './crosscheck.js';
import { runChecks } from './rules.js';
import { scoreChecks } from './score.js';
import { buildAuditTrail } from './audit.js';

export { tender, listBidders, SOURCES };

/** Full verification for one bidder. Deterministic - the AI layer sits on top of this. */
export async function verifyBidder(bidderId, { delay = 0 } = {}) {
  const startedAt = new Date().toISOString();
  const bidder = getBidder(bidderId);
  const portals = await queryAll(bidderId, { delay });
  const cross = crossCheck(portals);
  const checks = runChecks(portals, tender, cross, bidder);
  const scored = scoreChecks(checks);
  const finishedAt = new Date().toISOString();

  return {
    tender,
    bidder: { id: bidder.id, legalName: bidder.legalName, gemSellerId: bidder.gemSellerId, quotedValue: bidder.quotedValue, submittedDocs: bidder.submittedDocs },
    portals,
    cross,
    checks,
    ...scored,
    audit: buildAuditTrail({ tender, bidder, portals, checks, scored, startedAt, finishedAt }),
    startedAt,
    finishedAt,
    durationMs: new Date(finishedAt) - new Date(startedAt),
  };
}

export async function verifyAll(opts) {
  return Promise.all(listBidders().map((b) => verifyBidder(b.id, opts)));
}
