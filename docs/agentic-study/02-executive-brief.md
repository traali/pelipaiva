# 02 — Executive brief

**System:** Pelipäivä / FamDay — Finnish family sports weekend PWA.  
**SHA:** `20bad06` · **Prod:** https://pelipaiva.pages.dev · **Date:** 2026-08-30

Local-first React+Vite app. Dexie on the phone is source of truth. Cloudflare Worker is a CORS proxy plus a **fail-closed** family roster bus (issued codes, KV ~2 KB, 7-day TTL). No accounts, no cloud LLM. Walk/bike/car from a home pin. Optional Chrome on-device model, default off.

## Health (5)

1. **Constitution mostly holds in code:** no dummy 15:00 on save; ingest `fallbackToSynthetic: false`; family unknown → 403 JSON; Worker CORS is not `*`.
2. **CI/CD green** on this SHA (tsc + vitest + Pages + Worker). Live GET / 200.
3. **Docs are the weakest subsystem.** Root README is an audit stub. COMPETITIVE_AI still lists P0s the code already denied (X-001–X-004).
4. **No S0.** Highest open items are leftover synthetic factory, unpinned GHA, xlsx, CORS vs Vite :3000, Playwright not gating.
5. **iPhone Safari is unverified** in browsers; unit UA says Aikataulujärki only.

## Top 7 actions

| # | Action | IDs | Effort |
|---|---|---|---|
| 1 | Rewrite root README for run/test/deploy | F-DOC-001 | S |
| 2 | Delete `generateOrResolveMatchStats` + `generateFamilyCode` + `seedWeekendExtras` | F-ARC-001, F-ARC-002, F-QA-002 | S |
| 3 | Add `http://localhost:3000` to Worker CORS | F-API-001 | S |
| 4 | Stop writing `officialFromExampleCup` when live cup is empty | F-API-003 | S |
| 5 | Pin GHA actions by SHA; keep xlsx capped or drop | F-SEC-003, F-SEC-001 | S/M |
| 6 | Hide Apple/Qwen radios on ios-safari; fix PERHE-2 copy | F-UIX-001, F-UIX-002 | S |
| 7 | Optional: Playwright job on CI (Chromium only) | F-REL-001 | M |

## Could not know

Live `FAMILY_CODES` set; real Chrome Nano; real iPhone Safari; whether KV namespace is the only prod binding; staging existence (Q-004).
