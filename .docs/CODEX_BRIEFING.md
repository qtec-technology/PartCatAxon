# CODEX_BRIEFING.md — งานของ GPT 5.5 (Codex) ใน PartCatalog

> อ่านไฟล์นี้ก่อนเริ่มงานทุกครั้ง  
> อัปเดตล่าสุด: 2026-05-12  
> ไฟล์ที่ต้องอ่านเพิ่ม: `.docs/AXON_INTEGRATION.md`, `.docs/BULK_COST_CALCULATION.md`

---

## บทบาทของคุณ

คุณเป็น **AI Service Layer** สำหรับโปรเจค PartCatalog  
Claude Sonnet 4.6 ดูแล codebase (TypeScript/Next.js/Express/SQL)  
คุณสร้าง **isolated AI services** ที่ Claude จะ wire เข้า Express ทีหลัง

**กฎหลัก:**
- งานของคุณ **ไม่ต้องแตะ** `next-shell/`, `server/src/`, หรือ `.docs/` โดยตรง
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
3. ระบบ AI (คุณ) เติมข้อมูลที่ขาด (weight, HS code, permit)  
4. เซลล์ตรวจสอบ/แก้ → กด CAL → Save Draft  
5. Awarded → Manager approve → create Item/Term ใน SAP

---

## งาน 4 Tasks

### C1 — Weight & Dimension Lookup Service

**วัตถุประสงค์:** หาน้ำหนักและขนาดของสินค้าจาก part number / brand / description

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

**ลำดับการหา:**
1. ค้นหาใน Grainger product catalog API โดยใช้ part number หรือ catalog no
2. ถ้าไม่เจอ → ใช้ Gemini/GPT estimate จาก description + uom
3. ถ้าเดาไม่ได้ → คืน `source: 'not_found'`, `confidence: 0`, ทุก field เป็น `null`

**หมายเหตุ Grainger:** ลอง endpoint `https://www.grainger.com/search?searchQuery=<partNo>` หรือ product detail API ถ้ามี key — ถ้าไม่มี key ให้ scrape product page อย่างระมัดระวัง

---

### C2 — HS Code & Import Duty Suggestion Service

**วัตถุประสงค์:** แนะนำพิกัดศุลกากรและอัตราภาษีนำเข้า

**Input:**
```typescript
interface HSCodeRequest {
  description: string        // ชื่อสินค้า
  mfrBrand?: string
  itemCategory?: string      // ถ้ามี (เช่น "Electrical", "Mechanical")
  countryOfOrigin?: string   // เช่น "USA", "CN"
  historicalMatches?: Array<{
    description: string
    hsCode: string
    dutyPercent: number
  }>  // ส่ง historical cases มาให้เป็น few-shot examples
}
```

**Output:**
```typescript
interface HSCodeResult {
  hsCode: string | null          // เช่น "8501.10.00"
  dutyPercent: number | null     // เช่น 10 (หน่วยเป็น %)
  excisePercent: number | null   // excise tax ถ้าทราบ (หน่วย %)
  confidence: number             // 0.0 – 1.0
  reasoning: string              // อธิบายว่าทำไมถึงแนะนำ HS นี้
  alternativeCodes?: Array<{
    hsCode: string
    dutyPercent: number
    confidence: number
  }>
}
```

**วิธีทำ:**
- ใช้ `historicalMatches` เป็น few-shot ถ้ามี
- ถ้าไม่มี → ให้ GPT/Gemini reason จาก description + category
- อ้างอิง Thai Customs HS Code structure (Chapter 2 digit → Heading 4 digit → Subheading 6 digit → Thai tariff 8 digit)
- เน้น confidence ต่ำถ้าไม่มี historical context

---

### C3 — Import Permit & Shelf Life Checker

**วัตถุประสงค์:** ตรวจว่าสินค้าต้องขอใบอนุญาตนำเข้าหรือมีข้อกำหนด shelf life

**Input:**
```typescript
interface PermitCheckRequest {
  description: string
  hsCode?: string           // ถ้ามีจะช่วยได้มาก
  itemCategory?: string
  mfrBrand?: string
  countryOfOrigin?: string
}
```

**Output:**
```typescript
interface PermitCheckResult {
  permitRequired: boolean | null        // ต้องขอใบอนุญาตนำเข้าไหม
  permitType?: string                   // เช่น "FDA", "อย.", "กรมโรงงาน"
  shelfLifeRequired: boolean | null     // มีอายุการใช้งานจำกัดไหม
  shelfLifeMonths?: number             // อายุในเดือน ถ้าทราบ
  hazardous: boolean | null             // สินค้าอันตรายไหม
  notes: string                         // คำอธิบายเพิ่มเติม
  confidence: number                    // 0.0 – 1.0
}
```

**วิธีทำ:**
- ใช้ HS Code (ถ้ามี) ตรวจ Thai Import/Export control list
- Category ที่มักต้องขอใบอนุญาต: เคมีภัณฑ์, ยา, อาหาร, อุปกรณ์ไฟฟ้าแรงสูง, อาวุธ/ระเบิด
- ถ้าไม่มีข้อมูลเพียงพอ → คืน `null` ทุก field + `confidence: 0` + `notes: "ไม่สามารถระบุได้จากข้อมูลที่มี"`

---

### C4 — Prompt Templates

สร้าง prompt templates สำหรับ C1-C3 ที่:
- มี system prompt อธิบาย context ชัดเจน
- มี few-shot examples (อย่างน้อย 2-3 ตัวอย่างต่อ task)
- บังคับให้ output เป็น JSON ตาม schema ข้างบน
- มี fallback instruction เมื่อข้อมูลไม่เพียงพอ

**Format:**
```typescript
// ไฟล์: ai-services/prompts/weight-lookup.prompt.ts
export const WEIGHT_LOOKUP_SYSTEM_PROMPT = `...`
export const WEIGHT_LOOKUP_USER_TEMPLATE = `...`

// ไฟล์: ai-services/prompts/hscode.prompt.ts
// ไฟล์: ai-services/prompts/permit-check.prompt.ts
```

---

## Structure ที่ Codex ควรสร้าง

```
ai-services/          ← folder ใหม่ root level (ไม่ใช่ใน server/ หรือ next-shell/)
├── package.json      ← standalone Node.js service
├── src/
│   ├── services/
│   │   ├── weight-lookup.service.ts     ← C1
│   │   ├── hscode.service.ts            ← C2
│   │   └── permit-check.service.ts      ← C3
│   ├── prompts/
│   │   ├── weight-lookup.prompt.ts      ← C4
│   │   ├── hscode.prompt.ts             ← C4
│   │   └── permit-check.prompt.ts       ← C4
│   ├── providers/
│   │   ├── openai.provider.ts           ← GPT client
│   │   └── gemini.provider.ts           ← Gemini client
│   └── index.ts                         ← export all services
└── tests/
    ├── weight-lookup.test.ts
    ├── hscode.test.ts
    └── permit-check.test.ts
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
  dutyPercent: number       // ← HSCodeResult.dutyPercent
  excisePercent: number     // ← HSCodeResult.excisePercent
  // ... fields อื่นๆ
}
```

---

## สิ่งที่ Codex ไม่ต้องทำ (Claude ทำ)

- ❌ แก้ไขไฟล์ใน `server/`, `next-shell/`, `.docs/`
- ❌ สร้าง Express routes (Claude wires C1-C4 เข้า Express เอง)
- ❌ SQL queries หรือ DB connection
- ❌ Auth/session handling
- ❌ UI components

---

## Verification Protocol

เมื่อ Codex ทำงานเสร็จแต่ละ task:

1. **Codex ส่ง output JSON ตัวอย่าง** พร้อม input ที่ใช้ทดสอบ
2. **Claude verify** ว่า field names และ types ตรงกับ `AllocationLineSource`
3. **Claude merge** เข้า `server/src/services/ai-recommend.service.ts`
4. **ทั้งคู่ run** `npm run typecheck` ร่วมกัน

---

*อัปเดตไฟล์นี้เมื่อ: API contract เปลี่ยน, interface เพิ่ม field, หรือ scope ของ Codex เปลี่ยน*
