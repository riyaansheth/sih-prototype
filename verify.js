#!/usr/bin/env node
// Headless run: node verify.js [BID-00n]
import { verifyAll, verifyBidder, tender } from './lib/engine.js';

const only = process.argv[2];
const results = only ? [await verifyBidder(only)] : await verifyAll();

console.log(`\n${tender.id} — ${tender.title}`);
console.log(`${tender.buyer} | GeM ${tender.gemBidNo} | Est. Rs ${(tender.estimatedValue / 1e7).toFixed(2)} Cr\n`);

for (const r of results.sort((a, b) => b.score - a.score)) {
  console.log('─'.repeat(78));
  console.log(`${r.bidder.legalName}  [${r.bidder.id}]`);
  console.log(`  Score ${r.score}/100   Risk ${r.risk}   →  ${r.recommendation}`);
  if (r.overriddenByGate) console.log(`  ⚠ Band overridden to CRITICAL by gating failure`);
  for (const g of r.gateFailures) console.log(`    ✖ GATE — ${g.label}: ${g.detail}`);
  const notable = r.checks.filter((c) => c.status === 'FAIL' || c.status === 'WARN');
  if (notable.length) {
    console.log(`  Findings (${notable.length}):`);
    for (const c of notable) console.log(`    ${c.status === 'FAIL' ? '✖' : '!'} ${c.label}: ${c.detail}`);
  }
  console.log(`  Audit events: ${r.audit.length}   Sources queried: ${Object.keys(r.portals).length}`);
}
console.log('─'.repeat(78));
console.log('\nAdvisory only. Qualification remains with the Procurement Officer.\n');
