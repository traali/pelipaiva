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

1. **[AUDIT_2026-08-24T1715_ox-alpha_crosscheck-verdicts.md](./AUDIT_2026-08-24T1715_ox-alpha_crosscheck-verdicts.md)** — ⭐ **cross-check verdicts**: every claim from all prior audits + product docs re-verified first-hand (67 VALID / 2 DEBUNKED / 3 SOFTENED), product-doc drift catalog (7 items), self-corrections, and 16 verified findings absent from all prior audits; union P0–P3 roadmap
2. **[AUDIT_2026-08-24T1606_ox-alpha_nexus-uiux-user-flow-review.md](./AUDIT_2026-08-24T1606_ox-alpha_nexus-uiux-user-flow-review.md)** — NEXUS five-team adversarial UI/UX + user-flow review: flow-completeness / wiring-asymmetry / state-honesty findings (5C/10H/14M/8L at snapshot `bcedcb6`), each re-verified against current main with 🟢/🟡/🔴 status; contested items, negative space, prioritized fix plan + definition of done
3. **[AUDIT_2026-08-24T1408_ox-alpha_canonical-priority-merge-of-three-council-audits.md](./AUDIT_2026-08-24T1408_ox-alpha_canonical-priority-merge-of-three-council-audits.md)** — canonical engine/storage/API entry point: all findings from the three council audits merged, deduplicated, strictly priority-ordered (P0→P3) with What/Cause/Proof/Fix per finding
4. [AUDIT.md](./AUDIT.md) — APIs, Dexie, gaps
5. [AUDIT_2026-08-24T1405_ox-alpha_external-api-lifecycle-failure-audit.md](./AUDIT_2026-08-24T1405_ox-alpha_external-api-lifecycle-failure-audit.md) — **external API lifecycle & failure-mode audit**: 12-integration catalog + 11 findings (1 CRITICAL / 3 HIGH / 7 MEDIUM) with cause, line-level proof, and fix; remediation priority table
6. [AUDIT_2026-08-24T1407_ox-alpha_priority-order-findings-and-fixes.md](./AUDIT_2026-08-24T1407_ox-alpha_priority-order-findings-and-fixes.md) — **actionable audit in strict priority order (P0→P3)**: cause, line-level proof, and concrete fix for all 25 council findings (F-01…F-25)
7. [AUDIT_2026-08-24_ox-alpha.md](./AUDIT_2026-08-24_ox-alpha.md) — full 20-agent council audit: 25 findings (F-01…F-25) with root causes, line-level proofs, fact-check verdicts, vote tally, and P0–P3 remediation roadmap
8. [AUDIT_2026-08-24T1358_ox-alpha_20nation-council-review.md](./AUDIT_2026-08-24T1358_ox-alpha_20nation-council-review.md) — 20-nation council review (Session I dirty tree → Session II main): verdicts TRUE/FALSE/OVERBLOWN, resolved-items table
9. [USE_CASES.md](./USE_CASES.md) — parent-value backlog
10. [ARCHITECTURE.md](./ARCHITECTURE.md) — runtime graph
11. [AGENT_GRAPH.md](./AGENT_GRAPH.md) — build-time specialists
12. [FAMILY_SYNC_FINAL.md](./FAMILY_SYNC_FINAL.md) — family bus (WhatsApp + KV roster)
13. [FAMILY_CODES_OPS.md](./FAMILY_CODES_OPS.md) — **operators: issued codes, Cloudflare secret, rotate**
14. [FAMILY_SYNC_ARCHITECTURE.md](./FAMILY_SYNC_ARCHITECTURE.md) — v1.0 product draft (superseded for build)
15. [FAMILY_SYNC_ENHANCEMENTS.md](./FAMILY_SYNC_ENHANCEMENTS.md) — v1.1 notes; cut list is in FINAL §2
