# 00 — Recon

**Repo:** https://github.com/traali/pelipaiva  
**SHA:** `20bad06e559d77310bd8cc1971c2e1f1ff988f95` (short `20bad06`)  
**Date:** 2026-08-30  
**Default branch:** `main` (also local `feature/family-mission-control` @ `1988efb`, not studied as current)  
**Tags:** none  
**Contributors (git shortlog):** empty in this clone (single-author history; LICENSE © 2026 traali)

## What this repo is (new-hire paragraph)

Pelipäivä / FamDay is a **Finnish family sports weekend PWA**: local-first React+Vite app on Cloudflare Pages, IndexedDB (Dexie v2) as device source of truth, a Cloudflare Worker as CORS proxy + fail-closed family roster bus (KV, issued Crockford codes). Parents import Palloliitto/Salibandy/Basket/Torneopal URLs and `.ics` (Nimenhuuto/MyClub/Jopox), reconcile calendar vs federation, get leave-by / kit / kahvio / walk-bike-car from home. No product accounts. No cloud LLM. Optional per-device on-device model (Chrome Prompt API or future iOS WKWebView). Native iOS is a **stub folder**, not an Xcode app.

## Stack

| Layer | Reality | Evidence |
|---|---|---|
| UI | Vite 6, React 19, TS ~5.7, Tailwind 4, Radix, Motion, Lucide | [package.json](../../package.json) |
| PWA | `vite-plugin-pwa`, `public/_headers`, apple-touch + icons | [vite.config.ts](../../vite.config.ts), [public/_headers](../../public/_headers) |
| Device DB | Dexie 4, DB `PelipaivaDB` v1→v2 | [src/lib/storage/db.ts](../../src/lib/storage/db.ts) L53–81 |
| Edge | Cloudflare Pages `pelipaiva` + Worker `pelipaiva-edge` | [.github/workflows/cd.yml](../../.github/workflows/cd.yml), [cloudflare-worker/wrangler.jsonc](../../cloudflare-worker/wrangler.jsonc) |
| Family bus | Worker secret `FAMILY_CODES`, KV `MATCHDAY_KV` id `10b2dc844fe04f01920bdfba6fdecda5` | wrangler.jsonc L8–13; [worker.ts](../../cloudflare-worker/worker.ts) L1–4 |
| Calendar public URL | Pages Function proxies Worker `/api/calendar` | [functions/api/calendar.js](../../functions/api/calendar.js) |
| Tests | Vitest 4 (node + fake-indexeddb), Playwright (not in CI) | [vitest.config.ts](../../vitest.config.ts), [ci.yml](../../.github/workflows/ci.yml) |
| License | MIT | [LICENSE](../../LICENSE) |
| Native | Swift+JS bridge stubs only | [native/ios/](../../native/ios/) |

**Not present:** Dockerfile, compose, helm, terraform, Prisma/SQL, Redis, Kafka, OAuth, CODEOWNERS, SECURITY.md, CONTRIBUTING, OpenAPI, Storybook, workspaces/Nx.

**Lockfile:** `package-lock.json` committed. Worker has its own [cloudflare-worker/package.json](../../cloudflare-worker/package.json).

## Topology

```
Browser (Safari PWA / Android Chrome / desktop Chrome)
  Dexie PelipaivaDB ── agents/planner ── UI (HUD, cards, modals)
  optional: LanguageModel (Chrome) or FamdayNativeAi (iOS wrapper, not shipped)
        │
        ├─ GET/PUT /api/family/{code}  → Worker + MATCHDAY_KV (roster ~2KB)
        ├─ GET /api/calendar?perhe=    → Pages Function → Worker ICS
        └─ GET /api/proxy/ics?url=     → Worker allowlisted federation/ICS/FMI/LIPAS
```

**Apps/packages:** one frontend (`src/`), one Worker (`cloudflare-worker/`), Pages Functions (`functions/api/`), optional native stub (`native/ios/`). Not a monorepo.

## How to run locally (from scripts/CI, not guessed)

```
npm ci
npm run dev          # vite, port 3000 (vite.config.ts server.port)
npm test             # vitest run — CI gate
npx tsc -p tsconfig.app.json --noEmit
npm run build        # tsc -b && vite build — CI + CD
npm run test:e2e     # playwright; NOT in ci.yml
```

Prod: push `main` → CI then CD Pages (`dist`) + `wrangler deploy` in `cloudflare-worker`. Secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, Worker `FAMILY_CODES` (not in git).

Root [README.md](../../README.md) is **not** a product README; it describes an “Audit Summary System”. Product onboarding lives in [docs/](../) and is partially stale vs `20bad06`.

## Language mix (git ls-files)

362 tracked files. Dominant: **112 `.ts`**, **109 `.md`**, **39 `.tsx`**. Also wasm (Tesseract), png, ics fixtures, 1 `.swift`. Docs ≈ code in file count.

## UI surfaces (inventory)

SPA (`src/App.tsx`): OnboardingWizard, MissionControlHUD, MultiProfileHeader, HeroMatchCard, MatchdayCard, TimelineCalendarView, WeekendStrip, AmbientView, plus modals (SmartImport, FamilyManage, FamilyShare, FamilyCalendar, HomeLocation, AskCopilot, Logistics, Stats, Parking, Merge, Drop-in, OnDeviceLlmSettings). No router package — one shell.

## Data layer signals

- Dexie tables: profiles, events, officialFixtures, leagueStandings, teamRosters, arrivalRules, venuePins, customAliases, syncState (`db.ts`).
- localStorage: theme, `pelipaiva_onboarding_done`, `pelipaiva_home_location`, `pelipaiva_ondevice_llm`.
- Cloudflare KV: `family:{CODE}` roster JSON, TTL documented in FAMILY_SYNC_FINAL (verify in worker).
- No SQL migrations.

## External API signals (from code, Phase 2 will complete)

Proxy target via `DEFAULT_PROXY_URL` ([proxyUrl.ts](../../src/lib/api/proxyUrl.ts) L2). Vendors seen in src: tulospalvelu.palloliitto.fi, salibandy.fi, lentopallo.fi, basket.fi / koripallo-api, `*.torneopal.fi`, nimenhuuto/myclub/jopox ICS, api.hel.fi servicemap, nominatim.openstreetmap.org, LIPAS, FMI, espooliikkuu, WhatsApp `wa.me`, Google/Apple/Waze maps, Chrome `LanguageModel`.

## Tests

- Vitest: `src/**/*.test.ts` + `tests/**/*.test.ts` (tier0–5 “e2e” names are **unit/node**, not Playwright).
- Playwright: `tests/e2e/playwright/` — Pixel 7 + Desktop Chrome; WebKit not installed in Linux CI.
- Coverage script exists (`test:coverage`); not a CI gate.
- ESLint config present; **lint is not a CI step**.

## Risk hotspots (recon only — not findings yet)

1. Root README vs product (drift).
2. `FAMILY_CODES` secret + public Crockford regex; `generateFamilyCode()` still in client source.
3. Worker is SSRF-shaped proxy (`/api/proxy/ics?url=`) — allowlist must be the control.
4. `xlsx@0.18.5` untrusted spreadsheet parse.
5. Synthetic leftover `generateOrResolveMatchStats` in statsEngine.
6. Docs corpus (`PROJECT.md` milestones IN_PROGRESS, COMPETITIVE_AI OPEN P0s, agency audit at older SHA `2e45f97`).
7. Playwright not gating merge; iOS Safari untested in CI.
8. Native iOS not an `.xcodeproj`.
9. KV namespace id is public in wrangler.jsonc (binding, not a secret).
10. Kids’ sports PII: names on device; constitution says not in KV — must verify payload.

## Unknowns

| Item | Resolves with |
|---|---|
| Live `FAMILY_CODES` membership | Operator / wrangler secret (must not print values) |
| Whether KV id is production vs leftover | Cloudflare dashboard |
| Real Chrome 148 Gemini Nano on a laptop | Human device |
| Real iOS Safari PWA behaviour | Physical iPhone |
| Pages Function vs Worker calendar host of record | Live GET already 403 JSON; confirm feed path for issued codes |
| Tesseract CDN vs vendored wasm actually used | Read `ocrImageParser.ts` in API/ARC |
