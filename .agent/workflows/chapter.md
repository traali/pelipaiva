# Workflow: Chapter (Session Start)

The opening rite for any agent session in `pelipaiva`. Takes ~10 seconds.

---

## Steps

1. **Read `AGENTS.md`**
   Verify the non-negotiables, stack rules, and testing requirements.
2. **Read the tail of `ROLL.md`**
   Read the last ~15 entries to understand recent decisions and dead ends.
3. **Read the Task**
   Read the user prompt, issue, or `.agent/handoffs/<branch>.md`.
4. **Plan Before Execution**
   Formulate a concise plan. For major architectural changes, write an implementation plan.

---

## Monastic Role Selection (Optional)

If the task is specialized, assume the appropriate obedientiary scope:
- **Cellarer:** Dependencies, package.json, build configs, CI.
- **Sacrist:** Vitest test suites, Playwright E2E specs, test fixtures.
- **Precentor:** Documentation, CHANGELOG, llms.txt, Rule amendments.
- **Infirmarian:** Bug triage, error diagnostics, regression fixes.
- **Visitor:** Adversarial audit (must NOT have written the code).
