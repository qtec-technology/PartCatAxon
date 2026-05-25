# Agent Start Here

Last updated: 2026-05-25

Use this file as the first read for every Codex, Claude, Copilot, or other AI
agent session on this repo. It is intentionally shorter than the full docs, but
it points to the current source of truth.

## 1. Current Mission

The project is in **Architecture Stabilization / Cost Workspace setup**.

The next work must make the repo easy for agents to continue safely:

1. Keep Cost Workspace decisions aligned.
2. Finish Manual Cost Workspace first.
3. Verify formulas and field coverage before AXON integration.
4. Build the new schema only after the field matrix is reviewed.
5. Do not delete DB objects until backup and dependency audit are complete.

## 2. Active Runtime

```text
next-shell (3010) -> /api/* -> Express server (3001) -> SQL Server
                                             -> File Share
```

- Active frontend: `next-shell/`
- Backend API: `server/`
- Retired frontend: `client/` was deleted/retired on 2026-05-07. Do not
  reintroduce it into scripts, docs, deployment, or tests.

Commands from repo root:

```powershell
npm run dev
npm run typecheck
npm test
npm run build
```

Run `npm run typecheck`, `npm test`, and `npm run build` before handoff after
code changes. For docs-only changes, state that tests were not run.

## 3. Current Architecture Decisions

Read `.docs/COST_WORKSPACE_ARCHITECTURE.md` for the full decision record.

Locked decisions:

- Product boundary is **Cost Workspace**, not standalone Bulk Cost.
- Cost Workspace supports `SINGLE` and `BULK` calculation modes in one editor.
- Cost Workspace supports `MANUAL` and `AXON_AWARDED` sources.
- Manual is implemented first to verify formulas, required columns, UI, and
  snapshots before real AXON handoff.
- AXON remains Pi-Jo's system. PartCatalog consumes awarded supplier/line data
  only.
- AXON handoff is SQL/shared DB view by `ChainId` / AIX ID.
- `ChainId` / AIX ID is correlation/search/display metadata, not the primary
  key.
- Draft workspace is freely editable.
- Every Save Revision creates a new immutable snapshot.
- Review / Finalize validates a saved revision before master write.
- CWeight is a separate reusable module/service; Cost Workspace only calls it.

## 4. Hard Rules

- Term calculation remains backend source of truth.
- AXON owns Award. PartCatalog consumes only `Award = Y` rows.
- Do not write `@POITM` or `@PITM1` from Cost Workspace until
  Review/Finalize rules, reverse mapping rules, and the business/order gate are
  designed and approved.
- Current live snapshot tables `BulkCostRun`, `DraftItem`, and `DraftTerm` must
  be kept until replacement schema is implemented or data is migrated.
- Target rebuild names should prefer:

```text
CostWorkspaceRun
CostWorkspaceLine
CostWorkspaceSnapshot
```

- Do not make `ChainId`, job name, or reference number the primary key.
- Do not hide missing costs inside SAP-limited fields during workspace
  calculation. Preserve transparent cost truth first; compress/map later.
- Do not drop DB tables from screenshots. Audit row counts, references,
  dependencies, and backups first.

## 5. Required Reading By Task

| Task | Read first |
|---|---|
| Any task | `AGENTS.md`, this file, `.docs/SYSTEM_OVERVIEW.md`, `.docs/FEATURE_STATUS.md`, `.docs/ROADMAP.md` |
| Cost Workspace | `.docs/COST_WORKSPACE_ARCHITECTURE.md`, `.docs/COST_WORKSPACE_FIELD_COVERAGE.md`, `.docs/BULK_COST.md`, `.docs/BULK_COST_CALCULATION.md` |
| UI/template work | `.docs/TEMPLATE_STRATEGY.md`, `.docs/SYSTEM_OVERVIEW.md`, closest existing page/component |
| Calculation template work | `.docs/TEMPLATE_STRATEGY.md`, `.docs/BULK_COST_CALCULATION.md`, `.docs/COST_WORKSPACE_FIELD_COVERAGE.md` |
| AXON handoff | `.docs/AXON_HANDOFF_CONTRACT.md` |
| DB cleanup | `.docs/CLEANUP_INVENTORY.md`, `.docs/DOCS_INDEX.md` |
| Item/Term fields | `.docs/DATA_SCHEMA.md`, `.docs/COST_WORKSPACE_FIELD_COVERAGE.md` |
| CWeight | `.docs/CWEIGHT_DECISION_NOTE.md`, `.docs/CWEIGHT_EVALUATION.md` |
| Deployment/auth | `.docs/DEPLOYMENT_RUNBOOK.md`, `.docs/ARCHITECTURE.md` |

## 6. Current Safe Work Order

Do work in this order unless the owner explicitly changes scope:

1. Agent docs and handoff pack.
2. Field Coverage Matrix.
3. Cost Workspace schema design.
4. SQL audit/drop plan for obsolete objects.
5. Manual Cost Workspace field/formula/validation completion.
6. AXON awarded-view import after Pi-Jo confirms final view names/columns.
7. PartCatalog Review / Finalize.
8. Real master writes to Item/Term only after Review/Finalize rules and
   business/order gate are approved.

## 7. Skills / Plugin Policy

Do not install many skills/plugins just because they exist. Use only what helps
the current task.

Recommended for this repo:

- Browser/Playwright only when verifying UI.
- Documents/spreadsheets only when editing those file types.
- OpenAI docs only for OpenAI product/API questions.
- Frontend/design/shadcn guidance only when doing UI implementation.
- Karpathy-style rules, such as `multica-ai/andrej-karpathy-skills`, may be
  used as lightweight code-quality guidance only when already available or
  explicitly requested.

Avoid starting work by installing external skill packs. The repo docs are the
source of truth for agents on this project.
Generic skill rules never override repo docs, business decisions, SAP safety
rules, or task-specific requirements.

## 8. Handoff Requirements

At the end of any non-trivial session, report:

- files changed
- tests run and pass/fail status
- decisions made
- open questions
- next recommended step

Validation baseline after code changes:

```powershell
npm run typecheck
npm test
npm run build
```

For formula changes, add/update backend calculation tests and Cost Workspace
formula/golden tests before changing implementation. For persistence changes,
add mapper/repository tests and confirm no write touches `@POITM` / `@PITM1`.
Browser verification is useful for UI display changes, but it is not a
replacement for the command baseline.

If another agent will continue, point them to this file first.
