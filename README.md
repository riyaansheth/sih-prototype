# GeM BidGuard

### AI-Powered Integrated Bid Compliance Verification Platform for GeM Procurement

**Smart India Hackathon 2026**

[![Problem Statement](https://img.shields.io/badge/Problem_Statement-26100-0f172a)]()
[![Category](https://img.shields.io/badge/Category-Software-475569)]()
[![Theme](https://img.shields.io/badge/Theme-Smart_Automation-475569)]()

---

## The Problem Statement

| | |
|---|---|
| **ID** | 26100 |
| **Title** | AI-Powered Integrated Bid Compliance Verification Platform for GeM Procurement |
| **Organization** | Ministry of Petroleum & Natural Gas |
| **Department** | Chennai Petroleum Corporation Limited (CPCL) |
| **Category** | Software |
| **Theme** | Smart Automation |

### What it asks for

Government procurement through GeM requires an officer to verify every bidder's statutory
and eligibility claims — Udyam/MSME registration, GST registration **and return filing**,
PAN and income tax compliance, Make in India local content, EPFO/ESIC dues, Startup India,
NSIC, OEM authorization, DigiLocker document authenticity, and blacklisting/debarment
status.

Today this means opening a dozen captcha-protected government portals and checking each
one by hand, for every bidder, on every tender. A 40-bidder tender is roughly **500 manual
lookups**. It is slow, inconsistent between officers, and exactly the kind of repetitive
work where things get missed.

The problem statement asks for a platform that automates the verification, uses AI to
identify missing and inconsistent information, produces a compliance score and risk level,
and gives the officer a recommendation — while **leaving the qualification decision
entirely with the Procurement Officer**. Target impact: **60–80% reduction in verification
effort**.

---

## Our Solution

A **Requirement-to-Evidence** compliance engine. Each tender becomes a structured
checklist, and every requirement on it is resolved against evidence from two independent
streams — **government portal records** and the **bidder's submitted documents**. No
requirement is marked compliant without a citable source.

```
Tender Requirements → Multi-Portal Evidence → Document Extraction
      → Cross-Source Reconciliation → Scoring & Risk → Officer Briefing + Audit Record
```

### Core design principle: rules decide, AI explains

A deterministic rule engine produces every compliance status and the score. The language
model is confined to what it is genuinely better at — reading unstructured documents and
writing the officer's briefing. **It cannot alter a status, a score or a recommendation.**

This is not a stylistic choice. The problem statement demands an auditable record and
reserves the decision for a human officer; under Indian administrative law, "the model
scored them 34" is not a defensible ground if a disqualification is challenged in court.

### What makes it different

**Relationship-aware debarment detection.** Blacklists are searched by company name today,
so a debarred promoter simply incorporates a new company. We resolve debarment through the
**MCA21 director graph** — matching bidders to debarred entities by shared DIN, shared
registered address and incorporation timing.

In our validation set, a bidder that is clean on every direct check (active Udyam, current
GST filings, valid PAN, **absent from every blacklist**) links through its Managing
Director to an entity debarred by IOCL until 2027, at the same registered address,
incorporated 139 days after that ban took effect. A name-based search returns nothing —
and a name-based search is what manual verification is.

---

## Tech Stack

### Prototype

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) — UI and API in one deployable |
| UI | React 19, Tailwind CSS 4 |
| Runtime | Node.js 20+, native ESM |
| AI | OpenAI SDK — `gpt-5` |
| Storage | JSON files (no database) |
| Deployment | Vercel, auto-deploy on push |

**4 runtime dependencies, ~1,340 lines.** No state library, no component library, no ORM.

### Production path

| Concern | Production choice | Why |
|---|---|---|
| Portal calls | Queue + workers (BullMQ/Redis) | Real portals are slow and rate-limited; serverless times out on a 500-call fan-out |
| Database | PostgreSQL | Runs, bidders and decisions must survive a restart |
| Audit trail | Append-only, hash-chained, WORM | Tamper-evidence for legal weight |
| Documents | S3-compatible object storage | Durable retention of submitted files |
| OCR | Dedicated OCR before the model | Real bid documents are scanned and multi-page |
| Auth | SSO + role-based access control | Every audit entry needs a real identity |
| Portal access | GSP licence (GST), DigiLocker partner, MCA21 subscription | The real integration work |
| Secrets | Vault / KMS | Government credentials cannot live in env files |

The verification engine in `lib/` is pure functions with no I/O assumptions, so it lifts
out into a service unchanged.

---

## Quick Start

```bash
git clone https://github.com/riyaansheth/sih-prototype.git
cd sih-prototype
npm install

npm run verify    # headless — full assessment for all bidders in the terminal
npm run dev       # dashboard at http://localhost:3000
```

An OpenAI key is **optional** — without one the platform falls back to a committed cache,
then to a deterministic template. Nothing in the demo depends on network access.

**→ Full instructions: [USER_GUIDE.md](USER_GUIDE.md)**
**→ Design rationale and trade-offs: [ARCHITECTURE.md](ARCHITECTURE.md)**
**→ Idea submission document: [docs/SIH26100-Proposed-Solution.pdf](docs/SIH26100-Proposed-Solution.pdf)**

---

## What It Does

| Capability | Implementation |
|---|---|
| Multi-portal integration | 13 sources behind one uniform connector interface |
| Cross-source reconciliation | Same field from every portal that reports it, diffed and graded |
| Compliance engine | 16 checks; applicability driven by tender configuration |
| Scoring & risk | Weighted score, risk bands, gating overrides |
| AI recommendation | Officer briefing with three-step fallback |
| Document AI | Extraction from uploaded certificates |
| Audit trail | Every query, rule and decision with evidence references |

**Sources integrated:** Udyam/MSME · GSTN (registration + returns) · PAN/Income Tax ·
MCA21 · EPFO · ESIC · Startup India (DPIIT) · NSIC · DigiLocker · DPIIT Local Content ·
BIS · OEM Authorization · Aggregated Debarment Registry

### Validation set

| Bidder | Score | Risk | Exercises |
|---|---|---|---|
| Shakti Engineering Works | 100 | LOW | Clean path |
| Vajra Pipes | **85** | **CRITICAL** | Clean paperwork, debarment via director graph |
| Meridian Tubes | 76 | MEDIUM | Address mismatch, local content shortfall, missing BIS |
| Orion Steel Traders | 42 | CRITICAL | Suspended Udyam, GST defaults, 206AB, PF arrears |

---

## Team

**Atlas SkillTech University** · B.Tech Computer Science (AI & ML) · 2024–2028

| Role | Name | Email |
|---|---|---|
| **Team Leader** | Riyaan Sheth | riyaan.sheth.btech2028@atlasskilltech.university |
| Team Member | Dhruvi Jain | dhruvi.jain.btech2028@atlasskilltech.university |
| Team Member | Manyata Kothari | manyata.kothari.btech2028@atlasskilltech.university |
| Team Member | Ruchita Wagh | ruchita.wagh.btech2028@atlasskilltech.university |
| Team Member | Niharika Mathur | niharika.mathur.btech2028@atlasskilltech.university |
| Team Member | Aayushi Purohit | aayushi.purohit.btech2028@atlasskilltech.university |

---

## Scope & Disclosure

**Portal connectors are simulated.** None of these sources expose a public API to a
student team — GST requires a GSP licence, MCA21 and Udyam have no public API, DigiLocker
requires partner onboarding. What this prototype delivers is the **production-shaped
interface**: uniform envelope, evidence reference, status vocabulary — so swapping any
connector for a live call is a one-function change. This is disclosed in the UI on every
portal response.

**Not built:** authentication, database, GeM SSO, bulk import. These are deployment
concerns and are answered as roadmap rather than faked.

---

> **Decision-support tool.** Qualification and disqualification remain with the
> Procurement Officer. The AI functions as a verification and decision-support aid only.
