# Forward plan — after Grok audit `2e45f97`

Living list. Other AIs: **do the next unchecked P1, prove it, tick it with SHA.**  
Do not start P3 while P1 is open. Do not invent a native rewrite of the React UI.

Constitution: [SUPER_PROMPT.md](./SUPER_PROMPT.md) + [FAMILY_SYNC_FINAL.md](../FAMILY_SYNC_FINAL.md) §3.

## Now (P1) — integrity & ops

| ID | Task | Owner | Status | Done when |
|---|---|---|---|---|
| F-1 | Delete or quarantine `generateOrResolveMatchStats` so it cannot appear in the Pages bundle. Tests that need a fixture belong under `tests/`. | Agent | ✅ DONE (`ff43add`) | `rg generateOrResolveMatchStats src/lib/stats/statsEngine.ts` empty; vitest green; prod grep false |
| F-2 | Delete unused `generateFamilyCode()` (`familyCode.ts:14`) and unused `seedWeekendExtras.ts`. | Agent | ✅ DONE (`ff43add`) | Zero importers; public repo cannot mint |
| F-3 | Chrome laptop QA on a real Chrome 148+: opt-in → Lataa if needed → Copilot engine label `Paikallinen malli (Chrome)` → Poista käytöstä → Aikataulujärki. | Human | PENDING | Screenshot or notes in this file |
| F-4 | Operator: put the family’s real Crockford codes in Worker secret `FAMILY_CODES`. DKJVB-H is 403 until then. | Human | PENDING | `GET /api/family/{code}` 200 for that family only |
| F-5 | iPhone Safari UX: on `ios-safari`, hide Apple/Qwen radios; one line “Aikataulujärki. Apple vain FamDay-sovelluksessa.” | Agent | ✅ DONE (`ff43add`) | Clean Finnish copy rendered on ios-safari |

## Next (P2) — iOS neural for real

| ID | Task | Owner | Status | Done when |
|---|---|---|---|---|
| F-6 | Mac Xcode WKWebView app per `native/ios/README.md`. Load pages.dev. Inject user script + `famdayAi` handler. | Human+Agent | OPEN | TestFlight on an Intelligence phone |
| F-7 | Auto-mirror `localStorage.pelipaiva_ondevice_llm` → `UserDefaults` on every navigation. Bridge already fail-closes on `off`. | Agent | OPEN | Toggle in PWA flips native availability without a rebuild |
| F-8 | Only if AFM 3 Core Finnish JSON F1 is poor: official Qwen3 0.6B `.aimodel` via Background Assets. Wi‑Fi Lataa. Never in the IPA. No PCC. | Human | OPEN | A/B on real WhatsApp dumps (Simo P13, volleyball, ETEK) |
| F-9 | Cup ingest: if federation returns 0 cup matches, show “ei julkaistu” — do not write `officialFromExampleCup` rows. | Agent | ✅ DONE (`ff43add`) | KW Memorial / Espoo Liikkuu: live or empty, never canned HJK/KäPa |

## Later (P3) — hygiene

| ID | Task | Status | Done when |
|---|---|---|---|
| F-10 | Drop legacy `X-Pelipaiva-Rev`; If-Match only | OPEN | Worker 409 without it |
| F-11 | Unknown venue: no Töölö pin; require LIPAS or user pin | OPEN | `isApproximateLocation` never draws a marker |
| F-12 | Replace or isolate `xlsx`; prefer pasted TSV | OPEN | Advisory gone or parser in Worker |
| F-13 | Single `NeuralEngineId` type | ✅ DONE (`ff43add`) | Unified in `onDeviceLlm.ts` and re-exported |
| F-14 | `PROJECT.md` milestones → SHIPPED; point at this pack | OPEN | no IN_PROGRESS ghosts |
| F-15 | Ice hockey / remaining federation HTML only if an official JSON path exists | no HTML SPA scrape |

## Explicitly not doing

- Cloud LLM “just for iPhone”
- Capacitor rewrite of the whole UI
- Shipping 4B/7B models
- Putting neural preference in family KV
- Minting FAMILY_CODES from GitHub Actions
- Treating Apple Intelligence Finnish as supported (it is not on the public language list)

## Suggested next commit (smallest)

1. F-1 + F-2 + F-5 in one PR.  
2. Human F-4 secret.  
3. Human F-3 Chrome.  
4. Only then F-6 on a Mac.

## Review loop

After each PR: another model runs [SUPER_PROMPT.md](./SUPER_PROMPT.md), writes `docs/agency/AUDIT_<WHO>_<DATE>.md` with SHA + score, and patches this plan. Grok’s [GROK_AUDIT_2026-08-30.md](./GROK_AUDIT_2026-08-30.md) is the baseline to beat, not scripture.
