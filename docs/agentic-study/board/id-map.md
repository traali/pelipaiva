# ID namespace

**Canonical IDs** live in [11-findings-catalog.md](../11-findings-catalog.md) and [index.md](./index.md).

Specialist traces drafted overlapping `F-API-001` / `F-DOC-001` numbers. Mapping:

| Trace draft | Canonical | Note |
|---|---|---|
| DOC F-DOC-001 README phantom | **F-DOC-001** | SYN kept; DOC scored S1 → catalog **S2** (wrong README, not prod outage) |
| DOC F-DOC-002 missing AUDIT_* files | F-DOC-002 is PROJECT.md in catalog; DOC’s missing files → **F-DOC-005** (S3, not filed separately — see traces/doc.md) |
| API F-API-001 ICS fail-open empty secret | **F-API-005** (S2) — calendar vs family both 403 in live probe for DKJVB-H; empty-secret behaviour UNKNOWN without dashboard |
| API F-API-002 cup seed | **F-API-003** |
| API F-API-003 lentopallo host | **F-API-006** S3 — parser accepts tulospalvelu.lentopallo.fi; Worker allowlist uses `*.torneopal.fi` + lentopallo may fail proxy |
| ORCH F-API-001 CORS :3000 | **F-API-001** | kept |
| DATA F-DATA-001 allowlist holds | catalog F-DATA-002 BY-DESIGN |
| DATA S1 last-name / ICS token | **F-SEC-005** (S2) playerName unconstrained; **F-SEC-006** (S2) calendarUrl may contain myclub token — see traces/data.md |

ORCH adjudication: **no S0, no production S1**. Honesty/privacy items stay S2.
