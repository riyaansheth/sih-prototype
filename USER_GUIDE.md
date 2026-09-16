# User Guide — GeM BidGuard

Step-by-step instructions for running, demonstrating and extending the bid compliance
verification platform.

**Contents**
1. [Prerequisites](#1-prerequisites)
2. [Installation](#2-installation)
3. [Optional — enabling the AI features](#3-optional--enabling-the-ai-features)
4. [Running it](#4-running-it)
5. [Using the dashboard](#5-using-the-dashboard)
6. [The 5-minute demo script](#6-the-5-minute-demo-script)
7. [Customising the platform](#7-customising-the-platform)
8. [Deploying](#8-deploying)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. Prerequisites

| Requirement | Notes |
|---|---|
| **Node.js 20 or newer** | Check with `node -v`. Developed on Node 26. |
| **npm** | Ships with Node |
| **OpenAI API key** | **Optional.** Everything works without one — see step 3 |

---

## 2. Installation

```bash
git clone https://github.com/riyaansheth/sih-prototype.git
cd sih-prototype
npm install
```

Installation takes a few minutes on a slow connection. Wait for it to finish before
running anything.

---

## 3. Optional — enabling the AI features

**The platform is fully functional without an API key.** Skip this section if you just
want to run it.

Two features call OpenAI:

| Feature | Without a key |
|---|---|
| AI recommendation narrative | Falls back to committed cache, then to a deterministic template |
| Live document extraction (Document AI tab) | Returns a clear "not configured" message |

To enable them:

```bash
cp .env.example .env.local
```

Then open `.env.local` and fill in your key:

```
OPENAI_API_KEY=sk-proj-your-key-here
OPENAI_MODEL=gpt-5
```

> **Never commit this file.** It is already in `.gitignore`. Never paste a key into a
> chat, an issue or a screenshot — rotate it immediately at
> <https://platform.openai.com/api-keys> if you do.

### Regenerating the AI cache

`data/ai-cache.json` holds real model output for all four bidders, committed to the repo
so the demo shows genuine AI prose even with no internet. Regenerate it after changing
bidder data or the prompt:

```bash
node --env-file=.env.local scripts-build-cache.js
```

---

## 4. Running it

### Option A — headless (fastest way to see it work)

```bash
npm run verify
```

Prints the full assessment for all four bidders to the terminal: score, risk,
gating failures and every finding. No browser, no build step. Use this to confirm the
engine works before debugging anything in the UI.

Verify a single bidder:

```bash
node verify.js BID-004
```

### Option B — the dashboard

```bash
npm run dev
```

Open <http://localhost:3000>.

### Option C — production build (use this for the actual demo)

```bash
npm run build
npm start
```

Noticeably faster than dev mode. Run the build **before** you present, not during.

---

## 5. Using the dashboard

### Step 1 — Run the verification

Click **Verify All 4 Bidders**.

Bidders are verified one at a time with a short pause between them, so the fan-out is
visible rather than instantaneous. Each card fills in with a score, a risk chip and a
progress bar as its verification completes.

### Step 2 — Read the bidder list

The left column ranks bidders by compliance score, highest first. Each card shows:

- **Legal name** and GeM seller ID
- **Risk chip** — LOW / MEDIUM / HIGH / CRITICAL
- **Score bar** out of 100
- **Quoted value**
- **A red gating-failure banner**, if one applies
- **The officer's recorded decision**, once made

Click any card to open it.

### Step 3 — Read the detail header

The top panel gives the summary:

- **Compliance score** out of 100, with the weighted points behind it (e.g. `123.5 / 136`)
- **Check tally** — how many PASS, WARN, FAIL and N/A
- **Recommendation** — QUALIFY / REVIEW REQUIRED / DO NOT QUALIFY

If a **gating failure** applies, a red band appears explaining which requirement failed
and why the risk level was overridden. This is important: a bidder can score 85/100 on
paperwork and still be CRITICAL. The score is never silently adjusted — you see both the
documentary score and the reason it does not decide the outcome.

### Step 4 — Work through the six tabs

| Tab | What it shows |
|---|---|
| **Compliance Checks** | All 16 checks, gating ones first, then failures. Click any row to reveal the portal evidence references behind it. |
| **Cross-Verification** | The same field pulled from every portal that reports it, side by side, graded MATCH / BENIGN VARIANT / MATERIAL MISMATCH. |
| **Portal Evidence** | Each of the 13 sources with its status. Click to expand the raw JSON response. Simulated sources are labelled as such. |
| **AI Recommendation** | Officer briefing: summary, key risks by severity, suggested actions, and which deficiencies are curable. The badge in the corner says whether it came from a live call, the cache, or the deterministic fallback. |
| **Audit Trail** | Every portal query, rule evaluation, score computation and officer action, timestamped with evidence references. |
| **Document AI** | Documents submitted with the bid, plus a live upload box for real extraction. |

### Step 5 — Record the decision

In the grey strip under the detail header, type a remark and choose one:

- **Qualify**
- **Disqualify**
- **Seek Clarification**

The decision is recorded with a timestamp and officer identifier, appears on the bidder
card, and is appended to the Audit Trail tab.

> Decisions are stored in your browser's `localStorage` under the key `officerDecisions`.
> They persist across reloads but are local to that browser. To clear them, open the
> browser console and run `localStorage.removeItem('officerDecisions')`.

### Step 6 — Try live document extraction

Open the **Document AI** tab and upload an image of any Indian statutory certificate —
a Udyam certificate, GST registration, PAN card.

- **Images only** (PNG/JPG). A PDF returns a clear error asking you to export a page as
  an image.
- Requires `OPENAI_API_KEY` to be configured.

The model returns the document type, extracted fields, identifiers, a legibility rating
and any observations an officer should know about — an expiry date, a status stamp, a
missing signature.

---

## 6. The 5-minute demo script

Use this order when presenting. It builds to the strongest point instead of opening with it.

**Minute 1 — The problem.**
Show the tender header. Point out the requirement chips: MSE-reserved, 50% local content,
turnover floor, EPFO, ESIC, OEM authorization, BIS. Explain that an officer verifies each
of these for every bidder by hand across a dozen captcha-protected portals — roughly 500
lookups for a 40-bidder tender.

**Minute 2 — The automation.**
Click **Verify All**. While it runs, say: 13 government sources, 4 bidders, 52 portal
queries. Let the cards fill in.

**Minute 3 — Depth, not just speed.**
Open **Orion Steel Traders** (score 42). Show the Compliance Checks tab. Make the key
point: their GST registration reads *Active* — a registration-only check passes them —
but they have **four consecutive unfiled GSTR-3B periods**, a suspended Udyam
registration, a Section 206AB flag and ₹2.8 lakh in provident fund arrears. Registration
status alone tells you nothing.

**Minute 4 — Cross-verification.**
Open **Meridian Tubes** (score 76) → **Cross-Verification** tab. Their Udyam record says
Coimbatore, their GST record says Tirupur — different PIN codes, flagged as a material
mismatch. Then show the Legal Name row: `Pvt. Ltd.` vs `Private Limited` was cleared
automatically as a formatting variant. Emphasise that suppressing false positives is what
keeps officers trusting the tool.

**Minute 5 — The case that justifies the project.**
Open **Vajra Pipes**. Score **85**, risk **CRITICAL**.

Walk through it deliberately: active Udyam, GST returns current, valid PAN, BIS licence
valid, 62% local content, EPFO and ESIC clean — and **not on any blacklist**. A manual
check clears this bidder in ten minutes.

Now open the red gating band. Their Managing Director, DIN 02847193, also directed
*Kalyan Tubes Pvt Ltd* — debarred by IOCL until 2027 for supplying non-conforming API 5L
pipe. Same registered address. Vajra was incorporated **139 days after that ban took
effect**.

Close on the line that matters: *a name-based blacklist search returns nothing here, and a
name-based search is what manual verification is.* Then open the **Audit Trail** tab to
show that every step of that finding is on record.

---

## 7. Customising the platform

### Change the tender requirements

Edit `data/tender.json`. The `requirements` block drives which checks apply and what they
compare against:

```json
{
  "msmeReserved": true,
  "minLocalContentPct": 50,
  "minAnnualTurnover": 20000000,
  "epfoRequired": true,
  "esicRequired": true,
  "oemAuthorizationRequired": true,
  "bisCertificationRequired": true
}
```

Set `msmeReserved` to `false` and the MSME check becomes non-gating and reports N/A.
Raise `minLocalContentPct` to 70 and bidders currently passing will fail. No code changes.

### Add a bidder

Append an entry to `data/bidders.json`. Copy an existing bidder and edit it — every
bidder needs all 13 keys under `portals`. It will appear in the dashboard automatically.

### Add a compliance check

Add an entry to the `CHECKS` array in `lib/rules.js`:

```js
{
  id: 'MY_CHECK', label: 'My Check', category: 'Statutory', weight: 8,
  gate: false,                       // true = a FAIL forces CRITICAL
  run: (portals, tender, cross, bidder, asOf) => ({
    status: 'PASS',                  // PASS | WARN | FAIL | NA
    detail: 'Explain the result in a sentence an officer can put on file.',
    evidence: [],
  }),
}
```

Scoring, the dashboard, and the audit trail pick it up with no further changes.

### Replace a simulated portal with a real one

Every connector returns the same envelope, so this is a single-function change. In
`lib/connectors.js`, replace the lookup inside `query()` for that source with a real HTTP
call returning `{ status, data, evidence }`, and set `live: true` on its entry in
`SOURCES`. Nothing downstream changes.

---

## 8. Deploying

The project is wired to Vercel and redeploys on every push to `main`.

**First-time setup:**

1. Import the GitHub repo at <https://vercel.com/new> — Next.js is detected automatically
2. **Settings → Environment Variables** — add `OPENAI_API_KEY` and `OPENAI_MODEL`
3. **Settings → Deployment Protection → Vercel Authentication → Disabled**, otherwise
   visitors hit a Vercel login wall instead of your site

> `*.vercel.app` subdomains are globally unique. If your preferred name is taken, your
> project receives a suffixed URL instead. Find the real one under **Settings → Domains** —
> do not assume it matches the repository name.

---

## 9. Troubleshooting

| Symptom | Cause and fix |
|---|---|
| **Visitors see a Vercel login page** | Deployment Protection is on. Settings → Deployment Protection → Vercel Authentication → Disabled. |
| **The deployed URL shows someone else's site** | That subdomain belongs to a different Vercel project. Get your actual URL from Settings → Domains. |
| **AI Recommendation says "Deterministic fallback"** | No API key, or the call failed. Confirm `.env.local` exists and restart the dev server — env files are read at startup. |
| **Document AI returns "not configured"** | `OPENAI_API_KEY` is missing in that environment. On Vercel, add it under Environment Variables and redeploy. |
| **Document upload rejected** | Only images are accepted. Export the certificate page as PNG or JPG. |
| **`npm run verify` fails on import** | Node is older than 20 and lacks JSON import attributes. Upgrade Node. |
| **Officer decisions vanished** | They live in `localStorage`, so they are per-browser and cleared by private windows or site-data resets. |
| **Changes to `.env.local` have no effect** | Restart the server. Environment files are read once at startup. |

---

## Quick reference

```bash
npm install                                        # install dependencies
npm run verify                                     # headless verification, all bidders
node verify.js BID-004                             # one bidder
npm run dev                                        # dashboard, development
npm run build && npm start                         # production build — use for demos
node --env-file=.env.local scripts-build-cache.js  # regenerate the AI cache
```

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/verify?bidder=BID-001` | GET | Full verification result |
| `/api/recommend?bidder=BID-001` | GET | AI officer briefing |
| `/api/extract` | POST | Document extraction (multipart, field `file`) |

---

**Decision-support tool.** Qualification and disqualification remain with the Procurement Officer.
