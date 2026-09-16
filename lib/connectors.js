import bidders from '../data/bidders.json' with { type: 'json' };

// Every government source is reached through this one interface. Each connector
// returns the same envelope, so swapping a mock for a live API (GSP credential,
// DigiLocker partner key, MCA21 subscription) is a one-function change and
// nothing downstream moves.
//
// ponytail: all 13 connectors are mock-backed by data/bidders.json. Replace the
// `fetch` of any single entry with a real HTTP call when credentials exist.

export const SOURCES = [
  { key: 'UDYAM',         label: 'Udyam / MSME Registration',   portal: 'udyamregistration.gov.in', live: false },
  { key: 'GSTN',          label: 'GST Registration & Returns',  portal: 'services.gst.gov.in',      live: false },
  { key: 'ITD_PAN',       label: 'PAN / Income Tax',            portal: 'incometax.gov.in',         live: false },
  { key: 'MCA21',         label: 'MCA21 Company Master Data',   portal: 'mca.gov.in',               live: false },
  { key: 'EPFO',          label: 'EPFO Establishment',          portal: 'epfindia.gov.in',          live: false },
  { key: 'ESIC',          label: 'ESIC Employer',               portal: 'esic.gov.in',              live: false },
  { key: 'STARTUP_INDIA', label: 'Startup India (DPIIT)',       portal: 'startupindia.gov.in',      live: false },
  { key: 'NSIC',          label: 'NSIC Single Point Reg.',      portal: 'nsic.co.in',               live: false },
  { key: 'DIGILOCKER',    label: 'DigiLocker Document Pull',    portal: 'digilocker.gov.in',        live: false },
  { key: 'MII_DPIIT',     label: 'Make in India / Local Content', portal: 'dpiit.gov.in',           live: false },
  { key: 'BIS',           label: 'BIS Licence',                 portal: 'manakonline.in',           live: false },
  { key: 'OEM_AUTH',      label: 'OEM Authorization',           portal: 'manual + OEM',             live: false },
  { key: 'DEBARMENT',     label: 'Blacklist / Debarment Scan',  portal: 'aggregated',               live: false },
];

const byId = Object.fromEntries(bidders.map((b) => [b.id, b]));

export function listBidders() {
  return bidders.map(({ id, legalName, gemSellerId, quotedValue }) => ({ id, legalName, gemSellerId, quotedValue }));
}

export function getBidder(bidderId) {
  const b = byId[bidderId];
  if (!b) throw new Error(`Unknown bidder: ${bidderId}`);
  return b;
}

/** Query one source for one bidder. Mirrors what a real adapter would return. */
export async function query(sourceKey, bidderId, { delay = 0 } = {}) {
  const source = SOURCES.find((s) => s.key === sourceKey);
  if (!source) throw new Error(`Unknown source: ${sourceKey}`);
  if (delay) await new Promise((r) => setTimeout(r, delay));

  const hit = getBidder(bidderId).portals[sourceKey];
  if (!hit) {
    return { source: sourceKey, label: source.label, status: 'ERROR', data: {}, fetchedAt: new Date().toISOString(), evidence: { ref: null, portal: source.portal }, mock: !source.live, error: 'No response recorded for this source' };
  }
  return { source: sourceKey, label: source.label, ...hit, fetchedAt: new Date().toISOString(), mock: !source.live };
}

/** Fan out across every source. Real adapters would rate-limit here. */
export async function queryAll(bidderId, opts) {
  const results = await Promise.all(SOURCES.map((s) => query(s.key, bidderId, opts)));
  return Object.fromEntries(results.map((r) => [r.source, r]));
}
