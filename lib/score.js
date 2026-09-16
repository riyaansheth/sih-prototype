// Compliance score and risk classification.
//
// Fully transparent: every point traces to a weighted check, and a gate failure
// is stated alongside the score rather than folded into it. An officer must be
// able to ask "why 85?" and get an arithmetic answer - and must also see that a
// bidder scoring 85 on paperwork can still be CRITICAL on integrity grounds.

const VALUE = { PASS: 1, WARN: 0.5, FAIL: 0 };   // NA is excluded from the denominator

export const BANDS = [
  { min: 85, risk: 'LOW',      recommendation: 'QUALIFY' },
  { min: 65, risk: 'MEDIUM',   recommendation: 'REVIEW_REQUIRED' },
  { min: 40, risk: 'HIGH',     recommendation: 'REVIEW_REQUIRED' },
  { min: 0,  risk: 'CRITICAL', recommendation: 'DO_NOT_QUALIFY' },
];

export function scoreChecks(checks) {
  const applicable = checks.filter((c) => c.status !== 'NA');
  const totalWeight = applicable.reduce((a, c) => a + c.weight, 0);
  const earned = applicable.reduce((a, c) => a + c.weight * VALUE[c.status], 0);
  const score = totalWeight ? Math.round((earned / totalWeight) * 100) : 0;

  const failedGates = checks.filter((c) => c.gate && c.status === 'FAIL');
  const band = BANDS.find((b) => score >= b.min);

  return {
    // The document score stands on its own and is never silently adjusted.
    score,
    scoreRisk: band.risk,
    // A failed gate overrides the band outright - no amount of clean paperwork
    // cures debarment, an invalid PAN or a cancelled GSTIN.
    risk: failedGates.length ? 'CRITICAL' : band.risk,
    recommendation: failedGates.length ? 'DO_NOT_QUALIFY' : band.recommendation,
    overriddenByGate: failedGates.length > 0,
    gateFailures: failedGates.map((c) => ({ id: c.id, label: c.label, detail: c.detail })),
    breakdown: applicable
      .map((c) => ({ id: c.id, label: c.label, category: c.category, status: c.status, weight: c.weight, pointsEarned: +(c.weight * VALUE[c.status]).toFixed(1) }))
      .sort((a, b) => (b.weight - a.weight) || a.label.localeCompare(b.label)),
    totalWeight,
    earnedWeight: +earned.toFixed(1),
    notApplicable: checks.filter((c) => c.status === 'NA').map((c) => c.id),
  };
}
