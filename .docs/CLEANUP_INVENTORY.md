# Cleanup Inventory

Last updated: 2026-06-02

This inventory tracks dead-code, stale-doc, and architecture cleanup work for
the stabilization phase. It separates safe cleanup from changes that need design
approval or runtime coordination.

## P0 — Fix Now / Low Risk

| Item | Finding | Action | Status |
|---|---|---|---|
| Agent handoff docs | Agents were reading scattered/stale docs first and could miss the Cost Workspace decision | Add `.docs/AGENT_START_HERE.md`, `.docs/DOCS_INDEX.md`, and `.docs/COST_WORKSPACE_FIELD_COVERAGE.md` | Done 2026-05-25 |
| Stale docs | Older AXON API/push, Codex AI briefing, test-data handoff, and standalone validation notes could be read as current truth | Move useful validation guidance into `AGENT_START_HERE.md`, keep AXON truth in `AXON_HANDOFF_CONTRACT.md`, and delete stale docs | Done 2026-05-25 |
| `client/` docs | `client/` no longer exists, but `AGENTS.md`, `CLAUDE.md`, and `README.md` still referenced a missing `CLIENT_RETIREMENT_PLAN.md` | Replace with "client retired; do not reintroduce" guidance | Done 2026-05-19 |
| Bulk Cost draft schema wording | Agent quick refs still mentioned `BulkCostLine`; live schema uses `BulkCostRun` + `DraftItem` + `DraftTerm` | Update quick refs | Done 2026-05-19 |
| Date/time write path | Main repo still passed Node `new Date()` for Item/Term `UpdatedDate`; deploy-proven `repos2` uses SQL `GETDATE()` | Port fix and add regression test | Done 2026-05-19 |
| Bulk Cost obsolete line table path | Runtime config/write helpers and manual revision SQL still carried `BulkCostLine` remnants even though live snapshots are `DraftItem` / `DraftTerm` | Remove unused helper/config and keep revision SQL limited to `BulkCostRun` metadata | Done 2026-05-19 |
| Next.js App Router Cleanups | Obsolete empty folders (`auth-permission`, `migration`), legacy route `term/[termId]`, and dormant SPA files (`ProtectedRoute.tsx`, `PageLoader.tsx`) remained in next-shell | Safely deleted all empty routes and unused components to clean up workspace | Done 2026-05-27 |
| BulkCostWorkspace Refactoring | BulkCostWorkspace.tsx was a ~6,300 line God component | Refactored by extracting cells, changes-panel, and result-panels to separate files, reducing it to ~4,300 lines | Done 2026-05-27 |
| UI Responsive Height Fix | Containers on zoomed-out / high-resolution screens collapsed and left empty space at the bottom/sides | Patched app-shell-locked, content-area-locked, page-root, cost-workspace-shell, and cost-workspace-main to use flex column layout with stretch alignment and explicit heights | Done 2026-05-27 |
| CWeight plan mojibake | `.docs/implementation_Cweight_Plan.md` was unreadable due to encoding corruption and contained superseded database direction | Rewrote the plan as a clean UTF-8 ASCII decision note: active SQL phase uses `PART_CATALOG_AIX.dbo.@GRAINGER_CWEIGHT`; Vector Search remains deferred | Done 2026-06-02 |
| Performance cache scratch plan | `.docs/implementation_PerformanceCache_Plan.md` was a standalone implementation scratch file and is not referenced by active docs | Removed from working tree; keep cache-component direction in active roadmap/template docs if needed | Done 2026-06-02 |


## P1 — Inventory Before Editing

| Area | Finding | Next Action |
|---|---|---|
| Target architecture docs | `.docs/ARCHITECTURE.md` still has long-term Better Auth/Prisma/Server Actions target sections | Keep as long-term only, but add explicit "not in reset scope" labels |
| Bulk Cost frontend mocks | `BulkCostWorkspace.tsx` can still load demo lines for known demo supplier codes; `SupplierSelection.tsx` no longer feeds mock/AXON queue rows into active New Allocation | Keep mock imports test/demo-only; remove from workspace once manual blank flow has complete coverage |
| AXON seed scripts | `server/sql/20260512_seed_mock_data.sql` still seeds legacy `AxonExtractionQueue` demo rows, but `/api/bulk-cost/queue` has been removed from the active route surface | Audit existing DB rows before dropping legacy tables |
| AI services scope | `ai-services/` was a local CWeight/AI research package, but PartCatalogAxon must not become the AXON orchestrator | Removed from active repo/runtime on 2026-05-19; keep only historical docs unless explicitly re-scoped |
| Cost Workspace naming | Runtime still uses `BulkCostRun` / `DraftItem` / `DraftTerm`, but the rebuild target is broader Cost Workspace naming | Design replacement schema first: `CostWorkspaceRun`, `CostWorkspaceLine`, `CostWorkspaceSnapshot`; do not rename live tables in place |
| Manual vs AXON source | Manual Bulk Cost is an add-on path, while AXON_AWARDED is the future primary source | Finish Manual formula/field validation first, then import awarded AXON rows into the same workspace engine |
| Stale handoff docs | Historical handoff and validation files have been removed from the working tree | Keep removed names out of startup prompts |

## P2 — Requires Design Before Code

| Area | Risk | Required Decision |
|---|---|---|
| ChainId schema | Current Bulk Cost tables need explicit `ChainId`, source revision, supplier quote, and AXON line ids for real handoff | Confirm AXON final comparison view keys |
| Backend/shared Bulk Cost calculation | Active Manual CAL calls backend `POST /api/bulk-cost/calculate`, but stale frontend/test calculation fixtures may still confuse agents | Keep backend calculate API as source of truth and remove or relabel any remaining frontend-only calculation fixtures after coverage review |
| Operation layer | Automation is hard if core actions are only UI flows | Initial plan documented in `AUTOMATION_READINESS.md`; first Bulk Cost operation wrapper added; continue with AXON handoff read model |
| Auth model | Legacy Windows-bound auth is not automation/service-account ready | Continue proxy/header-based transitional auth and decide future Better Auth or service-account model separately |
| Deploy scripts | `repos2/deploy` has proven scripts but belongs to old temporary deployment shape | Port only useful Nginx/NSSM/smoke pieces after review |
| Legacy AIX tables | `AxonExtractionQueue`, `GraingerWeightData`, and `GraingerWeightImportLog` appear obsolete for the target architecture | Backup and run row-count, FK, object-dependency, and code-reference checks before dropping |

## Drop Candidate Checklist

Do not drop database objects directly from screenshots. Before deleting any
table or script, record:

- row count
- latest updated/created timestamp
- foreign keys referencing or referenced by the object
- stored procedures/views/functions/triggers that reference the object
- app code references from `rg`
- backup/export path
- replacement source of truth

Current candidate direction:

| Object | Direction | Reason |
|---|---|---|
| `AxonExtractionQueue` | Drop candidate after checks | Legacy queue/mock path; target AXON source is awarded SQL/shared view |
| `GraingerWeightData` | Drop candidate after checks | Active CWeight source is `[PART_CATALOG_AIX].[dbo].[@GRAINGER_CWEIGHT]` |
| `GraingerWeightImportLog` | Drop candidate after checks | Paired with obsolete AIX staging table |
| `BulkCostRun` | Keep until replacement | Current live save/load depends on it |
| `DraftItem` | Keep until replacement | Current snapshot line data depends on it |
| `DraftTerm` | Keep until replacement | Current snapshot term data depends on it |

## Verification Baseline

Run before handoff after code changes:

```text
npm run typecheck
npm test
npm run build
```

For exact latest pass counts and historical verification, read
`.docs/FEATURE_STATUS.md`. Do not treat this cleanup inventory as a current test
result.
