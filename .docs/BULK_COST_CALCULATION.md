# Bulk Cost Calculation Formula Reference

Last updated: 2026-05-08

This document is the authoritative formula reference for Bulk Cost Allocation.
It is derived from the Excel golden sample and reconciled against the current
implementation in `next-shell/src/features/bulk-cost/bulk-cost.calc.ts`.

---

## 1. Overview

Bulk Cost computes a fully-landed per-each cost for each sourced item/term,
starting from a supplier quotation and ending at a QLC + Markup result that
feeds directly into a draft Term row.

The pipeline for each line:

```
Source line (unit price + doc fees + dims + duty%)
  → OP1 (cost basis in THB)
  → OP2 (OP1 adjusted for ExworkCase)
  → INS (insurance)
  → FR  (allocated freight in THB)
  → DT  (duty tax)
  → TT  (wire fee)
  → CC  (customs clearance)
  → QLC (CEILING of sum, 0.01)
  → Total QLC (QLC / stockConv * saleConv + SPK + QOC)
  → Markup / Round-Up (sale price before discount)
```

---

## 2. Quote-Level Fields

These fields are the same for every line in a single supplier quotation.
If AXON extracts mixed values, the run must be split or held until the user resolves them.

| Field | Rule |
|---|---|
| Currency | Same for all lines. Mixed currency = split run or block CAL. |
| Order Term | Same for all lines. Drives ExworkCase + CIF branches. |
| Location | Same for all lines. Zone rate context. |
| Exchange Rate | One editable THB rate for the quote currency. |
| Ship Mode | One selection per run (affects ExworkCase and DW divisor). |

Line-level fields remain per item: qty, unit price, document fees, dimensions,
shipping weight, duty%, UOM, lead time, permit/shelf-life flags.

---

## 3. Allocation Basis

Before computing per-line final results, shared costs are distributed across lines.

### 3.1 Weight-Based Allocation (PKH, SOC, Freight, CC)

```text
lineWeight         = shippingWeightPerEach × qty
totalWeight        = SUM(lineWeight for all selected lines)
weightRatioPerItem = lineWeight / totalWeight
weightRatioPerEach = weightRatioPerItem / qty

allocatedCostItem  = totalCost × weightRatioPerItem   (last line gets residual)
allocatedCostEach  = allocatedCostItem / qty
```

### 3.2 Value-Based Allocation (Wire TT / Bank Fee)

```text
lineAmount         = unitPrice × qty
totalAmount        = SUM(lineAmount for all selected lines)
valueRatioPerItem  = lineAmount / totalAmount
valueRatioPerEach  = valueRatioPerItem / qty

allocatedTTItem    = totalWireTT × valueRatioPerItem   (last line gets residual)
allocatedTTEach    = allocatedTTItem / qty
```

### 3.3 Document Fees (COC, Mill Cert, Test Cert, COO, COA, Any Other)

Document fees have two mutually exclusive treatments:

1. **Per Each / UOM By Each only**: include in OP1 as a per-unit source-currency
   cost. If a supplier quotes an item-line document fee total for a specific
   item, sales must first normalize it to per each by dividing by that line qty.
2. **By Lot / Batch**: create a separate new line item. Do not allocate, spread,
   or fold the batch fee into product OP1.

Implementation note: COA and COO are merged into `docCOO` in the final result
columns (matching Excel final result columns COC / Mill / Test Cert / COO / Any Other).
The source model still stores `coa` and `coo` separately for extraction fidelity.

Implementation status: `next-shell/src/features/bulk-cost/bulk-cost.document-fees.ts`
now locks the pure business rule for Per Each, item-line total normalization,
and By Lot / Batch separate line candidates. The remaining gap is UI/API
persistence: real AXON data still needs an explicit `DocumentFeeBasis` field so
sales can verify/edit the basis before save.

Manual override remains part of the business rule: AXON can pre-create fee line
candidates, but sales must be able to add missing items, delete incorrect
candidates, edit amounts, or redistribute a customer-specific fee back into
product lines before final quotation work is accepted.

### 3.4 Rounding

All intermediate values are rounded to 6 decimal places.
The last line in each cost receives the residual (total − sum of non-last lines)
to ensure the sum of allocated item totals equals the input cost exactly.

---

## 4. Final Result Computation (per line)

### 4.1 OP1 — Cost Basis in THB

```text
docFeeTotal = COC + Mill + Test Cert + docCOO + Any Other
  where docCOO = COO + COA

op1Source   = productCost + pkhEach + socEach + docFeeTotal    (source currency)
OP1 (THB)   = op1Source × exchangeRate
```

`productCost` = unit price per each (source currency).
`pkhEach` / `socEach` = allocated PKH/SOC per each (source currency).
`docFeeTotal` includes only Per Each / UOM By Each document fees. By Lot / Batch
document fees are excluded from OP1 and must be represented as separate new line
items.

### 4.2 ExworkCase

```text
isFOBType   = orderTerm ∈ { Exwork, Ex-work, FCA, FAS, FOB }
exworkCase  = 1.03  if isFOBType AND shipModeNo ∈ { 3 (Truck), 6 (Air COUR) }
            = 1.0   otherwise
```

### 4.3 OP2

```text
OP2 = OP1 × exworkCase
```

### 4.4 Insurance (INS)

```text
INS = OP2 × (insPercent / 100)
```

Standard rates (applied to source currency selection in UI):
- 1% for USD, AUD, EUR, SGD
- 0% for other currencies

The `insPercent` value comes from the source line (set in the Latest edit layer).

### 4.5 Dimensional Weight (DW)

```text
vol = length × width × height
adjustedVol = vol × 17  if dimUnit = 2 (inches → cm³ equivalent)
            = vol       otherwise

DW (kg):
  shipModeNo 1, 4, 5  → adjustedVol / 6000
  shipModeNo 2        → MAX(adjustedVol / 1000, 1000)
  shipModeNo 3, 6     → adjustedVol / 5000
```

### 4.6 Shipping Weight for Calculation (swCal)

```text
swCal = shippingWeightPerEach   if provided and > 0
      = CEIL(MAX(DW, itemWeightPerEach), 0.5)   otherwise
```

### 4.7 Freight per Each in THB (FR)

```text
frEachTHB = freightEach (allocated, source currency) × exchangeRate
```

Separately, QTEC zone freight is also computed for reference (used in CIF Zone):

```text
frQTEC    = swCal × freightRate            (per-each, THB)
frZoneCost = 0.1 × OP2                    if Exwork/FCA + shipModeNo=3
           = MAX(DW, itemWeight) × zoneRate if Exwork/FCA + shipModeNo=6
           = 0                             otherwise
```

### 4.8 CIF

```text
cifQTEC = OP2 + INS + frEachTHB
        = 0                          if (Exwork or FCA) AND shipModeNo=3

cifZone = OP2 + INS + frZoneCost
        (only computed if Exwork/FCA and shipModeNo ∈ {3, 6})
```

### 4.9 Duty Tax (DT)

```text
dtQTEC      = cifQTEC × (importDutyPercent / 100)
dtZone      = cifZone × (importDutyPercent / 100)
selectedDuty = MAX(dtQTEC, dtZone)
```

Duty selection options available in UI: tariffDuty, tariffExempt, BOI (maps to the
`importDutyPercent` on the source line in the Latest edit layer).

### 4.10 Wire TT and Custom Clear in THB

```text
ttFinal = ttEach (allocated, source currency) × exchangeRate
ccFinal = ccEach (allocated, source currency) × exchangeRate
```

### 4.11 QLC

```text
preQLC = OP1 + INS + frEachTHB + selectedDuty + ET + MT + MiscTax + TT + CC + SCC
STK    = STK% × preQLC
QLC    = CEILING(preQLC + STK, 0.01)
```

Note: Bulk Cost uses **OP1** (not OP2) as the base for preQLC, consistent with the
Term engine which also uses pre-ExworkCase OP_SUM as the summing base.

### 4.12 Total QLC

```text
qlc2     = QLC / stockConversion      (if stockConversion > 0)
qlc3Base = qlc2 × saleConversion      (if saleConversion > 0)
totalQLC = qlc3Base + SPK + QOC
```

- `SPK` = selling packing cost per sale unit
- `QOC` = quality/other charge per sale unit

### 4.13 Markup and Round-Up

```text
denom   = 1 − (markupPercent / 100)
markup  = (totalQLC / denom) − totalQLC   (if denom > 0)
roundUp = totalQLC / denom                (if denom > 0)
```

`roundUp` is the recommended sale price (Total QLC grossed up by markup).

---

## 5. Term Calculation Reconciliation

The existing Term engine in `server/src/services/calculation.service.ts` uses:

```text
Term OP      = ProductCost + PKH + SOC
Term OP_SUM  = Term OP × ExchangeRate
Term OP_THB  = Term OP_SUM × 1.03   if Exwork/FCA/FAS/FOB + shipMode 3 or 6
INS          = OP_THB × INS%
CIF          = OP_THB + INS + FR,  except Exwork/FCA + Truck → 0
CIFZONE      = OP_THB + INS + FRZONE  for Exwork/FCA + shipMode 3 or 6
DT           = MAX(CIF × duty%, CIFZONE × duty%)
preQLC       = OP_SUM + INS + FR + DT + ET + MT + MiscTax + WTT + CC + SCC
QLC          = CEILING(preQLC + stockFee, 0.01)
TotalPrice   = (QLC / NumInBuy × NumInSale) + SPK + QOC
SalesPrice   = TotalPrice / (1 − Markup%)
```

Bulk Cost is consistent with that sequence. The key difference is that Bulk Cost
includes only Per Each / UOM By Each document fees in OP1 before the exchange
rate:

```text
Bulk OP source = productCost + allocatedPKH + allocatedSOC + docFeeTotal
Bulk OP1 (THB) = Bulk OP source × exchangeRate
Bulk OP2 (THB) = Bulk OP1 × exworkCase
Bulk preQLC    = OP1 + INS + FR + DT + ET + MT + MiscTax + TT + CC + SCC
Bulk STK       = STK% × preQLC
Bulk QLC       = CEILING(preQLC + STK, 0.01)
```

Implementation ownership as of 2026-05-15:

- Bulk Cost allocation/CAL currently runs in the Next.js frontend pure function
  `next-shell/src/features/bulk-cost/bulk-cost.calc.ts`.
- Term calculation remains backend source of truth in
  `server/src/services/calculation.service.ts`.
- `next-shell/src/features/bulk-cost/bulk-cost.formula-audit.ts` is a
  temporary guard that compares frontend Bulk Cost output against Term/Excel
  formula steps for each line. It does not replace the source of truth.
- Before Awarded automation or SAP writes, Bulk Cost should be promoted to a
  backend/shared calculation source of truth so preview, save, automation, and
  reverse mapping cannot drift.

### 5.1 Temporary Formula Audit

The Formula view calls `buildBulkCostFormulaAudit(...)` with
`AllocationLineSource`, `BulkCostInput`, and `FinalResultColumns` plus the
allocation result when available. Each audit row contains the step key, label,
formula name, input values, expected value, actual value, status
(`pass` / `warn` / `fail`), and note.

Covered steps:

```text
OP source -> OP1 THB -> OP2 -> INS
FR actual / FR zone -> CIF actual / CIF zone
DT actual / DT zone / selected duty
ET -> MT -> preQLC -> STK -> QLC -> QLC2
Total QLC / Total Price -> Markup -> Sales price
```

`AXON_Extraction_Calculation.xlsx` was readable during this audit. It confirms
the legacy AY-CP workbook shape, row range, and formulas for the visible final
result columns. The workbook does not expose the newer diagnostic values
(`ET`, `MT`, `preQLC`, `STK`, `QLC2`) as separate AY-CP columns, so those are
guarded by module tests against the frontend formula implementation and Term
formula sequence instead of direct workbook cell parity.

---

## 6. Source Fields From Excel

Source lines map to Excel Part 1:

| Excel area | Meaning | Role |
|---|---|---|
| A–J | identity, qty, UOM, unit price, amount, currency | amount = qty × unit price; amount drives value ratio |
| K–V | document fees: COC, Mill Cert, Test Cert, COA, COO, Any Other | Per Each / UOM By Each included in OP1; By Lot / Batch becomes a separate new line item |
| W–AA | lead time, order term, location, import permit, shelf life | draft Term/Item context |
| AC–AF | item/dimension/shipping weight | weight ratio and DW calc |
| AK | import duty % | duty calculation |
| AM–AW | allocated costs | PKH/SOC/FR/CC/TT per line |
| AY–CP | final result | Term-style output columns |

The UI final-result table uses `BULK_COST_AY_CP_COLUMNS` from
`bulk-cost.final-result.ts`, which locks the final CAL display to exactly 44
Excel columns from AY through CP. Formula diagnostics (`op1Source`, ET/MT
components, MiscTax, SCC, preQLC, STK) are intentionally separate from AY-CP and
should be shown only in formula-check or audit views.

Document fee normalisation: only item-specific non-per-each document fees may be
normalized to per each before CAL (`itemLineDocFee / qty`). Any document fee
quoted By Lot / Batch for the order must be split into a separate new line item.
It must not be silently spread across product lines.

---

## 7. Warning Model

The engine emits structured warnings from `calculateAllocationPreview`:

| Code | Severity | Condition |
|---|---|---|
| `ZERO_QTY` | error | No lines selected, or a line has qty ≤ 0 |
| `MIXED_VENDOR` | error | Lines from more than one vendor code in a run |
| `MIXED_CURRENCY` | error | Lines from more than one currency in a run |
| `NEGATIVE_COST` | warning | Any of PKH/SOC/Freight/CC/TT is negative |
| `MISSING_WEIGHT` | warning | Line has no shipping/dimension/item weight |
| `MISSING_AMOUNT` | warning | Line amount ≤ 0 (TT cannot be allocated) |
| `ROUNDING_RESIDUAL` | warning | Sum of allocated items deviates from input by > 0.001 |

`MIXED_VENDOR` and `MIXED_CURRENCY` are intentionally separate because one
quotation run should be calculated for one supplier and one currency.

---

## 8. Implementation Cross-Reference

| Formula step | Location in code |
|---|---|
| Weight/value ratio | `calculateAllocationPreview` lines 103–111 |
| PKH/SOC/FR/CC allocation | lines 140–160 |
| TT allocation | line 151 |
| OP1 / docFeeTotal | `computeFinalResult` lines 244–253 |
| ExworkCase | lines 256–258 |
| OP2 | line 261 |
| INS | line 264 |
| DW calc | `calcDW` helper, lines 396–407 |
| swCal | lines 269–271 |
| FR (allocated, THB) | line 290 |
| frZoneCost | lines 277–287 |
| CIF / CIF Zone | lines 293–302 |
| Duty Tax | lines 305–307 |
| TT / CC in THB | lines 310–311 |
| QLC | lines 314–316 |
| Total QLC | lines 319–321 |
| Markup / Round-Up | lines 324–326 |

Excel golden regression tests: `next-shell/tests/unit/bulk-cost-calc.test.ts`
The Grainger baseline uses exact Excel internal values, including total shipping
weight `194.43675`; do not replace them with the workbook's rounded display
values.

Golden tests added in `next-shell/tests/unit/bulk-cost-document-fees.test.ts`:
no document fee, Per Each document fees, item-line totals normalized to per each,
and By Lot / Batch fees that generate PartCatalog add-item candidates.

---

## 9. Backend Save Decisions

Confirmed 2026-05-08 for Phase 3A:

1. Bulk Cost persistence lives in `PART_CATALOG_AIX`.
2. Save draft creates `BulkCostRun` plus `DraftItem` and `DraftTerm` snapshot
   records. `BulkCostLine` is no longer used in the live Phase 3A schema, and
   draft save still does not write to `@POITM` / `@PITM1`.
3. Normal authenticated domain/catalog users can save `DRAFT` runs. No manager
   approval gate is required before draft snapshot save.
4. AXON matching hints such as `UniqueLineID`, `MatchMethod`, and
   `MatchConfidence` are persisted as hidden technical fields. Sales users do
   not need to confirm these hints in the UI.
5. Lifecycle statuses are `DRAFT -> QUOTED -> AWARDED -> REVERSE_MAPPED -> LOST -> ARCHIVED`.
   Phase 3A starts with `DRAFT`; Award/Reverse-map endpoints are deferred.

Open after Phase 3A:

1. UI/API persistence for `DocumentFeeBasis` and generated document-fee line
   candidates. The pure helper currently uses item group `107`, category
   `Service`, qty `1`, UOM `EA`, and leaves final user editing to sales.
2. Awarded reverse mapping rules for existing items: INSERT a new term vs UPDATE
   an existing term is still undecided and must be designed before implementing
   the Award/Reverse-map endpoint.
