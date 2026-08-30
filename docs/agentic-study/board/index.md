# Findings board

SHA `20bad06`. Status OPEN unless noted.

| ID | Agent | Sev | Title | Status |
|---|---|---|---|---|
| F-DOC-001 | DOC | S2 | Root README is not the product | OPEN |
| F-DOC-002 | DOC | S2 | PROJECT.md milestones still IN_PROGRESS | OPEN |
| F-DOC-003 | DOC | S2 | COMPETITIVE_AI P0 register is stale vs code | OPEN |
| F-DOC-004 | DOC | S3 | Agency Grok audit SHA 2e45f97 vs HEAD 20bad06 | OPEN |
| F-ARC-001 | ARC | S2 | generateOrResolveMatchStats still in statsEngine | OPEN |
| F-ARC-002 | ARC | S3 | generateFamilyCode uncalled in public repo | OPEN |
| F-ARC-003 | ARC | S3 | seedWeekendExtras unused | OPEN |
| F-ARC-004 | ARC | S3 | App.tsx god-shell | OPEN |
| F-ARC-005 | ARC | S4 | native/ios is stub not Xcode app | OPEN |
| F-API-001 | API | S2 | Worker CORS omits localhost:3000 (Vite port) | OPEN |
| F-API-002 | API | S3 | Proxy allowlist includes any *.torneopal.com | OPEN |
| F-API-003 | API | S2 | officialFromExampleCup can write catalog fixtures | OPEN |
| F-API-004 | API | S4 | DKJVB-H 403 is fail-closed ops | BY-DESIGN |
| F-DATA-001 | DATA | S3 | KV TTL 7d evaporates idle families | OPEN |
| F-DATA-002 | DATA | S4 | playerName (first name) + URLs in KV | BY-DESIGN |
| F-DATA-003 | DATA | S3 | Tombstones in localStorage not Dexie | OPEN |
| F-SEC-001 | SEC | S2 | xlsx@0.18.5 (2MB cap only) | OPEN |
| F-SEC-002 | SEC | S3 | OCR CDN fallback if self-host fails | OPEN |
| F-SEC-003 | SEC | S3 | GHA actions unpinned moving tags | OPEN |
| F-SEC-004 | SEC | S4 | FAMILY_CODES fail-closed | PASS |
| F-UIX-001 | UIX | S3 | Disabled Apple/Qwen radios on iOS Safari | OPEN |
| F-UIX-002 | UIX | S3 | Onboarding copy cites PERHE-2 (403 unless issued) | OPEN |
| F-UIX-003 | UIX | S4 | ErrorBoundary not on design tokens | OPEN |
| F-REL-001 | REL | S2 | Playwright not a CI gate | OPEN |
| F-REL-002 | REL | S3 | eslint not a CI gate | OPEN |
| F-REL-003 | REL | S3 | No staging / no structured observability | OPEN |
| F-QA-001 | QA | S2 | tests/e2e/tier* are node unit tests | OPEN |
| F-QA-002 | QA | S2 | Synthetic stats factory kept alive by tests | OPEN |
| F-QA-003 | QA | S3 | No WebKit/iOS Safari e2e | OPEN |
| F-C-001 | ORCH | S2 | Doc vs code P0 register (see F-DOC-003) | ADJUDICATED |
