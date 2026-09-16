#!/usr/bin/env node
// Pre-generates data/ai-cache.json so the demo never depends on live API access.
// Run once with a key present:  node scripts-build-cache.js
import { writeFileSync } from 'node:fs';
import { verifyAll } from './lib/engine.js';
import { recommend } from './lib/ai.js';

if (!process.env.OPENAI_API_KEY) {
  console.error('OPENAI_API_KEY not set — nothing to cache.');
  process.exit(1);
}

const out = {};
for (const r of await verifyAll()) {
  process.stdout.write(`generating ${r.bidder.id}… `);
  const rec = await recommend(r, { allowLive: true });
  if (rec.source !== 'openai') { console.log(`skipped (${rec.source})`); continue; }
  const { source, ...rest } = rec;
  out[r.bidder.id] = rest;
  console.log('ok');
}
writeFileSync('data/ai-cache.json', JSON.stringify(out, null, 2));
console.log(`\nwrote data/ai-cache.json (${Object.keys(out).length} entries)`);
