# ARCHITECTURE.md — PartCatalog Technical Architecture

ปรับปรุงล่าสุด: 19 พฤษภาคม 2026 (architecture stabilization reset)
เจ้าของ: อัปเดตเมื่อมี architecture decision ใหม่

---

## 0. Architecture Reset References

Before adding AXON/Bulk Cost features, read these reset documents:

- `.docs/EXECUTIVE_ALIGNMENT.md` — executive direction from meeting notes
- `.docs/AXON_HANDOFF_CONTRACT.md` — `ChainId` shared DB/view handoff from
  AXON final comparison to PartCatalogAxon
- `.docs/DEPLOYMENT_RUNBOOK.md` — Nginx/NSSM/subdomain/internal CA target
- `.docs/MODULE_BOUNDARIES.md` — module ownership and automation-ready operation
  layer target

Current ownership boundary:

```text
AXON = Pi-Jo side, RFQ chain owner
PartCatalogAxon = Kim side, costing/calculation/snapshot/Item-Term bridge
ChainId = shared correlation id
```

PartCatalogAxon must not rebuild the AXON pipeline. It consumes AXON final
comparison output through a read-only shared DB/view/module handoff and clones
that data into PartCatalogAxon snapshots before calculation.

Future automation depends on module boundaries and backend operations, not UI
click automation. Read `.docs/AUTOMATION_READINESS.md` before designing any AI,
agent, or scheduled workflow.

---

## 1. Stack Overview

| ชั้น | Technology | Version | Port |
|---|---|---|---|
| Active Frontend | Next.js (App Router) + React + TypeScript | Next 16.2.4 / React 19 | 3010 |
| Backend API | Express + TypeScript | Node 22+ | 3001 |
| Database | SQL Server | — | 1433 |
| CSS | Tailwind CSS v4 + shadcn/radix | tw v4 | — |
| Test | Vitest | — | — |
| Bundler (Next) | Turbopack | — | — |

---

## 2. Application Flow

```
Browser
└── Next.js shell (3010)
    │
    ├── App Router pages
    │   ├── /partcatalog          Native search (SearchCriteriaPanel + PartItemsGrid)
    │   ├── /item/[id]            Native ItemPage (ItemForm)
    │   ├── /item/new             New Item page
    │   ├── /item/preview         Bulk Cost item preview (read-only ItemForm + localStorage)
    │   ├── /term/[itemId]        Native TermPage (term list)
    │   ├── /term/[itemId]/[termId]   View specific term
    │   ├── /term/[itemId]/edit   Edit term
    │   ├── /term/new             New Term page
    │   ├── /term/preview         Bulk Cost term preview (localStorage)
    │   ├── /bulk-cost            Bulk Cost (SupplierSelection → BulkCostWorkspace)
    │   └── /api-health           Proxy health check page
    │
    └── /api/* (BFF route handler)
        └── src/app/api/[...path]/route.ts
            └── forwards to Express (3001)
                ├── Normalizes mutation headers (CSRF origin)
                ├── Passes cookies/auth headers
                └── Returns response to Next.js client
```

---

## 3. Next.js BFF Pattern

`next-shell` ใช้ **BFF (Backend For Frontend) route handler** แทน `rewrites` proxy

### ทำไมใช้ route handler ไม่ใช้ rewrites

Express มี CSRF origin allowlist สำหรับ frontend origin ปัจจุบัน
เมื่อ Next.js shell รันที่ port 3010 browsers จะส่ง `Origin: http://localhost:3010`
ดังนั้น Next BFF ต้อง forward mutation ด้วย origin ที่ server allowlist รับ

Route handler ใน `src/app/api/[...path]/route.ts` ทำ:
1. รับ request จาก Next client
2. Normalize headers (origin, content-type)
3. Forward ไป Express พร้อม credentials
4. Return response กลับ

### ตัวแปร environment สำคัญ (next-shell/.env.local)

```env
EXPRESS_API_URL=http://localhost:3001
EXPRESS_CSRF_ORIGIN=http://localhost:3010
NEXT_PUBLIC_API_BASE_URL=/api
```

---

## 4. Turbopack Root Resolution

### ปัญหา

เมื่อมีไฟล์ `package-lock.json` ที่ root `PartCatalog/`
Turbopack จะอ่านนั้นเป็น workspace root และหา `tailwindcss` ใน
`PartCatalog/node_modules/` แทน `next-shell/node_modules/`

### การแก้ไข (ใน next.config.ts)

```typescript
turbopack: {
  root: nextShellRoot,  // pin ไว้ที่ next-shell/ directory
  resolveAlias: {
    tailwindcss: resolve(nextShellRoot, 'node_modules/tailwindcss'),
    'tw-animate-css': resolve(nextShellRoot, 'node_modules/tw-animate-css'),
  },
},
```

### วิธีป้องกันในอนาคต

- ลบ `PartCatalog/package-lock.json` ทิ้ง (ถ้ามี)
- Root `PartCatalog/package.json` ควรมีแค่ `concurrently` เท่านั้น
- ไฟล์ `PartCatalog/.npmrc` มี `package-lock=false` ป้องกันการสร้าง lockfile ใหม่

### globals.css — Tailwind package imports

```css
@import 'tailwindcss' source(none);
@import 'tw-animate-css';
```

Use package imports. `next.config.ts` pins `tailwindcss` and `tw-animate-css`
to `next-shell/node_modules` through `turbopack.resolveAlias`, avoiding brittle
relative paths that can break under Webpack/Turbopack resolution.
ไม่ได้ใช้ bare import เพื่อหลีกเลี่ยงปัญหา resolution เดียวกัน

---

## 5. Authentication

### Development

- `server/.env` ตั้ง `DEV_DISPLAY_NAME` และ `DEV_EMAIL`
- `ROLE_MANAGERS` / `ROLE_SUPERVISORS` = comma-separated email lists
- Server inject user context จาก env แทน Windows headers

### Production

- Windows Authentication via IIS headers
- `X-Forwarded-User` / `X-Forwarded-Email` headers จาก IIS
- ไม่ fallback ไป env vars ใน production

### Permission Model

```typescript
// Any authenticated domain user (or catalog user) can access normal work
isUser = true  // domain user on Windows Auth, or catalog user in dev

// Elevated actions (create/edit/delete item, delete term, admin):
hasElevatedAccess = isManager || isSupervisor

// readOnlyMode flag blocks create/edit/delete on the UI side
```

---

## 6. Database Objects

### Connection

- Default database: `PART_CATALOG_AIX`
- Cross-database access via fully-qualified name: `SBOQTEC.dbo.@POITM`

### SBOQTEC (SAP-side)

| Object | Type | ใช้งาน |
|---|---|---|
| `@POITM` | Table | Item master (write target) |
| `VWIT_@POITM` | View | Item read (หน้า Search, Item page) |
| `VWIT_@POITM_PARTNO` | View | Item autocomplete by brand |
| `VWIT_@POITM_CATEGORY_BRAND` | View | Category → Brand mapping |
| `@PITM1` | Table | Term master (write target) |
| `@tblAttachment` | Table | Attachment metadata |
| `@BRAND` | Table | Brand lookup |
| `@UOM` | Table | Unit of measure lookup |
| `@CURRENCY` | Table | Currency lookup |
| `@ORDERTERM` | Table | Purchase/Sales term lookup |
| `@FREIGHT` | Table | Freight/courier rate |
| `@COUTRYORG` | Table | Country of origin lookup |
| `@ITEMCATEGORY` | Table | Item category lookup |

### PART_CATALOG_AIX (App-side)

| Object | Type | ใช้งาน |
|---|---|---|
| `vw@PITM1` | View | Term read (Home nested grid, Term page) |
| `@ITEMGROUP` | Table | Item group lookup (`104=FG`, `107=SV`, `105=SM`, `106=CM`) |
| `@LOCATION` | Table | Term location / zone rate |
| `@PERMITTYPE` | Table | Permit type lookup |
| `@OCRD` | Table | Vendor dropdown |
| `@OCRD_FOR_VENDOR_BRAND_FORM` | Table | Vendor filter (Brand/Vendor view) |
| `@OSLP` | Table | Sales person / Sourced By |
| `@SUBLOCATION` | Table | Purchase/Sales sub-location |
| `@OCPR` | Table | Contact person |
| `@PITM1_BRAND_VENDOR` | Synonym | Brand → Vendor report |
| `@PITM1_VENDOR_BRAND` | Synonym | Vendor → Brand report |
| `@FULLTEXT` | Synonym | Full-text search cache used by search SPs |

### File Storage

| ประเภท | Path |
|---|---|
| Item images | `\\192.168.2.53\AttachmentItemImage` |
| Attachments | `\\192.168.2.53\Attachment` |
| User pictures | `\\192.168.2.52\_PartCat_Resource\user_picture` |

---

## 7. Key Component Architecture

### ItemForm (`next-shell/src/components/features/item/ItemForm.tsx`)

- ~650 lines; จัดการ React Hook Form, lookups, attachments, image, long description
- รองรับ mode: `new | view | edit`
- `readOnlyMode={true}` ปิด create/edit/delete ฝั่ง UI (ใช้ใน preview)
- **Important:** default param `attachments: initialAttachments = EMPTY_ATTACHMENTS`
  (ต้องใช้ module-level constant ไม่ใช่ `[]` literal เพราะทำให้ infinite loop)

### BulkCostWorkspace (`next-shell/src/features/bulk-cost/BulkCostWorkspace.tsx`)

- ~2000 lines; รับ `supplierCode`, `supplierName`, `onBack` props
- State: `allLines`, `costs`, `preview`, `previewEdits`, `sourceView`
- Views: Origin (read-only) / Latest (editable) / Changes (diff)
- Steps: Step 1 (cost bar) → Step 2 (source lines) → Step 3 (result review)
- ใช้ `bulk-cost.preview.ts` เพื่อส่งข้อมูลไป `/item/preview` และ `/term/preview` tabs

### bulk-cost page (`next-shell/src/app/bulk-cost/page.tsx`)

- Persists `selectedSupplier` ใน URL search params (`?supplier=CODE&supplierName=NAME`)
- Page refresh จะ restore workspace state จาก URL ได้
- ครอบด้วย `<Suspense>` เพราะ `useSearchParams()` ต้องการ

---

## 8. Testing

Tests อยู่ที่ `next-shell/tests/unit/`

| Test file | จำนวน | ครอบคลุม |
|---|---|---|
| `bulk-cost-calc.test.ts` | ส่วนใหญ่ | allocation, rounding, pipeline, edge cases, warnings, Excel golden |
| `bulk-cost-mock.test.ts` | — | Grainger baseline, multi-quote formula branches |
| `bulk-cost-document-fees.test.ts` | — | no-fee, Per Each, item-total normalization, By Lot / Batch line candidates |
| `item-api.test.ts` | — | Item API payload mapping, especially blank B1 Item No -> null |
| `lookup-api.test.ts` | — | Term Form lookup cache ignores component abort signals; Purchase Sub Location queries by AP module + selected location |
| `term-page-mapper.test.ts` | — | Call By/Sourced By lookup fallback |

รวมฝั่ง `next-shell`: **44 tests ผ่านทั้งหมด** (ณ 8 พ.ค. 2026)

ฝั่ง `server/src/__tests__/` มี **45 tests ผ่านทั้งหมด** รวม request schema,
repository, auth, attachment legacy, และ Term calculation engine.

```powershell
npm test -- --run   # รันทุก test
```

---

## 9. Env Files

| ไฟล์ | ใช้สำหรับ |
|---|---|
| `server/.env` | DB connection, file paths, roles, dev user |
| `server/.env.example` | Template สำหรับ setup ใหม่ |
| `next-shell/.env.local` | Express URL and CSRF origin |

---

## 10. Calculation Engine (Term)

- **Source of truth อยู่ที่ backend:** `server/src/services/calculation.service.ts`
- Preview calculation และ Save calculation ใช้ engine เดียวกัน
- `U_QLC3` = Total Price (SPK + QOC) — persisted field หลัก
- `U_TotalPrice` = compatibility alias เท่านั้น ไม่ใช่ write target
- Frontend ไม่ควรคำนวณ Term calculation เอง

---

## 11. Bulk Cost Calculation Engine (Pure Frontend)

File: `next-shell/src/features/bulk-cost/bulk-cost.calc.ts`

- Pure TypeScript function ไม่มี side effects
- Weight-based allocation (PKH, SOC, Freight, CC)
- Value-based allocation (Wire TT / bank fee)
- Document fees enter OP1 only when basis is Per Each / UOM By Each; item-total
  fees are normalized by qty, and By Lot / Batch fees become separate service
  line candidates
- Last-line residual correction (แก้ rounding)
- Warning model: missing weight, zero qty, mixed vendor, mixed currency,
  rounding residual
- Phase 3A connects Save Draft to backend persistence as `BulkCostRun` plus
  `DraftItem` / `DraftTerm` snapshots in `PART_CATALOG_AIX`; `BulkCostLine` is
  no longer part of the live schema. Calculation itself remains the pure
  TypeScript engine.

---

## 12. Target Architecture (Phase 4-5)

> อ่าน `.docs/ROADMAP.md` สำหรับ timeline และ phases

This section is long-term direction, not the current stabilization scope. During
the 2026-05 architecture reset, do not migrate all Express routes to Server
Actions, do not replace raw `mssql`/stored procedures with Prisma, and do not
move AXON's Python orchestrator into PartCatalogAxon.

### Stack เป้าหมาย

| Layer | Current | Target |
|---|---|---|
| Frontend | Next.js + Express BFF | Next.js **Server Actions** + RSC (ตัด Express ออก) |
| Auth | Mock session / Windows IIS | **Better Auth** (JWT + Org plugin + RBAC) |
| Data layer | Raw mssql + Repository pattern | **Prisma ORM** (30+ models) + raw mssql escape hatch สำหรับ SP |
| AI | ไม่มี | **Python AXON orchestrator** (OpenAI + Gemini Vision + Claude CLI + Qdrant) |
| Deploy | npm run dev / IIS | **NSSM daemon + Nginx reverse proxy** + standalone Next.js |

### Target Application Flow

```
Browser
└── Next.js (App Router + RSC + Server Actions)
    ├── Better Auth middleware (JWT + Org/RBAC)
    ├── Prisma → SQL Server 2022 (Thai collation)
    │   ├── BulkCost tables (new schema)
    │   └── Better Auth tables (protected)
    └── raw mssql (escape hatch สำหรับ SP + legacy tables)

Python AXON Orchestrator (NSSM daemon, AXON side / Pi-Jo ownership)
├── Stages A-G: Email → Classify → Extract → Rank
├── AI: OpenAI GPT-4.1/5.4 + Gemini 2.5 + Claude Sonnet 4
├── Vector: Qdrant (192.168.2.54:6333)
└── Publish final comparison by ChainId
    (legacy alternative: POST extraction payload only if Pi-Jo chooses API push)

Nginx (reverse proxy)
├── / → Next.js standalone (3010)
└── /axon/* → Python FastAPI (ถ้ามี webhook)
```

### Auth Target Model (Better Auth)

```typescript
// Organization-based RBAC
user → belongs to → organization
     → has role: "catalog_user" | "manager" | "supervisor" | "system_admin"
     → hasAccess = authenticated && has catalog role

// Ordinary authenticated domain/catalog users can access normal PartCatalog work.
// Manager/supervisor/admin roles are reserved for elevated actions such as
// delete, approval, and permission administration.

// Multi-tenant prep: organization = business unit
```

### Prisma Schema (เป้าหมาย — Bulk Cost tables)

```prisma
model BulkCostRun {
  id           String   @id
  supplierCode String
  createdBy    String
  status       String   // DRAFT | QUOTED | AWARDED | REVERSE_MAPPED | LOST | ARCHIVED
  draftItems   DraftItem[]
  draftTerms   DraftTerm[]
  createdAt    DateTime
}

model DraftItem {
  id         String        @id
  runId      String
  run        BulkCostRun   @relation(...)
  origin     Json          // ExtractionLineSnapshot (immutable)
  latest     Json          // user-editable copy
  uniqueLineId String?      // hidden AXON hint
  matchMethod  String?      // hidden AXON hint
  matchConfidence Float?    // hidden AXON hint
  result     Json?         // AllocationLineResult หลัง CAL
}
```

### Calculation Flow เป้าหมาย

```
Client → Server Action: calculateAllocation(runId, costs, selectedLineIds)
       ← AllocationPreview (streaming)

Client → API: POST /api/bulk-cost/runs
       ← BulkCostRun + lineCount
```

**Note:** `bulk-cost.calc.ts` (pure function) ยังคงใช้ได้ใน Server Action โดยตรง ไม่ต้องเขียนใหม่

Awarded reverse mapping is deferred. Phase 3A must not create Draft Item/Term or
write `@POITM` / `@PITM1`; the existing-term INSERT-vs-UPDATE rule is still open.

---

*อัปเดตไฟล์นี้เมื่อ architecture เปลี่ยน หรือมี decision สำคัญ*
