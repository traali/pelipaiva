# Grok agency audit — 2026-08-30

**Auditor:** Grok Build (xAI)  
**SHA:** `2e45f97` (`feat: opt-in on-device AI for iOS Core AI and Chrome Nano`)  
**Prod:** https://pelipaiva.pages.dev (CD run 33294483674 success)  
**CI:** Quality Gate 33294483691 success — `tsc -p tsconfig.app.json --noEmit`, vitest, production build  
**Tests:** **455 passed / 50 files** (local vitest at audit time)  
**Prompt used:** [SUPER_PROMPT.md](./SUPER_PROMPT.md)  
**Supersedes for planning:** `COMPETITIVE_AI_FINAL_FINDINGS.md` (stale OPEN P0s), `docs/AUDIT_2026-08-28_muse-spark_*` (pre–on-device-AI)

This is a prove-or-deny pass against **current main**, not a merge of old registers.

## Score: **361 / 400** — pass bar 340. P0 empty.

| Slice | Pts | Award | Why |
|---|---|---|---|
| Constitution held | 80 | 74 | UI path refuses dummy 15:00; ingest `fallbackToSynthetic: false`. Penalty: `generateOrResolveMatchStats` still ships in the bundle (uncalled from UI) with fake roster numbers. |
| Family bus fail-closed | 50 | 48 | Prod `/api/calendar?perhe=DKJVB-H` → 403 `unknown_family`. `generateFamilyCode()` exists but has **zero UI callers**. |
| Local-first / offline HUD | 40 | 40 | Dexie v2 SoT. Graph consumes Dexie only. |
| Federation ingest honesty | 50 | 44 | Live Torneopal/koripallo-api path. Penalty: `officialFromExampleCup` can still materialise catalog cup rows if live cup is empty. |
| On-device AI contract | 50 | 50 | Default `off`. Opt-in + Lataa. Not in family KV. Session destroy. |
| Tests + CI | 40 | 40 | Gates main. |
| iOS honesty | 30 | 26 | Safari copy is honest. Swift bridge exists. Not an Xcode target / not TestFlight. UserDefaults mirror is documented, not automatic. |
| Chrome laptop path | 20 | 18 | `LanguageModel` adapter + user Lataa. Not QA’d on a real Chrome 148 in this session (unit-mocked only). |
| Privacy/CORS/If-Match | 40 | 38 | Origin allowlist, If-Match 409, AbortSignal 10s. Legacy `X-Pelipaiva-Rev` still accepted. |
| Parent UX Finnish | 20 | 18 | Tekoäly card in Perhe. Copilot labels engine. Penalty: Apple/Qwen disabled rows on iPhone Safari can look like a broken product unless the parent reads the caption. |
| **Total** | **400** | **361** | |

## Architecture (Agent A)

```
iPhone Safari PWA / Chrome laptop
        │  Dexie (SoT) ── runMissionControlGraph (pure)
        │  NLP parser ── Copilot (deterministic unless opt-in)
        │
        ├─ opt-in localStorage pelipaiva_ondevice_llm = off|apple|chrome|qwen06
        │     Chrome 148+ ── LanguageModel (Gemini Nano)
        │     WKWebView native/ios ── FamdayNativeAi ── LanguageModelSession
        │           AFM 3 Core  |  CoreAILanguageModel Qwen3 0.6B
        │     Safari: no neural bus (BY DESIGN)
        │
        └─ Cloudflare Pages (pelipaiva.pages.dev)
              Functions /api/calendar* ──► Worker
              Worker: FAMILY_CODES secret, MATCHDAY_KV roster only
              Worker: ICS/federation proxy (allowlisted hosts)
              Each phone hydrates tulospalvelu itself
```

Source of truth is **Dexie on the device**. KV is a roster bus, not a calendar. Neural net is not a source of truth: it may only enrich extraction when confidence < 0.80 **and** the user opted in **and** a model is actually loaded.

### Layer map

| Layer | Files | Side effects |
|---|---|---|
| UI HUD | `src/App.tsx`, `MissionControlHUD`, `HeroMatchCard`, `AskCopilotModal`, `FamilyManageModal` | Dexie writes |
| Agent graph | `src/lib/agents/*` | none (pure) |
| Parser | `messageParserNLP.ts`, `chromeBuiltinAi.ts`, `localAiEngine.ts` | none until save |
| On-device AI | `onDeviceLlmPrefs.ts`, `onDeviceLlm.ts`, `OnDeviceLlmSettings.tsx`, `native/ios/*` | localStorage; native session |
| Ingest | `ingestOfficial.ts`, `torneopalClient.ts`, `icsParser.ts` | Dexie officialFixtures/events |
| Family bus | `familyCloud.ts`, `familyCode.ts`, `cloudflare-worker/worker.ts` | KV PUT/GET, 403 |
| Geo/weather | `sportsGeocoder.ts`, `fmiWeatherEngine.ts` | network, flagged approximate |

## Findings

| ID | Agent | Sev | Status | Proof | Fix |
|---|---|---|---|---|---|
| G-01 | Hunter | P2 | OPEN | `src/lib/stats/statsEngine.ts:1485` `generateOrResolveMatchStats` still builds fake rosters (`goals: 1`, `Pelaaja 4`). Grep: **no UI importer**. Tests still call it. | Move to `tests/` or delete. Bundle must not contain a synthetic stats factory. |
| G-02 | Hunter | P2 | OPEN | `src/lib/sync/familyCode.ts:14` `generateFamilyCode()`. Zero callers. Constitution: public repo must not mint. | Delete function. Worker remains the only issuer. |
| G-03 | Hunter | P2 | PARTIAL | `ingestOfficial.ts:64` `fallbackToSynthetic: false` (PASS). `exampleTournaments.ts:275` `officialFromExampleCup` still used when live cup fixtures empty (`ingestOfficial.ts:70-72`). | Keep catalog URLs; do not write cup rows unless federation returned matches. Surface “cup not published yet”. |
| G-04 | Architect | P2 | OPEN | `native/ios` is Swift + JS + README, not an `.xcodeproj`. Linux CI cannot produce IPA. Safari PWA cannot run Core AI (correct). | Mac: WKWebView shell per README. Copy `pelipaiva_ondevice_llm` into UserDefaults automatically. |
| G-05 | Privacy | P3 | OPEN | Worker still accepts `X-Pelipaiva-Rev` (`worker.ts:210`, FAMILY_SYNC_FINAL: deprecated). | If-Match only. |
| G-06 | Hunter | P3 | PARTIAL | Geocoder unknown venue → Töölö coords `60.1872,24.9248` with `isApproximateLocation: true` (`sportsGeocoder.ts:414-420`). Honest flag; still a Helsinki pin on the map. | No pin until LIPAS/user pin. |
| G-07 | Privacy | P3 | OPEN | `xlsx@0.18.5` in `package.json`. Known advisories for untrusted buffers. | Parse via worker with size cap (already 2 MB) or drop xlsx; CSV/TSV only. |
| G-08 | Architect | P3 | DRIFT | `PROJECT.md` milestones still IN_PROGRESS/PLANNED. Product is on Pages. | Mark shipped; keep this pack as living plan. |
| G-09 | UX | P2 | OPEN | iPhone Safari shows Apple/Qwen radios **disabled**. Correct, but a parent may think the app is broken. | Single sentence CTA: “Aikataulujärki on päällä. Apple-malli vain FamDay-sovelluksessa.” Hide radios on `ios-safari`. |
| G-10 | Ops | P1 | BY-DESIGN | Prod `GET /api/calendar?perhe=DKJVB-H` → **403** `{"error":"unknown_family"}`. Code not in secret. Cannot fix from git. | Operator: `FAMILY_CODES` secret. See FAMILY_CODES_OPS.md. |
| G-11 | AI | P1 | PASS | Prefs default off `onDeviceLlmPrefs.ts:44`. Hybrid skips neural unless choice set (`chromeBuiltinAi.ts` hybrid gate). Copilot uses `createOnDeviceLanguageSession` which returns null when off. Prod bundle contains `pelipaiva_ondevice_llm`, `Laitteen tekoäly`, `FamdayNativeAi`, `LanguageModel`. | Keep. |
| G-12 | AI | P1 | PASS | Dummy kickoff refused: `localAiEngine.ts:43`, QuickDropInBar save gate. `generateOrResolveMatchStats` not in UI. | Keep. |
| G-13 | Safety | P1 | PASS | `ErrorBoundary` wired in `src/main.tsx:4`. CORS allowlist `worker.ts:200-214` (not `*`). If-Match 409. `AbortSignal.timeout(10_000)` on familyCloud. | Keep. |
| G-14 | Hunter | P3 | OPEN | `src/lib/matchday/seedWeekendExtras.ts` exists, **no importers**. Dead canned weekend. | Delete file. |
| G-15 | AI | P3 | OPEN | Duplicate `NeuralEngineId` in `chromeBuiltinAi.ts` and `onDeviceLlm.ts`. | One type module. |

## Denied from older audits (do not re-open without new proof)

| Old ID | Claim | Verdict at `2e45f97` | Proof |
|---|---|---|---|
| M-01 | FamilyManageModal hooks crash | DENIED | Component ships; CI build; no hooks-after-early-return in current file |
| M-02 | No ErrorBoundary | DENIED | `src/components/ErrorBoundary.tsx`, `src/main.tsx` |
| M-04 | ingest fallbackToSynthetic true | DENIED | `ingestOfficial.ts:64` false |
| M-05 | Fabricated 2–1 in UI | DENIED for UI path | generateOrResolve uncalled from components; G-01 residual factory remains |
| M-12 CORS `*` | OPEN | DENIED | allowlist `worker.ts:200` |
| M-14 AbortSignal = 0 | DENIED | familyCloud, ingestOfficial, geocoder, homeLocation all timeout |
| M-20 CI tsc checks nothing | DENIED | `.github/workflows/ci.yml` uses `tsc -p tsconfig.app.json --noEmit` |

## Prod curls (this session)

```
GET https://pelipaiva.pages.dev/            200 text/html
GET /assets/index-BdffvTuf.js               contains Laitteen tekoäly, FamdayNativeAi, LanguageModel
GET /assets/FamilyManageModal-ph1J4GbN.js   Laitteen tekoäly, Lataa Qwen, Poista tekoäly käytöstä
GET /api/calendar?perhe=DKJVB-H             403 {"error":"unknown_family"}
GET pelipaiva-edge.sakkoja.workers.dev/api/calendar?perhe=DKJVB-H  403
```

`generateOrResolveMatchStats` **false** in prod index. `En arvaa kello 15:00` **true**.

## Chrome laptop (Agent A+D)

Not executed on a physical Chrome 148 in this session. Contract in code:

1. Platform `chrome` if `LanguageModel` or Chrome UA.
2. Radio **Chrome Gemini Nano** only when Prompt API `readily` or `after-download`.
3. User must select it (writes `pelipaiva_ondevice_llm=chrome`).
4. If `after-download`, **Lataa** → `LanguageModel.create()` (browser download, our origin not involved).
5. Hybrid parser / Copilot then allowed. Off → Aikataulujärki.

Headless Chromium in CI has no Prompt API → tests mock `LanguageModel`. Real laptop QA is FORWARD_PLAN F-3.

## iOS (Agent A+D)

| Surface | Neural | What parent sees |
|---|---|---|
| Safari / Add to Home Screen | None | Disabled Apple/Qwen + Aikataulujärki (G-09: hide radios) |
| Future WKWebView app | AFM 3 Core after opt-in; Qwen after Lataa | Same Perhe card, radios enabled |
| Finnish + Apple Intelligence | Unsupported language list (EN/SV/DA/NO… no FI) | Prefer Qwen 0.6B if wrapping; still opt-in |

Swift: `native/ios/FamdayAi/FamdayAiBridge.swift` fail-closes on UserDefaults `off`. Qwen throws `notPackaged` until Background Assets exist. **Do not enable PCC.**

## Critic

Ship is honest. Biggest remaining integrity smell is **dead synthetic factories still in the production JS** (G-01, G-14), not live UI lies. Biggest product gap is **no compiled iOS shell** (G-04) — Safari will never grow Core AI. Biggest ops gap is **FAMILY_CODES** (G-10), not code.

Next reviewer: run SUPER_PROMPT against a newer SHA; only add findings with file:line.
