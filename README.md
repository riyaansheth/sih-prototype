# AI-Powered Integrated Bid Compliance Verification Platform

**Smart India Hackathon 2026 · Problem Statement 26100**
Ministry of Petroleum & Natural Gas · Chennai Petroleum Corporation Limited (CPCL)

Decision-support tooling for GeM procurement officers. It queries every applicable
government source for a bidder, reconciles the answers against each other and the
submitted documents, scores the result, and hands the officer a briefing.
**It never decides.** Qualification and disqualification remain with the Procurement Officer.

---

## Run it

```bash
npm install
npm run verify        # headless — prints the full assessment for all four bidders
npm run dev           # dashboard at http://localhost:3000
```

The AI paths are optional. Without a key the app falls back to a committed cache,
then to a deterministic template, so nothing in the demo depends on network access.

```bash
cp .env.example .env.local   # then add OPENAI_API_KEY
```

---

## What it does

| Capability | Where |
|---|---|
| Multi-portal integration — 13 sources behind one interface | `lib/connectors.js` |
| Cross-source field reconciliation | `lib/crosscheck.js` |
| Tender-specific eligibility + statutory checks | `lib/rules.js` |
| Weighted compliance score, risk band, gating overrides | `lib/score.js` |
| AI recommendation for the officer | `lib/ai.js` |
| Document extraction from an uploaded certificate | `app/api/extract/route.js` |
| Audit trail with evidence references | `lib/audit.js` |

Sources queried: Udyam/MSME, GSTN (registration + return filing), PAN/Income Tax,
MCA21, EPFO, ESIC, Startup India (DPIIT), NSIC, DigiLocker, Make in India/DPIIT local
content, BIS, OEM authorization, and an aggregated blacklist/debarment scan.

---

## Design decisions worth defending

**Rules decide, AI explains.** The rule engine produces every PASS/WARN/FAIL and the
score. The model only turns that finding set into prose an officer can put on file. A
model that could silently move a status would break the audit requirement and the
reservation of the decision to the officer — both explicit in the problem statement.

**The score is never silently adjusted.** A gating failure (debarment, invalid PAN,
cancelled GSTIN, suspended Udyam on an MSE-reserved tender) overrides the risk band to
CRITICAL and is stated next to the score rather than folded into it. Bidder BID-004
scores 85/100 on documentation and is still CRITICAL — the officer sees both numbers
and the reason.

**Cross-source reconciliation is deterministic.** `Pvt Ltd` vs `Private Limited` is
cleared as a formatting variant. Two different PIN codes across Udyam and GST is a
material mismatch. A proprietorship whose PAN carries the proprietor's personal name is
*not* flagged — that is how proprietorships work, and flagging it would train officers
to ignore the tool.

---

## Portal integration status

Every connector is mock-backed today and returns from `data/bidders.json`.

This is deliberate and disclosed in the UI. None of these sources expose a public API
to a hackathon team: GST requires a GSP licence, MCA21 and Udyam have no public API,
DigiLocker requires partner onboarding. What the prototype delivers is the
**production-shaped interface** — uniform envelope, evidence reference, status
vocabulary — so that swapping any single connector for a live call is a one-function
change with nothing downstream moving.

Claiming live integration we cannot demonstrate would be the wrong trade.

---

## Demo data

Four bidders, each built to exercise a different path:

| Bidder | Score | Risk | What it demonstrates |
|---|---|---|---|
| Shakti Engineering Works | 100 | LOW | The clean path |
| Meridian Tubes | 76 | MEDIUM | Address mismatch across Udyam/GST, 47% local content against a 50% floor, missing BIS licence |
| Orion Steel Traders | 42 | CRITICAL | Suspended Udyam, four unfiled GSTR-3B periods, 206AB flag, EPFO/ESIC arrears |
| Vajra Pipes | 85 | CRITICAL | Clean on every direct check — but MCA director data links it to a debarred entity |

Vajra is the case that justifies the project. It is not on any blacklist. Its Managing
Director also directed *Kalyan Tubes Pvt Ltd*, debarred by IOCL until 2027, from the
same registered address; Vajra was incorporated 139 days after that debarment took
effect. A name-based blacklist search — which is what manual verification does — returns
nothing.

---

## Not built

Authentication, a database, GeM SSO, bulk import, live portal credentials. These are
deployment concerns, not prototype concerns, and are answered as roadmap rather than
faked.
