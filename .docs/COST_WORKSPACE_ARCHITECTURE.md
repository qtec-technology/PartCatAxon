# Cost Workspace Architecture Decision

Last updated: 2026-05-22

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

The existing `/bulk-cost` route can continue temporarily as the implementation
surface, but copy/docs should move toward Cost Workspace terminology.

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
