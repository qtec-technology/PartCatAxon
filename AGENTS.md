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

Read `.docs/CLIENT_RETIREMENT_PLAN.md` before deleting `client/`.

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
- Bulk Cost Phase 3A may persist only `BulkCostRun` / `BulkCostLine` draft snapshots in `PART_CATALOG_AIX`.
- Do not overwrite `@POITM` / `@PITM1` or create Draft Item/Term from Bulk Cost until Awarded reverse mapping is designed.
- Run `npm run typecheck`, `npm test`, and `npm run build` before handing off.

## Docs To Read

| Work | Read |
|---|---|
| General work | `.github/copilot-instructions.md` + `.docs/FEATURE_STATUS.md` |
| Architecture decision | `.docs/ARCHITECTURE.md` |
| Bulk Cost | `.docs/BULK_COST.md` + `.docs/BULK_COST_CALCULATION.md` + `.docs/AXON_INTEGRATION.md` |
| Roadmap / Phase | `.docs/ROADMAP.md` |
| AI service tasks (Codex scope) | `.docs/CODEX_BRIEFING.md` |

## Update Docs After Work

| Change | Update |
|---|---|
| Bug fix / feature | `.docs/FEATURE_STATUS.md` |
| Architecture decision | `.docs/ARCHITECTURE.md` + `.docs/FEATURE_STATUS.md` |
| Client retirement progress | `.docs/CLIENT_RETIREMENT_PLAN.md` + `.docs/ROADMAP.md` |
| Bulk Cost | `.docs/BULK_COST.md` + `.docs/BULK_COST_CALCULATION.md` + `.docs/AXON_INTEGRATION.md` |
