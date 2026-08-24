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

## 🧪 Testing & Verification

```bash
# Run Vitest test suites (45 files / 400+ tests)
npm test
```

---

## 📄 License
MIT © [traali](https://github.com/traali)
