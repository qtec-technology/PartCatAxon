# AXON Handoff Contract

Last updated: 2026-05-22

This contract defines how PartCatalogAxon consumes AXON output. AXON is owned by
Pi-Jo's side. PartCatalogAxon reads only the awarded final comparison result,
clones the selected data into Cost Workspace snapshots, and then performs
Single/Bulk costing.

## Ownership

| Area | Owner | Notes |
|---|---|---|
| RFQ chain lifecycle | AXON | Customer request, supplier discovery, supplier RFQ, quote intake |
| Email/document extraction | AXON | AI pipeline and source document handling |
| Final comparison | AXON | Published for PartCatalogAxon consumption |
| Cost Workspace | PartCatalogAxon | Sales review, Latest edits, Single/Bulk calculation |
| Snapshot/revision | PartCatalogAxon | Origin, Latest, Result snapshots tied to `ChainId` |
| Item/Term bridge | PartCatalogAxon | Deferred until Review/Finalize, reverse mapping, and business/order gate rules are approved |

## Integration Shape

The preferred handoff is shared DB/view/module access on the same server
environment, not a public AXON-to-PartCatalog REST API.

```text
AXON tables
  -> AXON awarded final comparison SQL view or shared module
  -> PartCatalogAxon backend read-only query by ChainId / AIX ID
  -> clone awarded supplier/lines into Cost Workspace draft
  -> Single/Bulk calculation and save revision
```

The browser must not connect directly to SQL Server. The PartCatalogAxon
backend/BFF owns the read-only query and clone operation.

## Identity Model

`ChainId` is the main correlation id across systems and is expected to be the
business AIX ID, pending final confirmation from Pi-Jo's view. It connects the
customer request, supplier RFQ, quote comparison, costing run, snapshots, and
audit trail.

`ChainId` must not be the only key for PartCatalogAxon snapshots. The minimum
line identity needs revision and supplier/line dimensions because quotes can be
updated after the first comparison.

Recommended source keys:

```text
ChainId
ComparisonRevision
SupplierCode
SupplierQuoteId
AxonLineId
LineNo
```

Recommended PartCatalogAxon keys:

```text
BulkCostRun.RunId
BulkCostRun.ChainId
BulkCostRun.SourceRevision
BulkCostRun.SupplierCode
Draft line RunId + ChainId + AxonLineId
```

## Handoff Views

Final names must be confirmed with Pi-Jo, but PartCatalogAxon should expect a
header/line split filtered to awarded supplier/line rows only.

Current server scaffold:

```text
GET /api/axon-handoff/comparisons/:chainId
GET /api/axon-handoff/comparisons/:chainId?revision=<ComparisonRevision>
```

Required env vars after Pi-Jo confirms the SQL view names:

```text
DB_VIEW_AXON_FINAL_COMPARISON_HEADER=<qualified-or-unqualified-view-name>
DB_VIEW_AXON_FINAL_COMPARISON_LINES=<qualified-or-unqualified-view-name>
```

Until those env vars are set, the endpoint returns `501` rather than guessing a
view name.

AXON AI may mark supplier costs as header-level or line-level because suppliers
can quote costs in either shape. PartCatalog must not assume one fixed basis
until the final AXON columns are confirmed. Expected marker values are:

```text
HEADER_TOTAL
LINE_TOTAL
PER_UNIT
UNKNOWN
```

PartCatalog treats these as calculation inputs/suggestions. Sales can still
edit before CAL.

Proposed AXON-side view contract is captured in
`server/sql/20260519_axon_handoff_view_contract.sql`. It is a handoff script for
AXON review, not a PartCatalog migration. The source tables verified from the
read-only AXON copy are:

```text
CustomerRFQ.QlinkChainID
CustomerRFQBrandGroup
CustomerRFQLine
SupplierRFQ
RFQ_SUPPLIER_QUOTE
RFQ_SUPPLIER_QUOTE_ITEM
RFQ_QUOTE_RANKING
```

Current AXON code upserts ranking rows per brand group. Until AXON provides a
persistent comparison revision table, the proposed view derives a current
snapshot `ComparisonRevision` from the latest quote/ranking timestamp. That is
acceptable only as a current-read contract; PartCatalog still clones the view
output into its own Origin/Latest snapshots before calculating.

### Header View

```text
ChainId
ComparisonRevision
SourceRfqId
CustomerName
CustomerReferenceNo
Subject
DocumentNo
DocumentDate
SupplierCode
SupplierName
Currency
PurchaseTerm
TermLocation
QuoteStatus
UpdatedAt
```

### Line View

```text
ChainId
ComparisonRevision
SourceRfqId
BrandGroupId
SupplierRfqOperationId
SupplierQuoteId
QuoteItemId
RfqLineId
AxonLineId
LineNo
SourceRank
IsRecommendedSupplier
IsSelectedSupplier
SupplierCode
SupplierName
QuotationNo
QuoteDate
PaymentTerms
PurchaseTerm
DeliveryTerms
FreightType
FreightAmount
SupplierOrderCode
MfrBrand
MfrCatalogNo
Description
Qty
Uom
UnitPrice
Currency
QuotedQty
QuotedUom
RfqQty
RfqUom
Moq
LotSize
LeadTimeDays
ItemWeightKg
Length
Width
Height
DimUnit
ChargeableWeightKg
HsCode
DutyPercent
PermitRequired
ShelfLifeRequired
MatchMethod
MatchConfidence
SourceConfidence
SourceText
```

Backend read behavior:

- `GET /api/axon-handoff/comparisons/:chainId` first loads the newest header
  row for the requested `ChainId`.
- If the caller omits `?revision=...`, the backend uses the header's resolved
  `ComparisonRevision` when loading lines so it does not mix lines from multiple
  source revisions.
- If the caller supplies `?revision=...`, both header and lines are filtered to
  that exact source revision.

## Clone Semantics

PartCatalogAxon reads AXON views as read-only data. When sales chooses a supplier
or lines for costing, PartCatalogAxon creates its own Origin snapshot.

```text
Origin = immutable AXON final comparison snapshot
Latest = sales-editable working copy used for calculation
Result = calculated output snapshot
```

Reloading the same `ChainId` later must not mutate an existing saved run
silently. A new comparison revision should create a new PartCatalogAxon revision
or require an explicit user clone/refresh action.

## Recalculation Model

The handoff must support repeated calculations. Supplier data is not static:
another supplier may reply later, a better quotation can arrive after the first
calculation, and sales may need to split payment or shipment conditions before
quoting the customer.

Design rules from the 2026-05-18 meeting:

- `ChainId`, AXON job id, or job name must not be used as a single fixed primary
  key for calculation records.
- PartCatalogAxon must save calculation attempts as revisions/snapshots.
- Revision 2 may contain different supplier data, selected lines, costs, or
  allocation variables from revision 1.
- Editing and recalculating must not silently destroy historical calculation
  evidence.

Recommended identity shape:

```text
ChainId + ComparisonRevision + BulkCostRunRevision + RunId
```

`RunId` remains the local PartCatalogAxon primary key. `ChainId` is a correlation
key, not the primary key for the calculation snapshot.

## UI Entry

Sales should enter PartCatalogAxon from AXON context:

```text
AXON final comparison
  -> open/clone in PartCatalogAxon by ChainId
  -> review comparison context
  -> select supplier/lines
  -> Bulk Cost
```

If PartCatalogAxon also provides an inbox, it should be an AXON Chain inbox
filtered by `ChainId`, not a standalone supplier picker that loses RFQ context.

## Safety Rules

- Do not write to AXON source tables from PartCatalogAxon.
- Do not write to SAP Item/Term master tables before Review/Finalize, reverse
  mapping, and business/order gate rules are designed and approved.
- Preserve `ChainId`, source revision, and source line ids on every snapshot and
  audit record.
- Treat AXON and AI values as suggestions until sales verifies them.

## AXON Awarded Intake Placeholder UI Status

- **Status**: UI Placeholder Only (Not Connected)
- **UI Tab**: "Import AXON Awarded" (integrated into the Cost Workspace page `/bulk-cost`).
- **Functionality**: Demonstrates the target intake workflow by accepting a `ChainId` (AIX ID) and `SourceRevision`, showing a mock preview shell of customer metadata, supplier summary, cost markers, and skeleton lines. The active button is disabled, showing the reason: *"Waiting for AXON final awarded SQL view contract"*.
- **Database Access**: There is no database view connection, backend API, or SQL query configured for this flow yet. The final view schemas and column mappings are pending from the AXON team (Pi-Jo).
- **Identity Model**: `ChainId` / AIX ID is utilized purely as a correlation and search field; it is not a primary key for calculations.
