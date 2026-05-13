# Bulk Cost Test Data Handoff

Last updated: 2026-05-08

Use this file as the first handoff prompt for the next AI/Claude chat.

## User Context

Project root: `C:\Users\kittipat\Desktop\PartCatalog`

Current priority: audit Term/Bulk Cost calculation correctness before creating
real Bulk Cost DB tables. Do not run `server/sql/20260508_bulk_cost_draft_snapshot.sql`
until formula coverage and golden cases are reviewed.

The user exported test data manually from SSMS into `.datatest`.

## Important Corrections

- `@PITM1_VENDOR_BRAND` is a synonym, not a view.
- `@PITM1_BRAND_VENDOR` is a synonym, not a view.
- `@FULLTEXT` is a synonym, not a view.
- The current CSV exports use `TOP 500` for Term/Item/vendor context and
  `TOP 1000` for brand.
- The user did not hand-pick a curated set of columns for every object. The
  exports are broad table-shaped outputs with the header row included.
- Current files are `.csv` with headers, plus one `.xlsx` Excel baseline. Older
  markdown/TSV export references in historical notes should not be used as the
  current source.

## Test Data Files

Directory: `.datatest`

- `.datatest/vw@PITM1.csv`
  - Main Term calculation sample.
  - Treat each row/`TermID` as one calculation test case.
- `.datatest/VWIT_@POITM.csv`
  - Item context for matching Term rows by `ItemID` / `ItemCode`.
- `.datatest/@UOM.csv`
  - UOM lookup.
- `.datatest/@CURRENCY.csv`
  - Currency and exchange rate lookup.
- `.datatest/@ORDERTERM.csv`
  - Order term lookup.
- `.datatest/@FREIGHT.csv`
  - Freight lookup/rates.
- `.datatest/@LOCATION.csv`
  - Location/zone rate lookup.
- `.datatest/@OCRD.csv`
  - Vendor lookup, broad TOP 500 export.
- `.datatest/@BRAND.csv`
  - Brand lookup.
- `.datatest/@PITM1_BRAND_VENDOR.csv`
  - Brand to vendor report data from synonym.
- `.datatest/@PITM1_VENDOR_BRAND.csv`
  - Vendor to brand report data from synonym.
- `.datatest/AXON_Extraction_Calculation.xlsx`
  - Manager Excel baseline for Bulk Cost calculation; use exact internal values,
    not rounded display values. Grainger total shipping weight is `194.43675`.

## Business Rules Already Locked

1. `1 Term = 1 calculation test case`.
   Item is parent/context only; one item may have many terms.
2. Bulk Cost run is quotation/supplier-level.
   One run can contain many item/term candidate lines.
3. Quote-level fields should be common within one supplier quote:
   Currency, Order Term, Location.
4. OP1 for Bulk Cost:
   `OP1 source = PCS + PKH + SOC + COC + Mill + Test Cert + COO + Any Other`
   then `OP1 THB = OP1 source * exchangeRate`.
5. Document fee basis:
   - Per Each / UOM By Each enters OP1.
   - Item-specific fee total can be normalized to per each by dividing by qty.
   - By Lot / Batch must become a separate new line item. Do not allocate it
     into product OP1.
6. Freight:
   allocated Freight is what goes into QLC. `frQTEC` is a reference/zone-rate
   calculation, not the allocated cost input.
7. Before production, warning codes must split:
   - `MIXED_VENDOR`
   - `MIXED_CURRENCY`
   Current code already implements this split; keep both in regression tests.
8. Term-engine parity fields must be accounted for:
   `ET`, `MT`, `MiscTax`, `SCC`, `STK%`, `WTT`, `CC`, `ASP`, `SPK`, `QOC`.

## Read These First

1. `.docs/BULK_COST_CALCULATION.md`
2. `.docs/BULK_COST.md`
3. `.docs/DATA_SCHEMA.md`
4. `.docs/FEATURE_STATUS.md`
5. `.docs/ROADMAP.md`
6. `.docs/AXON_INTEGRATION.md`
7. `server/src/services/calculation.service.ts`
8. `next-shell/src/features/bulk-cost/bulk-cost.calc.ts`
9. `next-shell/tests/unit/bulk-cost-calc.test.ts`
10. `server/src/__tests__/calculation.service.test.ts`

## Next AI Task

Do not edit production code first. Start with analysis and documentation.

1. Parse `.datatest/*.csv` as CSV exports and inspect
   `.datatest/AXON_Extraction_Calculation.xlsx` for Excel exact values.
2. Create a compact data audit:
   - row count per file
   - detected headers
   - columns missing from expected calculation coverage
   - null/zero-heavy fields
3. Analyze `vw@PITM1.csv` coverage:
   - currencies represented
   - order terms represented
   - ship modes represented
   - Exwork/FCA/FAS/FOB + ship mode 3/6 cases
   - DDP/local THB cases
   - UOM conversion where `NumInBuy` or `NumInSale` is not 1
   - rows with `U_ET`, `U_MT`, `U_MiscTax`, `U_WTT`, `U_CC`, `U_STK`,
     `U_ASP`, `U_SPK`, `U_QOC`
   - rows with missing/zero weight vs populated dimensional/ship weight
   - rows with duty percent and duty amount
4. Compare a small sample of Term rows against the server Term calculation
   engine and report differences. Do not rewrite formulas until differences are
   categorized.
5. Identify what additional SSMS exports are still needed for Bulk Cost golden
   cases, especially document-fee basis because current Term data does not carry
   Bulk Cost document fee basis.
6. Write results into an existing docs file if possible. If no good home exists,
   create `.docs/BULK_COST_TEST_DATA_AUDIT.md`.
7. Update `.docs/FEATURE_STATUS.md` and `.docs/ROADMAP.md` after the audit.

## Prompt To Paste Into New Claude Chat

You are working in `C:\Users\kittipat\Desktop\PartCatalog`.

Read `.docs/BULK_COST_TEST_DATA_HANDOFF.md` first, then read:

- `.docs/BULK_COST_CALCULATION.md`
- `.docs/BULK_COST.md`
- `.docs/DATA_SCHEMA.md`
- `.docs/FEATURE_STATUS.md`
- `.docs/ROADMAP.md`
- `.docs/AXON_INTEGRATION.md`

Then inspect `.datatest`.

Important: `.datatest/*.csv` files are the current exports with a header row.
`@PITM1_VENDOR_BRAND`, `@PITM1_BRAND_VENDOR`, and `@FULLTEXT` are synonyms, not
views. Current exports include TOP 500 Term/Item/vendor context, TOP 1000
brand, lookup CSVs, and `AXON_Extraction_Calculation.xlsx`.

Task:

1. Do not modify application code yet.
2. Parse and summarize `.datatest` row counts/headers/coverage.
3. Treat each `TermID` in `vw@PITM1.csv` as one calculation test case.
4. Produce `.docs/BULK_COST_TEST_DATA_AUDIT.md` with:
   - available files
   - coverage by currency/order term/ship mode/UOM/extra cost fields/weight/duty
   - recommended golden test cases
   - missing data needed before DB creation
   - risks where Bulk Cost formula may differ from legacy Term engine
5. Update `.docs/FEATURE_STATUS.md` and `.docs/ROADMAP.md`.
6. Stop and ask the user before changing calculation code or database scripts.
