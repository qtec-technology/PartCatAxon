# Cost Workspace Architecture Decision

Last updated: 2026-05-27 (Business Decisions locked; M1 SQL script created)

This document supersedes the older mental model where `Bulk Cost` was treated
as the whole feature. The product target is now **Cost Workspace**: a temporary
calculation workspace that supports both Single and Bulk costing, from either
AXON awarded data or manual entry, before PartCatalog Item/Term finalization.

## 1. Final Scope

Cost Workspace is the PartCatalog-side working area for costing.

It must support:

- `AXON_AWARDED` source: primary production source after Pi-Jo publishes the
  final awarded SQL/shared view.
- `MANUAL` source: add-on/manual workspace for testing formulas, creating
  quotations without AXON, and validating the required Item/Term columns.
- `SINGLE` mode: one line, no cross-line allocation required.
- `BULK` mode: multiple lines, header-level costs allocated down to line level.

Manual should be completed first because it lets the team verify formulas,
required columns, UI flow, and snapshot behavior without waiting for the AXON
view contract. AXON integration should reuse the same workspace engine instead
of creating a separate costing UI.

## 2. Ownership Boundary

```text
AXON
  -> customer request / RFQ chain
  -> supplier quote intake
  -> comparison and Award selection
  -> publishes awarded supplier/line view by ChainId

PartCatalog Cost Workspace
  -> imports awarded AXON lines or accepts manual lines
  -> lets sales edit draft values freely
  -> calculates Single/Bulk cost
  -> saves immutable snapshot revisions
  -> sends complete candidates to PartCatalog Review / Finalize
```

AXON must not perform PartCatalog costing. PartCatalog must not rebuild AXON's
supplier-selection UI.

## 3. ChainId / AIX ID

`ChainId` is the shared correlation key and is expected to match the business
AIX ID, pending final confirmation from Pi-Jo's view. It is **not** a primary
key for Cost Workspace data.

Use it as:

- search field
- display field
- cross-system correlation field
- snapshot/audit metadata

Local Workspace/Revision IDs must remain the database primary keys because the
same ChainId can be recalculated multiple times.

## 4. Source Contract

AXON handoff must use SQL View / shared DB view access, not browser SQL and not
a public REST API as the first target.

The PartCatalog backend should read only:

- awarded supplier/line rows
- `Award = Y` / equivalent selected supplier marker
- ChainId / AIX ID
- comparison/source revision
- supplier quote identity
- source line identity
- extracted item/quote/cost fields

Header-vs-line supplier costs are decided by AXON AI extraction and passed as
marked data. PartCatalog must wait for Pi-Jo's final column names before hard
coding this contract.

Expected cost-level marker examples:

```text
HEADER_TOTAL
LINE_TOTAL
PER_UNIT
UNKNOWN
```

PartCatalog uses the marker as a suggestion/input classification. Sales can
still edit before calculation.

## 5. Working Space vs Snapshot

Cost Workspace has two storage concepts.

### Draft / RAM

The draft workspace is freely editable:

- sales can import, add, remove, or edit lines
- sales can change conditions and costs
- sales can run CAL repeatedly
- no historical revision is required for every draft edit

This is intentionally similar to using a calculator before committing a result.

### Save / Hard Disk

Every Save / Finalize creates a new immutable revision snapshot:

- never overwrite the previous saved revision
- store all input fields, calculated output, and mapping metadata
- store user, timestamp, source type, mode, and ChainId/AIX context
- support traceability when a quoted price causes a profit/loss question later

Revision example:

```text
ChainId AIX123
  -> Revision 1
  -> Revision 2
  -> Revision 3
```

## 6. Proposed New Table Names

The current live schema uses `BulkCostRun`, `DraftItem`, and `DraftTerm`.
The rebuild target should use names that describe the broader workspace:

```text
CostWorkspaceRun
CostWorkspaceLine
CostWorkspaceSnapshot
```

`WorkspaceRun`, `WorkspaceLine`, and `WorkspaceSnapshot` are acceptable but less
specific. Prefer the `CostWorkspace*` prefix because the app may later contain
other non-cost workspaces.

Do not rename code/tables in-place without a migration plan. First build the
new schema contract, then migrate or retire old objects after dependency checks.

## 7. Field Completeness Rule

The snapshot before PartCatalog finalization must be complete enough to become
Item/Term candidates. It should preserve:

- all required Item fields
- all required Term fields
- all extra transparent costing fields that do not exist in SAP/legacy Term
- source/origin values from AXON or manual input
- latest user-edited values
- calculated output per line
- mapping metadata for PartCatalog Review / Finalize

Do not hide missing costs inside SAP-limited fields during calculation. If SAP
or legacy Term only has `PCS`, `PKH`, `SOC`, etc., that compression belongs to a
later export/finalize mapping step, not the workspace truth model.

## 8. Weight / CWeight Rule

Bulk allocation by weight cannot be trusted when all selected lines have no
usable weight. The workspace must handle this explicitly:

- If reliable CWeight / shipping weight exists, allocate weight-based costs by
  that value.
- If only dimensions and actual weight exist, call the separate CWeight module
  or compute the reviewed chargeable weight.
- If some selected lines are missing weight, block or warn before CAL depending
  on business tolerance.
- If every selected line is missing weight, block weight-based allocation
  because the distribution would be arbitrary.
- Sales override must always be allowed and must not be overwritten by AI.

CWeight remains a separate reusable module/service. Cost Workspace only calls it
for suggestions/prefill.

## 9. Pages / UI Shape

Use one main editor rather than separate Single and Bulk pages:

```text
Workspace List
  -> New Manual Workspace
  -> Import from AXON by ChainId

Workspace Editor
  -> source: MANUAL | AXON_AWARDED
  -> mode: SINGLE | BULK
  -> editable draft lines
  -> CAL
  -> Save Revision

PartCatalog Review / Finalize
  -> validate Item/Term required fields
  -> review mapping and compression rules
  -> decide New Item + New Term / Existing Item + New Term / Update Term
```

The existing `/bulk-cost` route continues temporarily as the implementation surface to avoid affecting next-shell routing. The visible product name on the UI has been changed to 'Cost Workspace', with 'Bulk Cost' serving as the internal calculation mode. The underlying database tables, schemas, folder structures, and API routes retain their original names (e.g., `BulkCostRun`, `DraftItem`, `DraftTerm`) until a formal migration design is approved.

UI navigation uses the approved hybrid layout: the global Part Catalog topbar stays in `AppShell`, and Cost Workspace owns a route-local left sidebar for `Workspace Runs`, `New Manual`, `AXON Awarded`, and the active `Editor`. This keeps Part Catalog pages stable while giving the 40+ column workspace more horizontal room than the previous top-tab layout.

## 10. Cleanup Direction

Safe-to-remove candidates after backup and dependency checks:

- `AxonExtractionQueue`: legacy queue/mock path, replaced by awarded AXON view.
- `GraingerWeightData`
- `GraingerWeightImportLog`

Keep until the replacement schema is implemented or data is migrated:

- `BulkCostRun`
- `DraftItem`
- `DraftTerm`

Do not drop tables directly from screenshots. First run row-count,
foreign-key, object-dependency, and code-reference checks.

---

## 11. Business Decisions Locked (2026-05-27)

| # | Decision | Implementation note |
|---|---|---|
| 1 | Draft persistence | `DraftJson` on `CostWorkspaceRun` is overwritable; immutable snapshot only on Save Revision |
| 2 | 3 save actions | Draft (overwrite), Revision (new `SnapshotType=SAVE_REVISION`), Finalize (validate + prepare for SAP) |
| 3 | Weight-missing policy | Block CAL 100% for bulk-by-weight; `U_CWeight` must not be NULL/0 for every selected line |
| 4 | Mixed currency | Manual Convert/Reject in Phase 1; no auto-convert |
| 5 | Doc fees | Service Line separate — `DocFee_*` fields on line, `DocFeeBasisJson` for basis config |
| 6 | Existing item+term | Always Add New Term (`AwardedTermID` recorded on line after Finalize) |
| 7 | Manual finalize timing | User-triggered immediately; Master Write only on Got Order |
| 8 | ValidTo default | `U_ValidTo = U_ValidFrom + 1 month` (editable) |
| 9 | SCC/ASP basis | Deferred — `U_ASP` column stored as NULL, not wired to CAL engine yet |
| 10 | Merged line model | `CostWorkspaceLine` = unified DraftItem + DraftTerm; split to `@POITM`/`@PITM1` only at Finalize |

## 12. M1 SQL Migration Script

Script: `server/sql/migration/M1_create_cost_workspace.sql`

Creates three tables in `PART_CATALOG_AIX`:

| Table | Purpose |
|---|---|
| `CostWorkspaceRun` | Run header, revision tracking, draft JSON, supplier, header costs, defaults |
| `CostWorkspaceLine` | Unified item+term line (Decision #10); all Item/Term/CAL/Allocation fields |
| `CostWorkspaceSnapshot` | Immutable revision records for Save Revision + Finalize |

Phase M2 (repository + dual-write) must not start until M1 is executed and verified on the `PART_CATALOG_AIX` test instance.

`db-objects.ts` already contains `costWorkspaceRun`, `costWorkspaceLine`, and `costWorkspaceSnapshot` references using env keys `DB_TABLE_CW_RUN`, `DB_TABLE_CW_LINE`, `DB_TABLE_CW_SNAPSHOT`.
