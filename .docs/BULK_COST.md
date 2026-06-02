# BULK_COST.md — Bulk Cost Allocation Feature Guide

ปรับปรุงล่าสุด: 27 พฤษภาคม 2026 (PartCatalog/SAP master wording alignment)
**Agent: อัปเดตไฟล์นี้เมื่อมีการเปลี่ยนแปลง Bulk Cost ทุกชนิด**

---

## 1. สถานะปัจจุบัน

**Phase 3A Live / Rebuild Decision Active** — current implementation still uses
Bulk Cost route/code names, but the target architecture is now **Cost
Workspace**. Read `.docs/COST_WORKSPACE_ARCHITECTURE.md` before changing schema,
AXON handoff, or finalization flow.

### 1.1 Cost Workspace Decision

Bulk Cost is no longer the full product boundary. It is one calculation mode
inside Cost Workspace.

| Decision | Current answer |
|---|---|
| Product boundary | `Cost Workspace` |
| Calculation modes | `SINGLE` + `BULK` in one editor |
| Data sources | `AXON_AWARDED` primary, `MANUAL` add-on |
| First implementation focus | Finish Manual first to verify formula, columns, UI, and snapshots |
| AXON handoff | Shared SQL View / DB view by `ChainId` / AIX ID |
| AXON filter | Only awarded supplier/line rows |
| Supplier cost basis | AXON AI marks header vs line; PartCatalog calculates |
| Save behavior | Draft is editable; every Save/Finalize creates a new immutable revision |
| Target table names | Prefer `CostWorkspaceRun`, `CostWorkspaceLine`, `CostWorkspaceSnapshot` for rebuild |
| ChainId | Search/display/correlation field, not primary key |

| ส่วน | สถานะ |
|---|---|
| SupplierSelection (Step 1) | ✅ Done — clear Manual Bulk Cost supplier search that opens a blank run |
| BulkCostWorkspace (Step 2-4) | ✅ Done — Manual workspace labels aligned with Term where possible, Step 1 starts with Term-style empty selections, DB lookups/global defaults include Purchase Sub Location, Step 2 Line Items Grid uses Item lookup dropdowns for Category/Permit Type, captures Cust Stock Code, exposes purchase/calc inputs in 2.2, keeps order-setting propagation explicit, separates selling-side terms, optional run info, Source Lines, CAL state/error, Save Revision state, Result Review |
| Allocation Run List | ✅ Done — 2-tab page, search, status/saleIncharge filters, visible horizontal scrollbar + 400-row pager, resizable columns, split Supplier/Code |
| Restore saved run | ✅ Done — opening run from list pre-loads CAL at Step 3 |
| Mark Awarded / Lost | ✅ Existing run-status buttons only — not AXON supplier Award ownership |
| Item/Term preview banner | ✅ Done — banner stays in normal flow so it never covers form headers while scrolling |
| Manual quote numeric input UX | ✅ Done — zero values clear on focus; non-zero values select all for quick overwrite |
| Calculation engine | ✅ Backend API source of truth — UI `CAL` calls `POST /api/bulk-cost/calculate`; draft save persists the returned snapshot |
| Mock data | ⚠️ Tests/demo only — Grainger baseline + 12 supplier quotes remain for regression tests; active New Allocation no longer reads mock supplier rows |
| Item/Term preview | ✅ Done — localStorage bridge → `/item/preview`, `/term/preview` |
| Viewport-locked layout | ✅ Done — `/bulk-cost` uses app-shell-locked layout (internal scroll matching `/partcatalog`) |
| Backend API | ✅ Phase 3A Live — `POST /api/bulk-cost/calculate`, `POST /api/bulk-cost/runs` revision snapshot save, `GET /runs`, `GET /runs/:id`, `PATCH /runs/:id/status`, `POST /runs/:id/sandbox-finalize` |
| Sandbox Finalize (AIX Mirror Write) | ✅ Done — `POST /api/bulk-cost/runs/:id/sandbox-finalize` writes Item+Term to `[PART_CATALOG_AIX].[dbo].[@POITM/@PITM1]` only; hard DB guard blocks SBOQTEC writes; this is not a PartCatalog/SAP master write; trace in `Updatedby`/`U_Remark`; UI confirm flow in Review panel; idempotency guard reuses existing same Run/Revision/Line rows instead of inserting duplicates; validation aligned with subLocation fallback and covered by unit tests |
| DB persistence | ✅ Live — Manual Bulk Cost save/load uses `BulkCostRun` / `DraftItem` / `DraftTerm` snapshots; it does not write production PartCatalog/SAP master records in `[SBOQTEC].[dbo].[@POITM]` / `[@PITM1]` |
| Grainger CWeight source | ✅ Existing DB source — use `[GRAINGER].[dbo].[@GRAINGER_CWEIGHT]`; AIX `GraingerWeightData` staging is obsolete for the active path |
| CWeight / Weight module | 🚧 Evaluated — local-only CWeight policy report added; exact identifiers are `AUTO_ACCEPT`, description matches remain `REVIEW_SUGGESTION`, and any future API fallback is review-only after local `NOT_FOUND` |
| Real AXON data source | ❌ Not Started |

---

## 2. User Flow

```
/bulk-cost
├── Tab: Allocations
│   └── AllocationList — search / status / saleIncharge filter
│       └── Open run → BulkCostWorkspace (pre-loaded at Step 3)
│           └── Mark run status Awarded / Lost → toast + status badge
└── Tab: New Allocation
    └── SupplierSelection
        └── เลือก supplier จาก vendor master → URL params อัปเดต (?supplier=CODE&supplierName=NAME)
            └── BulkCostWorkspace รับ supplierCode + supplierName และเปิด blank workspace
                ├── Cost Bar (Step 1 ใน workspace): Bulk Header & Global Setup — order setup including Purchase Sub Location, bulk costs, global variables; run metadata is optional and not part of calculation inputs
                ├── Source Lines (Step 2): ดู/แก้ไข origin/latest lines แบบ 2.1 Item data, 2.2 Purchase conditions, 2.3 Shipping cost, 2.4 Document fees, 2.5 Purchase price/insurance, 2.6 Sales conditions; เลือก lines สำหรับ CAL
                ├── [กด CAL] → POST /api/bulk-cost/calculate → setPreview()
                ├── Result Review (Step 3): ดู/แก้ไข final results, preview item/term draft
                └── Save Revision → run-status Awarded / Lost buttons ปรากฏ
```

### Page Refresh Behavior

URL params `?supplier=CODE&supplierName=NAME` เก็บ supplier ที่เลือก
ถ้า refresh หน้า → restore กลับ workspace โดยอัตโนมัติ (ไม่กลับ SupplierSelection)

### Recalculation / Revision Flow

Bulk Cost must support repeated calculations because supplier quotation data can
change while sales is still working. A new supplier may reply later, a better
price may arrive the next day, or the customer may request payment/shipment
conditions that change the allocation basis.

Core rules from the 2026-05-18 meeting:

- Do not make `JobId`, job name, or `ChainId` the only primary key for a saved
  calculation.
- Save each calculation as a separate revision/snapshot.
- A saved revision must be reloadable for review.
- Editing a saved working copy and recalculating must create or update an
  explicit revision, not silently overwrite the historical snapshot.
- The second calculation may have different supplier data, line items, costs,
  payment split, or shipment split from the first calculation.

Conceptual model:

```text
Business context / ChainId / manual supplier
  -> BulkCostRun revision 1
  -> BulkCostRun revision 2
  -> BulkCostRun revision 3
```

For manual Bulk Cost, the context may be only supplier/reference information.
For AXON handoff, the context includes `ChainId` and AXON comparison revision.
Both flows must preserve calculation history instead of locking one fixed row.

---

## 3. ไฟล์หลัก

| ไฟล์ | บทบาท |
|---|---|
| `src/app/bulk-cost/page.tsx` | Orchestrator: URL state + SupplierSelection → Workspace |
| `src/features/bulk-cost/SupplierSelection.tsx` | Step 1: เลือก supplier จาก vendor master เพื่อเปิด blank workspace |
| `src/features/bulk-cost/BulkCostWorkspace.tsx` | Main workspace UI (~2000 lines) |
| `src/features/bulk-cost/bulk-cost.types.ts` | TypeScript interfaces ทั้งหมด |
| `src/features/bulk-cost/bulk-cost.calc.ts` | Legacy/test calculation fixture; active UI must use backend calculate API |
| `src/features/bulk-cost/bulk-cost.formula-audit.ts` | Temporary formula audit guard comparing returned CAL output to Term/Excel-style expected steps |
| `src/features/bulk-cost/bulk-cost.final-result.ts` | AY-CP final-result schema and diagnostic-column separation |
| `src/features/bulk-cost/bulk-cost.document-fees.ts` | Pure document-fee basis helper: Per Each, item-total normalization, By Lot / Batch line candidates |
| `src/features/bulk-cost/bulk-cost.api.ts` | Backend API client for CAL, revision save, list/load/status |
| `src/features/bulk-cost/bulk-cost.mock.ts` | Dev/demo mock data (Grainger + 12 quotes) — keep out of production handoff path |
| `src/features/bulk-cost/bulk-cost.preview.ts` | localStorage bridge สำหรับ preview tabs |
| `src/app/item/preview/page.tsx` | Read-only ItemForm (รับข้อมูลจาก localStorage) |
| `src/app/term/preview/page.tsx` | Read-only TermPage (รับข้อมูลจาก localStorage) |
| `next-shell/tests/unit/bulk-cost-calc.test.ts` | Unit tests |
| `next-shell/tests/unit/bulk-cost-document-fees.test.ts` | Document-fee basis golden tests |
| `next-shell/tests/unit/bulk-cost-api.test.ts` | Save payload unit test |
| `server/src/routes/bulk-cost.routes.ts` | Express routes: save, list, get, patch status, sandbox-finalize |
| `server/src/repositories/sandbox-master.repository.ts` | Sandbox AIX @POITM/@PITM1 INSERT; includes assertNotSapTarget() guard |
| `server/src/services/sandbox-finalize.service.ts` | sandboxFinalizeRun() — load run, validate lines, write to AIX mirror |
| `server/src/queries/domains/bulk-cost/sandbox-finalize.write.ts` | SQL builders for INSERT @POITM and @PITM1 into PART_CATALOG_AIX |
| `server/src/repositories/bulk-cost.repository.ts` | Transactional insert/query — no mock fallbacks |
| `server/sql/20260519_bulk_cost_manual_revision.sql` | `BulkCostRun` revision metadata only; line snapshots remain in `DraftItem` / `DraftTerm` |
| `server/sql/20260512_axon_ai_tables.sql` | Legacy AXON queue/helper tables; not used by active Bulk Cost route |
| `server/sql/20260512_seed_mock_data.sql` | Demo-only seed rows for legacy `AxonExtractionQueue`; do not run in production |
| `server/sql/20260512_grainger_weight_table.sql` | Obsolete AIX staging script for `GraingerWeightData` + `GraingerWeightImportLog`; active CWeight source is `[GRAINGER].[dbo].[@GRAINGER_CWEIGHT]` |

---

## 4. TypeScript Data Contracts (`bulk-cost.types.ts`)

```typescript
AllocationLineSource    // ข้อมูล 1 line จาก AXON/Excel
BulkCostInput           // Cost inputs จาก Cost Bar (freight, insurance, CC, TT, etc.)
AllocationLineResult    // ผลลัพธ์ 1 line หลัง CAL
AllocationPreview       // ผลลัพธ์รวมทั้งหมด (lines[] + warnings[])
AllocationWarning       // คำเตือน (missing weight, rounding residual, etc.)
SeparateLineItem        // ค่าที่แยกออกจากการ allocate (เช่น freight ต่อ each)
AllocationRun           // Context ของการ CAL 1 ครั้ง (costs + selectedLines)
FinalResultColumns      // คอลัมน์ผลลัพธ์สุดท้าย (AY-CP + diagnostic fields)
```

Manual line identity now includes `customerStockCode`; Item preview maps it to
the Item form candidate. `itemCategory` and `permitType` must be selected from
the same Item lookup API used by the Item page where possible. Step 2.2 exposes
line-level calculation inputs (`leadTime`, `moq`, `zoneRate`, `etPercent`,
`miscTax`, `scc`) because they affect DraftTerm snapshots and/or Term CAL.

`bulk-cost.final-result.ts` is the display/export contract for the CAL final
table. `BULK_COST_AY_CP_COLUMNS` is exactly Excel AY-CP (44 columns).
Diagnostic fields such as `op1Source`, `et`, `mt`, `miscTaxVal`, `scc`,
`preQLC`, and `stk` remain available for formula review, but they are not part
of the AY-CP table.

---

## 5. Calculation Engine (`server/src/services/bulk-cost-calculation.service.ts`)

### หลักการ

- **Weight-based allocation:** PKH, SOC, Freight, CC
- **Value-based allocation:** Wire TT / bank fee
- **Per-each direct:** document fees (COC, Mill, Test Cert, COA, COO, Any Other)
- **Quote-level context:** Currency, Order Term, Location, Exchange Rate, Ship Mode
- Last-line residual correction — แก้ rounding ให้ sum ตรง
- Weight Validation: Block CAL immediately if weight-based costs (PKH, SOC, Freight, CC) are > 0 and any selected line is missing weight/dimensions.
- Contact Person Validation: If contact person name is set in costs but contact code (cntctCode) is unresolved from DB lookup, a warning is raised during Review & Finalize stage.

### OP1 Formula (confirmed by manager)

```
OP1 (source currency) = PCS + PKH + SOC + COC + Mill + Test Cert + COO + Any Other
OP1 (THB) = OP1 (source currency) × Exchange Rate
```

Only Per Each / UOM By Each document fees enter OP1. If a supplier gives a
document fee total for one specific item line, the system can normalize it to
per-each (`itemLineDocFee / qty`) before CAL. Any By Lot / Batch document fee
must be created as a separate new line item and must not be allocated into OP1.
Sales users must still be able to add, edit, delete, or redistribute these
document-fee line candidates manually before final quotation work is accepted.

Detailed review doc: `.docs/BULK_COST_CALCULATION.md`.

### Formula Audit Guard

`bulk-cost.formula-audit.ts` builds per-line audit rows for OP source, OP1,
OP2, INS, FR/CIF/DT actual and zone branches, ET/MT, preQLC, STK, QLC, QLC2,
Total QLC, markup, and sales price. The Formula view uses this guard to show
`Pass` / `Warn` / `Fail` status for the current frontend result.

This audit is temporary and display-only. Active Bulk Cost CAL runs through
`POST /api/bulk-cost/calculate`, backed by
`server/src/services/bulk-cost-calculation.service.ts`, which delegates the
per-line Term math to `server/src/services/calculation.service.ts`. The UI must
not calculate authoritative Bulk Cost results locally.

### Freight Display / Persistence Mapping

Keep these two Term fields separate:

- `U_FR` / `Freight (FR)` = actual allocated freight used by CIF and preQLC.
- `U_FreightQTEC` / `Freight to QTEC WH` = reference value
  `ShipWeightCal * FreightRate`.

Bulk Cost final result AY-CA (`FR`) displays the actual allocated freight
because that is the value used by the Bulk Cost formula. DraftTerm persistence
still writes the reference freight into `U_FreightQTEC` so the saved snapshot
matches Term page semantics.

Final-result labels intentionally include `(THB)` on CC, TT, SPK, and QOC
fields. `FR` is also a Thai baht value, aligning with Term's `Freight (FR)`
input label for Step 3 mapping. These values have already been converted or
entered as Thai baht by the time they appear in the final AY-CP result.

Currency is specified before calculation in Step 1/Step 2:

- Step 1 line `Currency` is the supplier quote currency for unit price.
- Step 2 `Quote Currency` is the currency for Cost Bar inputs such as PKH, SOC,
  freight, CC, and TT.
- Step 2 `Exchange Rate to THB` converts those Step 1/Step 2 source-currency
  inputs into the final Thai baht calculation fields.

The current frontend formula assumes one quote currency per run. If a supplier
quote mixes THB freight/CC/TT with foreign-currency item prices, users must
normalize the amounts before CAL, or the run must be split/held until a shared
backend calculation path supports mixed-currency costs explicitly.

---

## 6. Sandbox Finalize / Dry-run Master Write

**Always called "Sandbox Finalize" — NOT a PartCatalog/SAP production write.**

### What it does

`POST /api/bulk-cost/runs/:id/sandbox-finalize` reads a saved `BulkCostRun` and
writes Item + Term sandbox records into `[PART_CATALOG_AIX].[dbo].[@POITM]` and
`[@PITM1]`. This is a mirror of the SBOQTEC schema used as a staging/validation
environment only. Production PartCatalog uses the same master tables as SAP in
`[SBOQTEC].[dbo].[@POITM]` and `[@PITM1]`, so a real PartCatalog master write is
also a real SAP master write.

### Hard guards

- `assertNotSapTarget()` in `sandbox-master.repository.ts` throws unless
  `DB_NAME_SANDBOX` resolves exactly to `PART_CATALOG_AIX` (case-insensitive).
- The guard also rejects if the generated sandbox object prefix is not
  `[PART_CATALOG_AIX].[dbo]`.
- Neither the repository nor the service has any code path that writes to
  `[SBOQTEC].[dbo].[@POITM]` or `[@PITM1]`.
- The `DB_NAME_SANDBOX` env defaults to `PART_CATALOG_AIX`; do not point it to
  any other database for this sandbox flow.
- Before inserting, the service searches `[PART_CATALOG_AIX].[dbo].[@POITM]`
  by the Run/Revision/Line trace. If a matching Item + Term already exists, it
  returns the existing sandbox IDs with `reused: true` and does not insert
  duplicates.
- If a matching Item exists without a matching Term, the service returns an
  error for that line and stops that line from creating another duplicate item.

### Trace fields

Each sandbox write embeds its trace into the standard @POITM/@PITM1 schema
(no custom columns added to the mirror):

| Field | Content |
|---|---|
| `Updatedby` (50 chars) | `SBX\|R<runId>\|V<revisionNo>\|<user>` e.g. `SBX\|R42\|V2\|Kit` |
| `U_Remark` (200 chars) | `SBX-Finalize\|RunID:<runId>\|RevGroup:<revisionGroupId>\|Rev:<revisionNo>\|Line:<lineKey>\|By:<user>\|At:<timestamp>` |

Server-side winston `info` log is also emitted per written line.

### UI flow

1. Run must be saved first (Save Revision).
2. In the Review panel, click **Sandbox Finalize (AIX Dry-run)**.
3. Confirmation dialog appears. Click **ยืนยัน Sandbox Finalize** to proceed.
4. Result shows written lines (sandboxItemId, sandboxTermId per lineKey) and any
   validation errors for lines that could not be written.
5. If the same saved revision is finalized again, existing sandbox rows are
   reused and the UI indicates that duplicate rows were not created.

### Line validation before write

`sandbox-finalize.service.ts` validates each `DraftItem` snapshot:

| Field | Rule |
|---|---|
| `sapDescription` | Required |
| `itemGroup` | Required |
| `stockUOM` or `uom` | Required |
| `vendorCode` | Required |
| `currency` | Required |
| `unitPrice` | Must be > 0 |
| `orderTerm` | Required |
| `location` | Required |

Lines that fail validation are returned in the `errors` array; the service
continues writing valid lines and returns HTTP 207 if any errors occurred.

### Step 3 Term Mapping Display

The Step 3 Review table is mapped toward the Term calculation layout:

| Term area | Bulk Cost Step 3 display |
|---|---|
| Product Cost (PCS) | `PCS` |
| Packing Handling (PKH) | `PKH` |
| Supplier Outb Cost (SOC) | `SOC` |
| Documents Fees (FEES) | `Documents Fees (FEES)` diagnostic total |
| Order Price source | `OP1 (PSC)` diagnostic value before exchange rate |
| Currency | `Currency` |
| Exchange Rates | `EX.RATE` |
| Order Price (THB) | `OP1 (THB)` |
| Ship Mode / dimensions | Step 2 source columns and Term draft preview |
| Chargeable W (KG) | `Chargeable Wt/Ea`, derived from max item/dim weight before ceiling |
| Shipping Weight | `Ship Wt/Ea`, the rounded weight used by CAL |
| Freight to QTEC WH | `FR` (maps to `U_FR` = Freight (FR) in Term) |

Frontend CAL preview calls backend `POST /api/bulk-cost/calculate`, and backend
draft save calls `buildAuthoritativeBulkCostDraft()` from
`server/src/services/bulk-cost-calculation.service.ts` before repository writes.
The saved `PreviewSnapshotJson` and per-line DraftTerm calculated fields are
derived from the backend Term calculation sequence, not trusted from the client
payload. Frontend `bulk-cost.calc.ts` remains a legacy/test fixture and
formula-audit comparison helper, not the authoritative calculation path.

`Exwork` remains available in Formula/Audit diagnostics but is not shown in the
Step 3 Review table.

Bulk Cost DraftTerm save now writes `U_ValidFrom` using the server save date so
every saved draft term has a validity start date. `U_ValidTo` remains null until
an explicit business rule is confirmed.

### ShipWeightCal Priority

1. ใช้ `shippingWeightPerEach` (extracted จาก AXON) ก่อน
2. Fallback ไปคำนวณจาก dimension/item weight ถ้าไม่มี

---

## 6. Mock Data (`bulk-cost.mock.ts`)

This data is dev/demo/test-only after the architecture reset. The production
Bulk Cost entry point should be AXON final comparison by `ChainId` through
`/api/axon-handoff/comparisons/:chainId`, then clone into PartCatalogAxon
snapshots. Do not treat `bulk-cost.mock.ts` as the real AXON source.

- **Grainger** — manager-provided Excel baseline (20 lines, qty 45, amount 10,650.08 USD, shipping weight 194.43675 kg from Excel internal values)
- 12 supplier quotes เพิ่มเติมครอบคลุม:
  - Location codes: US, SG, TH, UK, DE, JP, CN
  - Order Terms: Exwork, FCA, FAS, FOB, CIF, DDP, DAP, CPT, EX-FACTORY-Thailand, QTEC PICK UP
  - Ship Modes: ทั้ง 6 modes
  - Currency: USD, EUR, JPY, etc.

---

## 7. localStorage Preview Bridge (`bulk-cost.preview.ts`)

ใช้สำหรับเปิด Item/Term preview ใน tab ใหม่โดยส่งข้อมูล draft ผ่าน localStorage

```typescript
storeBulkCostPreview(key: string, data: BulkCostPreviewPayload)  // TTL 30 นาที
loadBulkCostPreview(key: string): BulkCostPreviewPayload | null
```

Flow:
1. BulkCostWorkspace กด preview icon → `storeBulkCostPreview(key, draftData)`
2. เปิด tab ใหม่ → `/item/preview?key=KEY` หรือ `/term/preview?key=KEY`
3. Preview page อ่าน key จาก URL → `loadBulkCostPreview(key)` → render read-only form

---

## 8. Source Lines — 3 Views

| View | พฤติกรรม |
|---|---|
| **Origin** | Read-only — ข้อมูล original จาก AXON/Excel ไม่เคยเปลี่ยน |
| **Latest** | Editable — sales แก้ไขได้ คือสิ่งที่ส่งเข้า CAL เสมอ |
| **Changes** | แสดง diff ระหว่าง Origin และ Latest พร้อม per-field reset |

---

## 9. Column Presets (Source Lines)

| Preset | Fields ที่เห็น |
|---|---|
| **2.1 Item data** | Item Group, Mfr Brand, Mfr Catalog No, Item Description, Category dropdown, Cust Stock Code, Stock UOM, Country of Origin, Shelf Life, Permit, Permit Type dropdown, HS Code. |
| **2.2 Purchase conditions** | Purchase Term, Term Location, Sub Location, Supp Order Code, Lead Time, MOQ, Duty %, STK %, Zone Rate, ET %, ETC, SCC. Defaults can be pushed from Step 1 with `Apply Order Settings to All`, but line values drive CAL. |
| **2.3 Shipping cost** | Ship Mode, dimensions, item/shipping/chargeable weight, freight/courier rate. |
| **2.4 Document fees** | COC, Mill, Test Cert, COA, COO, Any Other, and document fee total/basis. |
| **2.5 Purchase price/insurance** | Qty, Product Cost (PCS), Currency, allocated PKH/SOC/DOC, OP1/OP1 THB, INS %. |
| **2.6 Sales conditions** | Sales Term, Sales Sub Location, Purchase/Stock/Sales UOM conversion, SPK, QOC, Markup. These are selling-side fields and are intentionally separate from purchase/import cost fields. |
| **All** | ทุก field — read-only audit view |

---

## 10. Item Group Codes

| Code | Display Name |
|---|---|
| `104` | FG (Finished Goods) |
| `107` | SV |
| `105` | SM |
| `106` | CM |

ใช้ code เป็น save/internal value, แสดง display name ใน UI

---

## 11. Business Rules สำคัญ

- **UOM ใน Bulk Cost** = `Stock UOM` ของ Item (field `InvntryUom` ใน `@POITM`)
- **Currency / Order Term / Location** เป็น quote-level fields; ถ้า AXON/Excel ได้หลายค่าใน quote เดียว ต้อง split run หรือให้ user resolve ก่อน CAL
- **AXON header-level costs**: if supplier quotation states document-level charges, AXON should place them in `RawPayloadJson.headerCosts` as reviewable suggestions for Cost Bar fields (`pkh`, `soc`, `freight`, `customs`/`cc`, `wireTT`, insurance). These are not final values until sales confirms/edits them.
- **Delivery Lead Time** เป็น item-level field (อาจต่างกันใน quote เดียวกัน)
- **ไม่มี** approval gate ใน prototype flow ปัจจุบัน (save ตรง)
- **ItemCode** ไม่ใช่ user-entered field — ระบบ generate จาก ItemGroup prefix + SP
- **Manual Save Revision** บันทึก `BulkCostRun` พร้อม `DraftItem` / `DraftTerm` line
  snapshots ใน `PART_CATALOG_AIX` เท่านั้น; ไม่สร้าง Item/Term master จริง
  และยังไม่เขียน production PartCatalog/SAP master ใน `[SBOQTEC].[dbo].[@POITM]` / `[@PITM1]`
- **Document fee basis is mandatory**: Per Each / UOM By Each fees enter OP1;
  item-line totals must be normalized to per-each first; By Lot / Batch fees
  become separate new line items and must not be allocated into product OP1.
- **Manual override stays mandatory**: AXON may pre-create By Lot / Batch
  certificate/test fee line candidates, but sales can add missing items, delete
  wrong candidates, edit amounts, or redistribute costs back into product lines
  when a customer-specific quotation rule requires it.
- **Golden Case required before DB execution**: document fee handling is a new
  Bulk Cost rule compared with the legacy Term engine, so business must verify
  expected pricing/margin cases before the SQL script is run in production.
- **AXON hints** เช่น `UniqueLineID`, `MatchMethod`, `MatchConfidence` เป็น hidden technical fields
  สำหรับ persistence/reverse mapping เท่านั้น ไม่ต้องแสดงให้ sales confirm ใน UI
- **Status lifecycle**: `DRAFT -> QUOTED -> AWARDED -> REVERSE_MAPPED -> LOST -> ARCHIVED`.
  In Manual Workspace this is a PartCatalog run status. It is not the AXON
  supplier Award decision; AXON owns supplier Award and PartCatalog consumes
  only `Award = Y` rows.
- **Existing sync jobs**: `Sync POITM PARTCATALOG_SQL SBOQTEC` and
  `PartCat_Collect_Brand_Vendor` already sync to `PART_CATALOGSQL`; this is not
  a blocker because `PART_CATALOG_AIX` exposes the required data through synonyms.

---

## 12. งานถัดไปสำหรับ Bulk Cost

1. Review `.docs/BULK_COST_TEST_DATA_AUDIT.md` with business/owner
2. Collect missing golden-case data for ET/MT/MiscTax/SCC/STK, CWeight, and additional order-term variants
3. คุย business owner เรื่อง UI acceptance + field confirmations + Golden Case verification สำหรับ document fee basis
4. Keep CWeight local research reports current: formula, divisor, rounding, ship mode, dim unit, matching fields, and `.docs/CWEIGHT_EVALUATION.md`
5. Keep Grainger CWeight lookup source as `[GRAINGER].[dbo].[@GRAINGER_CWEIGHT]`; do not deploy the obsolete AIX `GraingerWeightData` staging script for the active path
6. Use backend-only `POST /api/bulk-cost/cweight-prefill` for draft-line CWeight suggestions first; wire to Bulk Cost UI later only after separate UI approval
7. Keep UI CAL preview and save aligned on the backend calculation service/API; add regression coverage when fields change
8. Connect real AXON data source แทน seed data
9. ออกแบบ Awarded reverse mapping flow ก่อนสร้าง endpoint จริง
10. ทำ E2E test สำหรับ full allocation → save snapshot flow

---

## 13. ข้อห้ามสำหรับ Bulk Cost

- ❌ อย่าเขียน Bulk Cost save เข้า `@POITM` / `@PITM1` ใน Phase 3A
- ❌ อย่าสร้าง Item/Term master จริง หรือ Award/Reverse-map endpoint จนกว่า INSERT-vs-UPDATE term rule จะได้รับการออกแบบ; Phase 3A สร้างได้เฉพาะ `DraftItem` / `DraftTerm` snapshot
- ❌ อย่าแก้ Grainger mock data (เป็น golden regression baseline จากผู้บริหาร)
- ❌ อย่าเปลี่ยนสูตร OP1 โดยไม่มีการยืนยันจาก business owner

---

## 14. เอกสารอ้างอิงใน repo

ให้ใช้ไฟล์ใน `.docs` เป็น source ล่าสุดสำหรับ workflow นี้:

| เอกสาร | เนื้อหา |
|---|---|
| `.docs/BULK_COST_CALCULATION.md` | สูตรคำนวณ Bulk Cost จาก Excel sample + reconciliation กับ Term engine |
| `.docs/BULK_COST.md` | Feature guide และ decision log สรุปของ Bulk Cost |
| `.docs/AXON_HANDOFF_CONTRACT.md` | AXON awarded shared-view handoff by ChainId / AIX ID |
| `.docs/DATA_SCHEMA.md` | Item/Term schema และ calculation field mapping |
| `.docs/FEATURE_STATUS.md` | สถานะล่าสุดและ decision log |
