# Pelipäivä — family sports time hub

Pelipäivä is the **command center for a Finnish sports weekend**: multiple kids, multiple sports, one parent with a phone in the car park.

Not a calendar. Not a stats app. **When do I leave, what goes in the bag, who has kahvio, and which two halls collide.**

This expansion keeps the original local-first contract (Dexie, zero-auth, GDPR, no product LLM) and lifts the product from a football matchday card to a multi-sport family graph:

- **Night Captain OLED** + **Floodlight** daylight (Navikka + football-stats DNA)
- Deterministic agent graph: conflict, carpool, kit, talkoo, tournament
- Hero **Lähde klo** on the first screen
- Sport-specific kassi (jalkapallo, salibandy, koripallo, lentopallo, jääkiekko, futsal)
- Kitchen Ambient as a 10-foot HUD

Start here:

0. **[agency/README.md](./agency/README.md)** — ⭐⭐⭐ **2026-08-30 Grok agency pack** (other AIs: start here). Super prompt + Grok audit at `2e45f97` (361/400) + forward plan. Supersedes older OPEN registers for planning.
1. **[AUDIT_2026-08-28_muse-spark_full-corpus_final.md](./AUDIT_2026-08-28_muse-spark_full-corpus_final.md)** — ⭐⭐⭐ **FINAL — 2026-08-28 · Muse Spark 1.2 (OpenCode Chief of Staff) — FULL-CORPUS PROOF-OR-DENY + COMPETITIVE PRIORITY RESET** — Every prior finding (54 MASTER + 13 U) re-verified at `7d36def` · **38 FIXED · 9 PARTIAL · 7 OPEN · 6 DENIED/BY-DESIGN** (P0 is now EMPTY) · Fresh line refs + U-defect audit + docs-vs-code drift + revised P1→P2 roadmap · _This supersedes all prior audit tiers for planning._
2. **[AUDIT_2026-08-28_muse-spark_competitive-uiux-audit.md](./AUDIT_2026-08-28_muse-spark_competitive-uiux-audit.md)** — ⭐ **2026-08-28 · Competitive RED vs BLUE UI/UX audit (13 defects)** — Winner RED 89 vs 85 · Line-anchored findings, token & a11y matrix — _now subsumed by the final above_
3. **[MASTER_FINDINGS_REGISTER.md](./MASTER_FINDINGS_REGISTER.md)** — ⭐⭐ **THE list that rules them all**: all 54 distinct findings deduplicated (49 OPEN · 3 PARTIAL · 4 FIXED · 5 BY-DESIGN at `f325e50`), P0–P3 tiers, source-ID traceability — _status counts now superseded by the final (38 FIXED). See final for current truth. Historical reference only._
3. **[AUDIT_2026-08-24T1730_ox-alpha_full-corpus-proof-or-deny.md](./AUDIT_2026-08-24T1730_ox-alpha_full-corpus-proof-or-deny.md)** — ⭐ **final gate**: every finding from every audit below independently re-proven or denied first-hand (fresh line refs, build+401 tests re-run); debunks the `.update(undefined)` sub-claim, corrects #27 skipWaiting, adds drift P8 (`fallbackToSynthetic` vs FAMILY_SYNC_FINAL constitution) + P9 (CI `tsc --noEmit` checks nothing)
4. **[AUDIT_2026-08-24T1715_ox-alpha_crosscheck-verdicts.md](./AUDIT_2026-08-24T1715_ox-alpha_crosscheck-verdicts.md)** — cross-check verdicts: every claim from all prior audits + product docs re-verified first-hand (67 VALID / 2 DEBUNKED / 3 SOFTENED), product-doc drift catalog (7 items), self-corrections, and 16 verified findings absent from all prior audits; union P0–P3 roadmap
5. **[AUDIT_2026-08-24T1606_ox-alpha_nexus-uiux-user-flow-review.md](./AUDIT_2026-08-24T1606_ox-alpha_nexus-uiux-user-flow-review.md)** — NEXUS five-team adversarial UI/UX + user-flow review: flow-completeness / wiring-asymmetry / state-honesty findings (5C/10H/14M/8L at snapshot `bcedcb6`), each re-verified against current main with 🟢/🟡/🔴 status; contested items, negative space, prioritized fix plan + definition of done
6. **[AUDIT_2026-08-24T1408_ox-alpha_canonical-priority-merge-of-three-council-audits.md](./AUDIT_2026-08-24T1408_ox-alpha_canonical-priority-merge-of-three-council-audits.md)** — canonical engine/storage/API entry point: all findings from the three council audits merged, deduplicated, strictly priority-ordered (P0→P3) with What/Cause/Proof/Fix per finding
7. [AUDIT.md](./AUDIT.md) — APIs, Dexie, gaps
8. [AUDIT_2026-08-24T1405_ox-alpha_external-api-lifecycle-failure-audit.md](./AUDIT_2026-08-24T1405_ox-alpha_external-api-lifecycle-failure-audit.md) — **external API lifecycle & failure-mode audit**: 12-integration catalog + 11 findings (1 CRITICAL / 3 HIGH / 7 MEDIUM) with cause, line-level proof, and fix; remediation priority table
9. [AUDIT_2026-08-24T1407_ox-alpha_priority-order-findings-and-fixes.md](./AUDIT_2026-08-24T1407_ox-alpha_priority-order-findings-and-fixes.md) — **actionable audit in strict priority order (P0→P3)**: cause, line-level proof, and concrete fix for all 25 council findings (F-01…F-25)
10. [AUDIT_2026-08-24_ox-alpha.md](./AUDIT_2026-08-24_ox-alpha.md) — full 20-agent council audit: 25 findings (F-01…F-25) with root causes, line-level proofs, fact-check verdicts, vote tally, and P0–P3 remediation roadmap
11. [AUDIT_2026-08-24T1358_ox-alpha_20nation-council-review.md](./AUDIT_2026-08-24T1358_ox-alpha_20nation-council-review.md) — 20-nation council review (Session I dirty tree → Session II main): verdicts TRUE/FALSE/OVERBLOWN, resolved-items table
12. [USE_CASES.md](./USE_CASES.md) — parent-value backlog
13. [ARCHITECTURE.md](./ARCHITECTURE.md) — runtime graph
14. [AGENT_GRAPH.md](./AGENT_GRAPH.md) — build-time specialists
15. [FAMILY_SYNC_FINAL.md](./FAMILY_SYNC_FINAL.md) — family bus (WhatsApp + KV roster)
16. [FAMILY_CODES_OPS.md](./FAMILY_CODES_OPS.md) — **operators: issued codes, Cloudflare secret, rotate**
17. [FAMILY_SYNC_ARCHITECTURE.md](./FAMILY_SYNC_ARCHITECTURE.md) — v1.0 product draft (superseded for build)
18. [FAMILY_SYNC_ENHANCEMENTS.md](./FAMILY_SYNC_ENHANCEMENTS.md) — v1.1 notes; cut list is in FINAL §2
