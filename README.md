# ⚽ Pelipäivä (Matchday Hub)

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![React](https://img.shields.io/badge/React-19.0.0-61DAFB?logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-6.1.0-646CFF?logo=vite&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v4.0-38B2AC?logo=tailwindcss&logoColor=white)
![Dexie.js](https://img.shields.io/badge/Dexie.js-v4.4-00A98F)
![PWA](https://img.shields.io/badge/PWA-100%25%20Local--First-10B981)
![Deployment](https://img.shields.io/badge/Cloudflare%20Pages-LIVE%20%28200%20OK%29-F38020?logo=cloudflare)

> **Suomalaisen juniori- ja amatööriurheilun ottelupäivän tilannekeskus.**  
> 100% Local-First · Zero-Auth / Ei backend-tietokantaa · 100% GDPR-yhteensopiva · Multi-Device (Mobiili-PWA + Google Nest Hub).  
> 🌐 **Live PWA:** [https://pelipaiva.pages.dev](https://pelipaiva.pages.dev)  
> 📺 **Live Ambient Hub:** [https://pelipaiva.pages.dev/ambient](https://pelipaiva.pages.dev/ambient)

---

## 🚨 Golden Engineering Rule: Cloudflare Live Verification Mandate
> **"Nothing is ready until it is confirmed running live in Cloudflare."**
> 
> Local tests passing and build success are necessary prerequisites, but no task, feature, or release is considered **Done** until it is deployed to Cloudflare and actively confirmed with an `HTTP 200` live edge response.

---

## 🧠 The Problem
Finnish sports families juggle 4–5 separate apps before every match:
- Checking kickoff times in **Nimenhuuto** or **MyClub**
- Checking rain radar in **Ilmatieteen laitos (FMI)** or **Foreca**
- Checking parking zones and parking disc rules in **EasyPark / ParkMan / Google Maps**
- Checking league standings and top scorers in **Palloliitto Tulospalvelu / Torneopal / Basket.fi**

## 💡 The Solution
**Pelipäivä** combines all 4 streams into a single, high-contrast, dual-theme **Nova Bento Grid Card** on your phone and an **Ambient Display / Voice Assistant on your Google Nest Hub in the kitchen**. 

All data is stored 100% locally on your device via `IndexedDB (Dexie.js)`. There are zero user accounts, zero tracking cookies, and zero remote databases.

---

## 🏗 Architecture

Built by **traali** using:

| Layer | Technology | Why |
| :--- | :--- | :--- |
| **Frontend Framework** | React 19 + Vite 6 (TypeScript Strict) | Fast ESM builds, sub-second HMR, and <85 KB gzipped initial bundle |
| **Local-First Storage** | Dexie.js v4 (IndexedDB) | 100% client-side privacy, reactive queries (`useLiveQuery`), offline autonomy |
| **Design System** | Tailwind CSS v4 + Nova Dual-Theme Tokens | High-contrast Daylight (#F8FAFC) & Floodlight OLED (#000000) with fluid typography `clamp()` |
| **National Geocoding** | LIPAS.fi API + Finnish Slang Dictionary | 42,000+ Finnish venues + pitch surface data (`tekonurmi`, `luonnonnurmi`, `parketti`) |
| **Weather & Safety** | FMI Open Data WFS + Turf.js | Harmonie (<66h) & ECMWF point forecasts + real-time 30/30 lightning safety reset |
| **Smart Logistics** | Deterministic Symbolic Reasoner | **Nappisvahti** footwear selector, kit clash resolver, and Tieliikennelaki 2020 parking disc logic |
| **Edge Infrastructure** | Cloudflare Pages + Cloudflare Worker | Free-tier edge hosting + privacy-preserving streaming CORS proxy & 7-day KV sync for Nest |

---

## ✨ Key Features

- **👟 Nappisvahti (Footwear & Injury Prevention):** Evaluates pitch surface (LIPAS.fi) and real-time weather (FMI) to recommend exact footwear (`AG`, `FG`, `SG`, `TF Turf`, `Indoor Non-marking`) and warns against dangerous frozen sand turf.
- **⚡ 30/30 Salamavahti (Lightning Safety Rule):** Monitors FMI real-time lightning strikes within a 30 km radius. If a strike occurs $\le 10\text{ km}$, it triggers match suspension alerts and a 30-minute safety countdown.
- **🚗 ParkkiSakko-indeksi & Kiekkokello:** Calculates parking ease score (`🟢 Helppo`, `🟡 Kohtalainen`, `🔴 Ahdas`) and rounds parking disc arrival times per Finnish Road Traffic Act (Tieliikennelaki 2020 § 40).
- **📅 Timezone-Safe .ics Ingestion:** Imports Nimenhuuto, MyClub, Jopox, and Torneopal feeds with automatic volunteer duty detection (`☕ Kahviovuoro`, `⏱️ Toimitsija`).
- **👨‍👩‍👧‍👦 Multi-Child Family Hub:** Aggregates schedules for multiple kids/teams with real-time overlap conflict detection.
- **📺 Google Nest Hub Ambient Screen:** 10-foot Kitchen Display view (`/ambient`) and Google Assistant voice routine integration.

---

## 🚀 Quick Start

### Prerequisites
- Node.js 20+ / 22+
- npm 10+

### Installation
```bash
# 1. Clone the repository
git clone https://github.com/traali/pelipaiva.git
cd pelipaiva

# 2. Install dependencies
npm install

# 3. Run unit tests
npm test

# 4. Start local development server
npm run dev
```

### Production Build & Deploy
```bash
# Automated deploy pipeline (tests -> build -> Cloudflare Pages & Worker deploy)
./deploy.ps1
```

---

## 🔍 Latest Audit — 2026-08-28 · Competitive UI/UX (RED vs BLUE)

**Winner: TEAM RED 89 vs 85 · 13 defects (Sev-1:1 · Sev-2:5 · Sev-3:5 · Sev-4:2) · Tree `7d36def`**

Autonomous Competitive Agent Graph audit executed by **Muse Spark 1.2** (`opencode/muse-spark-1.2-contributor-free`) via **OpenCode** as **Chief of Staff** — TEAM RED (Chaos/Tokens/A11y) vs TEAM BLUE (Cognitive/Funnel/Copy).

- **Sev-1 Blocker:** Offline onboarding with 0 profiles traps user (`src/App.tsx:374` + `src/components/OnboardingWizard.tsx:156`) — no offline guard.
- **Sev-2 A11y:** HUD menu has no focus trap/inert (`src/components/MissionControlHUD.tsx:89`) · SmartImport tabs not keyboard-operable (`src/components/SmartImportModal.tsx:423`) · Double-submit not disabled (`src/App.tsx:201`).
- **Tokens:** `liquid-glass` blur only in dark, `gap-3.5` grid drift, `whistle/15` contrast fail — see `src/styles/tokens.css:7`.
- Full report with line refs, remediation steps, and prioritized backlog: **[docs/AUDIT_2026-08-28_muse-spark_competitive-uiux-audit.md](./docs/AUDIT_2026-08-28_muse-spark_competitive-uiux-audit.md)** · Docs index: [docs/README.md](./docs/README.md)

**COMPETITIVE AI CROSS-CHECK UPDATE (2026-08-24):** Based on full corpus proof-or-deny verification:

- **P0 Critical Gaps:** 11/24 currently OPEN (M-01 hooks crash, M-02 no ErrorBoundary, M-04 spec violation, M-05 fabricated stats, M-07 consent gaps, M-08 demo profile leak, M-10 KV guards, M-11 reconciliation unwired)
- **Priority Escalations:** M-04 ↑ to DAY 1 (active spec violation), M-11 ↑ to DAY 1 (REQ-10/11 non-compliance)
- **Ready for Imminent Fix:** M-03 "HH:24" RangeError, M-06 weather honesty partial, M-14 timeout chain complete, M-15 geocoder improvement

---

## 🧪 Testing & Verification

```bash
# Run Vitest test suites (45 files / 400+ tests)
npm test
```

---

## 🔍 UI/UX Audits

| Date | Auditor | Protocol | Scope | Key Findings |
| :--- | :--- | :--- | :--- | :--- |
| 2026-08-24 | ox-alpha | NEXUS 5-team adversarial | Full codebase | 2 Critical, 7 High, 15 Medium, 7 Low ([details](./docs/AUDIT_2026-08-24T1606_ox-alpha_nexus-uiux-user-flow-review.md)) |
| 2026-08-28 | opencode/mimo-v2.5-free | Autonomous Competitive Agent Graph (Team Red vs Team Blue) | All 32 `.tsx` components, styles, tokens, A11y, data integrity | 5 Sev-1, 13 Sev-2, 14 Sev-3, 8 Sev-4. **Team Red 145 pts, Team Blue 85 pts** ([details](./docs/AUDIT_2026-08-28_opencode-competitive-agent-graph_full-spectrum-uiux-audit.md)) |

**Top-priority items from 2026-08-28 audit:**
1. **Data-loss race condition** in `ingestOfficial.ts` — `bulkDelete` + `bulkPut` without Dexie transaction
2. **3 modals without Radix Dialog** — `EventChatModal`, `FamilyLogisticsModal`, `MatchStatsModal` (no focus trap, no Escape, no `aria-modal`)
3. **No skip-to-content link** — keyboard/SR baseline gap
4. **Non-transactional `clearAllDatabaseData`** — partial DB wipe risk

See [MASTER_FINDINGS_REGISTER.md](./docs/MASTER_FINDINGS_REGISTER.md) for consolidated tracking.

---

## 🔍 UI/UX Competitive Audit (2026-08-28)

A full adversarial + ergonomic UI/UX audit was run by the opencode Competitive Agent Graph (Chief of Staff + Team Red "BREAK" vs Team Blue "OPTIMIZE"). **Team Red won 110–70** across 16 findings (2 Sev-2, 10 Sev-3, 4 Sev-4).

- Full report: [`docs/AUDIT_2026-08-28_ox-competitive-uiux-graph.md`](./docs/AUDIT_2026-08-28_ox-competitive-uiux-graph.md)
- Tracked in: [`docs/MASTER_FINDINGS_REGISTER.md`](./docs/MASTER_FINDINGS_REGISTER.md) as **U-01…U-13** (all OPEN).
- Top fixes: shared focus-trapped `Modal` primitive (resolves U-01 / M-33), sticky-header offset (U-02 / M-40), and `rel="noopener noreferrer"` on all 14 `window.open` calls (U-03).

## 📄 License
MIT © [traali](https://github.com/traali)
