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

1. [AUDIT.md](./AUDIT.md) — APIs, Dexie, gaps
2. [AUDIT_2026-08-24T1405_ox-alpha_external-api-lifecycle-failure-audit.md](./AUDIT_2026-08-24T1405_ox-alpha_external-api-lifecycle-failure-audit.md) — **external API lifecycle & failure-mode audit**: 12-integration catalog + 11 findings (1 CRITICAL / 3 HIGH / 7 MEDIUM) with cause, line-level proof, and fix; remediation priority table
3. [AUDIT_2026-08-24_ox-alpha.md](./AUDIT_2026-08-24_ox-alpha.md) — full 20-agent council audit: 25 findings (F-01…F-25) with root causes, line-level proofs, fact-check verdicts, vote tally, and P0–P3 remediation roadmap
4. [USE_CASES.md](./USE_CASES.md) — parent-value backlog
5. [ARCHITECTURE.md](./ARCHITECTURE.md) — runtime graph
6. [AGENT_GRAPH.md](./AGENT_GRAPH.md) — build-time specialists
7. [FAMILY_SYNC_FINAL.md](./FAMILY_SYNC_FINAL.md) — family bus (WhatsApp + KV roster)
8. [FAMILY_CODES_OPS.md](./FAMILY_CODES_OPS.md) — **operators: issued codes, Cloudflare secret, rotate**
9. [FAMILY_SYNC_ARCHITECTURE.md](./FAMILY_SYNC_ARCHITECTURE.md) — v1.0 product draft (superseded for build)
10. [FAMILY_SYNC_ENHANCEMENTS.md](./FAMILY_SYNC_ENHANCEMENTS.md) — v1.1 notes; cut list is in FINAL §2
