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

## Emergency Prompt If Quota Ends Immediately

```text
Continue from .docs/HANDOFF.md and .docs/TASKS.md. Do not assume prior chat
memory. Inspect git status and recent commits first. Treat generated
next-shell/next-env.d.ts churn as repo state to reconcile before committing.
Only Ready for Copilot tasks are safe for Copilot. Formula, persistence,
Valid From, backend/shared calculation, and Award/SAP-adjacent work are reserved
for Codex.
```

