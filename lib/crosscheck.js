// Cross-source field reconciliation.
//
// The same fact (legal name, PAN, address) arrives from several portals. A human
// evaluator eyeballs them; this diffs them and grades each disagreement as a
// harmless formatting variant or a material mismatch worth an officer's time.
// Deterministic on purpose - the LLM layer explains these findings, it does not
// produce them.

const ABBREV = [
  [/\bPVT\b/g, 'PRIVATE'], [/\bLTD\b/g, 'LIMITED'], [/\bCO\b/g, 'COMPANY'],
  [/\bENGG\b/g, 'ENGINEERING'], [/\bINDS\b/g, 'INDUSTRIES'], [/\bMFG\b/g, 'MANUFACTURING'],
  [/\bCORPN\b/g, 'CORPORATION'], [/\bENTP\b/g, 'ENTERPRISES'], [/\bNO\b/g, ''],
];

const STOPWORDS = new Set(['ROAD', 'RD', 'STREET', 'ST', 'NEAR', 'OPP', 'INDIA', 'TAMIL', 'NADU', 'TN']);

function normName(s) {
  let out = String(s ?? '').toUpperCase().replace(/[.,\-_/()&']/g, ' ');
  for (const [re, to] of ABBREV) out = out.replace(re, to);
  return out.replace(/\s+/g, ' ').trim();
}

function addrTokens(s) {
  return new Set(
    String(s ?? '').toUpperCase().replace(/[.,\-_/()&']/g, ' ').split(/\s+/)
      .filter((t) => t && t.length > 1 && !STOPWORDS.has(t))
  );
}

function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const t of a) if (b.has(t)) shared++;
  return shared / (a.size + b.size - shared);
}

const pincode = (s) => (String(s ?? '').match(/\b\d{6}\b/) || [null])[0];

// Which sources carry which field, and how to dig it out of each payload.
const FIELDS = [
  { key: 'legalName', label: 'Legal Name', kind: 'name', from: {
      UDYAM: (d) => d.enterpriseName, GSTN: (d) => d.legalName, ITD_PAN: (d) => d.nameOnPan,
      MCA21: (d) => d.companyName, EPFO: (d) => d.establishmentName, ESIC: (d) => d.employerName } },
  { key: 'pan', label: 'PAN', kind: 'exact', from: {
      UDYAM: (d) => d.pan, GSTN: (d) => d.pan, ITD_PAN: (d) => d.pan } },
  { key: 'address', label: 'Registered Address', kind: 'address', from: {
      UDYAM: (d) => d.registeredAddress, GSTN: (d) => d.principalPlaceOfBusiness, MCA21: (d) => d.registeredOffice } },
  { key: 'incorporationDate', label: 'Date of Incorporation', kind: 'exact', from: {
      UDYAM: (d) => d.dateOfIncorporation, MCA21: (d) => d.dateOfIncorporation } },
];

function grade(kind, values, ctx = {}) {
  const raw = values.map((v) => v.value);
  if (new Set(raw).size === 1) return { severity: 'MATCH', note: 'Identical across all reporting sources.' };

  if (kind === 'exact') {
    return { severity: 'MATERIAL_MISMATCH', note: 'Sources report different values for a field that must be identical.' };
  }

  if (kind === 'name') {
    // A proprietorship has no separate legal identity: its PAN is the proprietor's
    // own PAN and carries their personal name. Comparing it to the trade name is a
    // guaranteed false positive, so exclude it and say why.
    let compared = values;
    let carve = null;
    if (/PROPRIETOR/i.test(ctx.constitution ?? '') && values.length > 2) {
      compared = values.filter((v) => v.source !== 'ITD_PAN');
      carve = values.find((v) => v.source === 'ITD_PAN');
    }
    const norm = new Set(compared.map((v) => normName(v.value)));
    if (norm.size === 1) {
      return carve
        ? { severity: 'BENIGN_VARIANT', note: `Trade name is consistent across sources. PAN is held in the proprietor's personal name ("${carve.value}"), which is expected for a proprietorship and is not a mismatch.` }
        : { severity: 'BENIGN_VARIANT', note: 'Same entity name with formatting/abbreviation differences (e.g. "Pvt Ltd" vs "Private Limited").' };
    }
    return { severity: 'MATERIAL_MISMATCH', note: 'Entity names do not reconcile after normalisation.' };
  }

  // address
  const pins = new Set(raw.map(pincode).filter(Boolean));
  const sims = [];
  for (let i = 0; i < raw.length; i++)
    for (let j = i + 1; j < raw.length; j++) sims.push(jaccard(addrTokens(raw[i]), addrTokens(raw[j])));
  const worst = Math.min(...sims);

  if (pins.size > 1) return { severity: 'MATERIAL_MISMATCH', note: `Different PIN codes reported (${[...pins].join(', ')}). Sources point to different physical locations.`, similarity: worst };
  if (worst >= 0.7) return { severity: 'BENIGN_VARIANT', note: 'Same address, differing formatting or abbreviation.', similarity: worst };
  return { severity: 'MATERIAL_MISMATCH', note: 'Addresses share too little in common to be the same premises.', similarity: worst };
}

/** @param portals output of connectors.queryAll */
export function crossCheck(portals) {
  return FIELDS.map((f) => {
    const values = Object.entries(f.from)
      .map(([src, pick]) => ({ source: src, value: pick(portals[src]?.data ?? {}) }))
      .filter((v) => v.value != null && v.value !== '');
    if (values.length < 2) return { field: f.key, label: f.label, values, severity: 'INSUFFICIENT_DATA', note: 'Fewer than two sources reported this field.' };
    return { field: f.key, label: f.label, values, ...grade(f.kind, values, { constitution: portals.GSTN?.data?.constitution }) };
  });
}

export const materialMismatches = (findings) => findings.filter((f) => f.severity === 'MATERIAL_MISMATCH');
