# Specialist briefs — Pelipäivä @ 20bad06

All roles obey `INTERNAL_EXECUTION_PROMPT.md`.

## DOC
README, `docs/**`, `PROJECT.md`, `COMPETITIVE_AI_FINAL_FINDINGS.md`, `docs/agency/*`, `llms.txt`. Can a stranger run/test/deploy? List doc-code drifts with the code side winning.

## ARC
`src/lib/**`, `src/App.tsx`, `src/types/matchday.ts`, `native/ios/**`. Bounded contexts, Dexie as SoT, agent graph purity, dead code (`generateOrResolveMatchStats`, `generateFamilyCode`, `seedWeekendExtras`), circular imports, error swallowing.

## API
`cloudflare-worker/worker.ts`, `src/lib/api/**`, `src/lib/clubs/ingestOfficial.ts`, `src/lib/stats/statsEngine.ts` (extract path only), `fmiWeatherEngine.ts`, `sportsGeocoder.ts`, `functions/api/**`. Vendor table. Proxy allowlist. Timeouts. Fallback honesty.

## DATA
`src/lib/storage/db.ts`, `homeLocation.ts`, `familyCloud.ts`, Worker KV put/get/TTL, localStorage keys. Tenancy = family code. GDPR erase = clear Dexie. What is in KV vs not.

## UIX
`src/components/**`, `src/styles/tokens.css`, `index.html`. Journeys: onboarding local, Perhe, kotiosoite walk/bike, Copilot, import. a11y, 390px, disabled Apple radios on Safari.

## SEC
Worker CORS, If-Match, rate limit, FAMILY_CODES, proxy SSRF, xlsx, OCR, PII in KV/WhatsApp share, GH Actions pin vs sha. Read API/DATA traces before closing.

## REL
`.github/workflows/*`, `public/_headers`, `_redirects`, wrangler, rollback. Observability (console.error only?).

## QA
`tests/**`, `src/**/*.test.ts`, playwright.config, ci.yml. What CI actually gates. Hunters still passing tests that preserve synthetic factories.

## ORCH / SYN
C1–C6, catalog, exec, roadmap, “how the team worked”.
