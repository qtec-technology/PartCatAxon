# AXON → PartCatalog Integration Contract

> อัปเดตล่าสุด: 2026-05-08  
> อ้างอิงหลักใน repo: `.docs/BULK_COST.md`, `.docs/BULK_COST_CALCULATION.md`, `.docs/DATA_SCHEMA.md`
> **อ่านไฟล์นี้ก่อนเริ่ม backend Bulk Cost ทุกครั้ง**

---

## 1. แนวคิดหลัก

AXON ทำหน้าที่ **อ่านเอกสาร supplier แล้วส่งข้อมูลกลับมาให้ PartCatalog** เท่านั้น  
AXON ไม่ตัดสินใจว่า field ไหนต้องลงฐานข้อมูลอย่างไร เพราะข้อมูลบางตัวต้อง match กับ master data เดิม  
(Supplier, Item Group, Mfr Brand, UOM, Sales Person, Location)

### Flow หลัก

```
AXON Python Orchestrator
└── อ่านเอกสาร supplier (PDF / Excel / Email / Image)
    └── ส่ง ExtractionPayload → PartCatalog Bulk Cost API
        └── ระบบสร้าง:
            ├── Origin (สำเนาจาก AXON — ห้ามแก้ไข, ใช้ audit)
            └── Latest (สำเนาที่ user แก้ไขได้ — ใช้ CAL จริง)
                └── User ยืนยัน/แก้ไข fields ที่จำเป็น
                    └── กด CAL → ระบบคำนวณ Bulk Cost Allocation
                        └── Save Draft → เก็บ BulkCostRun + DraftItem/DraftTerm snapshot
                            └── Awarded phase ค่อย reverse-map เข้า Item/Term master
```

---

## 2. AXON Pipeline ภาพรวม

AXON ใช้ AI หลายตัว แบ่งเป็น Stage:

| Stage | หน้าที่ | AI Provider |
|---|---|---|
| A | Email Classification | OpenAI GPT-4.1 (fallback: Claude Sonnet 4) |
| B | RFQ/Document Extraction (multimodal) | Gemini 2.5 Pro Vertex AI (fallback: GPT-4.1) |
| C | Brand Resolution | OpenAI |
| D | Hybrid Search (vector) | Qdrant (192.168.2.54:6333) + OpenAI embeddings |
| E | Part Matching | OpenAI |
| F1 | Reply Tracker (rule-based) | ไม่ใช้ AI |
| F2 | Reply Classifier | OpenAI GPT-4.1 (async) |
| G1 | Quote Extractor | Gemini 2.5 Flash |
| G2 | Concern Analyzer | OpenAI GPT-4.1 |
| G3 | Quote Ranker | OpenAI GPT-5.4 |

**จุดที่เกี่ยวกับ PartCatalog Bulk Cost โดยตรง:** Stage G1 (Quote Extractor) ส่ง ExtractionPayload เข้า API

---

## 3. หลักการแบ่ง Field เป็น 4 กลุ่ม

| กลุ่ม | เจ้าของ | ตัวอย่าง |
|---|---|---|
| **Extracted** | AXON อ่านจากเอกสาร | Supplier Name, Supp Order Code, Description, Qty, Unit Price, Currency |
| **User Confirmed** | User ต้องยืนยันก่อน save | Supplier match, Item Group, Mfr Brand, Stock UOM, Duty %, Weight |
| **System Default** | ระบบใส่ค่าเริ่มต้น user แก้ได้ | Active = true, UOM conversion = 1, Valid From = document date/today |
| **Calculated** | ระบบคำนวณหลัง CAL | Amount, Ratio, OP1, OP2, CIF, Duty Amount, QLC, Sales Price |

**กฎสำคัญ:** Calculated fields ไม่ใช่ input จาก AXON — ระบบคำนวณเองเสมอ

---

## 4. AXON Extraction Payload Contract

### 4.1 Document Header (batch level)

| Field | ต้องส่ง | เหตุผล |
|---|---|---|
| `sourceFileId` | ✅ ต้องส่ง | ผูกกลับไปยังไฟล์ต้นทาง |
| `sourceFileName` | ✅ ต้องส่ง | audit + แสดงให้ user ตรวจ |
| `documentType` | ถ้ามี | quote, invoice, proforma, email, spreadsheet |
| `documentNo` | ถ้ามี | reference/contract/quote no |
| `documentDate` | ถ้ามี | ช่วย default Valid From หรือ exchange rate date |
| `supplierRawName` | ✅ ต้องส่ง | ใช้ match Supplier master |
| `supplierAddress` | ถ้ามี | ช่วยตรวจ supplier/country/origin |
| `supplierContactName` | ถ้ามี | map ไป Contact Person |
| `supplierEmailOrPhone` | ถ้ามี | ช่วยเลือก contact |
| `currency` | ✅ ต้องส่งถ้ามีราคา | ใช้กับ Product Cost |
| `paymentTerm` | ถ้ามี | เก็บเป็น remark/reference |
| `purchaseTerm` / `incoterm` | ✅ ต้องส่งถ้าเจอ | มีผลต่อสูตร Ex-work/Freight/OP2 |
| `termLocation` / `shipFrom` | ถ้ามี | ใช้หา Zone Rate หรือ Term Location |
| `validFrom` / `validTo` | ถ้ามี | Term validity |
| `leadTimeDays` | ถ้ามี (header default) | Lead time อาจแตกต่างต่อ item — ใช้เป็น default เท่านั้น |
| `moq` / `mov` | ถ้ามี | map ไป MOQ/MOV |

> **หมายเหตุ:** AXON ควรส่งทั้ง normalized value และ raw text  
> เช่น `purchaseTerm = "Ex-work"` พร้อม `raw = "EXW warehouse USA"`

---

### 4.2 Header-Level Costs in `RawPayloadJson`

If a supplier quotation clearly states document-level costs, AXON should extract
them into `RawPayloadJson.headerCosts`. These values are suggestions for the
Bulk Cost Cost Bar; sales must still review/edit them before CAL.

Keep these values separate from item lines. Product-specific fees stay on the
line. By Lot / Batch document fees remain review candidates and must not be
automatically allocated into OP1 unless a business rule is approved.

Suggested JSON shape:

```json
{
  "quote": {
    "currency": "USD",
    "purchaseTerm": "EXW",
    "termLocation": "US"
  },
  "headerCosts": {
    "packingHandling": {
      "amount": 50,
      "currency": "USD",
      "basis": "HEADER_TOTAL",
      "sourceText": "Packing & handling: USD 50",
      "confidence": 0.92,
      "needsReview": true
    },
    "supplierOutboundCost": {
      "amount": 120,
      "currency": "USD",
      "basis": "HEADER_TOTAL",
      "sourceText": "Freight to forwarder: USD 120",
      "confidence": 0.88,
      "needsReview": true
    },
    "freight": {
      "amount": null,
      "currency": null,
      "basis": "UNKNOWN",
      "sourceText": null,
      "confidence": 0,
      "needsReview": true
    },
    "customClearance": {
      "amount": null,
      "currency": null,
      "basis": "UNKNOWN",
      "sourceText": null,
      "confidence": 0,
      "needsReview": true
    },
    "wireTransferFee": {
      "amount": null,
      "currency": null,
      "basis": "UNKNOWN",
      "sourceText": null,
      "confidence": 0,
      "needsReview": true
    },
    "insurance": {
      "amount": null,
      "percent": null,
      "currency": null,
      "basis": "UNKNOWN",
      "sourceText": null,
      "confidence": 0,
      "needsReview": true
    },
    "otherCharges": []
  }
}
```

| `headerCosts` field | Bulk Cost mapping |
|---|---|
| `packingHandling.amount` | Cost Bar `pkh` |
| `supplierOutboundCost.amount` | Cost Bar `soc` |
| `freight.amount` | Cost Bar `freight` |
| `customClearance.amount` | Cost Bar `customs` / `cc` |
| `wireTransferFee.amount` | Cost Bar `wireTT` |
| `insurance.amount` / `insurance.percent` | Insurance input, if present |
| `otherCharges[]` | Review-only until mapped |

Allowed `basis` values:

```text
HEADER_TOTAL | PER_LINE | PER_UNIT | UNKNOWN
```

---

### 4.3 Item Line Fields (สำคัญที่สุด)

1 source line = 1 DraftItem + 1 DraftTerm snapshot under one BulkCostRun in
Phase 3A. `BulkCostLine` has been removed from the live schema. These Draft
tables are still only draft snapshots; they do not write `@POITM` / `@PITM1`
until Awarded reverse mapping is designed and approved.

| Field | AXON ส่ง | User ยืนยัน | ใช้กับ |
|---|---|---|---|
| `lineNo` | ✅ ต้องส่ง | ไม่ต้องกรอก | audit/order |
| `supplierOrderCode` | ✅ ถ้าเจอ | ตรวจความถูกต้อง | Term: Supp Order Code |
| `mfrBrand` | ✅ ถ้าเจอ | ✅ ถ้าสร้าง item ใหม่ | Item: Mfr Brand |
| `mfrCatalogNo` | ✅ ถ้าเจอ | ✅ ถ้าสร้าง item ใหม่ | Item: Mfr Catalog No |
| `itemCategory` | ถ้า infer ได้ | ✅ ถ้าสร้าง item ใหม่ | Item: Item Category |
| `supplierDescription` | ✅ ต้องส่ง | reference | Item/Term reference |
| `itemDescriptionCandidate` | ควรส่ง | ตัดให้ ≤100 ตัวอักษร | Item Description |
| `longDescriptionCandidate` | ควรส่ง | แก้ต่อหลังสร้าง draft | Long Description |
| `qty` | ✅ ต้องส่ง | ✅ ต้องยืนยัน | CAL, draft term |
| `uom` / `stockUom` | ✅ ถ้าเจอ | ✅ ต้องยืนยัน (Stock UOM) | Item: `InvntryUom` |
| `unitPrice` | ✅ ต้องส่ง | ✅ ต้องยืนยัน | Product Cost (PCS) |
| `currency` | ✅ ต้องส่ง | ยืนยันกับ header currency | Product Cost currency |
| `leadTimeDays` | ถ้ามีต่อ line | ✅ ต้อง confirm | Term Lead Time |
| `amount` | ส่งได้ | ตรวจเทียบ | ระบบคำนวณซ้ำ: `qty × unitPrice` |
| `countryOfOrigin` | ถ้ามี | optional | Item COO |
| `hsCode` | ถ้ามี | optional | Item HS Code |
| `eccn` | ถ้ามี | optional | Item ECCN |
| `itemWeightKg` | ถ้ามี | ✅ confirm | Term Item Weight |
| `chargeableWeightKg` | ถ้ามี | ✅ confirm | CAL allocation (CC) |
| `shippingWeightPerEachKg` | ถ้ามี | ✅ confirm | CAL allocation |
| `dutyPercent` | ถ้ามีหรือ lookup | ✅ ต้อง confirm | Import Duty |
| `permitRequired` | ถ้าเจอข้อความ | ✅ ต้อง confirm | Permit Required |
| `cocFee` | ถ้ามี | confirm | Document fee |
| `millCertFee` | ถ้ามี | confirm | Document fee |
| `testCertFee` | ถ้ามี | confirm | Document fee |
| `coaFee` | ถ้ามี | confirm | Document fee |
| `cooFee` | ถ้ามี | confirm | Document fee |
| `anyOtherFee` | ถ้ามี | confirm | Document fee |

Document fee basis must also be captured or confirmed:

- `Per Each` / `UOM By Each`: fee enters OP1 as a per-unit source-currency cost.
- Item-specific non-per-each total: sales normalizes to per each before CAL.
- `By Lot` / `Batch`: create a separate new line item; do not allocate into OP1.

Manual override rule: AXON may suggest document-fee line candidates, but sales
must be able to add missing fee items, edit values/basis, delete incorrect
candidates, or redistribute a fee back into product lines when a
customer-specific quotation rule requires it.

---

### 4.4 Matching / Master Data Hints

AXON ควรส่ง hint สำหรับ master data lookup พร้อม confidence:

```typescript
matchingHints: {
  supplierCode?: string        // VendorCode ที่ match ใน @OCRD
  supplierConfidence?: number  // 0–1
  itemCode?: string            // ItemCode ที่น่าจะ match ใน @POITM
  itemMatchType?: "existing" | "new_item"
  itemConfidence?: number
  brandCode?: string           // จาก @BRAND master
  brandConfidence?: number
}
```

**กฎสำคัญ:**
- `ItemCode` **ไม่ใช่ field ที่ AXON ต้องส่ง** และไม่ให้ user กรอกก่อน save
- Backend จะ generate ItemCode หลัง save ผ่าน stored procedure เดิมของ Part Catalog
- แสดงสถานะเป็น `Match = Existing / New Item` แทน ItemCode
- `Item Group` ต้องให้ user เลือกก่อนสร้าง draft เพราะมีผลกับ prefix + stored procedure

---

## 5. Origin / Latest Model

```typescript
interface DraftLineSnapshot {
  lineNo: number
  origin: ExtractionLineSnapshot  // จาก AXON — ห้ามแก้ไขหลัง save
  latest: ExtractionLineSnapshot  // user แก้ได้ — ใช้ CAL จริง
  matchType: "existing" | "new_item"
  itemGroupCode?: string           // required ถ้า matchType = "new_item"
}

interface ExtractionLineSnapshot {
  supplierOrderCode?: string
  mfrBrand?: string
  mfrCatalogNo?: string
  qty: number
  unitPrice: number
  currency: string
  uom?: string
  // ... fields อื่นๆ ตาม contract ด้านบน
}
```

**กฎ:** Latest เท่านั้นที่ใช้ CAL — Origin เก็บไว้เปรียบเทียบและ audit

---

## 6. Blocking Business Rules (ต้องตอบก่อน connect DB)

| # | คำถาม | Default Assumption | Impact |
|---|---|---|---|
| Q1 | Qty มาจากไหน? | **AXON suggests `QuotedQty` or `RfqQty`; sales verifies/edits** | UI flow + data model |
| Q3 | Amount ที่ใช้ value ratio? | **`amount = unitPrice × qty`** | Allocation calc |
| Q5 | DraftItem/DraftTerm snapshot หรือ reference TermID? | **Snapshot** — เก็บค่าทั้งหมดตอน save | DB schema |
| Q6 | Exchange Rate มาจากไหน? | **From Term/default currency lookup, editable by user** | Quote-level cost input |
| Q14 | ใครมีสิทธิ save allocation run? | **Authenticated domain/catalog users can access and save normal work; manager/supervisor reserved for delete/approval/admin actions** | Aligns with `AUTH_ALLOW_DOMAIN_USERS` |
| Q7 | ผล allocation write back ไป @PITM1? | **เก็บแยก (BulkCostRun table)** — ไม่ overwrite Term | DB design |
| Q9 | BulkCostRun ต้อง approval flow ก่อน save draft? | **No approval gate for draft snapshot save** | Normal domain/catalog users save `DRAFT`; elevated roles remain for delete/approval/admin |
| DB | Bulk Cost DB อยู่ที่ไหน? | **`PART_CATALOG_AIX`** | Use web DB side; do not create a separate DB |
| Phase 3A | Save creates Draft Item/Term? | **Yes, draft snapshots only** — save `BulkCostRun` + `DraftItem` + `DraftTerm`; do not write master `@POITM` / `@PITM1` | Prevent master DB bloat and keep quotation work independent |
| AXON hints | แสดงให้ sales confirm ไหม? | **Hidden only** | Persist `UniqueLineID`, `MatchMethod`, `MatchConfidence` for system/reverse mapping |
| Doc fee basis | Per Each or By Lot / Batch? | **Per Each enters OP1; By Lot / Batch becomes a new line item** | Affects extraction, CAL, UI review, and reverse mapping |

---

## 7. Phase 3A Save Rules

After CAL succeeds, Save Draft does this only:

| Condition | System action |
|---|---|
| Any selected line | Insert one `DraftItem` snapshot and one related `DraftTerm` snapshot under one `BulkCostRun` |
| `matchType = "existing"` | Store existing item/term hints only; do not create or update `@PITM1` |
| `matchType = "new_item"` | Store new item candidate snapshot only; do not generate ItemCode yet |
| AXON matching hints | Persist hidden `UniqueLineID`, `MatchMethod`, `MatchConfidence` if provided |
| By Lot / Batch document fee | Store as a separate new-line candidate; do not fold into product OP1 |
| Sales manual document-fee edit | Allow add/edit/delete/redistribute before Awarded reverse mapping |

No master Item/Term is created in Phase 3A. DraftItem/DraftTerm are only AIX
draft snapshots. Awarded reverse mapping is a later
phase and must decide whether existing item terms are INSERTed as new terms or
UPDATEd over existing terms before any endpoint is implemented.

Required before Save Draft:
- selected lines must have enough data for CAL (`qty`, `unitPrice`, `currency`)
- document fee basis must be known for every document fee that is not zero
- the UI must send Origin, Latest, and Result snapshots so the run is auditable
- the run status starts as `DRAFT`

---

## 8. TypeScript API Contract (เป้าหมาย)

```typescript
// POST /api/bulk-cost/extraction
interface AXONExtractionPayload {
  header: DocumentHeader
  headerCosts: HeaderCosts
  lines: ExtractionLine[]
  matchingHints: MatchingHints
}

// POST /api/bulk-cost/calculate
interface BulkCostCalculationRequest {
  runId: string
  costs: BulkCostInput      // Cost Bar fields
  selectedLineIds: string[] // Lines ที่เลือก CAL
}

// POST /api/bulk-cost/runs (implemented Phase 3A)
interface SaveBulkCostRunRequest {
  supplierCode: string
  supplierName: string
  status: 'DRAFT'
  costs: BulkCostInput
  originLines: AllocationLineSource[]
  latestLines: AllocationLineSource[]
  preview: AllocationPreview
  lines: Array<{
    lineKey: string
    origin: AllocationLineSource | null
    latest: AllocationLineSource
    result: AllocationLineResult
    axon: {
      uniqueLineId?: string
      matchMethod?: string
      matchConfidence?: number
    }
  }>
}

// Response: BulkCostRun record + lineCount
```

---

## 9. สิ่งที่ยังไม่ได้ตัดสินใจ (ต้องถาม executive)

- [ ] **Q8:** Filter Terms ตาม Active only?
- [x] **Q9:** BulkCostRun ต้อง approval flow ก่อน create draft? No approval gate for `DRAFT` snapshot save.
- [x] **Q14:** ใครมีสิทธิ save allocation run? Authenticated domain/catalog users can access and save normal work; manager/supervisor reserved for delete/approval/admin actions.
- [x] Bulk Cost DB จะอยู่ใน `PART_CATALOG_AIX` หรือ DB ใหม่แยก? Use `PART_CATALOG_AIX`.
- [x] **AXON push หรือ PartCatalog pull?** → **Hybrid: AXON Push to DB + Sales Pull via Dashboard** (confirmed by Pi-Or/Pi-Jo 2026-05-12)

---

## 10. Business Decisions ที่ยืนยันแล้ว (2026-05-12)

### AXON Model = Hybrid Push + Pull

AXON ทำงานหลังบ้าน: อ่านเมล → extract → rank (Stage G3) → **push เข้า DB เป็น Origin snapshot อัตโนมัติ**

เซลล์ทำงานฝั่ง UI: เข้าหน้า Dashboard → เห็นรายการที่ AXON เตรียมไว้จัดกลุ่มตาม Supplier → **กดเลือก Supplier → pull เข้า Workspace**

ไม่มี real-time notification — เซลล์ browse เองตาม workflow ปกติ

### Item Group Flow

```
AXON/AI suggest Item Group (🪄 icon)
    ↓
Sales ตรวจสอบ/แก้ via Dropdown (เสมอ)
    ↓
Save Draft → Virtual FG (ไม่กระทบ SAP)
    ↓
AWARDED → Manager Approve → Reverse Map → สร้าง Item จริงใน SAP
```

**กฎ:** ทุก field ต้องแก้ได้เสมอ — AI suggest ≠ lock

### AI Auto-Recommend Scope

Scope ล่าสุด: Kim/Codex ทำเฉพาะ CWeight / Weight & Dimension ก่อน ส่วน HS Code,
Duty, Import Permit, Shelf Life เป็น scope ของ AXON/ทีมอื่น

| Feature | Primary | Fallback | Output Fields |
|---|---|---|---|
| Weight & Dimension Lookup | Grainger/export/local data | AI estimate later, after local pattern tests | `itemWeightKg`, `L×W×H`, `chargeableWeightKg` |
| HS Code & Duty Suggestion | AXON/ทีมอื่น | Not Codex scope now | `hsCode`, `dutyPercent` |
| Import Permit & Shelf Life | AXON/ทีมอื่น | Not Codex scope now | `permitRequired`, `shelfLifeRequired` |

### Three-Tier Fallback (CWeight phase แรก)

```
Tier 1 → Existing/export/local data match
Tier 2 → CWeight module suggestion with confidence
Tier 3 → Sales user manual edit (ด่านสุดท้าย เสมอ)
```

### Workspace Column Rules

- Dropdown fields (UOM, Ship Mode, Purchase Term ฯลฯ) ต้องทำงานเหมือน legacy Term form
- AXON ส่งมา → pre-fill แต่ยังแก้ได้
- AXON ไม่ส่ง → ใช้ step/default เดิม (เหมือน Term form เก่า)
- Inter-field dependencies จาก Term form ต้องรักษาไว้ (UOM → conversion, Currency → exchange rate ฯลฯ)

---

*อัปเดตไฟล์นี้เมื่อ: AXON extraction contract เปลี่ยน, business rules ได้รับการยืนยัน, หรือ API spec เปลี่ยน*
