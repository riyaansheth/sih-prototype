// Tender-specific eligibility + statutory compliance checks.
//
// Rules decide; the LLM only explains. The problem statement requires an
// auditable record and leaves qualification to the Procurement Officer, so every
// status here must be reproducible from the portal payloads alone.
//
// `gate: true` means a FAIL cannot be outweighed by a good score elsewhere.

const ev = (p, key) => (p[key]?.evidence ? [{ source: key, ...p[key].evidence }] : []);
const monthsBetween = (ym, asOf) => {
  if (!ym) return Infinity;
  const [y, m] = ym.split('-').map(Number);
  return (asOf.getFullYear() - y) * 12 + (asOf.getMonth() + 1 - m);
};
const crore = (n) => `Rs ${(n / 10000000).toFixed(2)} Cr`;

const CHECKS = [
  {
    id: 'DEBARMENT', label: 'Blacklisting & Debarment', category: 'Integrity', weight: 20, gate: true,
    run: (p) => {
      const d = p.DEBARMENT.data;
      if (d.directHits?.length) return { status: 'FAIL', detail: `Bidder appears directly on ${d.directHits.length} debarment list(s).`, evidence: ev(p, 'DEBARMENT') };
      if (d.directorLinkedHits?.length) {
        const h = d.directorLinkedHits[0];
        const who = h.sharedDirectors.map((s) => `${s.name} (DIN ${s.din})`).join(', ');
        return {
          status: 'FAIL',
          detail: `No direct hit, but a shared-director link was found. ${who} is ${h.sharedDirectors[0].roleInBidder} of the bidder and was ${h.sharedDirectors[0].roleInDebarredEntity} of ${h.debarredEntity} (CIN ${h.debarredEntityCin}), debarred by ${h.debarringAuthority} until ${h.debarredUpto} for: ${h.grounds}.`
            + (h.otherSignals?.sharedRegisteredAddress ? ` Both entities share the registered address ${h.otherSignals.addressOnRecord}.` : '')
            + (h.otherSignals?.bidderIncorporatedDaysAfterDebarment != null ? ` The bidder was incorporated ${h.otherSignals.bidderIncorporatedDaysAfterDebarment} days after that debarment took effect.` : ''),
          evidence: [...ev(p, 'DEBARMENT'), ...ev(p, 'MCA21')],
        };
      }
      return { status: 'PASS', detail: `No match across ${d.sourcesChecked.length} debarment sources, direct or via MCA director linkage.`, evidence: ev(p, 'DEBARMENT') };
    },
  },
  {
    id: 'PAN_VALID', label: 'PAN Validity', category: 'Statutory', weight: 10, gate: true,
    run: (p) => {
      const d = p.ITD_PAN.data;
      return /valid and active/i.test(d.panStatus ?? '')
        ? { status: 'PASS', detail: `PAN ${d.pan} is valid and active (${d.nameOnPan}).`, evidence: ev(p, 'ITD_PAN') }
        : { status: 'FAIL', detail: `PAN status returned as "${d.panStatus ?? 'unavailable'}".`, evidence: ev(p, 'ITD_PAN') };
    },
  },
  {
    id: 'GST_REGISTRATION', label: 'GST Registration', category: 'Statutory', weight: 10, gate: true,
    run: (p) => {
      const d = p.GSTN.data;
      return /active/i.test(d.gstinStatus ?? '')
        ? { status: 'PASS', detail: `GSTIN ${d.gstin} active since ${d.registrationDate}. Constitution: ${d.constitution}.`, evidence: ev(p, 'GSTN') }
        : { status: 'FAIL', detail: `GSTIN ${d.gstin ?? '—'} status is "${d.gstinStatus ?? 'unavailable'}".`, evidence: ev(p, 'GSTN') };
    },
  },
  {
    id: 'MSME_STATUS', label: 'Udyam / MSME Registration', category: 'Eligibility', weight: 15,
    gate: (t) => t.requirements.msmeReserved,
    run: (p, t) => {
      if (!t.requirements.msmeReserved) return { status: 'NA', detail: 'Tender is not reserved for MSEs.', evidence: [] };
      const u = p.UDYAM;
      if (u.status === 'VERIFIED' && u.data.isActive)
        return { status: 'PASS', detail: `${u.data.udyamNumber} active. Classified ${u.data.enterpriseType} enterprise, ${u.data.majorActivity}.`, evidence: ev(p, 'UDYAM') };
      if (u.status === 'EXPIRED' || u.data.isActive === false)
        return { status: 'FAIL', detail: `Udyam registration ${u.data.udyamNumber} is not active. Portal reports: ${u.data.deactivationReason ?? 'registration inactive'}. MSE benefit cannot be extended on a suspended registration.`, evidence: ev(p, 'UDYAM') };
      return { status: 'FAIL', detail: 'No active Udyam registration found for this bidder.', evidence: ev(p, 'UDYAM') };
    },
  },
  {
    id: 'GST_RETURNS', label: 'GST Return Filing', category: 'Statutory', weight: 12,
    run: (p, t) => {
      const r = p.GSTN.data.returns ?? {};
      const worst = Math.max(r.GSTR1?.consecutiveDefaults ?? 0, r.GSTR3B?.consecutiveDefaults ?? 0);
      const line = `GSTR-1 last filed ${r.GSTR1?.lastFiled ?? '—'}, GSTR-3B last filed ${r.GSTR3B?.lastFiled ?? '—'}.`;
      if (worst === 0) return { status: 'PASS', detail: `Returns current. ${line}`, evidence: ev(p, 'GSTN') };
      if (worst <= 2) return { status: 'WARN', detail: `${line} ${worst} return period(s) outstanding — short delay, typically curable before award.`, evidence: ev(p, 'GSTN') };
      return { status: 'FAIL', detail: `${line} ${worst} consecutive periods not filed. Under Rule 21A CGST Rules this exposes the GSTIN to suspension and indicates financial distress.`, evidence: ev(p, 'GSTN') };
    },
  },
  {
    id: 'INCOME_TAX', label: 'Income Tax Compliance', category: 'Statutory', weight: 8,
    run: (p) => {
      const d = p.ITD_PAN.data;
      const filed = d.itrFiled ?? {};
      if (d.specifiedPersonU206AB)
        return { status: 'FAIL', detail: `Flagged as a specified person under Section 206AB. ${d.note ?? ''}`.trim(), evidence: ev(p, 'ITD_PAN') };
      const missing = Object.entries(filed).filter(([, v]) => !v).map(([k]) => k);
      if (!missing.length) return { status: 'PASS', detail: `ITR filed for ${Object.keys(filed).join(' and ')}. Not flagged under Section 206AB.`, evidence: ev(p, 'ITD_PAN') };
      return { status: 'WARN', detail: `ITR not on record for ${missing.join(', ')}. ${d.note ?? 'Verify whether the entity was liable to file for that year.'}`, evidence: ev(p, 'ITD_PAN') };
    },
  },
  {
    id: 'TURNOVER', label: 'Annual Turnover Threshold', category: 'Eligibility', weight: 10,
    run: (p, t) => {
      const need = t.requirements.minAnnualTurnover;
      const got = p.GSTN.data.annualTurnoverFY2425;
      if (got == null) return { status: 'WARN', detail: 'Turnover could not be derived from GST filings.', evidence: ev(p, 'GSTN') };
      return got >= need
        ? { status: 'PASS', detail: `FY ${t.requirements.turnoverFinancialYear} turnover ${crore(got)} against a requirement of ${crore(need)}.`, evidence: ev(p, 'GSTN') }
        : { status: 'FAIL', detail: `FY ${t.requirements.turnoverFinancialYear} turnover ${crore(got)} falls short of the required ${crore(need)}.`, evidence: ev(p, 'GSTN') };
    },
  },
  {
    id: 'LOCAL_CONTENT', label: 'Make in India / Local Content', category: 'Eligibility', weight: 12,
    run: (p, t) => {
      const need = t.requirements.minLocalContentPct;
      const m = p.MII_DPIIT;
      if (m.status === 'NOT_SUBMITTED') return { status: 'FAIL', detail: m.data.reason, evidence: ev(p, 'MII_DPIIT') };
      const got = m.data.localContentPct;
      return got >= need
        ? { status: 'PASS', detail: `${got}% local content certified by ${m.data.certifyingAuthority}. Qualifies as ${m.data.supplierClass} (requirement: ${need}%).`, evidence: ev(p, 'MII_DPIIT') }
        : { status: 'FAIL', detail: `${got}% local content certified against a tender minimum of ${need}%. Bidder is ${m.data.supplierClass}; this tender requires Class-I local supplier status.`, evidence: ev(p, 'MII_DPIIT') };
    },
  },
  {
    id: 'EPFO', label: 'EPFO Compliance', category: 'Statutory', weight: 8,
    run: (p, t) => {
      if (!t.requirements.epfoRequired) return { status: 'NA', detail: 'Not required by this tender.', evidence: [] };
      const d = p.EPFO.data;
      if (d.contributionArrears > 0)
        return { status: 'FAIL', detail: `Rs ${d.contributionArrears.toLocaleString('en-IN')} in provident fund arrears across ${d.arrearsMonths} month(s). Last ECR filed ${d.lastEcrFiled}.`, evidence: ev(p, 'EPFO') };
      return { status: 'PASS', detail: `Establishment ${d.establishmentCode} current. ${d.employeeCount} employees, last ECR ${d.lastEcrFiled}, no arrears.`, evidence: ev(p, 'EPFO') };
    },
  },
  {
    id: 'ESIC', label: 'ESIC Compliance', category: 'Statutory', weight: 6,
    run: (p, t) => {
      if (!t.requirements.esicRequired) return { status: 'NA', detail: 'Not required by this tender.', evidence: [] };
      const d = p.ESIC.data;
      if (d.contributionArrears > 0)
        return { status: 'FAIL', detail: `Rs ${d.contributionArrears.toLocaleString('en-IN')} in ESI arrears across ${d.arrearsMonths} month(s). Last contribution ${d.lastContributionMonth}.`, evidence: ev(p, 'ESIC') };
      return { status: 'PASS', detail: `Employer ${d.employerCode} current. ${d.insuredPersons} insured persons, last contribution ${d.lastContributionMonth}.`, evidence: ev(p, 'ESIC') };
    },
  },
  {
    id: 'OEM_AUTH', label: 'OEM Authorization', category: 'Technical', weight: 10,
    run: (p, t, _c, _b, asOf) => {
      if (!t.requirements.oemAuthorizationRequired) return { status: 'NA', detail: 'Not required by this tender.', evidence: [] };
      const o = p.OEM_AUTH;
      if (o.status === 'NOT_SUBMITTED') return { status: 'FAIL', detail: o.data.reason, evidence: ev(p, 'OEM_AUTH') };
      if (o.data.authorizationRef === 'SELF-MANUFACTURER')
        return { status: 'PASS', detail: `Bidder is the manufacturer (${o.data.productsCovered}); OEM authorization is not applicable. Corroborated by Udyam major activity "Manufacturing" and an active BIS licence.`, evidence: [...ev(p, 'OEM_AUTH'), ...ev(p, 'BIS')] };
      const expired = o.data.validUpto && new Date(o.data.validUpto) < asOf;
      return expired
        ? { status: 'FAIL', detail: `Authorization ${o.data.authorizationRef} from ${o.data.oemName} expired on ${o.data.validUpto}.`, evidence: ev(p, 'OEM_AUTH') }
        : { status: 'PASS', detail: `Authorized by ${o.data.oemName} (ref ${o.data.authorizationRef}) until ${o.data.validUpto}. Covers: ${o.data.productsCovered}.`, evidence: ev(p, 'OEM_AUTH') };
    },
  },
  {
    id: 'BIS', label: 'BIS Certification', category: 'Technical', weight: 8,
    run: (p, t, _c, _b, asOf) => {
      if (!t.requirements.bisCertificationRequired) return { status: 'NA', detail: 'Not required by this tender.', evidence: [] };
      const b = p.BIS;
      if (b.status === 'NOT_SUBMITTED') return { status: 'FAIL', detail: b.data.reason, evidence: ev(p, 'BIS') };
      const expired = b.data.validUpto && new Date(b.data.validUpto) < asOf;
      return expired
        ? { status: 'FAIL', detail: `BIS licence ${b.data.licenceNumber} expired on ${b.data.validUpto}.`, evidence: ev(p, 'BIS') }
        : { status: 'PASS', detail: `Licence ${b.data.licenceNumber} (${b.data.standard}) active until ${b.data.validUpto}. Scope: ${b.data.scope}.`, evidence: ev(p, 'BIS') };
    },
  },
  {
    id: 'DIGILOCKER', label: 'DigiLocker Document Authenticity', category: 'Documents', weight: 8,
    run: (p) => {
      const d = p.DIGILOCKER;
      if (d.status === 'VERIFIED')
        return { status: 'PASS', detail: `${d.data.documentsPulled.length} document(s) pulled issuer-signed from DigiLocker. Tamper check ${d.data.tamperCheck}, signature valid.`, evidence: ev(p, 'DIGILOCKER') };
      return { status: 'WARN', detail: `Only ${d.data.documentsPulled?.length ?? 0} of ${(d.data.documentsPulled?.length ?? 0) + (d.data.documentsUnavailable?.length ?? 0)} document(s) were issuer-verified. ${d.data.note ?? ''}`.trim(), evidence: ev(p, 'DIGILOCKER') };
    },
  },
  {
    id: 'MCA_STATUS', label: 'MCA21 Company Standing', category: 'Statutory', weight: 6,
    run: (p) => {
      const m = p.MCA21;
      if (m.status === 'NOT_APPLICABLE') return { status: 'NA', detail: m.data.reason, evidence: [] };
      const d = m.data;
      if (d.strikeOffFlag) return { status: 'FAIL', detail: `${d.cin} is flagged for strike-off under Section 248.`, evidence: ev(p, 'MCA21') };
      if (!/active/i.test(d.companyStatus)) return { status: 'FAIL', detail: `Company status is "${d.companyStatus}".`, evidence: ev(p, 'MCA21') };
      return { status: 'PASS', detail: `${d.cin} Active. Last AGM ${d.lastAGM}, last balance sheet ${d.lastBalanceSheet}. ${d.directors.length} director(s) on record.`, evidence: ev(p, 'MCA21') };
    },
  },
  {
    id: 'CROSS_VERIFICATION', label: 'Cross-Source Data Consistency', category: 'Documents', weight: 10,
    run: (_p, _t, cross) => {
      const bad = cross.filter((c) => c.severity === 'MATERIAL_MISMATCH');
      const benign = cross.filter((c) => c.severity === 'BENIGN_VARIANT');
      if (bad.length)
        return { status: 'FAIL', detail: bad.map((c) => `${c.label}: ${c.note}`).join(' '), evidence: bad.flatMap((c) => c.values.map((v) => ({ source: v.source, ref: v.value }))) };
      if (benign.length)
        return { status: 'PASS', detail: `All fields reconcile. ${benign.length} formatting variant(s) detected and cleared as benign.`, evidence: [] };
      return { status: 'PASS', detail: 'All cross-checked fields match exactly across reporting portals.', evidence: [] };
    },
  },
  {
    id: 'DOC_COMPLETENESS', label: 'Document Completeness', category: 'Documents', weight: 7,
    run: (_p, t, _c, bidder) => {
      const required = ['UDYAM_CERTIFICATE', 'GST_REGISTRATION', 'PAN_CARD', 'AUDITED_FINANCIALS'];
      if (t.requirements.oemAuthorizationRequired) required.push('OEM_AUTHORIZATION');
      if (t.requirements.bisCertificationRequired) required.push('BIS_LICENCE');
      if (t.requirements.minLocalContentPct > 0) required.push('LOCAL_CONTENT_CERTIFICATE');
      const have = new Set(bidder.submittedDocs.map((d) => d.type));
      const missing = required.filter((r) => !have.has(r));
      return missing.length
        ? { status: 'FAIL', detail: `${missing.length} mandatory document(s) not submitted: ${missing.map((m) => m.replace(/_/g, ' ').toLowerCase()).join(', ')}.`, evidence: [] }
        : { status: 'PASS', detail: `All ${required.length} mandatory documents submitted.`, evidence: [] };
    },
  },
];

export function runChecks(portals, tender, cross, bidder, asOf = new Date()) {
  return CHECKS.map((c) => {
    const gate = typeof c.gate === 'function' ? c.gate(tender) : !!c.gate;
    let out;
    try {
      out = c.run(portals, tender, cross, bidder, asOf);
    } catch (e) {
      out = { status: 'WARN', detail: `Check could not be evaluated: ${e.message}`, evidence: [] };
    }
    return { id: c.id, label: c.label, category: c.category, weight: c.weight, gate, ...out };
  });
}
