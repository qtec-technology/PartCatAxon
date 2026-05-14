# PartCatalog — Roadmap

> อัปเดตล่าสุด: 2026-05-08  
> อ่านร่วมกับ `.docs/FEATURE_STATUS.md` (สถานะปัจจุบัน) และ `.docs/ARCHITECTURE.md`

---

## ภาพรวม Phase

```
Phase 1 ✅  Web Baseline (ใช้งานได้จริง)
Phase 2 🔄  Next.js Native Migration (กำลังทำ)
Phase 3 ⏳  Bulk Cost Backend + AXON Integration
Phase 4 ⏳  Auth Migration → Better Auth
Phase 5 ⏳  Full AI Automation
```

---

## Phase 1 — Web Baseline ✅ (เสร็จแล้ว)

แทนระบบ Microsoft Access ด้วย Web App:

- [x] Item CRUD (new / view / edit + image + attachment)
- [x] Term CRUD (new / view / edit + calculation + RFQ mailto)
- [x] Search / Part Catalog
- [x] Express backend API (Node.js + TypeScript + mssql)
- [x] SQL Server connectivity (SBOQTEC + PART_CATALOG_AIX)
- [x] File share connectivity (\\192.168.2.53\...)

---

## Phase 2 — Next.js Native Migration 🔄 (กำลังทำ)

ย้าย frontend จาก React/Vite SPA มาเป็น Next.js App Router:

- [x] Next.js shell setup (port 3010)
- [x] BFF proxy `/api/*` → Express
- [x] Native ItemPage (`/item/[id]`, `/item/new`)
- [x] Native TermPage (`/term/[itemId]`)
- [x] Native Search/PartCatalog (`/partcatalog`)
- [x] Bulk Cost UI prototype (mock data, 42 next-shell unit tests)
- [x] Client retirement complete (client/ deleted 2026-05-07)
- [x] Root dev/build/test scripts use `server + next-shell` only
- [x] `/` redirects to `/partcatalog`
- [ ] UI parity checklist: next-shell vs legacy SPA (Item + Term)
- [ ] Production entry point: user เข้า next-shell แทน SPA
- [ ] Deprecate legacy `client/` SPA

**Prerequisites ก่อน go-live:**
- Next.js UI ต้องผ่าน UAT รอบแรก
- ทุก workflow ใน Item/Term ต้องทำงานได้เหมือน SPA เดิม

---

## Phase 3 — Bulk Cost Backend + AXON Integration ⏳

เชื่อม Bulk Cost UI กับ backend และ AXON:

### 3A — DB Schema + Backend API

**Blocking questions (ตอบแล้วสำหรับ Phase 3A):**
- [x] Q7: Allocation result เก็บใน BulkCostRun table แยก (ไม่ overwrite @PITM1)
- [x] Q5: DraftItem/DraftTerm เป็น snapshot (ไม่ใช่ FK reference TermID); `BulkCostLine` removed from live Phase 3A schema
- [x] Q6: Exchange Rate มาจาก Term/default currency lookup → editable
- [x] Q9: BulkCostRun ไม่ต้องมี approval gate ก่อน save `DRAFT`
- [x] Bulk Cost DB อยู่ใน `PART_CATALOG_AIX`
- [x] Phase 3A save เก็บ `BulkCostRun` / `DraftItem` / `DraftTerm`; ไม่เขียน `@POITM` / `@PITM1`
- [x] AXON matching hints เก็บแบบ hidden (`UniqueLineID`, `MatchMethod`, `MatchConfidence`)

**งานที่ต้องทำ:**
- [x] ออกแบบ DB schema: `BulkCostRun`, `DraftItem`, `DraftTerm`
- [x] สร้าง SQL script: `server/sql/20260508_bulk_cost_draft_snapshot.sql`
- [x] สร้าง Express API route: `POST /api/bulk-cost/runs`
- [x] เชื่อม BulkCostWorkspace save draft เข้า API
- [ ] Formula audit before DB execution: Term-engine parity fields
  (`ET`, `MT`, `MiscTax`, `SCC`, `STK%`), order-term normalization, and
  allocated-freight validation
- [x] Split Bulk Cost run warnings into `MIXED_VENDOR` and `MIXED_CURRENCY`
- [x] Add document-fee Golden unit tests for no fee, Per Each, item-total
  normalization, and By Lot / Batch line candidates
- [x] Analyze earlier `.datatest` TOP 200 export and produce initial Bulk Cost/Term
  golden-case coverage report: `.docs/BULK_COST_TEST_DATA_AUDIT.md`
- [x] Re-run/extend golden-case coverage against current `.datatest/*.csv`
      TOP 500 exports — 12 golden-case tests in `golden-cases.test.ts`
- [ ] Collect missing golden-case exports for ET/MT/MiscTax/SCC/STK, CWeight,
      and additional order-term variants
- [ ] Run SQL script on `PART_CATALOG_AIX` and smoke test real save
- [ ] ออกแบบ Awarded reverse mapping flow แยก Phase ถัดไป (ยังไม่สร้าง endpoint)
- [ ] SupplierSelection โหลดจาก real DB (`@OCRD`)

### 3B — AXON Integration

อ่าน `.docs/AXON_INTEGRATION.md` และ `.docs/CODEX_BRIEFING.md` ก่อน

**Business Decisions ยืนยันแล้ว (2026-05-12):**
- [x] AXON Model = **Hybrid Push+Pull**: AXON push เข้า DB อัตโนมัติ, เซลล์ Pull ผ่าน Dashboard
- [x] Item Group = AI Suggest (🪄) → Sales Edit → Manager Approve ตอน AWARDED
- [x] Three-tier fallback สำหรับ CWeight: existing/export data → AI suggestion (ภายหลัง) → User manual (เสมอแก้ได้)
- [x] Scope ล่าสุด: Kim/Codex ทำเฉพาะ CWeight / Weight & Dimension; HS Code, Duty, Permit, Shelf Life เป็น AXON/ทีมอื่น

**งาน Claude Sonnet 4.6 (codebase owner):**
- [ ] A2: SupplierSelection โหลดจาก real `@OCRD`
- [ ] A3: `POST /api/bulk-cost/extraction` endpoint รับ AXON ExtractionPayload
- [ ] B1: SQL `AxonExtractionQueue` + `AIRecommendCache` tables + repository
- [ ] B2: Origin/Latest model ใน BulkCostWorkspace UI
- [ ] B3: Item Group dropdown + 🪄 AI suggest indicator
- [ ] B4: Supplier matching confirmation UI (AXON hint → user confirm/reject)
- [ ] B5: Three-tier badge UI (AXON / AI / manual)
- [ ] B6: Workspace columns ตาม legacy Term form (UOM dropdown, Ship Mode ฯลฯ)
- [ ] C5: Wire CWeight service route ภายหลังเมื่อ local pattern ผ่าน test แล้ว
- [ ] C6: Verify Codex CWeight response ตรง Bulk Cost weight fields
- [ ] D1: Manager Approve dialog + PATCH status AWARDED
- [ ] D2: Reverse Mapping summary (read-only preview หลัง AWARDED)

**งาน Codex / GPT 5.5 (CWeight layer — isolated):**
- [ ] C1: CWeight / Weight & Dimension local research module
- [ ] C2: Pattern tests สำหรับ dimensional weight, chargeable weight, divisor, rounding, ship mode, dim unit
- [ ] C3: Matching strategy เริ่มจาก exact/rule-based fields (supplier order code, mfr no, brand, vendor, description)
- [ ] C4: CWeight prompt/research notes เฉพาะกรณีที่ต้องใช้ AI ภายหลัง

**ทำพร้อมกันได้ (parallel):** A2/A3/B1-B6 (Claude/AXON) + C1-C4 (Codex CWeight)
**ต้องรอลำดับ:** C5 รอ CWeight local pattern/test ผ่านก่อน | D1 รอ B2-B3 เสร็จก่อน

### 3C — Prisma ORM (ขึ้นอยู่กับ 3A)

- [ ] ติดตั้ง Prisma + `prisma-dbml-generator`
- [ ] สร้าง schema สำหรับ BulkCost tables
- [ ] Raw mssql escape hatch สำหรับ stored procedures เดิม

---

## Phase 4 — Auth Migration → Better Auth ⏳

**สาเหตุ:** Windows/IIS auth ยึดติด IIS มากเกินไปสำหรับ AI/agent identity

- [ ] ติดตั้ง Better Auth
- [ ] JWT + Org plugin (RBAC)
- [ ] User roles: Manager, Supervisor, Staff
- [ ] Multi-tenant prep (ถ้าจำเป็น)
- [ ] Migrate session model ใน next-shell
- [x] Bulk Cost access control: authenticated domain/catalog users can access and save normal work; manager/supervisor reserved for elevated actions

**Prerequisites:** Phase 3A เสร็จก่อน (เพราะ auth กระทบ Bulk Cost save permissions)

---

## Phase 5 — Full AI Automation ⏳

ระบบอัตโนมัติเต็มรูปแบบ:

- [ ] AXON Email → SupplierReply → Quote Extraction pipeline ต่อตรงกับ Bulk Cost
- [ ] AI-assisted field suggestion (Warning + Suggestion mode)
- [ ] AI Quote Ranker (Stage G3) ส่งผลไปยัง SupplierSelection sorting
- [ ] Auto-prefill Item/Term fields จาก AI extraction
- [ ] Qdrant vector search สำหรับ duplicate item detection
- [ ] Approval matrix / governance flow สำหรับ Bulk Cost runs
- [ ] Python orchestrator deploy เป็น NSSM daemon service

---

## Target Architecture (Phase 4-5)

```
Browser
└── Next.js 16 (App Router + RSC + Server Actions)
    ├── Better Auth (JWT + Org/RBAC)
    ├── Prisma ORM (30+ models → SQL Server 2022)
    └── /api/* → Express (legacy escape hatch)

Python AXON Orchestrator (NSSM daemon)
├── OpenAI / Gemini Vision / Claude CLI
├── Qdrant vector DB (192.168.2.54)
└── POST → PartCatalog /api/bulk-cost/extraction

Deploy: NSSM + Nginx reverse proxy + standalone Next.js
```

---

## QTEC Floor Standard Checklist

| รายการ | สถานะ |
|---|---|
| `biome.json` (linting) | ❌ ยังไม่มี |
| `CLAUDE.md` (~70 lines) | ✅ สร้างแล้ว |
| `.github/workflows/lint.yml` | ❌ ยังไม่มี |
| `lefthook.yml` (pre-commit) | ❌ ยังไม่มี |
| Unit tests pass | ✅ next-shell 44 tests + server 73 tests |
| TypeScript strict | ✅ |

---

*อัปเดตไฟล์นี้เมื่อ phase เสร็จ, ตัดสินใจ blocking question, หรือ scope เปลี่ยน*
