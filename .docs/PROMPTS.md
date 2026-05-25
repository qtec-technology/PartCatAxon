# Prompts

Updated: 2026-05-25

## Universal Agent Startup Prompt

Use this when opening a new Codex, Claude, Copilot, or other agent chat for
PartCatalog work.

```text
Read AGENTS.md, .docs/AGENT_START_HERE.md, and .docs/SYSTEM_OVERVIEW.md first.
Then read the task-specific docs listed there.

Current mission: Architecture Stabilization / Cost Workspace setup. Cost
Workspace is the product boundary; Bulk Cost is one calculation mode. Manual
Cost Workspace must be completed before AXON import so formulas, required
fields, UI, and revision snapshots can be verified. AXON_AWARDED will later
import only awarded supplier/line rows by ChainId/AIX ID through SQL/shared DB
view.

Hard rules:
- Active frontend is next-shell; backend is server; do not use retired client.
- Term calculation is backend source of truth.
- AXON owns Award. PartCatalog consumes only Award = Y rows.
- Do not write @POITM or @PITM1 from Cost Workspace until Review/Finalize
  rules, reverse mapping rules, and the business/order gate are approved.
- Do not drop DB objects without backup and dependency audit.
- Do not install broad skill/plugin packs just because they exist.
- For UI or calculation work, use .docs/TEMPLATE_STRATEGY.md and the closest
  existing template before inventing a new structure.

Before editing, run git status --short and inspect relevant files. Keep the
change scoped. After code changes, run npm run typecheck, npm test, and
npm run build before handoff. For docs-only changes, state that tests were not
run.
```

## Prompt For Copilot Display-Only Task

Use this only for low-risk UI/display tasks.

```text
Read AGENTS.md, .github/copilot-instructions.md, .docs/AGENT_START_HERE.md,
.docs/SYSTEM_OVERVIEW.md, .docs/DOCS_INDEX.md, .docs/FEATURE_STATUS.md,
.docs/BULK_COST.md, and .docs/BULK_COST_CALCULATION.md.

Task: perform only the Ready for Copilot display-only Bulk Cost Step 3 mapping
task assigned by the owner. Do not change formula math, backend Term calculation,
DraftTerm persistence, AXON Award flow, Review/Finalize flow, @POITM, or
@PITM1. Keep edits scoped to next-shell Bulk Cost labels/table display and
focused tests. Run focused tests first, then npm run typecheck, npm test, and
npm run build before handoff.
```

## Prompt For Codex Reserved Task

Use this for formula, persistence, or architecture work.

```text
Read AGENTS.md, .docs/AGENT_START_HERE.md, .docs/SYSTEM_OVERVIEW.md,
.docs/DOCS_INDEX.md, .docs/FEATURE_STATUS.md,
.docs/COST_WORKSPACE_ARCHITECTURE.md,
.docs/COST_WORKSPACE_FIELD_COVERAGE.md, .docs/BULK_COST.md,
.docs/BULK_COST_CALCULATION.md, .docs/AXON_HANDOFF_CONTRACT.md,
.docs/ARCHITECTURE.md, and the task-specific docs listed in DOCS_INDEX.

First reconcile git status, latest commits, and any uncommitted diffs. Then
design the smallest safe change for the assigned Reserved for Codex task.
Term calculation is the backend source of truth. Cost Workspace/Bulk Cost
calculation must stay aligned with backend/shared calculation services and
formula audit guards. AXON owns Award; PartCatalog consumes only Award = Y rows.
Do not write @POITM/@PITM1 until Review/Finalize rules, reverse mapping rules,
and the business/order gate are approved. Add tests before changing formula or
persistence behavior. Run npm run typecheck, npm test, and npm run build before
commit.
```

## Prompt For Copilot Temporary Takeover

```text
You are temporarily taking over PartCatalog work while Codex is unavailable.
Start by reading AGENTS.md, .docs/AGENT_START_HERE.md,
.docs/SYSTEM_OVERVIEW.md, .docs/DOCS_INDEX.md, .docs/FEATURE_STATUS.md,
.docs/ROADMAP.md, .docs/BULK_COST.md, .docs/BULK_COST_CALCULATION.md, and
the task-specific docs listed in DOCS_INDEX. If you are using Copilot, also
read .github/copilot-instructions.md.

First run git status --short and git log --oneline -10. If the repo has
changed, reconcile before editing. Do not assume prior chat memory.

Safe scope: small display/test/doc changes in next-shell Bulk Cost only.
Avoid formula/persistence/architecture changes unless explicitly assigned and
covered by tests. Do not touch retired client/, AXON Award flow,
Review/Finalize flow, @POITM, @PITM1, or reverse mapping.

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
Continue from AGENTS.md, .docs/AGENT_START_HERE.md,
.docs/SYSTEM_OVERVIEW.md, .docs/DOCS_INDEX.md, and .docs/FEATURE_STATUS.md.
Do not assume prior chat memory. Inspect git status and recent commits first.
Only owner-approved low-risk display/test/doc tasks are safe for Copilot.
Backend/shared calculation, AXON handoff, Review/Finalize, @POITM, @PITM1, and
reverse mapping are reserved for Codex unless explicitly assigned with tests.
```
