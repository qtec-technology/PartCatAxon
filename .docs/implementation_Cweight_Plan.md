# CWeight โ€” เธงเธดเน€เธเธฃเธฒเธฐเธซเนเธชเธ–เธฒเธเธฐเธเธฑเธเธเธธเธเธฑเธ + เนเธเธเธเธฑเธ’เธเธฒ

> เธญเธฑเธเน€เธ”เธ•: 28 เธเธคเธฉเธ เธฒเธเธก 2026

---

## 1. เธ เธฒเธเธฃเธงเธก: DB Tables 2 เธ•เธฒเธฃเธฒเธ เนเธเธฃเธฐเธเธ CWeight

```text
โ”โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”
โ”  เธ•เธฒเธฃเธฒเธเน€เธเนเธฒ (Legacy)                                                  โ”
โ”  [PART_CATALOG_AIX].[dbo].[@CHARGEABLEWEIGHT]                       โ”
โ”  โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€                         โ”
โ”  Columns:  GRAINGER_NO  |  CWeight                                   โ”
โ”  Rows:     ~500 rows (เธเธฒเธ .datatest)                                  โ”
โ”  เนเธเนเนเธ”เธข:   SP: SPIT_GetCWeightByVendorStockItemNo                    โ”
โ”  เธเธฑเธเธซเธฒ:   โ เนเธเน 2 columns, เนเธกเนเธกเธต description, เนเธกเนเธกเธต brand              โ”
โ”            โ เธ–เธนเธเน€เธฃเธตเธขเธเธเธฒเธ Term Page เธเนเธฒเธ VendorStockItemNo              โ”
โ”            โ VendorStockItemNo โ  GRAINGER_NO เนเธเธซเธฅเธฒเธขเธเธฃเธ“เธต                โ”
โ””โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”

โ”โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”
โ”  เธ•เธฒเธฃเธฒเธเนเธซเธกเน (เธเธดเธก build)                                                โ”
โ”  [PART_CATALOG_AIX].[dbo].[@GRAINGER_CWEIGHT]                       โ”
โ”  โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€                         โ”
โ”  Columns:  13 columns เธเธฃเธ (เธ”เธนเธฃเธฒเธขเธฅเธฐเน€เธญเธตเธขเธ”เธ”เนเธฒเธเธฅเนเธฒเธ)                       โ”
โ”  Rows:     1,000,000+ rows                                           โ”
โ”  เนเธเนเนเธ”เธข:   cweight.repository.ts (Exact Match)                       โ”
โ”  เธเนเธญเธ”เธต:    โ… เธกเธต description, brand, category, web link                โ”
โ”            โ… เธเนเธญเธกเธนเธฅเธเธฃเธเธชเธณเธซเธฃเธฑเธเธ—เธธเธ Phase (Exact โ’ Vector โ’ AI)            โ”
โ”  เธเนเธญเธเธณเธเธฑเธ”: โ ๏ธ เนเธเนเธ”เธเธฑเธเธเธธเธเธฑเธ query เนเธเน 6 columns เธเธฒเธ 13                  โ”
โ”            โ ๏ธ Term Page เธขเธฑเธเนเธกเนเนเธเนเธ•เธฒเธฃเธฒเธเธเธตเน                                โ”
โ””โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”
```

---

## 2. SP Legacy เธ—เธณเธญเธฐเนเธฃ (เธ•เธญเธเธเธตเนเน€เธเนเธฒเนเธเนเธฅเนเธง)

```sql
-- SPIT_GetCWeightByVendorStockItemNo
-- Query เธ•เธฒเธฃเธฒเธ [@CHARGEABLEWEIGHT] (เธ•เธฒเธฃเธฒเธเน€เธเนเธฒ 2 columns)
SELECT @outCWeight = CONVERT(VARCHAR, CONVERT(DECIMAL(19,4), ISNULL(CWeight, 0)))
FROM [@CHARGEABLEWEIGHT]
WHERE GRAINGER_NO = @VendorStockItemNo
```

**เธเธฑเธเธซเธฒเธเธฑเธ”เน€เธเธ:**
1. Query เธเธฒเธ `@CHARGEABLEWEIGHT` เนเธกเนเนเธเน `@GRAINGER_CWEIGHT` (เธ•เธฒเธฃเธฒเธเนเธซเธกเน 1M+ rows)
2. `VendorStockItemNo` เธเธฒเธ Term form เธญเธฒเธเนเธกเนเธ•เธฃเธเธเธฑเธ `GRAINGER_NO` โ’ match เนเธกเนเน€เธเธญ
3. เธเธทเธเนเธเนเธ•เธฑเธงเน€เธฅเธ CWeight โ’ เนเธกเนเธฃเธนเนเธงเนเธฒเธกเธฒเธเธฒเธเนเธซเธ, confidence เน€เธ—เนเธฒเนเธซเธฃเน

---

## 3. Flow เธเธฑเธเธเธธเธเธฑเธ vs Flow เน€เธเนเธฒเธซเธกเธฒเธข

### เธเธฑเธเธเธธเธเธฑเธ: 2 เธฃเธฐเธเธเนเธขเธเธเธฑเธ

```text
โ”โ”€ Term Page โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”
โ”  User เธเธฃเธญเธ suppOrderCode โ’ onBlur                            โ”
โ”    โ’ GET /api/terms/cweight?vendorStockItemNo=XXX            โ”
โ”    โ’ SP: SPIT_GetCWeightByVendorStockItemNo                  โ”
โ”    โ’ Query: @CHARGEABLEWEIGHT (เน€เธเนเธฒ, 2 cols) โ    โ”
โ”    โ’ Return: number (0 if not found)                         โ”
โ””โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”

โ”โ”€ Bulk Cost โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”
โ”  POST /api/cweight/resolve                                   โ”
โ”    โ’ cweight-lookup.service.ts                               โ”
โ”    โ’ Step 1: Direct Formula                                  โ”
โ”    โ’ Step 2: Query: @GRAINGER_CWEIGHT (เนเธซเธกเน, 13 cols) โ… โ”
โ”    โ’ Return: CWeightResult { decision, confidence, ... }     โ”
โ””โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”
```

### เน€เธเนเธฒเธซเธกเธฒเธข: เธฃเธฐเธเธเน€เธ”เธตเธขเธง 4 Steps

```text
โ”โ”€ เธ—เธธเธ Page (Term + Bulk Cost + เนเธเธเธเธญเธทเนเธ) โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”
โ”                                                               โ”
โ”  POST /api/cweight/resolve                                    โ”
โ”    โ’ cweight-lookup.service.ts (orchestrator)                 โ”
โ”                                                               โ”
โ”  Step 1: Direct Formula  โ”€โ”€ เธกเธต weight+dims? โ’ เธเธณเธเธงเธ“เน€เธฅเธข        โ”
โ”    โ… AUTO_ACCEPT                                              โ”
โ”                                                               โ”
โ”  Step 2: Exact Match     โ”€โ”€ @GRAINGER_CWEIGHT                 โ”
โ”    Query by: GRAINGER_NO / MFG_PART_NO + MFG_NAME            โ”
โ”    โ… AUTO_ACCEPT (conf 0.90-0.97)                            โ”
โ”                                                               โ”
โ”  Step 3: Vector Search   โ”€โ”€ Qdrant (1M+ embeddings)           โ”
โ”    Embed description โ’ search โ’ return Grainger Number        โ”
โ”    โ’ SQL query เธเธฅเธฑเธเนเธเธ”เธถเธ weight เธเธฒเธ @GRAINGER_CWEIGHT         โ”
โ”    โ ๏ธ REVIEW_SUGGESTION                                       โ”
โ”                                                               โ”
โ”  Step 4: Internet AI Search (เธชเธณเธซเธฃเธฑเธเธชเธดเธเธเนเธฒเธ—เธตเนเนเธกเนเธญเธขเธนเนเนเธ Grainger) โ”
โ”    AI Agent เธเนเธเธซเธฒเธเธฒเธเธซเธฅเธฒเธข websites โ’ เธ•เธฑเธ” outliers โ’ median     โ”
โ”    โ ๏ธ REVIEW_SUGGESTION                                       โ”
โ”                                                               โ”
โ”  Step 5: Manual Input    โ”€โ”€ user เธเธฃเธญเธเน€เธญเธ                      โ”
โ”    โ… MANUAL (conf 1.0)                                        โ”
โ””โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”
```

---

## 4. @GRAINGER_CWEIGHT โ€” 13 Columns เนเธเนเนเธ”เนเธญเธขเนเธฒเธเนเธฃ

| # | Column | เธ•เธฑเธงเธญเธขเนเธฒเธ | Phase 1 (Exact) | Phase 2 (Vector) | Phase 3 (AI) |
|---|---|---|---|---|---|
| 1 | `GRAINGER_NO` | `10E965` | ๐”‘ **Exact key** | Qdrant payload | โ€” |
| 2 | `Grainger Part Number` | `10E965` | (เธเนเธณ col 1) | โ€” | โ€” |
| 3 | `MFG_PART_NO` | `QRB206GY` | ๐”‘ **Exact key** | Qdrant payload | โ€” |
| 4 | `MFG_NAME` | `QUANTUM STORAGE SYSTEMS` | ๐” Brand filter | Qdrant payload | โ€” |
| 5 | `CATEGORY_1` | `Material Handling` | โ€” | ๐ท๏ธ **Pre-filter** เธฅเธ” search space | โ€” |
| 6 | `CATEGORY_2` | `Storage Bins and Containers` | โ€” | ๐ท๏ธ **Pre-filter** | โ€” |
| 7 | `CATEGORY_3` | `Hopper Bins` | โ€” | ๐ท๏ธ **Pre-filter** | โ€” |
| 8 | `SHORT_DESC` | `G7022 Bin 41.875 in L...` | โ€” | ๐“ **Embedding text (short)** | โ€” |
| 9 | `PRODUCT_DESCRIPTION` | (เธขเธฒเธง ~200 words) | โ€” | ๐“๐”ฅ **Embedding text (primary)** | โ€” |
| 10 | `Weight (kgs)` | `11.2365` | โ–๏ธ **Item Weight output** | โ–๏ธ Output | โ… Validation |
| 11 | `Dims Weight (kg)` | `55.1026` | โ–๏ธ **Volumetric Weight output** | โ–๏ธ Output | โ… Validation |
| 12 | `Chargeable Weight (kg)` | `55.1026` | โ–๏ธ **CWeight output** | โ–๏ธ Output | โ… Validation |
| 13 | `Grainger Web Link` | `https://www.grainger.com/...` | โ€” | โ€” | ๐ **Source validation** |

> [!IMPORTANT]
> **Column 5-9, 13 เน€เธเนเธ "เธเธธเธกเธ—เธญเธ" เธ—เธตเนเนเธเนเธ”เธเธฑเธเธเธธเธเธฑเธเนเธกเนเนเธ”เนเนเธเนเน€เธฅเธข**
> - Column 5-7 (Category) โ’ เธเธณเธเธฑเธ”เธเธทเนเธเธ—เธตเนเธเนเธเธซเธฒ เธฅเธ”เน€เธงเธฅเธฒ
> - Column 8-9 (Description) โ’ **เธซเธฑเธงเนเธเธซเธฅเธฑเธเธเธญเธ Vector Embedding**
> - Column 13 (Web Link) โ’ เนเธซเน AI เธขเธทเธเธขเธฑเธเธเนเธญเธกเธนเธฅเธเธฒเธ source เธเธฃเธดเธ

---

## 5. Proposed Changes โ€” 3 Phases

### Phase 1: Consolidate (เธ—เธณเนเธ”เนเธ—เธฑเธเธ—เธต โ…)

**เน€เธเนเธฒเธซเธกเธฒเธข**: เธฃเธงเธก 2 เธฃเธฐเธเธ CWeight เน€เธเนเธ 1 โ€” Term Page เนเธเน `@GRAINGER_CWEIGHT` เนเธ—เธ `@CHARGEABLEWEIGHT`

#### [MODIFY] [cweight-lookup.service.ts](file:///c:/Users/kittipat/source/repos/PartCatalog/server/src/services/cweight-lookup.service.ts)
- เน€เธเธดเนเธก input field: `catalogNo` (alias เธเธญเธ mfgPartNo เธเธฒเธ Term form)
- เธชเนเธ `supplierOrderCode` เธ—เธตเน Term form เธชเนเธเธกเธฒเน€เธเนเธ `GRAINGER_NO` key เธ”เนเธงเธข (เน€เธเธฃเธฒเธฐเธเธฒเธเธเธฃเธ“เธต suppOrderCode = Grainger Number เธเธฃเธดเธ)

#### [MODIFY] [useTermPageData.ts](file:///c:/Users/kittipat/source/repos/PartCatalog/next-shell/src/components/features/term/hooks/useTermPageData.ts#L611-L643) `refreshCWeightBySuppOrderCode()`
- เน€เธเธฅเธตเนเธขเธเธเธฒเธเน€เธฃเธตเธขเธ `GET /api/terms/cweight?vendorStockItemNo=XXX`
- เน€เธเนเธเน€เธฃเธตเธขเธ `POST /api/cweight/resolve` เธเธฃเนเธญเธกเธชเนเธ fields เธ—เธตเนเธกเธตเธญเธขเธนเนเธเธฃเธ:
  - `supplierOrderCode` (Vendor Stock Item No)
  - `manufacturerPartNo` (MFG Part No เธเธฒเธ form)
  - `manufacturerName` (Brand เธเธฒเธ form)
  - `itemWeightKg`, `length`, `width`, `height`, `dimUnit`, `shipModeNo`
- เนเธ”เน `CWeightResult` เธเธฅเธฑเธเธกเธฒ โ’ set `formData.cWeight` + เนเธชเธ”เธ decision badge
- เธเธดเธก : note เธเธธเธ”เธเธตเนเน€เธฃเธฒเธชเธฒเธกเธฒเธฃเธ–เนเธเนเนเธเน manufacturerPartNo เธญเธขเนเธฒเธเน€เธ”เธตเนเธขเธงเนเธ”เนเธซเธฃเธทเธญเนเธกเน เน€เธเนเธเนเธเนเธ”เนเธขเธฒเธเธ—เธตเนเธเนเธฒเธ•เนเธฒเธเนเธเธฐเนเธ”เนเธเธฃเธเน€เธชเธกเธญ เนเธฅเธฐ `itemWeightKg`, `length`, `width`, `height`, `dimUnit`, `shipModeNo`, `supplierOrderCode`  เนเธกเนเธเธงเธฃเธเธณเธกเธฒเนเธเนเน€เธเนเธเธ•เธฑเธงเธเธเธซเธฒเนเธเธเธงเธฒเธกเธเธดเธ”เธเธกเนเธฅเนเธงเธเนเธงเธขเธเธดเธ”เธ—เธต

#### [MODIFY] [term.api.ts](file:///c:/Users/kittipat/source/repos/PartCatalog/next-shell/src/services/term.api.ts#L48-L60)
- เน€เธเธดเนเธก function `resolveCWeight()` เธ—เธตเนเน€เธฃเธตเธขเธ `POST /api/cweight/resolve`
- `getCWeightByVendorStockItemNo()` deprecate (เธญเธฒเธเน€เธเนเธเนเธงเน backward compat เธเนเธงเธเนเธฃเธ)

#### Legacy cleanup (เน€เธกเธทเนเธญ Phase 1 stable)
- เธฅเธ `GET /api/terms/cweight` route
- เธฅเธ `term.controller.ts > getCWeight()`
- เธฅเธ `term.repository.ts > getCWeight()` (SP reference)
- SP `SPIT_GetCWeightByVendorStockItemNo` โ€” verify เธงเนเธฒเนเธกเนเธกเธตเธฃเธฐเธเธเธญเธทเนเธเนเธเน เนเธฅเนเธงเธฅเธเนเธ”เน
- เธ•เธฒเธฃเธฒเธ `@CHARGEABLEWEIGHT` โ€” verify เนเธฅเนเธงเธฅเธเนเธ”เน (เธเนเธญเธกเธนเธฅเธกเธตเธญเธขเธนเนเนเธ `@GRAINGER_CWEIGHT` เธเธฃเธเนเธฅเนเธง)

---

### Phase 2: Vector Search / Description Matching (เธ•เนเธญเธเธกเธต Qdrant + API key)

**เน€เธเนเธฒเธซเธกเธฒเธข**: เน€เธกเธทเนเธญ Exact Match เนเธกเนเธเธ โ’ เนเธเน `PRODUCT_DESCRIPTION` เธซเธฒ Grainger Number เธ—เธตเนเนเธเธฅเนเน€เธเธตเธขเธ

#### Embedding Pipeline (offline batch โ€” เธ—เธณเธเธฃเธฑเนเธเน€เธ”เธตเธขเธง)
```text
1M+ rows เธเธฒเธ @GRAINGER_CWEIGHT
  โ’ concat: SHORT_DESC + " " + PRODUCT_DESCRIPTION
  โ’ OpenAI text-embedding-3-small โ’ vector 1536 dims
  โ’ Upload to Qdrant collection "grainger_cweight"
  โ’ Payload: { graingerNo, mfgPartNo, mfgName, category1, shortDesc }
```

#### Runtime Flow (เธ•เธฒเธก vision เธเธตเนเนเธเน)
```text
Input description "Heavy duty PEX ball valve 1/2 in"
  โ’ Embed โ’ Qdrant nearest neighbor search
  โ’ Return: payload.graingerNo = "3AB12"
  โ’ SQL: SELECT * FROM @GRAINGER_CWEIGHT WHERE GRAINGER_NO = '3AB12'
  โ’ Return: REVIEW_SUGGESTION + weight data
```

#### [MODIFY] [cweight-lookup.service.ts](file:///c:/Users/kittipat/source/repos/PartCatalog/server/src/services/cweight-lookup.service.ts)
- เน€เธเธดเนเธก Step 3: เน€เธกเธทเนเธญ exact match เนเธกเนเธเธ โ’ เน€เธฃเธตเธขเธ Vector Search service
- Vector Search return `graingerNo` โ’ query `@GRAINGER_CWEIGHT` เธเธฅเธฑเธเธกเธฒเธ”เธถเธ weight

#### Technology decisions
- **เธชเธฃเนเธฒเธเธ—เธตเนเนเธซเธ**: เธ–เนเธฒ Qdrant + OpenAI embedding เธญเธขเธนเนเนเธ PartCatalog server โ’ เน€เธเธดเนเธก dependency เนเธ server
- **เธซเธฃเธทเธญ Standalone**: เธชเธฃเนเธฒเธ CWeight Standalone API เธ—เธตเน wrap vector search + SQL query
- PartCatalog server เน€เธฃเธตเธขเธ Standalone API เน€เธกเธทเนเธญ local exact match เนเธกเนเธเธ

---

### Phase 3: Internet AI Search + Manual Input (เธฃเธฐเธขเธฐเธขเธฒเธง)

**เน€เธเนเธฒเธซเธกเธฒเธข**: เธชเธดเธเธเนเธฒเธ—เธตเนเนเธกเนเธญเธขเธนเนเนเธ Grainger เน€เธฅเธข โ’ AI เธซเธฒเธเธฒเธ internet โ’ Manual fallback

#### AI Search (เธ•เธฒเธก vision เธเธตเนเนเธเน)
- AI Agent เธเนเธเธซเธฒ product weight + dimensions เธเธฒเธ 5-10 websites
- เธ•เธฑเธ” outliers (IQR/Z-score) โ’ median/average
- Validation: เน€เธ—เธตเธขเธเธเธฑเธ Grainger ground truth เธเนเธญเธเนเธเนเธเธฃเธดเธ

#### Manual Input
- เธ–เนเธฒ AI เนเธกเนเนเธเนเนเธ โ’ force user เธเธฃเธญเธ weight/dims manually
- UI: เนเธชเธ”เธ NOT_FOUND badge + manual input form

---

## User Review Required

> [!IMPORTANT]
> **Phase 1 เธ—เธณเนเธ”เนเน€เธฅเธขเธซเธฃเธทเธญเนเธกเน?**
> 1. เธขเธทเธเธขเธฑเธเธงเนเธฒ Term Page เน€เธเธฅเธตเนเธขเธเธเธฒเธ `GET /api/terms/cweight` โ’ `POST /api/cweight/resolve` เนเธ”เนเน€เธฅเธข?
> 2. Legacy SP (`SPIT_GetCWeightByVendorStockItemNo`) เธกเธตเธฃเธฐเธเธเธญเธทเนเธเน€เธฃเธตเธขเธเนเธเนเธญเธตเธเนเธซเธก? (เน€เธเนเธ Microsoft Access เน€เธเนเธฒ, report เธญเธทเนเธเน)
> 3. เธ•เธฒเธฃเธฒเธ `@CHARGEABLEWEIGHT` เธกเธตเธฃเธฐเธเธเธญเธทเนเธเธญเนเธฒเธเธญเธขเธนเนเนเธซเธก?

> [!IMPORTANT]
> **Column names เนเธ SQL**
> 4. Column names เนเธ `@GRAINGER_CWEIGHT` SQL table เธ•เธฃเธเธเธฑเธ Excel headers เน€เธเนเธฐเธซเธฃเธทเธญเธกเธต underscore เนเธ—เธ space?
>    - Excel: `GRAINGER NO` โ’ SQL: `GRAINGER_NO`?
>    - Excel: `SHORT DESC` โ’ SQL: `SHORT_DESC`?
>    - Excel: `PRODUCT DESCRIPTION` โ’ SQL: `PRODUCT_DESCRIPTION`?
>    - Excel: `Weight (kgs)` โ’ SQL: `Sell_Pack_Weight_kgs`?
>    - (เนเธเนเธ”เธเธฑเธเธเธธเธเธฑเธเนเธเน `Sell_Pack_Weight_kgs`, `Volumetric_Weight_kgs`, `Chargeable_Weight_kgs` เธเธถเนเธเธ•เนเธฒเธเธเธฒเธ Excel headers)

> [!WARNING]
> **Phase 2-3 เธ•เนเธญเธเธ•เธฑเธ”เธชเธดเธเนเธเธเนเธญเธ**
> 5. Phase 2 (Vector Search): เธชเธฃเนเธฒเธเนเธ PartCatalog server เธซเธฃเธทเธญเนเธขเธ repo?
`Kim: เธเธงเธฃเธชเธฃเนเธฒเธเนเธขเธเธญเธญเธเธกเธฒเน€เธเนเธ "เนเธกเธ”เธนเธฅเธญเธดเธชเธฃเธฐ (Standalone Module / API)" เธเธฃเธฑเธ เนเธกเนเธเธงเธฃเธชเธฃเนเธฒเธเธเธนเธเธ•เธดเธ”เนเธงเนเนเธเธ•เธฑเธงเนเธเธฃเนเธเธฃเธก PartCatalog เนเธ”เธขเธ•เธฃเธ เธชเนเธงเธเน€เธฃเธทเนเธญเธเนเธขเธ repo เธเธธเธ“เธเนเธงเธขเธเธกเธเธดเธ”เธซเธเนเธญเธขเธงเนเธฒเนเธเธเนเธซเธเธ”เธตเธเธงเนเธฒเธเธฑเธเธฃเธฐเธซเธงเนเธฒเธเนเธขเธเธเธฑเธเนเธกเนเนเธขเธ`
> 6. Qdrant (192.168.2.54:6333) เธเธฃเนเธญเธกเนเธเนเนเธฅเนเธงเธซเธฃเธทเธญเธขเธฑเธ?
`Kim: เธเธกเธขเธฑเธเนเธกเนเนเธ”เนเน€เธฃเธดเนเธกเธ•เนเธเธญเธฐเนเธฃเน€เธฅเธข`
> 7. OpenAI API key เธกเธตเธญเธขเธนเนเนเธฅเนเธงเธซเธฃเธทเธญเธ•เนเธญเธ approve?
`Kim: เธกเธตเธญเธขเธนเนเนเธฅเนเธงเนเธ•เนเน€เธเธทเนเธญเธเธ•เนเธเน€เธฃเธฒเธขเธฑเธเนเธกเนเธ•เนเธญเธเธชเธฃเนเธฒเธ API เธเธตเนเนเธเนเธเธญเธเธงเนเธฒเนเธซเนเธ—เธ”เธชเธญเธเธ”เนเธงเธข agents เธเนเธญเธเธซ`

## Open Questions

1. `@GRAINGER_CWEIGHT` เธกเธต SQL indexes เธญเธฐเนเธฃเนเธฅเนเธงเธเนเธฒเธ? (`GRAINGER_NO`, `MFG_PART_NO` ?
`Kim: เนเธกเนเธกเธต indexes`
2. เธเนเธญเธกเธนเธฅ 1M+ rows เนเธ `@GRAINGER_CWEIGHT` update เธเนเธญเธขเนเธเนเนเธซเธ? (batch import? real-time sync?)
`Kim: batch import เธเธฒเธเนเธ—เธต`
3. `@CHARGEABLEWEIGHT` เธกเธตเธเนเธญเธกเธนเธฅเนเธซเธเธ—เธตเนเนเธกเนเธกเธตเนเธ `@GRAINGER_CWEIGHT`? เธซเธฃเธทเธญเน€เธเนเธ subset เธ—เธฑเนเธเธซเธกเธ”?
`Kim: เน€เธเนเธ subset เธ—เธฑเนเธเธซเธกเธ”`

---

## Verification Plan

### Phase 1 Verification
```bash
# 1. Typecheck + Tests
npm run typecheck
npm test
npm run build

# 2. Manual test
# Term Page: เธเธฃเธญเธ Vendor Stock Item No โ’ เธ”เธถเธ CWeight เธเธฒเธ @GRAINGER_CWEIGHT
# Term Page: เธเธฃเธญเธ MFG Part No + Brand โ’ เธ”เธถเธ CWeight เธเธฒเธ @GRAINGER_CWEIGHT
# Bulk Cost: prefill CWeight เธขเธฑเธเธ—เธณเธเธฒเธเน€เธซเธกเธทเธญเธเน€เธ”เธดเธก
```

### SQL Verification
```sql
-- เธ•เธฃเธงเธ column names เธเธฃเธดเธ
SELECT TOP 5 * FROM [PART_CATALOG_AIX].[dbo].[@GRAINGER_CWEIGHT]

-- เธเธฑเธ rows
SELECT COUNT(*) FROM [PART_CATALOG_AIX].[dbo].[@GRAINGER_CWEIGHT]

-- เธ•เธฃเธงเธ indexes
EXEC sp_helpindex '[@GRAINGER_CWEIGHT]'

-- เน€เธเธฃเธตเธขเธเน€เธ—เธตเธขเธ 2 เธ•เธฒเธฃเธฒเธ
SELECT COUNT(*) AS OldTable FROM [PART_CATALOG_AIX].[dbo].[@CHARGEABLEWEIGHT]
SELECT COUNT(*) AS NewTable FROM [PART_CATALOG_AIX].[dbo].[@GRAINGER_CWEIGHT]
```
### SQL Result from Kim query

```json
[
  {
    "GRAINGER NO": "10E965",
    "Grainger Part Number": "10E965",
    "MFG PART NO": "QRB206GY",
    "MFG NAME": "QUANTUM STORAGE SYSTEMS",
    "CATEGORY 1": "Material Handling",
    "CATEGORY 2": "Storage Bins and Containers",
    "CATEGORY 3": "Hopper Bins",
    "SHORT DESC": "G7022 Bin 41.875 in L 19.875 in W Plastic",
    "PRODUCT DESCRIPTION": "G7022 Bin Color Gray Includes Dividers Dividers Not Included Includes Label Holder Label Holder Included Material Plastic Maximum Operating Temperature 250 Degrees F Overall Height 17 1/2 in Overall Length 41 7/8 in Overall Width 19 7/8 in Stackable Stacking Capable Weight Capacity 175 lb Mobility Stationary Number of Divider Slots 3 Number of Long Divider Slots 3 Number of Short Divider Slots 0 Number of Dividers Not Applicable Caster Wheel Diameter Not Applicable",
    "Weight (kgs)": 11.2365,
    "Dims Weight (kg)": 55.10262612951808,
    "Chargeable Weight (kg)": 55.10262612951808,
    "Grainger Web Link": "https://www.grainger.com/Grainger/items/10E965"
  },
  {
    "GRAINGER NO": "10E967",
    "Grainger Part Number": "10E967",
    "MFG PART NO": "QRB246GY",
    "MFG NAME": "QUANTUM STORAGE SYSTEMS",
    "CATEGORY 1": "Material Handling",
    "CATEGORY 2": "Storage Bins and Containers",
    "CATEGORY 3": "Hopper Bins",
    "SHORT DESC": "G7024 Bin 41.875 in L 23.875 in W Plastic",
    "PRODUCT DESCRIPTION": "G7024 Bin Color Gray Includes Dividers Dividers Not Included Includes Label Holder Label Holder Included Material Plastic Maximum Operating Temperature 250 Degrees F Overall Height 17 1/2 in Overall Length 41 7/8 in Overall Width 23 7/8 in Stackable Stacking Capable Weight Capacity 175 lb Mobility Stationary Number of Divider Slots 3 Number of Long Divider Slots 3 Number of Short Divider Slots 0 Number of Dividers Not Applicable Caster Wheel Diameter Not Applicable",
    "Weight (kgs)": 12.939,
    "Dims Weight (kg)": 64.61295180722892,
    "Chargeable Weight (kg)": 64.61295180722892,
    "Grainger Web Link": "https://www.grainger.com/Grainger/items/10E967"
  },
  {
    "GRAINGER NO": "10E971",
    "Grainger Part Number": "10E971",
    "MFG PART NO": "1275-207BL",
    "MFG NAME": "QUANTUM STORAGE SYSTEMS",
    "CATEGORY 1": "Material Handling",
    "CATEGORY 2": "Shelving and Storage Racks",
    "CATEGORY 3": "Stationary Bin Shelving and Pick Racks",
    "SHORT DESC": "G6988 Bin Shlvng 12inx75inx36in Blue",
    "PRODUCT DESCRIPTION": "G6988 Bin Shelving Bin Style Shelf Bin Material Polypropylene (36) 6 in x 8 3/8 in x 11 5/8 in Bin HxWxD Bin Height 6 in Bin Front Type Open Bin Depth 11 5/8 in Bin Color Blue Frame Material Steel NSF Frame Color Gray Powder Coated Includes Bins Yes Bin Width 8 3/8 in Includes QSB207BL Load Capacity per Shelf 400 lb Number of Bins 36 Number of Shelves 10 Number of Usable Sides 1 Overall Depth 12 in Overall Height 75 in Overall Width 36 in Powder Coated Shelf Finish",
    "Weight (kgs)": 56.75,
    "Dims Weight (kg)": 110.76506024096385,
    "Chargeable Weight (kg)": 110.76506024096385,
    "Grainger Web Link": "https://www.grainger.com/Grainger/items/10E971"
  },
  {
    "GRAINGER NO": "10E973",
    "Grainger Part Number": "10E973",
    "MFG PART NO": "1239-201BL",
    "MFG NAME": "QUANTUM STORAGE SYSTEMS",
    "CATEGORY 1": "Material Handling",
    "CATEGORY 2": "Shelving and Storage Racks",
    "CATEGORY 3": "Stationary Bin Shelving and Pick Racks",
    "SHORT DESC": "G6982 Bin Shlvng 12inx39inx36in Blue",
    "PRODUCT DESCRIPTION": "G6982 Bin Shelving Bin Style Shelf Bin Material Polypropylene (32) 6 in x 4 1/8 in x 11 5/8 in Bin HxWxD Bin Height 6 in Bin Front Type Open Bin Depth 11 5/8 in Bin Color Blue Frame Material Steel NSF Frame Color Gray Powder Coated Includes Bins Yes Bin Width 4 1/8 in Includes QSB201BL Load Capacity per Shelf 400 lb Number of Bins 32 Number of Shelves 5 Number of Usable Sides 1 Overall Depth 12 in Overall Height 39 in Overall Width 36 in Powder Coated Shelf Finish",
    "Weight (kgs)": 31.78,
    "Dims Weight (kg)": 57.59783132530121,
    "Chargeable Weight (kg)": 57.59783132530121,
    "Grainger Web Link": "https://www.grainger.com/Grainger/items/10E973"
  },
  {
    "GRAINGER NO": "10E976",
    "Grainger Part Number": "10E976",
    "MFG PART NO": "1239-209BL",
    "MFG NAME": "QUANTUM STORAGE SYSTEMS",
    "CATEGORY 1": "Material Handling",
    "CATEGORY 2": "Shelving and Storage Racks",
    "CATEGORY 3": "Stationary Bin Shelving and Pick Racks",
    "SHORT DESC": "G6985 Bin Shlvng 12inx39inx36in Blue",
    "PRODUCT DESCRIPTION": "G6985 Bin Shelving Bin Style Shelf Bin Material Polypropylene (12) 11 5/8 in x 11 1/8 in x 6 in Bin HxWxD Bin Height 6 in Bin Front Type Open Bin Depth 11 5/8 in Bin Color Blue Frame Material Steel NSF Frame Color Gray Powder Coated Includes Bins Yes Bin Width 11 1/8 in Includes QSB209BL Load Capacity per Shelf 400 lb Number of Bins 12 Number of Shelves 5 Number of Usable Sides 1 Overall Depth 12 in Overall Height 39 in Overall Width 36 in Powder Coated Shelf Finish",
    "Weight (kgs)": 28.375,
    "Dims Weight (kg)": 57.59783132530121,
    "Chargeable Weight (kg)": 57.59783132530121,
    "Grainger Web Link": "https://www.grainger.com/Grainger/items/10E976"
  }
]

[
  {
    "(No column name)": 1008109
  }
]

[
  {
    "OldTable": 1008109
  }
]

[
  {
    "NewTable": 1008109
  }
]
```
