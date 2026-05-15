# Prompts

Updated: 2026-05-15

## Prompt For Copilot Display-Only Task

Use this only for low-risk UI/display tasks.

```text
Read AGENTS.md, CLAUDE.md, .github/copilot-instructions.md, .docs/HANDOFF.md,
.docs/TASKS.md, .docs/BULK_COST.md, and .docs/BULK_COST_CALCULATION.md.

Task: perform only the Ready for Copilot display-only Bulk Cost Step 3 mapping
task assigned by the owner. Do not change formula math, backend Term calculation,
DraftTerm persistence, Award/SAP flow, @POITM, or @PITM1. Keep edits scoped to
next-shell Bulk Cost labels/table display and focused tests. Run focused tests
first, then npm run typecheck, npm test, and npm run build before handoff.
```

## Prompt For Codex Reserved Task

Use this for formula, persistence, or architecture work.

```text
Read AGENTS.md, CLAUDE.md, .github/copilot-instructions.md, .docs/HANDOFF.md,
.docs/TASKS.md, .docs/BULK_COST.md, .docs/BULK_COST_CALCULATION.md,
.docs/AXON_INTEGRATION.md, .docs/ARCHITECTURE.md, and .docs/FEATURE_STATUS.md.

First reconcile git status, latest commits, and any uncommitted diffs. Then
design the smallest safe change for the assigned Reserved for Codex task.
Term calculation is the backend source of truth. Bulk Cost calculation is still
frontend with an audit guard. Do not write @POITM/@PITM1 and do not touch
Award/SAP reverse mapping. Add tests before changing formula behavior. Run
npm run typecheck, npm test, and npm run build before commit.
```

## Prompt For Copilot Temporary Takeover

```text
You are temporarily taking over PartCatalog work while Codex is unavailable.
Start by reading AGENTS.md, CLAUDE.md, .github/copilot-instructions.md,
.docs/AGENT_SITUATION.md, .docs/HANDOFF.md, .docs/TASKS.md,
.docs/VALIDATION.md, .docs/BULK_COST.md, .docs/BULK_COST_CALCULATION.md,
.docs/AXON_INTEGRATION.md, and .docs/FEATURE_STATUS.md.

First run git status --short and git log --oneline -10. Latest known Codex
commit is a0a10d0 fix: persist bulk cost draft term valid from. If the repo has
changed, reconcile before editing.

Safe scope: small display/test/doc changes in next-shell Bulk Cost only.
Avoid formula/persistence/architecture changes unless explicitly assigned and
covered by tests. Do not touch old client/, Award/SAP flow, @POITM, @PITM1, or
reverse mapping.

Before handoff back to Codex, write down:
- commits you made
- files changed
- tests run and exact pass/fail counts
- open risks
- any assumptions or business questions
- anything intentionally not done

Run npm run typecheck, npm test, and npm run build before committing.
```

## Emergency Prompt If Quota Ends Immediately

```text
Continue from .docs/HANDOFF.md and .docs/TASKS.md. Do not assume prior chat
memory. Inspect git status and recent commits first. Latest known Codex commit
is a0a10d0. Only Ready for Copilot tasks are safe for Copilot. Backend/shared
calculation, Award/SAP-adjacent work, @POITM, @PITM1, and reverse mapping are
reserved for Codex unless explicitly assigned with tests.
```
