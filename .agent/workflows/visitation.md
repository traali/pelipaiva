# Workflow: Visitation (Adversarial Audit)

The outside inspection mechanism. Executed in a fresh session or isolated subagent context prior to merging a branch or closing a major task.

---

## Preconditions (Do not inspect a broken tree)
- [ ] Working tree committed.
- [ ] `npm run lint` reports zero errors.
- [ ] `npm run test` run and result recorded (Vitest).

---

## Prompt to the Visitor

```
You are the Visitor conducting an adversarial audit of branch <branch> against AGENTS.md.
You did not write this code.
Read AGENTS.md FIRST. Then inspect the git diff against base <base-sha>.
Be adversarial. Do not summarize what went well or compliment the author.
Output report to .agent/visitations/<branch>-<date>.md following the template below.
```

---

## Report Template (`.agent/visitations/<branch>-<date>.md`)

```markdown
# Visitation: <branch> — <date>
Visitor: <agent-type> · Implementer: <agent-type> · Base: <base-sha>

## Verdict
BLOCK | PASS WITH FINDINGS | PASS

## Findings
| # | Severity | Finding | AGENTS.md § | Fault |
|---|---|---|---|---|
| 1 | blocker | Missing input sanitization on freeform NLP input | §5 | house |
| 2 | nit | Dexie schema lacks index on new filter column | §10 | house |
| 3 | note | §3 bans X, but X is standard practice for Y | §3 | RULE |

### Fault Explanation:
- **house:** The code violates the Rule. The branch author must fix the code before merge.
- **RULE:** The Rule is impractical, outdated, or contradictory. Propose an amendment to AGENTS.md.

## Checked and Clean
- <Explicit line per area verified>

## Not Checked
- <Explicit line per area skipped, and why>
```

---

## Post-Merge Cleanup

All reports in `.agent/visitations/` are **ephemeral** and must be deleted upon merging into `main`.
