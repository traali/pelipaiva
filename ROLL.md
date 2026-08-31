# ROLL.md — The Chronicle of Pelipäivä

Append-only decision log. One line per architectural call or lesson learned.
Read the last ~15 lines at session start (Chapter). Never rewrite history; only append.

---

2026-08-15 | pelipaiva | Adopted Dexie 4.x for IndexedDB schema; offline-first calendar access is primary.
2026-08-18 | pelipaiva | Decoupled family sync from auth servers; zero-auth encrypted payloads via URL hash & QR.
2026-08-20 | pelipaiva | Integrated Torneopal sports scoring: Volleyball sets (Erät 3-1), Basketball points, Floorball/Football goals.
2026-08-24 | pelipaiva | Live weather radar & lightning alerts use FMI OpenWMS + EUMETSAT via Cloudflare Edge Worker cache.
2026-08-28 | pelipaiva | Swapped heavy runtime multi-agent swarm orchestration for deterministic unit/E2E test suite.
2026-08-31 | pelipaiva | Adopted Cistercian Monastic Governance (AGENTS.md canonical Rule + adversarial Visitation audit).
2026-08-31 | pelipaiva | Used bidirectional pair hashing (A-B, B-A) for family conflicts to keep dismissal state synced across sibling cards.
2026-08-31 | pelipaiva | Added automated pre-visitation check via 'npm run visit' (word count cap, lint, vitest 100% green).
2026-08-31 | pelipaiva | Collapsed OUT (Poisjäänti) cards to 48px strips and suppressed all overlap/lightning alerts on skipped events.
2026-08-31 | pelipaiva | Upgraded runtime deps (dexie-react-hooks@4.4.0, lucide-react@1.38.0, motion@13.1.1) and added oxlint + lefthook for 30ms pre-commit gating. Verified via clean Visitor: PASS WITH FINDINGS (57 suites, 502 tests green).
2026-08-31 | pelipaiva | Reconciled venue mismatches (Torneopal wins as authoritative, UI renders banner with 1-tap resolution), audited via clean Visitor: PASS (57 suites, 504 tests green).
2026-08-31 | pelipaiva | Active transit UX: compact parking on walking/biking, adaptive navigation CTA, weather-aware cycling (rain/ice/gusts -> car/transit fallback), and zero false conflict alarms when kids travel independently. Verified via clean Visitor: PASS (57 suites, 507 tests green).
2026-08-31 | pelipaiva | Implemented dynamic sticky day headers (pinned beneath filter bar via ResizeObserver --sticky-filter-height), verified via clean Visitor: PASS (57 suites, 507 tests green).
2026-08-31 | pelipaiva | Stitched calendar events with bare fixtures globally in allStitchedEvents before running mission-control graph, eliminating false duplicate conflict banners (Pyrkkä vs Lauttasaari TN B). Verified via clean Visitor: PASS (57 suites, 507 tests green).
2026-08-31 | pelipaiva | Cleaned up all past visitation nits: added eslint to lefthook pre-commit, purged obsolete 22-folder .agents/ tree, optimized Vite manualChunks (chunk size 723 kB -> 506 kB), and eliminated import warnings. Verified via clean Visitor: PASS (57 suites, 507 tests green).




