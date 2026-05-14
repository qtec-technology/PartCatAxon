# BULK_COST.md — Bulk Cost Allocation Feature Guide

ปรับปรุงล่าสุด: 13 พฤษภาคม 2026 (updated)
**Agent: อัปเดตไฟล์นี้เมื่อมีการเปลี่ยนแปลง Bulk Cost ทุกชนิด**

---

## 1. สถานะปัจจุบัน

**Phase 3A Live** — UI พร้อม, DB connected, mock fallbacks removed

| ส่วน | สถานะ |
|---|---|
| SupplierSelection (Step 1) | ✅ Done — table layout, expandable rows, 400-record pager |
| BulkCostWorkspace (Step 2-4) | ✅ Done — Source Lines, Cost Bar, Result Review |
| Allocation Run List | ✅ Done — 2-tab page, search, status/saleIncharge filters, visible horizontal scrollbar + 400-row pager, resizable columns, split Supplier/Code |
| Restore saved run | ✅ Done — opening run from list pre-loads CAL at Step 3 |
| Mark Awarded / Lost | ✅ Done — buttons in Workspace toolbar after Save Draft |
| Item/Term preview banner | ✅ Done — banner stays in normal flow so it never covers form headers while scrolling |
| Manual quote numeric input UX | ✅ Done — zero values clear on focus; non-zero values select all for quick overwrite |
| Calculation engine (frontend) | ✅ Done — 42 next-shell unit tests ผ่าน |
| Mock data | ✅ Done — Grainger baseline + 12 supplier quotes (frontend only; no server mock fallbacks) |
| Item/Term preview | ✅ Done — localStorage bridge → `/item/preview`, `/term/preview` |
| Viewport-locked layout | ✅ Done — `/bulk-cost` uses app-shell-locked layout (internal scroll matching `/partcatalog`) |
| Backend API | ✅ Phase 3A Live — `POST /api/bulk-cost/runs` draft snapshot save, `GET /runs`, `GET /runs/:id`, `PATCH /runs/:id/status` |
| DB persistence | ✅ Live — `BulkCostRun` / `BulkCostLine` / `AxonExtractionQueue` in `PART_CATALOG_AIX`; 13 seed rows in queue; mock fallbacks removed |
| Grainger CWeight source | ✅ Existing DB source — use `[GRAINGER].[dbo].[@GRAINGER_CWEIGHT]`; AIX `GraingerWeightData` staging is obsolete for the active path |
| CWeight / Weight module | 🚧 Scaffolded — `ai-services/weight-lookup.service.ts` Grainger path ready; next step is local pattern research/tests before endpoint wiring |
| Real AXON data source | ❌ Not Started |

---

## 2. User Flow

```
/bulk-cost
├── Tab: Allocations
│   └── AllocationList — search / status / saleIncharge filter
│       └── Open run → BulkCostWorkspace (pre-loaded at Step 3)
│           └── Mark Awarded / Lost → toast + status badge
└── Tab: New Allocation
    └── SupplierSelection
        └── เลือก supplier → URL params อัปเดต (?supplier=CODE&supplierName=NAME)
            └── BulkCostWorkspace รับ supplierCode + supplierName
                ├── Cost Bar (Step 1 ใน workspace): กรอก order term, ship mode, costs
                ├── Source Lines (Step 2): ดู/แก้ไข origin/latest lines, เลือก lines สำหรับ CAL
                ├── [กด CAL] → calculateAllocationPreview() → setPreview()
                ├── Result Review (Step 3): ดู/แก้ไข final results, preview item/term draft
                └── Save Draft → Awarded / Lost buttons ปรากฏ
```

### Page Refresh Behavior

URL params `?supplier=CODE&supplierName=NAME` เก็บ supplier ที่เลือก
ถ้า refresh หน้า → restore กลับ workspace โดยอัตโนมัติ (ไม่กลับ SupplierSelection)

---

## 3. ไฟล์หลัก

| ไฟล์ | บทบาท |
|---|---|
| `src/app/bulk-cost/page.tsx` | Orchestrator: URL state + SupplierSelection → Workspace |
| `src/features/bulk-cost/SupplierSelection.tsx` | Step 1: ตารางเลือก supplier |
| `src/features/bulk-cost/BulkCostWorkspace.tsx` | Main workspace UI (~2000 lines) |
| `src/features/bulk-cost/bulk-cost.types.ts` | TypeScript interfaces ทั้งหมด |
| `src/features/bulk-cost/bulk-cost.calc.ts` | Pure calculation function |
| `src/features/bulk-cost/bulk-cost.document-fees.ts` | Pure document-fee basis helper: Per Each, item-total normalization, By Lot / Batch line candidates |
| `src/features/bulk-cost/bulk-cost.api.ts` | Build/save `BulkCostRun` draft snapshot payload |
| `src/features/bulk-cost/bulk-cost.mock.ts` | Mock data (Grainger + 12 quotes) — frontend only |
| `src/features/bulk-cost/bulk-cost.preview.ts` | localStorage bridge สำหรับ preview tabs |
| `src/app/item/preview/page.tsx` | Read-only ItemForm (รับข้อมูลจาก localStorage) |
| `src/app/term/preview/page.tsx` | Read-only TermPage (รับข้อมูลจาก localStorage) |
| `next-shell/tests/unit/bulk-cost-calc.test.ts` | Unit tests |
| `next-shell/tests/unit/bulk-cost-document-fees.test.ts` | Document-fee basis golden tests |
| `next-shell/tests/unit/bulk-cost-api.test.ts` | Save payload unit test |
| `server/src/routes/bulk-cost.routes.ts` | Express routes: save, list, get, patch status |
| `server/src/repositories/bulk-cost.repository.ts` | Transactional insert/query — no mock fallbacks |
| `server/sql/20260508_bulk_cost_draft_snapshot.sql` | `BulkCostRun` / `BulkCostLine` table creation |
| `server/sql/20260512_axon_ai_tables.sql` | `AxonExtractionQueue` + AXON AI helper tables |
| `server/sql/20260512_seed_mock_data.sql` | 13 seed rows for `AxonExtractionQueue` |
| `server/sql/20260512_grainger_weight_table.sql` | Obsolete AIX staging script for `GraingerWeightData` + `GraingerWeightImportLog`; active CWeight source is `[GRAINGER].[dbo].[@GRAINGER_CWEIGHT]` |
| `ai-services/src/services/weight-lookup.service.ts` | C1: Grainger-first weight/dim lookup → Gemini AI fallback |

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
FinalResultColumns      // คอลัมน์ผลลัพธ์สุดท้าย (AY-CP ตาม Excel spec)
```

---

## 5. Calculation Engine (`bulk-cost.calc.ts`)

### หลักการ

- **Weight-based allocation:** PKH, SOC, Freight, CC
- **Value-based allocation:** Wire TT / bank fee
- **Per-each direct:** document fees (COC, Mill, Test Cert, COA, COO, Any Other)
- **Quote-level context:** Currency, Order Term, Location, Exchange Rate, Ship Mode
- Last-line residual correction — แก้ rounding ให้ sum ตรง
- Warning: missing weight → แสดง warning; weight-based costs may fall into residual behavior if every line is missing weight

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

### ShipWeightCal Priority

1. ใช้ `shippingWeightPerEach` (extracted จาก AXON) ก่อน
2. Fallback ไปคำนวณจาก dimension/item weight ถ้าไม่มี

---

## 6. Mock Data (`bulk-cost.mock.ts`)

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
| **Basic** | Identity: item code, brand, mfr no, description, HS Code, permit, shelf life, Supp Order Code |
| **Price** | Qty, UOM, unit price, currency |
| **Document Fees** | COC, Mill, Test Cert, COA, COO, Any Other |
| **Weight** | Ship weight per each, CWeight, dimensions |
| **Duty** | Duty % |
| **Term** | Delivery lead time, Supp Order Code |
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
- **Save Draft Phase 3A** บันทึกเฉพาะ `BulkCostRun` / `BulkCostLine` เป็น snapshot `DRAFT`
  ใน `PART_CATALOG_AIX`; ยังไม่สร้าง Draft Item/Term และยังไม่เขียน `@POITM` / `@PITM1`
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
- **Status lifecycle**: `DRAFT -> QUOTED -> AWARDED -> REVERSE_MAPPED -> LOST -> ARCHIVED`
- **Existing sync jobs**: `Sync POITM PARTCATALOG_SQL SBOQTEC` and
  `PartCat_Collect_Brand_Vendor` already sync to `PART_CATALOGSQL`; this is not
  a blocker because `PART_CATALOG_AIX` exposes the required data through synonyms.

---

## 12. งานถัดไปสำหรับ Bulk Cost

1. Review `.docs/BULK_COST_TEST_DATA_AUDIT.md` with business/owner
2. Collect missing golden-case data for ET/MT/MiscTax/SCC/STK, CWeight, and additional order-term variants
3. คุย business owner เรื่อง UI acceptance + field confirmations + Golden Case verification สำหรับ document fee basis
4. Build CWeight local research module/tests first: formula, divisor, rounding, ship mode, dim unit, matching fields
5. Keep Grainger CWeight lookup source as `[GRAINGER].[dbo].[@GRAINGER_CWEIGHT]`; do not deploy the obsolete AIX `GraingerWeightData` staging script for the active path
6. Wire CWeight lookup endpoint later only after business approval: query `[GRAINGER].[dbo].[@GRAINGER_CWEIGHT]` first, then review-only local semantic fallback if approved
7. Connect real AXON data source แทน seed data
8. ออกแบบ Awarded reverse mapping flow ก่อนสร้าง endpoint จริง
9. ทำ E2E test สำหรับ full allocation → save snapshot flow

---

## 13. ข้อห้ามสำหรับ Bulk Cost

- ❌ อย่าเขียน Bulk Cost save เข้า `@POITM` / `@PITM1` ใน Phase 3A
- ❌ อย่าสร้าง Draft Item/Term หรือ Award/Reverse-map endpoint จนกว่า INSERT-vs-UPDATE term rule จะได้รับการออกแบบ
- ❌ อย่าแก้ Grainger mock data (เป็น golden regression baseline จากผู้บริหาร)
- ❌ อย่าเปลี่ยนสูตร OP1 โดยไม่มีการยืนยันจาก business owner

---

## 14. เอกสารอ้างอิงใน repo

ให้ใช้ไฟล์ใน `.docs` เป็น source ล่าสุดสำหรับ workflow นี้:

| เอกสาร | เนื้อหา |
|---|---|
| `.docs/BULK_COST_CALCULATION.md` | สูตรคำนวณ Bulk Cost จาก Excel sample + reconciliation กับ Term engine |
| `.docs/BULK_COST.md` | Feature guide และ decision log สรุปของ Bulk Cost |
| `.docs/AXON_INTEGRATION.md` | AXON extraction contract และ BulkCostRun/BulkCostLine snapshot flow |
| `.docs/DATA_SCHEMA.md` | Item/Term schema และ calculation field mapping |
| `.docs/FEATURE_STATUS.md` | สถานะล่าสุดและ decision log |
