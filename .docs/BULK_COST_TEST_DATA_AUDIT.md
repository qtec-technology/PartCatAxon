# Bulk Cost Test Data Audit

Last updated: 2026-05-25

This is a supporting coverage note, not the calculation source of truth. Use
`.docs/BULK_COST_CALCULATION.md` for formulas and `.docs/FEATURE_STATUS.md` for
latest verification counts.

Current `.datatest` exports are CSV files plus one Excel workbook. Earlier audit
sections 2-4 were produced from the previous TOP 200 markdown/TSV export and are
kept as historical baseline until the comparison is re-run against the current
TOP 500 CSV files.

No SQL script or database object was changed for this audit.

## 1. Source Files

| File | Columns | Parsed rows | Notes |
|---|---:|---:|---|
| `.datatest/vw@PITM1.csv` | 93 | 500 | Main Term calculation sample. Treat each `TermID` as one calculation test case. |
| `.datatest/VWIT_@POITM.csv` | 50 | 500 | Item context for matching by `ItemID` / `ItemCode`. |
| `.datatest/@UOM.csv` | 2 | 66 | UOM lookup. |
| `.datatest/@CURRENCY.csv` | 4 | 17 | Currency and exchange-rate lookup. |
| `.datatest/@ORDERTERM.csv` | 2 | 22 | Order-term lookup. |
| `.datatest/@FREIGHT.csv` | 3 | 9 | Freight lookup/rates, including Grainger-related rates. |
| `.datatest/@LOCATION.csv` | 5 | 53 | Location/zone-rate lookup. |
| `.datatest/@OCRD.csv` | 322 | 500 | Broad vendor lookup export. |
| `.datatest/@BRAND.csv` | 3 | 1000 | Brand lookup export. |
| `.datatest/@PITM1_BRAND_VENDOR.csv` | 24 | 500 | Synonym data, not a view. |
| `.datatest/@PITM1_VENDOR_BRAND.csv` | 24 | 500 | Synonym data, not a view. |
| `.datatest/AXON_Extraction_Calculation.xlsx` | 94 | 20 source lines | Manager Excel baseline; internal total shipping weight is `194.43675`, not the 2-decimal display value. |

Important object correction:

- `@PITM1_VENDOR_BRAND` is a synonym.
- `@PITM1_BRAND_VENDOR` is a synonym.
- `@FULLTEXT` is a synonym.

## 2. Term Coverage

Historical note: this section was computed from the older
`.datatest/Term_calculation.md` TOP 200 export. Re-run it against
`.datatest/vw@PITM1.csv` before using it as final production coverage.

`Term_calculation.md` contained 200 parsed Term rows:

| Coverage area | Result |
|---|---:|
| Unique `TermID` | 200 |
| Unique `ItemID` | 199 |
| Unique vendors | 88 |
| Rows joined to parsed item context by `ItemID` | 79 |

### Currency

| Currency | Rows |
|---|---:|
| THB | 150 |
| USD | 42 |
| EUR | 4 |
| GBP | 2 |
| SGD | 2 |

### Order Term

| Order term | Rows |
|---|---:|
| DDP | 147 |
| Exwork | 46 |
| EX-FACTORY-Thailand | 4 |
| DAP | 2 |
| FCA | 1 |

Gaps: no `FAS`, `FOB`, `CIF`, `CFR`, `CPT`, or `QTEC PICK UP` examples in this
TOP 200 set.

### Ship Mode

| Ship mode no | Rows |
|---|---:|
| 3 | 148 |
| 6 | 44 |
| 2 | 4 |
| 5 | 3 |
| 1 | 1 |

There are 42 Exwork/FCA/FAS/FOB rows with ship mode 3 or 6:

- Exwork/FCA/FAS/FOB + Truck: 1
- Exwork/FCA/FAS/FOB + Air Courier: 41

### UOM

| Coverage | Rows |
|---|---:|
| Rows where `NumInBuy`, `NumInSale`, or Buy/Sale UOM indicates conversion | 12 |

Top purchase UOM values: `EA` 136, `ST` 24, `RL` 7, `PL` 6, `CN` 5, `PR` 5.

Top sale UOM values: `EA` 140, `ST` 24, `PL` 6, `RL` 6, `PR` 5, `BX` 4,
`CN` 4.

### Cost/Tax/Weight

| Field group | Rows |
|---|---:|
| Duty percent or duty amount present | 45 |
| Foreign currency | 50 |
| DDP + THB local cases | 146 |
| Weight populated | 58 |
| Missing/zero weight | 142 |
| `U_WTT` nonzero | 50 |
| `U_CC` nonzero | 47 |
| `U_FR` nonzero | 48 |
| `U_FRZONE` nonzero | 42 |
| `U_FreightQTEC` nonzero | 3 |
| `U_SPK` nonzero | 6 |
| `U_QOC` nonzero | 9 |
| `U_ET`, `U_MT`, `U_MiscTax`, `U_ASP`, `U_STK`, `U_STK_Percent`, `U_CWeight` nonzero | 0 |

The current sample is good for OP, exchange, Exwork surcharge, freight, duty,
wire TT, CC, UOM conversion, SPK/QOC, and Grainger-like cases. It does not
cover ET/MT/MiscTax/SCC/STK/CWeight behavior.

## 3. Server Term Engine Comparison

Historical note: this comparison was run against the older TOP 200 markdown/TSV
export. The current CSV export has 500 rows and should be re-run before DB
execution.

Comparison method:

- Parsed all 200 rows from `.datatest/Term_calculation.md`.
- Mapped each row through `server/src/services/calc-input.mapper.ts`.
- Recomputed with `server/src/services/calculation.service.ts`.
- Compared major persisted calculation fields using tolerance `> 0.01`.

Summary:

| Result | Count |
|---|---:|
| Rows compared | 200 |
| Rows matching all compared fields | 193 |
| Rows with differences | 7 |

No differences were found for:

- `U_OP`
- `U_OP_SUM`
- `U_OP_THB`
- `U_DimWeight`
- `U_ShipWeightCal`
- `U_INS`
- `U_FRZONE`
- `U_FreightQTEC`
- `U_CIF`
- `U_CIFZONE`
- `U_DT`
- `U_DT_FR`
- `U_DT_FRZONE`
- `U_ET`
- `U_MT`
- `U_preQLC`
- `U_STK`

Differences by field:

| Field | Rows |
|---|---:|
| `U_QLC` | 1 |
| `U_QLC2` | 6 |
| `U_QLC3` | 2 |
| `U_MK_THB` | 1 |
| `U_SalesPrice` | 3 |

Notable difference rows:

| TermID | Pattern | Difference |
|---|---|---|
| `821413` | `KG -> BG`, `NumInSale=25` | Persisted `U_QLC2=1525`, current engine calculates `61`; `U_QLC3` still matches. |
| `899123` | `DZ -> DZ`, `NumInBuy=12`, `NumInSale=12` | Persisted `U_QLC2=71.89`, current engine calculates `5.990833`; `U_QLC3` matches. |
| `830692` | `EA -> BX`, `NumInSale=12` | Persisted `U_QLC2=256.08`, current engine calculates `21.34`; `U_QLC3` matches. |
| `733998` | `KG -> BG`, `NumInSale=25` | Persisted `U_QLC2=1375`, current engine calculates `55`; `U_QLC3` matches. |
| `791184` | `EA -> BX`, `NumInSale=12`, `QOC=50` | `U_QLC2`, `U_QLC3`, `U_MK_THB`, and `U_SalesPrice` differ due UOM conversion and rounding. |
| `691231` | Simple `EA -> EA` | `U_SalesPrice` differs by `0.011111`; likely rounding/precision only. |
| `821733` | Simple `EA -> EA` | `U_QLC`, `U_QLC2`, `U_QLC3`, and `U_SalesPrice` differ by about `0.01`; likely rounding/precision only. |

Initial interpretation:

- The server engine is aligned with existing Term data for upstream formula
  steps through `U_preQLC` and mostly through `U_QLC`.
- The main semantic risk is `U_QLC2`: current code treats `U_QLC2` as QLC per
  stock UOM, while several persisted rows appear to store sale-unit converted
  values in `U_QLC2`.
- `U_QLC3` usually matches the final total, so downstream user-visible price is
  much less affected than the intermediate `U_QLC2` label/storage meaning.

## 4. Recommended Golden Cases

Use these Term IDs as the first regression set:

| Scenario | Candidate TermID(s) | Why |
|---|---|---|
| Local THB DDP simple | `899161`, `839905`, `839902` | Validates OP/QLC/sales price with minimal extra cost. |
| Exwork + Air Courier surcharge | `899158`, `553329`, `867550` | Validates 1.03 ExworkCase, zone/CIF branch, inch dimension examples. |
| Exwork + Sea | `899160`, `879946`, `872842`, `873012` | Validates non-air/non-truck branch and foreign currency. |
| Grainger | `553329`, `588176`, `899133`, `867550` | Covers known Grainger vendor/rate patterns from current export. |
| Foreign currency | `899158`, `899160`, `879946`, `553329` | USD/EUR exchange rate paths. |
| Duty | `899160`, `553329`, `796546`, `821067`, `872842` | Validates import duty and MAX duty branch. |
| UOM conversion risk | `821413`, `899123`, `830692`, `733998`, `791184` | Captures `U_QLC2` semantic mismatch. |
| Wire TT / CC | `899158`, `899160`, `879946`, `553329` | Validates WTT/CC inclusion in `preQLC`. |
| SPK / QOC | `553329`, `899152`, `603502`, `770996`, `880595` | Validates final total and markup. |

## 5. Missing Data Before DB Creation

Need additional exports or curated cases for:

1. **Document fee basis in real AXON/UI payloads**
   - Unit tests now cover no fee, Per Each / UOM By Each, item-specific total
     normalized by qty, and By Lot / Batch line candidates.
   - Current Term data still does not carry Bulk Cost document fee basis, so
     real AXON/UI payload examples are still needed before production.
2. **ET / MT / MiscTax / SCC / STK**
   - Historical TOP 200 had no nonzero examples for `U_ET`, `U_MT`,
     `U_MiscTax`, `U_ASP`, `U_STK`, or `U_STK_Percent`.
3. **CWeight / Chargeable Weight**
   - Historical TOP 200 had no nonzero `U_CWeight`.
   - Need either `@CHARGEABLEWEIGHT` export or procedure output samples from
     `SPIT_GetCWeightByVendorStockItemNo`.
4. **Order term normalization**
   - Historical sample has `EX-FACTORY-Thailand`, but lacks enough `FAS`, `FOB`,
     `CIF`, `CFR`, `CPT`, `QTEC PICK UP`, and free-text variants.
5. **Mixed-vendor / mixed-currency Bulk Cost runs**
   - These are run-level warning cases and are not naturally covered by one
     Term row at a time.
6. **Clean item/vendor parsing**
   - Current CSV exports fix the earlier markdown/TSV parsing risk for item and
     vendor context.

## 6. Risks For Bulk Cost

1. Bulk Cost currently includes Per Each document fees in OP1, while legacy Term OP is
   `ProductCost + PKH + SOC`. This is correct per latest business decision, but
   it must be covered by separate golden cases.
2. Pure helper/tests now cover `DocumentFeeBasis`, but the live UI/API still
   needs explicit persistence for real AXON document-fee basis and line
   candidates.
3. Bulk Cost prototype currently lacks Term-engine parity fields for
   ET/MT/MiscTax/SCC/STK in the calculation path.
4. Freight meaning must stay locked:
   allocated freight goes into QLC; `frQTEC` remains reference/zone logic.
5. Warning codes are now split into `MIXED_VENDOR` and `MIXED_CURRENCY`; keep
   both in regression tests.
6. UOM conversion semantics must be clarified before using `U_QLC2` as a strict
   persisted parity field. `U_QLC3`/SalesPrice should be the safer business
   parity checkpoint.

## 7. Next Steps

1. Review this audit with business/owner before running any Cost Workspace
   replacement schema or production data migration.
2. Re-run the Term coverage/comparison against current `.datatest/vw@PITM1.csv`
   TOP 500.
3. Build a focused Term golden test set from the candidate `TermID` list and the
   current CSV export.
4. Ask for additional SSMS exports for the missing groups above, especially
   ET/MT/MiscTax/SCC/STK/CWeight examples and real AXON document-fee basis
   payloads.
5. After business confirms the formula coverage, implement remaining code/test changes in
   small phases:
   - order-term normalization
   - Term parity fields in Bulk Cost
   - UI/API persistence for `DocumentFeeBasis` and By Lot / Batch generated line items
