# QTEC PartCatalog

Internal web app replacing the old Microsoft Access workflow for Item, Term, Attachment, Calculation, and Bulk Cost Allocation.

## Quick Start

```bash
npm run dev          # server:3001 + next-shell:3010
npm run dev:next     # next-shell only
npm run dev:server   # Express API only
npm run typecheck    # server build + next-shell typecheck
npm test             # server tests + next-shell tests
npm run build        # server build + next-shell production build
```

## Architecture

```text
next-shell (3010) -> /api/* -> Express server (3001) -> SQL Server
                                             -> File Share
```

`next-shell/` is the active frontend. `server/` remains the backend API.
`client/` was retired on 2026-05-07; do not reintroduce it into normal
dev/build/deploy workflows.

## Key Directories

```text
next-shell/src/
  app/              App Router pages
  components/       shadcn/ui + custom components
  features/         Feature modules (bulk-cost, item, term)
server/src/
  routes/           Express route handlers
  services/         Business logic (calculation = source of truth)
  repositories/     DB layer (mssql)
.docs/              Technical docs for dev/agent
```

## Critical Rules

- Root workflow is `server + next-shell`; never reintroduce `client` into normal dev/build/deploy scripts.
- Term calculation = backend source of truth.
- Cost Workspace Phase 3A may persist only `BulkCostRun` / `DraftItem` / `DraftTerm` draft snapshots in `PART_CATALOG_AIX`.
- Do not overwrite `@POITM` / `@PITM1` or create real Item/Term master records from Cost Workspace until Review/Finalize rules, reverse mapping rules, and the business/order gate are approved; `DraftItem` / `DraftTerm` are AIX snapshot tables only.
- Run `npm run typecheck`, `npm test`, and `npm run build` before handing off.

## Docs To Read

| Work | Read |
|---|---|
| General work | `.docs/AGENT_START_HERE.md` + `.docs/SYSTEM_OVERVIEW.md` + `.github/copilot-instructions.md` + `.docs/FEATURE_STATUS.md` + `.docs/ROADMAP.md` |
| Architecture decision | `.docs/ARCHITECTURE.md` |
| AXON handoff | `.docs/AXON_HANDOFF_CONTRACT.md` |
| Cost Workspace / Bulk Cost | `.docs/COST_WORKSPACE_ARCHITECTURE.md` + `.docs/COST_WORKSPACE_FIELD_COVERAGE.md` + `.docs/BULK_COST.md` + `.docs/BULK_COST_CALCULATION.md` |
| Roadmap / Phase | `.docs/ROADMAP.md` |
| Docs cleanup / handoff | `.docs/DOCS_INDEX.md` + `.docs/CLEANUP_INVENTORY.md` |
| CWeight / AI-assisted scope | `.docs/CWEIGHT_DECISION_NOTE.md` + `.docs/CWEIGHT_EVALUATION.md` |

## Update Docs After Work

| Change | Update |
|---|---|
| Bug fix / feature | `.docs/FEATURE_STATUS.md` |
| Architecture decision | `.docs/ARCHITECTURE.md` + `.docs/FEATURE_STATUS.md` |
| Cleanup / dead code | `.docs/CLEANUP_INVENTORY.md` + `.docs/ROADMAP.md` |
| Cost Workspace / Bulk Cost | `.docs/COST_WORKSPACE_ARCHITECTURE.md` + `.docs/COST_WORKSPACE_FIELD_COVERAGE.md` + `.docs/BULK_COST.md` + `.docs/BULK_COST_CALCULATION.md` |
