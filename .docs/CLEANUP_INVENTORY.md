# Cleanup Inventory

Last updated: 2026-05-19

This inventory tracks dead-code, stale-doc, and architecture cleanup work for
the stabilization phase. It separates safe cleanup from changes that need design
approval or runtime coordination.

## P0 — Fix Now / Low Risk

| Item | Finding | Action | Status |
|---|---|---|---|
| `client/` docs | `client/` no longer exists, but `AGENTS.md`, `CLAUDE.md`, and `README.md` still referenced a missing `CLIENT_RETIREMENT_PLAN.md` | Replace with "client retired; do not reintroduce" guidance | Done 2026-05-19 |
| Bulk Cost draft schema wording | Agent quick refs still mentioned `BulkCostLine`; live schema uses `BulkCostRun` + `DraftItem` + `DraftTerm` | Update quick refs | Done 2026-05-19 |
| Date/time write path | Main repo still passed Node `new Date()` for Item/Term `UpdatedDate`; deploy-proven `repos2` uses SQL `GETDATE()` | Port fix and add regression test | Done 2026-05-19 |
| Bulk Cost obsolete line table path | Runtime config/write helpers and manual revision SQL still carried `BulkCostLine` remnants even though live snapshots are `DraftItem` / `DraftTerm` | Remove unused helper/config and keep revision SQL limited to `BulkCostRun` metadata | Done 2026-05-19 |

## P1 — Inventory Before Editing

| Area | Finding | Next Action |
|---|---|---|
| AXON integration docs | `.docs/AXON_INTEGRATION.md` still contains older API/push wording and AXON pipeline details that read like PartCatalogAxon owns AXON | Rework around `.docs/AXON_HANDOFF_CONTRACT.md` after confirming view names with Pi-Jo |
| Target architecture docs | `.docs/ARCHITECTURE.md` still has long-term Better Auth/Prisma/Server Actions target sections | Keep as long-term only, but add explicit "not in reset scope" labels |
| Bulk Cost frontend mocks | `BulkCostWorkspace.tsx` can still load demo lines for known demo supplier codes; `SupplierSelection.tsx` no longer feeds mock/AXON queue rows into active New Allocation | Keep mock imports test/demo-only; remove from workspace once manual blank flow has complete coverage |
| AXON seed scripts | `server/sql/20260512_seed_mock_data.sql` still seeds legacy `AxonExtractionQueue` demo rows, but `/api/bulk-cost/queue` has been removed from the active route surface | Audit existing DB rows before dropping legacy tables |
| AI services scope | `ai-services/` was a local CWeight/AI research package, but PartCatalogAxon must not become the AXON orchestrator | Removed from active repo/runtime on 2026-05-19; keep only historical docs unless explicitly re-scoped |

## P2 — Requires Design Before Code

| Area | Risk | Required Decision |
|---|---|---|
| ChainId schema | Current Bulk Cost tables need explicit `ChainId`, source revision, supplier quote, and AXON line ids for real handoff | Confirm AXON final comparison view keys |
| Backend/shared Bulk Cost calculation | Bulk Cost calculation still has frontend-only ownership risk | Define shared calculation API/service before Award/SAP automation |
| Operation layer | Automation is hard if core actions are only UI flows | Initial plan documented in `AUTOMATION_READINESS.md`; first Bulk Cost operation wrapper added; continue with AXON handoff read model |
| Auth model | Windows/IIS-style auth is not automation/service-account ready | Decide transitional domain header vs future Better Auth migration path |
| Deploy scripts | `repos2/deploy` has proven scripts but belongs to old temporary deployment shape | Port only useful Nginx/NSSM/smoke pieces after review |

## Verification Baseline

Latest reset verification:

```text
npm run typecheck
npm test        # server 110 + next-shell 70
npm run build
```

All passed on 2026-05-19 after the Bulk Cost entry cleanup and `ai-services/`
retirement.
