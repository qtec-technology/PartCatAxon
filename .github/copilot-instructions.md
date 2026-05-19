# PartCatalog — คำสั่งสำหรับ AI Agent

> **ไฟล์นี้โหลดอัตโนมัติทุกครั้งที่เปิด session ใหม่ใน VS Code Copilot**
> **อ่านก่อนทำงานทุกครั้ง — และอัปเดตเอกสารที่เกี่ยวข้องหลังทำงานเสร็จเสมอ**

---

## 1. ภาพรวมโปรเจค

**QTEC Part Catalog** คือระบบ Web Application ภายในองค์กรที่แทนระบบ Microsoft Access เดิม
ใช้จัดการข้อมูลสินค้า (Item), เงื่อนไขราคา/ต้นทุน (Term), ไฟล์แนบ (Attachment),
การคำนวณ (Calculation) และ Bulk Cost Allocation

**Active frontend:** `next-shell/` (Next.js 16 + React 19 + TypeScript, port 3010)
**Backend API:** `server/` (Express + TypeScript, port 3001)

---

## 2. โครงสร้างโปรเจค

```
PartCatalog/
  server/       Express + TypeScript API (port 3001)
  next-shell/   Next.js 16 BFF/Shell (active, port 3010)
  .docs/        เอกสาร technical สำหรับ dev/agent
  .github/      ไฟล์นี้ + workflow configs
  README.md     Setup + dev commands สำหรับมนุษย์
```

---

## 3. Ports & URLs

| Service | URL | หมายเหตุ |
|---|---|---|
| Next.js shell | http://localhost:3010 | Active frontend |
| Express API | http://localhost:3001 | Backend; Next ส่ง `/api/*` ไปที่นี่ |
| API Health | http://localhost:3010/api-health | ตรวจสอบ proxy connection |

---

## 4. วิธีรันระบบ (จาก root `PartCatalog/`)

```powershell
npm run dev              # รันทุกอย่างพร้อมกัน (server + next)
npm run dev:server       # Express API เท่านั้น
npm run dev:next         # Next.js shell เท่านั้น
```

**ข้อควรระวัง:** อย่าให้มีไฟล์ `package-lock.json` ที่ root `PartCatalog/`
Turbopack จะสับสนกับ `next-shell/package-lock.json` และหา `tailwindcss` ผิดที่

---

## 5. Architecture ระดับสูง

```
Browser
└── Next.js shell (port 3010)
    ├── /partcatalog       → Native search (SearchCriteriaPanel + PartItemsGrid)
    ├── /item/[id]         → Native ItemPage (ItemForm)
    ├── /item/new          → Native New Item
    ├── /item/preview      → Bulk Cost item preview (read-only ItemForm)
    ├── /term/[itemId]     → Native TermPage
    ├── /term/preview      → Bulk Cost term preview (read-only TermPage)
    ├── /bulk-cost         → Bulk Cost (SupplierSelection → BulkCostWorkspace)
    └── /api/*             → BFF route handler → Express (port 3001)
                                                   └── SQL Server
                                                         ├── SBOQTEC (SAP tables)
                                                         └── PART_CATALOG_AIX (app views)
                                                   └── File Share (\\192.168.2.53\...)
```

---

## 6. สถานะ Workstream ล่าสุด

| Workstream | สถานะ |
|---|---|
| Web baseline (Search/Item/Term) | ✅ Active — ใช้งานได้จริง |
| Next.js Phase 1 (BFF proxy) | ✅ Done — `/api/*` route handler พร้อม |
| Next.js Phase 2 (native pages) | ✅ Done — Item/Term/PartCatalog native แล้ว |
| Bulk Cost UI (interactive prototype) | ✅ Done — UI พร้อม, 33 unit tests ผ่าน |
| Bulk Cost backend API + DB | 🚧 Phase 3A — API + SQL script ready; real DB smoke test pending |
| Architecture Stabilization | 🔄 Active — อ่าน `.docs/EXECUTIVE_ALIGNMENT.md`, `.docs/AXON_HANDOFF_CONTRACT.md`, `.docs/DEPLOYMENT_RUNBOOK.md`, `.docs/MODULE_BOUNDARIES.md` ก่อน feature ถัดไป |
| AXON → Bulk Cost integration | ❌ Not Started — handoff contract หลักอยู่ใน `.docs/AXON_HANDOFF_CONTRACT.md`; `.docs/AXON_INTEGRATION.md` เป็นรายละเอียดเดิมที่ต้อง align |
| Auth migration → Better Auth | ❌ Not Started — Phase 4 |
| Full AI automation | ❌ Not Started — Phase 5 |

ดูสถานะแบบละเอียดและ roadmap ที่: **`.docs/FEATURE_STATUS.md`** + **`.docs/ROADMAP.md`**

---

## 7. ไฟล์สำคัญที่ต้องรู้

### Next.js Shell (`next-shell/src/`)

| ไฟล์ | บทบาท |
|---|---|
| `components/AppShell.tsx` | Navigation หลัก (Part Catalog / Bulk Cost tabs) |
| `app/layout.tsx` | Root layout + AuthProvider + Toaster |
| `app/bulk-cost/page.tsx` | Bulk Cost orchestrator: URL-param state |
| `app/partcatalog/page.tsx` | Native search page |
| `app/item/[id]/page.tsx` | Native item detail page |
| `app/item/preview/page.tsx` | Bulk Cost item preview (read-only) |
| `app/term/[itemId]/page.tsx` | Native term page |
| `app/api/[...path]/route.ts` | BFF proxy → Express |
| `features/bulk-cost/BulkCostWorkspace.tsx` | Bulk Cost main UI (~2000 lines) |
| `features/bulk-cost/SupplierSelection.tsx` | Step 1: เลือก Supplier จาก vendor master เพื่อเปิด blank workspace |
| `features/bulk-cost/bulk-cost.calc.ts` | Pure calculation engine |
| `features/bulk-cost/bulk-cost.types.ts` | TypeScript data contracts |
| `features/bulk-cost/bulk-cost.mock.ts` | Mock data (Grainger + 12 suppliers) |
| `features/bulk-cost/bulk-cost.preview.ts` | localStorage bridge สำหรับ preview tabs |
| `components/features/item/ItemForm.tsx` | Item form (~650 lines) |
| `next.config.ts` | Turbopack config + resolveAlias สำหรับ tailwindcss |

### Express API (`server/src/`)

| ไฟล์ | บทบาท |
|---|---|
| `routes/item.routes.ts` | Item CRUD endpoints |
| `routes/term.routes.ts` | Term CRUD endpoints |
| `services/calculation.service.ts` | **Term calculation engine — source of truth** |
| `repositories/item.repository.ts` | Item DB layer |
| `repositories/term.repository.ts` | Term DB layer |

---

## 8. Business Rules ที่ต้องรู้

| Rule | รายละเอียด |
|---|---|
| Term Calculation | Backend เป็น source of truth เสมอ — frontend ไม่คำนวณเองสำหรับ Term |
| Auth | Domain users = read/normal access; manager/supervisor = elevated (delete/approval/admin) |
| Item delete | ห้ามลบถ้ายังมี Term อยู่ |
| New Term | สร้างได้จาก Item ที่มีอยู่เท่านั้น |
| Attachment | เขียนไฟล์จริงไปที่ network share, metadata บันทึกใน DB |
| Bulk Cost UI | Phase 3A ต่อ save draft snapshot ได้; New Allocation เป็น manual PartCatalog workspace จาก vendor master; AXON `ChainId` handoff เป็น entry แยกในอนาคต |
| Bulk Cost save | รอ schema design + business rule ยืนยันก่อน |

---

## 9. Database

| Database | บทบาท | ตัวอย่าง objects |
|---|---|---|
| `SBOQTEC` | SAP-side tables/views หลัก | `@POITM`, `@PITM1`, `@tblAttachment`, `@BRAND`, `@UOM` |
| `PART_CATALOG_AIX` | App-side views/lookups | `vw@PITM1`, `@ITEMGROUP`, `@OCRD`, `@OSLP`, `@LOCATION` |

Storage:
- Item images: `\\192.168.2.53\AttachmentItemImage`
- Attachments: `\\192.168.2.53\Attachment`
- User pictures: `\\192.168.2.52\_PartCat_Resource\user_picture`

ดูรายละเอียดทั้งหมดที่: **`.docs/ARCHITECTURE.md`**

---

## 10. คำสั่ง Quality Check (รันก่อน commit เสมอ)

```powershell
# จาก PartCatalog/
npm run typecheck         # TypeScript check (next-shell)
npm test                  # Unit tests — ต้องผ่าน 33 tests
npm run build             # Build check — ต้องไม่มี error
```

---

## 11. โปรโตคอลสำหรับ Agent

### ก่อนเริ่มงานทุกครั้ง

1. อ่านไฟล์นี้ทั้งหมด
2. อ่าน `.docs/FEATURE_STATUS.md` เพื่อรู้สถานะล่าสุดและ decision log
3. อ่าน reset docs ก่อนงาน feature ถัดไป: `.docs/EXECUTIVE_ALIGNMENT.md` + `.docs/AXON_HANDOFF_CONTRACT.md` + `.docs/DEPLOYMENT_RUNBOOK.md` + `.docs/MODULE_BOUNDARIES.md`
4. ถ้างานเกี่ยวกับ Bulk Cost → อ่าน `.docs/BULK_COST.md` + `.docs/BULK_COST_CALCULATION.md` + `.docs/AXON_INTEGRATION.md`
5. ถ้างานเกี่ยวกับ Phase ถัดไป → อ่าน `.docs/ROADMAP.md`
6. ถ้างานเกี่ยวกับ target architecture → อ่าน `.docs/ARCHITECTURE.md`

### หลังทำงานเสร็จ — ต้องอัปเดตเอกสารเสมอ

| สิ่งที่ทำ | เอกสารที่ต้องอัปเดต |
|---|---|
| แก้ bug / เพิ่ม feature | `.docs/FEATURE_STATUS.md` (Implementation Log + status) |
| ตัดสินใจ architecture | `.docs/ARCHITECTURE.md` + `.docs/FEATURE_STATUS.md` (Decision Log) |
| Architecture stabilization / cleanup | `.docs/CLEANUP_INVENTORY.md` + `.docs/ROADMAP.md` + `.docs/FEATURE_STATUS.md` |
| AXON handoff | `.docs/AXON_HANDOFF_CONTRACT.md` + `.docs/AXON_INTEGRATION.md` + `.docs/FEATURE_STATUS.md` |
| งาน Bulk Cost | `.docs/BULK_COST.md` + `.docs/BULK_COST_CALCULATION.md` + `.docs/AXON_INTEGRATION.md` + `.docs/FEATURE_STATUS.md` |
| Phase เสร็จ / scope เปลี่ยน | `.docs/ROADMAP.md` + ไฟล์นี้ section 6 |
| เปลี่ยน business rule | `.github/copilot-instructions.md` section 8 + `CLAUDE.md` |

### ข้อห้าม (DO NOT)

- ❌ อย่าแก้ UI ของ Search/Item/Term โดยไม่ตรวจ business rules ก่อน
- ❌ อย่าให้ Bulk Cost เขียน `@POITM` / `@PITM1` หรือสร้าง Draft Item/Term ใน Phase 3A
- ❌ อย่าสร้าง Award/Reverse-map endpoint จนกว่า INSERT-vs-UPDATE term rule จะได้รับการออกแบบ
- ❌ อย่าทำ migration แบบลบ/แทน Express API ทันที — ต้องผ่าน Better Auth phase ก่อน
- ❌ อย่า auto-save หรือ auto-deploy โดยไม่มี approval
- ❌ อย่าให้ AXON ตัดสินใจ field ที่ต้อง match master data (Supplier, ItemGroup, Brand, UOM)
- ❌ อย่าปล่อยให้มี `package-lock.json` ที่ root (ทำให้ Turbopack สับสน)

---

## 12. เอกสารในโปรเจค

| ไฟล์ | บทบาท | เมื่อไรควรอ่าน |
|---|---|---|
| `CLAUDE.md` | Quick ref สำหรับ Claude/AI agents | ทุก session (Claude auto-load) |
| `README.md` | Setup + dev commands | ตั้งเครื่องใหม่ / onboarding |
| `.github/copilot-instructions.md` | ไฟล์นี้ | ทุก session (VS Code Copilot auto-load) |
| `.docs/ARCHITECTURE.md` | Stack, DB, API, current vs target architecture | งาน infrastructure / architecture decision |
| `.docs/FEATURE_STATUS.md` | Workstream status + decision log + implementation log | รู้สถานะปัจจุบัน / handoff |
| `.docs/EXECUTIVE_ALIGNMENT.md` | Executive direction from meeting notes | ก่อน architecture/feature reset |
| `.docs/AXON_HANDOFF_CONTRACT.md` | ChainId/shared-view handoff between AXON and PartCatalogAxon | งานเชื่อม AXON |
| `.docs/DEPLOYMENT_RUNBOOK.md` | Nginx/NSSM/subdomain/internal CA deploy target | งาน deploy/runtime |
| `.docs/MODULE_BOUNDARIES.md` | Server/Next module ownership and automation-ready operation layer | งาน cleanup/refactor |
| `.docs/AUTOMATION_READINESS.md` | Operation-layer and audit requirements for future automation | งาน automation / agent-safe workflow |
| `.docs/OPERATION_LAYER_DESIGN.md` | Code-level operation service plan and next slices | งานแยก module / operation layer |
| `.docs/CLEANUP_INVENTORY.md` | Dead-code/stale-doc/risk cleanup list | งาน stabilization |
| `.docs/BULK_COST.md` | Bulk Cost UI guide (flow, components, calc engine) | งาน Bulk Cost UI ทุกชนิด |
| `.docs/BULK_COST_CALCULATION.md` | Bulk Cost formula review from Excel sample + Term engine reconciliation | งานสูตร Bulk Cost / CAL |
| `.docs/AXON_INTEGRATION.md` | AXON → PartCatalog data contract | เริ่ม backend Bulk Cost / AXON integration |
| `.docs/ROADMAP.md` | Phase 1-5 + blocking questions + QTEC Floor checklist | วางแผน / รู้ว่าทำอะไรได้บ้างตอนนี้ |
