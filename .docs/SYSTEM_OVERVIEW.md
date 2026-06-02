# System Overview

Last updated: 2026-05-25

This is the high-level overview of the whole QTEC PartCatalog system. Use it
when onboarding a developer/agent, explaining the project to management, or
deciding which detailed document to read next.

For implementation details, read:

- `.docs/ARCHITECTURE.md` for technical architecture
- `.docs/DATA_SCHEMA.md` for Item/Term database field mapping
- `.docs/COST_WORKSPACE_ARCHITECTURE.md` for Cost Workspace decisions
- `.docs/COST_WORKSPACE_FIELD_COVERAGE.md` for field coverage and schema planning
- `.docs/AXON_HANDOFF_CONTRACT.md` for AXON handoff rules
- `.docs/FEATURE_STATUS.md` for current status

## 1. Purpose

QTEC PartCatalog is an internal web application replacing the older Microsoft
Access workflow for:

- Part Catalog search
- Item registration and maintenance
- Term / supplier cost and selling price maintenance
- Attachment and item image handling
- Term calculation
- Cost Workspace / Bulk Cost allocation
- Missing-cost-column capture for costs that were historically hidden in other
  fields, such as document/certificate/calibration-style charges
- Revision snapshots for traceability
- Future AXON awarded-quote handoff

The system's practical goal is to let sales and related teams prepare item and
term data accurately enough for PartCatalog/SAP usage while preserving
traceability of how a cost or selling price was calculated.

The web application first copies the essential Access baseline, then adds Cost
Workspace capabilities that Access did not handle well: bulk/header cost
allocation, transparent cost columns, and revision history.

## 2. Current Runtime Shape

```text
Browser
  -> Next.js shell (next-shell, port 3010)
      -> /api/* BFF proxy
          -> Express API server (server, port 3001)
              -> SQL Server
              -> File shares
```

Active runtime:

| Layer | Current implementation |
|---|---|
| Frontend | `next-shell/`, Next.js App Router, React, TypeScript |
| Backend | `server/`, Express, TypeScript |
| Database | SQL Server, mainly `SBOQTEC` and `PART_CATALOG_AIX` |
| Files | Network shares for item images and attachments |
| Retired frontend | `client/` is retired and must not be reintroduced |

Development commands from repo root:

```powershell
npm run dev
npm run typecheck
npm test
npm run build
```

## 3. System Modules

| Module | Owner boundary | Current state | Notes |
|---|---|---|---|
| Search / Part Catalog | PartCatalog | Active | Search item and expand term information |
| Item | PartCatalog | Active | Create/view/edit item, image, attachments |
| Term | PartCatalog | Active | Create/view/edit term and calculate price |
| Term Calculation / Single Cost | Backend PartCatalog | Active | Backend source of truth for one-item/one-term calculation |
| Cost Workspace / Bulk Cost | PartCatalog | Active but redesigning | Manual path exists; target is broader Cost Workspace with Single + Bulk modes |
| CWeight | Separate service/module | Backend-only support exists | UI integration deferred; reusable outside PartCatalog |
| AXON handoff | AXON owns Award, PartCatalog consumes awarded rows | Scaffolded, waiting for real views | Shared SQL/view by ChainId/AIX ID |
| Review / Finalize | PartCatalog | Not built | Required before writing master Item/Term |
| Deployment/auth stabilization | PartCatalog | Active | Target is Nginx/NSSM/proxy-header auth |
| Full AI automation | Future | Deferred | Requires module boundaries and operation layer |

## 4. Main User Flows

### 4.1 Existing Search / Item / Term Flow

```text
Sales/user
  -> Search Part Catalog
  -> Open item
  -> View/edit item details
  -> Open/create term
  -> Enter supplier/cost/logistics fields
  -> Backend calculates Term
  -> Save term
```

Important rules:

- Item and Term are active production workflows.
- Term calculation must be done by backend logic.
- The frontend must not become the authoritative calculation engine for Term.
- Attachments and images write metadata to DB and files to network shares.
- This flow works well for normal one-by-one work, but becomes slow when one
  supplier quote contains many lines because sales must repeat Add Item/Add Term
  line by line.

### 4.2 Current Manual Bulk Cost Flow

The current implementation surface is still named `/bulk-cost`, but the target
business concept is Cost Workspace.

```text
Open /bulk-cost
  -> Choose supplier from vendor master
  -> Open blank manual workspace
  -> Choose/confirm Single or Bulk calculation mode
  -> Enter Step 1 setup and header costs
  -> Add/edit line items in Step 2
  -> Run CAL
  -> Review calculated result in Step 3
  -> Save Revision
```

Current persistence:

```text
BulkCostRun
  -> DraftItem
  -> DraftTerm
```

These are AIX snapshot tables only. They are not real Item/Term master writes.

This current manual flow is not the AXON awarded flow. It exists so the team can
finish formula validation, missing field coverage, UI behavior, and snapshots
without waiting for Pi-Jo's final AXON view.

### 4.3 Target Cost Workspace Flow

Cost Workspace is the future product boundary. Bulk Cost is one mode inside it.

```text
Workspace List
  -> New Manual Workspace
  -> Import from AXON by ChainId/AIX ID

Workspace Editor
  -> source: MANUAL | AXON_AWARDED
  -> mode: SINGLE | BULK
  -> editable draft lines
  -> CAL / recalculate
  -> Save Revision

PartCatalog Review / Finalize
  -> validate Item fields
  -> validate Term fields
  -> review calculation and mapping
  -> decide new item/new term/existing item/update path
  -> only then write master records when approved and business rules allow it
```

Target table naming:

```text
CostWorkspaceRun
CostWorkspaceLine
CostWorkspaceSnapshot
```

Do not rename current runtime tables in place before schema and migration rules
are designed.

### 4.4 Future AXON Handoff Flow

AXON is Pi-Jo's side. PartCatalog must not rebuild AXON and must not own the
Award UI.

```text
AXON
  -> receives customer RFQ
  -> groups/requests supplier quotes
  -> reads supplier replies
  -> compares suppliers
  -> sales marks awarded supplier/line in AXON
  -> publishes awarded view by ChainId/AIX ID

PartCatalog
  -> queries only Award = Y rows through backend
  -> clones origin data into Cost Workspace
  -> lets sales edit latest values
  -> calculates cost
  -> saves revision snapshot
  -> later finalizes to Item/Term
```

AXON handoff should be shared SQL/view/module access on the same server
environment, not browser SQL and not a public REST API as the first target.

PartCatalog consumes only awarded supplier/line data, not the whole AXON RFQ UI
and not the whole comparison/award screen. If a comparison-like view is needed
later inside PartCatalog, it must remain read-only/import oriented unless the
architecture decision changes.

## 5. Data Ownership

| Data / Process | Owner | Rule |
|---|---|---|
| Customer RFQ chain | AXON | PartCatalog does not manage this |
| Supplier quote extraction | AXON | AI may suggest fields and mark header/line costs |
| Award selection | AXON | Sales chooses Award in AXON; PartCatalog consumes `Award = Y` rows |
| Cost calculation workspace | PartCatalog | Sales can edit every business field before save |
| Save Revision / Snapshot | PartCatalog | Every Save Revision creates immutable calculation evidence |
| Review / Finalize | PartCatalog | Validates Item/Term required fields and mapping before master write |
| Item/Term master write | PartCatalog | Must wait for Review/Finalize rules and the business/order gate |
| CWeight lookup | Separate module/service | Workspace calls it for suggestions |

## 6. Database Overview

### 6.1 Main Databases

| Database | Role |
|---|---|
| `SBOQTEC` | SAP-side/master tables and read views |
| `PART_CATALOG_AIX` | App-side lookups/views plus current draft/snapshot storage |
| `GRAINGER` | Existing Grainger CWeight source table |

### 6.2 Important SAP/PartCatalog Objects

| Object | Role |
|---|---|
| `SBOQTEC.dbo.@POITM` | PartCatalog/SAP Item master production write target |
| `SBOQTEC.dbo.VWIT_@POITM` | Item read view |
| `SBOQTEC.dbo.@PITM1` | PartCatalog/SAP Term master production write target |
| `PART_CATALOG_AIX.dbo.vw@PITM1` | Term read view |
| `PART_CATALOG_AIX.dbo.@OCRD` | Vendor lookup |
| `PART_CATALOG_AIX.dbo.@LOCATION` | Location / zone lookup |
| `PART_CATALOG_AIX.dbo.@SUBLOCATION` | Purchase/sales sub-location lookup |
| `SBOQTEC.dbo.@CURRENCY` | Currency and exchange-rate lookup |
| `SBOQTEC.dbo.@ORDERTERM` | Purchase/sales term lookup |
| `GRAINGER.dbo.@GRAINGER_CWEIGHT` | Active trusted CWeight source |

PartCatalog master data and SAP master data are the same production records for
Item/Term: writing to `SBOQTEC.dbo.@POITM` or `SBOQTEC.dbo.@PITM1` is both a
PartCatalog master write and an SAP master write. `PART_CATALOG_AIX` mirror
tables with matching names are sandbox validation targets only.

### 6.3 Current Cost Workspace Related Tables

| Object | Current direction |
|---|---|
| `BulkCostRun` | Keep until replacement schema exists |
| `DraftItem` | Keep until replacement schema exists |
| `DraftTerm` | Keep until replacement schema exists |
| `AxonExtractionQueue` | Drop candidate after audit and backup |
| `GraingerWeightData` | Drop candidate after audit and backup |
| `GraingerWeightImportLog` | Drop candidate after audit and backup |

`PART_CATALOG_AIX` should not be described as "RAM" by itself. The RAM concept
means the editable workspace/draft behavior. The database is the app-side
storage area for lookups, views, drafts, and saved snapshots.

## 7. Calculation Overview

### 7.1 Term Calculation

Term calculation is the production source of truth and lives in backend code.

Key principles:

- Frontend sends input fields.
- Backend recalculates before save.
- Backend output includes OP, freight, CIF, duty, QLC, markup, and sales price
  values.
- `U_QLC3` is the persisted total price field.
- `U_TotalPrice` is compatibility alias only.

### 7.2 Cost Workspace / Bulk Calculation

Bulk mode takes run-level/header costs and allocates them to line level.

Current allocation rules:

| Cost | Allocation basis |
|---|---|
| PKH | by weight |
| SOC | by weight |
| Freight / FR | by weight |
| Custom Clear / CC | by weight |
| Wire TT | by value |
| Document fees per each | direct into OP1 |
| Lot/batch document fees | separate service-line candidate |

Important rule:

- If every selected Bulk line has no usable weight/CWeight, weight-based
  allocation must be blocked.
- If some lines are missing weight, policy is still open. Recommended default:
  allow CAL with warning only if owner approves, but block Finalize.
- Workspace calculation should keep transparent cost truth first. SAP/Term
  field compression or mapping belongs in Review/Finalize, not in the draft
  calculation truth.

## 8. CWeight Overview

CWeight means chargeable/shipping weight used for freight and allocation.

Architecture decision:

- CWeight is a separate module/service.
- It is reusable by sales, import/export, shipping, and future workflows.
- Cost Workspace calls it for prefill/suggestions.
- It must not overwrite user-edited weights automatically.

Source priority:

1. Direct formula from actual weight and dimensions when enough data exists.
2. Trusted exact lookup from `GRAINGER.dbo.@GRAINGER_CWEIGHT`.
3. Future Qdrant/vector search as a candidate lookup layer that returns a
   payload such as Grainger number, then SQL is queried for the trusted weight.
4. Future external AI/search only as review suggestion.
5. Manual user entry as final fallback.

Do not ask AI to find "chargeable weight" directly. It should gather actual
weight and dimensional/shipping evidence, then the module determines the
reviewable CWeight.

Current near-term AI scope should stay focused on CWeight. HS Code, Import
Duty, Permit, and similar classification work are future / AXON-team scope
unless a new decision changes ownership.

## 9. File Storage

| File type | Storage |
|---|---|
| Item images | `\\192.168.2.53\AttachmentItemImage` |
| Attachments | `\\192.168.2.53\Attachment` |
| User pictures | `\\192.168.2.52\_PartCat_Resource\user_picture` |

## 10. Auth And Deployment Direction

Current direction:

- Development uses configured dev user environment values.
- Production should run behind Nginx or trusted reverse proxy.
- Express should trust proxy identity headers only in production.
- The old IIS/Windows-bound assumption should not drive future architecture.

Target direction:

```text
Nginx / trusted proxy
  -> Next.js standalone
  -> Express API
  -> SQL Server and file shares
```

Longer-term auth target is Better Auth / RBAC, but it is not the immediate
stabilization task.

## 11. Agent And Skills Policy

Agents should start from repo docs, not from broad external skill packs.

First-read files:

1. `AGENTS.md`
2. `.docs/AGENT_START_HERE.md`
3. `.docs/SYSTEM_OVERVIEW.md`
4. `.docs/FEATURE_STATUS.md`
5. Task-specific docs from `.docs/DOCS_INDEX.md`

Skill/plugin guidance:

- Use browser/playwright only when verifying UI.
- Use documents/spreadsheets only when editing those artifact types.
- Use official docs tools only when the task needs current external docs.
- Karpathy-style rules can be used as lightweight code-quality guidance when
  already available or explicitly requested.
- Do not install broad skill packs just because they exist.
- Generic skill rules never override repo docs, business decisions, SAP safety
  rules, or task-specific requirements.

## 12. Current Status Summary

| Area | Status |
|---|---|
| Search / Item / Term baseline | Active |
| Next.js native frontend | Active |
| Express backend | Active |
| Term calculation | Active, backend source of truth |
| Manual Bulk Cost | Active but being reframed as Cost Workspace |
| Cost Workspace schema | Not rebuilt yet |
| Field coverage matrix | Started |
| AXON real awarded view | Waiting for Pi-Jo final view names/columns |
| Review / Finalize page | Not built |
| Master Item/Term writes from workspace | Blocked until rules and business/order gate are approved |
| DB cleanup | Planned, not executed |

## 13. Safe Work Order

Current recommended sequence:

1. Review and complete field coverage matrix.
2. Design Cost Workspace schema.
3. Audit current DB objects before any drop.
4. Complete Manual Cost Workspace fields/formula/validation.
5. Add draft persistence behavior if approved.
6. Build PartCatalog Review / Finalize.
7. Integrate AXON awarded view when available.
8. Only then design/write real Item/Term master mapping after the approved
   business/order gate.

## 14. Non-Negotiable Safety Rules

- Do not write `@POITM` or `@PITM1` from workspace until final rules exist.
- Do not treat ChainId/AIX ID as primary key.
- Do not delete database objects without backup and dependency checks.
- Do not hide supplier costs inside unrelated fields during workspace
  calculation.
- Do not let AXON/AI values become locked business truth. Sales must be able to
  edit business fields.
- Do not split Single and Bulk into separate calculation products unless the
  owner explicitly changes the architecture.
- Do not let PartCatalog own the Award decision unless Pi-Jo changes the AXON
  handoff contract. The current rule is: AXON owns Award, PartCatalog consumes
  awarded rows.

## 15. Where To Go Next

| Need | Read |
|---|---|
| Technical architecture | `.docs/ARCHITECTURE.md` |
| Current status | `.docs/FEATURE_STATUS.md` |
| Cost Workspace decision | `.docs/COST_WORKSPACE_ARCHITECTURE.md` |
| Field coverage | `.docs/COST_WORKSPACE_FIELD_COVERAGE.md` |
| Formula details | `.docs/BULK_COST_CALCULATION.md` |
| AXON contract | `.docs/AXON_HANDOFF_CONTRACT.md` |
| DB mapping | `.docs/DATA_SCHEMA.md` |
| Cleanup/drop planning | `.docs/CLEANUP_INVENTORY.md` |
