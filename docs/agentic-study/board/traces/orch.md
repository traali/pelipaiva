# TRACE — ORCH

Phase 0 written first (`00-recon.md`, `01-strategy.md`, prompts).  
Four explore subagents dispatched (DOC/ARC/API/DATA). Traces below authored by ORCH from first-hand reads at SHA `20bad06` when spokes had not yet landed files (elapsed >3 min, empty `board/traces/`).

Live probes (this run):
- GET https://pelipaiva.pages.dev/ → 200
- GET /api/calendar?perhe=DKJVB-H → 403 `{"error":"unknown_family"}` application/json
- Worker /api/family/DKJVB-H → 403
- CI/CD GitHub: success on `20bad06`
