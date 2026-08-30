# Contradictions

| ID | A | B | Verdict |
|---|---|---|---|
| X-001 | COMPETITIVE_AI M-02 “no ErrorBoundary” | `src/components/ErrorBoundary.tsx` + `src/main.tsx` wrap | **Code wins.** Finding DENIED. F-DOC-003. |
| X-002 | COMPETITIVE_AI M-12 CORS `*` on Worker | worker.ts L200–216 origin allowlist | **Code wins** for Worker. Pages HTML still had ACAO `*` on GET / (CDN). Split: Worker PASS, Pages static S4. |
| X-003 | COMPETITIVE_AI M-14 AbortSignal=0 | familyCloud.ts L51, ingestOfficial fetch timeout | **Code wins.** |
| X-004 | COMPETITIVE_AI M-20 tsc checks nothing | ci.yml `tsc -p tsconfig.app.json --noEmit` | **Code wins.** |
| X-005 | PROJECT.md M1–M4 IN_PROGRESS | prod pages.dev + 462 vitest | **Code/prod wins.** Docs stale. F-DOC-002. |
| X-006 | FAMILY_SYNC_FINAL “no last names in KV” vs PUT playerName | familyCloud.ts L391–400 sends playerName | **Both true if UI stores given names.** Not enforced. F-DATA-002. |
| X-007 | docs/ARCHITECTURE “no product LLM” vs Chrome LanguageModel | onDeviceLlmPrefs default off; opt-in local only | **No contradiction.** Neural is optional on-device. |
| X-009 | API agent: cup seed S1 | SYN catalog S2 | **S2.** Persisted canned cup is a constitution smell, not a site-down. |
| X-010 | DOC agent: README S1 | SYN catalog S2 | **S2.** Onboarding docs wrong; prod PWA still runs. |
| X-011 | DATA agent: last name policy S1 | constitution only bans last names, UI not validated | **S2 F-SEC-005.** Enforce given-name or accept household names. |
