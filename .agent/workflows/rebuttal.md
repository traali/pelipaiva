# Workflow: Rebuttal (Right of Appeal)

The author's right to challenge a Visitor finding. Without this, false positives accumulate forever and bad rules cannot be corrected.

**One rebuttal per finding. One ground per rebuttal. Decided by someone who did not make the finding.**

---

## Grounds

| Ground | Claim | Decided by | If upheld |
|---|---|---|---|
| **1. Misread** | Visitor's factual claim about the code is wrong | Original Visitor, re-reading cited lines | Finding withdrawn |
| **2. Out of scope** | Pre-existing defect, not introduced by this diff | Check the diff mechanically | Finding withdrawn; add to `DEBT.md` |
| **4. Rule wrong** | Code is valid but the rule should change | Author amends `AGENTS.md`, logs in `ROLL.md` | Finding falls; rule updated |
| **5. Deferred** | Finding is valid but out of scope for this change | Author asserts (advisory only) | Merge proceeds with `DEBT.md` entry |

*Ground 3 (rule silent, blind second Visitor) is reserved for Stage 2+ when concurrent authors exist.*

**Blocking findings are appealable only on grounds 1 and 4 — never deferred under ground 5.**

---

## Rebuttal Template (.agent/rebuttals/<branch>-<date>-F<n>.md)

One file per contested finding.

```markdown
# Rebuttal — <branch> — <date>
Finding: F<n> (from visitation .agent/visitations/<branch>-<date>.md)

## Ground
[1 misread | 2 out of scope | 4 rule wrong | 5 deferred]

## Argument
<One paragraph. Cite the lines in question. Quote the rule text you rely on.>

## Evidence
<Verbatim code excerpt or rule quote that supports the argument.>

## If ground 5 (deferred)
- Owner: <id>
- Deadline: <YYYY-MM-DD>
- DEBT.md entry: <D-n>

## Decision
<Outcome: withdrawn | upheld | rule amended | merged with DEBT.md entry>
```

---

## Process

1. Author writes one rebuttal file per contested finding.
2. **Ground 1 or 2:** original Visitor re-reads cited lines, withdraws or upholds. No further rounds.
3. **Ground 4:** author amends `AGENTS.md` directly and logs the decision in `ROLL.md`. Finding falls automatically.
4. **Ground 5:** author adds a `DEBT.md` entry and asserts the deferral. Advisory findings only.
5. Each finding gets exactly one rebuttal. Outcome is final.

---

## Keeping It Honest

- No rebuttal may argue 'the Visitor should have been less strict.' That is not a ground.
- If three rebuttals on ground 4 point at the same rule section, amend the section — not the rebuttals.
- A withdrawn finding is gone. It cannot be re-raised on the same diff by a subsequent Visitor.
