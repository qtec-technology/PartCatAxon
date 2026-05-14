# CODEX_BRIEFING.md — งานของ GPT 5.5 (Codex) ใน PartCatalog

> อ่านไฟล์นี้ก่อนเริ่มงานทุกครั้ง  
> อัปเดตล่าสุด: 2026-05-13
> ไฟล์ที่ต้องอ่านเพิ่ม: `.docs/AXON_INTEGRATION.md`, `.docs/BULK_COST_CALCULATION.md`

---

## บทบาทของคุณ

คุณเป็น **CWeight / Weight & Dimension research layer** สำหรับโปรเจค PartCatalog
Claude Sonnet 4.6 ดูแล codebase (TypeScript/Next.js/Express/SQL)  
AXON/ทีมอื่นดูแล HS Code, Duty, Import Permit, Shelf Life และ document extraction

**กฎหลัก:**
- Scope ปัจจุบันของ Codex/Kim คือ **CWeight / Weight & Dimension เท่านั้น**
- ห้ามทำ HS Code, Duty, Import Permit, Shelf Life ใน phase นี้
- งาน CWeight phase แรกเป็น local research module + tests; ยังไม่ทำ UI/API production
- ห้ามใช้ API key หรือ external API ใน phase แรก
- งานของคุณ **ไม่ต้องแตะ** `next-shell/`, `server/src/`, หรือ `.docs/` โดยตรง ยกเว้นได้รับคำสั่งเฉพาะให้แก้ docs
- ทุก service คืน JSON ตาม TypeScript interface ที่กำหนดด้านล่าง **เท่านั้น**
- ถ้าไม่มั่นใจค่าไหน ให้คืน `null` + `confidence: 0` ดีกว่าเดาผิด
- Claude จะ verify output ของคุณว่า match types ก่อน merge เสมอ

---

## Context ระบบ

PartCatalog เป็นระบบสำหรับ QTEC บริษัท trading ไทย  
ทำ quotation สินค้า industrial/MRO → คำนวณราคาขาย (QLC/Sales Price) รวม import duty, freight, insurance  
AXON คือ Python orchestrator ที่อ่านใบเสนอราคา supplier แล้ว push ข้อมูลเข้าระบบ

**Bulk Cost flow:**
1. AXON อ่านอีเมล/PDF → extract line items → push เข้า DB  
2. เซลล์เปิด Dashboard → เลือก Supplier → เปิด Workspace  
3. CWeight module ช่วยหา/แนะนำ weight, dimension, chargeable weight เฉพาะเมื่อข้อมูลขาด
4. เซลล์ตรวจสอบ/แก้ → กด CAL → Save Draft  
5. Awarded → Manager approve → create Item/Term ใน SAP

---

## งานปัจจุบันของ Codex/Kim

### C1 — CWeight / Weight & Dimension Research Module

**วัตถุประสงค์:** หา pattern และ logic สำหรับน้ำหนักที่ใช้คำนวณค่าขนส่งจากข้อมูลจริง เช่น item weight, shipping weight, chargeable weight, dimensions, dim unit, ship mode

**Input:**
```typescript
interface WeightLookupRequest {
  supplierOrderCode?: string   // เช่น "2ZY75"
  mfrBrand?: string            // เช่น "Dayton"
  mfrCatalogNo?: string        // เช่น "2ZY75"
  description: string          // เช่น "Motor 1HP 1725RPM TEFC"
  uom?: string                 // เช่น "EA"
}
```

**Output ที่ต้องการ (ต้อง match นี้ทุก field):**
```typescript
interface WeightLookupResult {
  itemWeightKg: number | null         // น้ำหนักสุทธิ kg
  chargeableWeightKg: number | null   // chargeable weight (ถ้าหาได้)
  dimensionL: number | null           // ความยาว cm
  dimensionW: number | null           // ความกว้าง cm
  dimensionH: number | null           // ความสูง cm
  dimUnit: 'CM' | 'INCH' | null
  source: 'grainger' | 'ai_estimate' | 'not_found'
  confidence: number                  // 0.0 – 1.0
  sourceUrl?: string                  // URL Grainger ถ้าเจอ
  rawGraingerData?: Record<string, unknown>  // raw JSON จาก Grainger API
}
```

**ลำดับ phase แรก:**
1. ใช้ sample/export/local data ก่อน เช่น `[GRAINGER].[dbo].[@GRAINGER_CWEIGHT]`, legacy Term exports, GER exports
2. เขียน pure functions เพื่อทดลองสูตร dimensional weight / chargeable weight
3. เทียบ pattern เช่น divisor 5000/6000/1000, dim unit CM/INCH, ship mode, CEILING 0.5
4. ถ้าไม่มี primary key ให้เริ่มจาก exact/rule-based matching: supplier order code, mfr catalog no, brand, vendor, description
5. Fuzzy/dense/AI matching เป็น step หลังจาก exact/rule-based matching
6. ยังไม่ใช้ Gemini/OpenAI API key และยังไม่เรียก external API ใน phase แรก

**หมายเหตุ Grainger:** phase แรกใช้ข้อมูล Grainger ที่ export/seed ในระบบก่อน ยังไม่ scrape หรือเรียก Grainger website/API

---

### Out of Scope ตอนนี้

งานต่อไปนี้เป็นของ AXON/ทีมอื่น ไม่ใช่ scope Codex/Kim ใน phase แรก:
- HS Code & Duty suggestion
- Import Permit
- Shelf Life
- Document extraction จาก email/PDF/Excel
- Production API endpoint และ UI integration

---

### C2 — CWeight Prompt / Research Notes

สร้าง prompt/templates/notes สำหรับ CWeight เท่านั้น ที่:
- มี system prompt อธิบาย context ชัดเจน
- มี few-shot examples (อย่างน้อย 2-3 ตัวอย่างต่อ task)
- บังคับให้ output เป็น JSON ตาม schema ข้างบน
- มี fallback instruction เมื่อข้อมูลไม่เพียงพอ

**Format:**
```typescript
// ไฟล์: ai-services/src/prompts/weight-lookup.prompt.ts
export const WEIGHT_LOOKUP_SYSTEM_PROMPT = `...`
export const WEIGHT_LOOKUP_USER_TEMPLATE = `...`
```

---

## Structure ที่ Codex ควรใช้/สร้าง

```
ai-services/          ← folder ใหม่ root level (ไม่ใช่ใน server/ หรือ next-shell/)
├── package.json      ← standalone Node.js service
├── src/
│   ├── services/
│   │   ├── weight-lookup.service.ts     ← C1
│   │   └── cweight-pattern.service.ts   ← local-only pattern lab (ถ้าต้องแยกเพิ่ม)
│   ├── prompts/
│   │   └── weight-lookup.prompt.ts
│   ├── providers/
│   │   ├── openai.provider.ts           ← GPT client
│   │   └── gemini.provider.ts           ← Gemini client
│   └── index.ts                         ← export all services
└── tests/
    ├── weight-lookup.test.ts
    └── cweight-pattern.test.ts
```

---

## Interface สำคัญจาก Codebase (อย่าแก้)

Claude จะ verify ว่า output ของคุณ compatible กับ types เหล่านี้:

```typescript
// จาก next-shell/src/features/bulk-cost/bulk-cost.types.ts
interface AllocationLineSource {
  lineKey: string
  suppOrderCode: string
  description: string
  qty: number
  unitPrice: number
  currency: string
  uom: string
  purchaseUOM: string
  numInBuy: number
  salesUOM: string
  numInSale: number
  itemWeight: number        // ← WeightLookupResult.itemWeightKg ไปที่นี่
  cWeight: number           // ← WeightLookupResult.chargeableWeightKg
  dimUnit: number           // 1=CM, 2=INCH
  length: number            // ← WeightLookupResult.dimensionL
  width: number             // ← WeightLookupResult.dimensionW
  height: number            // ← WeightLookupResult.dimensionH
  // ... fields อื่นๆ
}
```

---

## สิ่งที่ Codex ไม่ต้องทำ (Claude ทำ)

- ❌ แก้ไขไฟล์ใน `server/`, `next-shell/`, `.docs/`
- ❌ สร้าง Express routes
- ❌ SQL queries หรือ DB connection
- ❌ Auth/session handling
- ❌ UI components
- ❌ HS Code / Permit / Shelf Life logic

---

## Verification Protocol

เมื่อ Codex ทำงานเสร็จแต่ละ CWeight task:

1. **Codex ส่ง output JSON ตัวอย่าง** พร้อม input ที่ใช้ทดสอบ
2. **Codex run** `npm --prefix ai-services test` และ `npm --prefix ai-services run build`
3. **Claude/owner verify** ว่า field names และ types ตรงกับ Bulk Cost weight fields
4. ค่อยตัดสินใจทีหลังว่าจะ wire เข้า backend endpoint หรือไม่

---

*อัปเดตไฟล์นี้เมื่อ: API contract เปลี่ยน, interface เพิ่ม field, หรือ scope ของ Codex เปลี่ยน*
