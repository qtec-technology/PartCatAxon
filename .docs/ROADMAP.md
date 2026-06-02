# PartCatalog — Roadmap

> อัปเดตล่าสุด: 2026-05-25
> อ่านร่วมกับ `.docs/FEATURE_STATUS.md` (สถานะปัจจุบัน) และ `.docs/ARCHITECTURE.md`

---

## ภาพรวม Phase

```
Phase 0 🔄  Architecture Stabilization (AXON handoff + deploy reset)
Phase 1 ✅  Web Baseline (ใช้งานได้จริง)
Phase 2 🔄  Next.js Native Migration (กำลังทำ)
Phase 3 ⏳  Cost Workspace Backend + AXON Integration
Phase 4 ⏳  Auth Migration → Better Auth
Phase 5 ⏳  Full AI Automation
```

---

## Phase 0 — Architecture Stabilization 🔄

หยุดเพิ่ม feature ใหม่ชั่วคราวเพื่อปรับฐานระบบก่อนเดินต่อ AXON handoff และ
Bulk Cost production flow.

อ่านเอกสาร reset:

- `.docs/EXECUTIVE_ALIGNMENT.md`
- `.docs/AXON_HANDOFF_CONTRACT.md`
- `.docs/DEPLOYMENT_RUNBOOK.md`
- `.docs/MODULE_BOUNDARIES.md`
- `.docs/AUTOMATION_READINESS.md`
- `.docs/OPERATION_LAYER_DESIGN.md`

งานที่ต้องจบก่อนเริ่ม phase ถัดไป:

- [x] Port Item/Term `UpdatedDate` fix จาก deploy-proven `repos2`: SQL Server
      local `GETDATE()` แทน Node `new Date()` SQL parameter
- [x] Create agent-ready handoff pack:
      `.docs/AGENT_START_HERE.md`, `.docs/DOCS_INDEX.md`, and
      `.docs/COST_WORKSPACE_FIELD_COVERAGE.md`
- [ ] Align deploy topology with AXON: Nginx, subdomain, internal CA, NSSM
- [ ] Harden current Trusted Reverse Proxy Header Auth before production:
      bind Express to `127.0.0.1` only, add `TRUSTED_PROXY_IPS` validation
      before reading `x-forwarded-*` headers, ensure Nginx strips/overwrites
      client-supplied identity headers, and evaluate optional proxy header HMAC
      signing if the deployed proxy/SSO layer supports it
- [x] Lock Cost Workspace direction: one workspace supports `SINGLE` + `BULK`
      and `MANUAL` + `AXON_AWARDED`; Manual is completed first to verify
      formulas/columns/snapshots before real AXON view integration
- [ ] Lock AXON handoff contract around `ChainId` / AIX ID, comparison revision,
      awarded supplier quote, AXON line identity, and header-vs-line cost markers
- [x] Draft AXON final comparison header/line SQL view contract from the
      read-only AXON copy (`server/sql/20260519_axon_handoff_view_contract.sql`)
- [x] Scaffold read-only AXON final comparison endpoint by `ChainId`
      (`GET /api/axon-handoff/comparisons/:chainId`) with env-gated view names
- [ ] Confirm real AXON final comparison view names/columns with Pi-Jo and set
      `DB_VIEW_AXON_FINAL_COMPARISON_HEADER` / `DB_VIEW_AXON_FINAL_COMPARISON_LINES`
- [x] Clean retired `client/` references from normal quick docs/scripts
- [x] Document module boundaries and avoid browser-only business logic for
      automation-critical workflows
- [ ] Design next backend operation boundaries:
      `cloneAxonComparison`, backend/shared `calculateBulkCost`
- [x] Add first Bulk Cost operation service wrapper so controllers no longer
      call repositories directly for current run/save/status operations
- [x] Move Bulk Cost calculation toward backend/shared source of truth before
      Award/SAP automation

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
- [x] Bulk Cost / Cost Workspace UI connected to backend calculate and live DB
      save/load paths
- [x] Client retirement complete (client/ deleted 2026-05-07)
- [x] Root dev/build/test scripts use `server + next-shell` only
- [x] `/` redirects to `/partcatalog`
- [ ] UI parity checklist: next-shell vs legacy SPA (Item + Term)
- [ ] Production entry point: user เข้า next-shell แทน SPA
- [x] Legacy `client/` SPA retired; do not reintroduce into normal workflows
- [ ] Evaluate Next.js Cache Components / `use cache` for stable read-only
      data and route shells only (lookups, vendor lists, item groups, static
      reference data). Do not cache auth-sensitive pages, draft workspace
      state, CAL results, save/revision flows, or data that must be fresh per
      request.
- [ ] Create minimal UI template registry / internal `/menu` or `/templates`
      route for QTEC page shells, search panels, dense grids, form sections,
      workspace steps, and review tables. Keep it internal and use it as an AI
      reference, not a business workflow.

**Prerequisites ก่อน go-live:**
- Next.js UI ต้องผ่าน UAT รอบแรก
- ทุก workflow ใน Item/Term ต้องทำงานได้เหมือน SPA เดิม

---

## Phase 3 — Cost Workspace Backend + AXON Integration ⏳

เชื่อม Cost Workspace UI กับ backend และ AXON. Bulk Cost is now one mode inside
Cost Workspace, alongside Single Cost.

### 3A — DB Schema + Backend API

Rebuild target naming:

```text
CostWorkspaceRun
CostWorkspaceLine
CostWorkspaceSnapshot
```

Current live implementation still uses `BulkCostRun` / `DraftItem` /
`DraftTerm`. Keep it until replacement schema and migration/retirement scripts
are ready.

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
- [x] Redesign schema as Cost Workspace: `CostWorkspaceRun`,
      `CostWorkspaceLine`, `CostWorkspaceSnapshot` — M1 SQL created in
      `server/sql/migration/M1_create_cost_workspace.sql`; pending DB execution
- [ ] Review `.docs/COST_WORKSPACE_FIELD_COVERAGE.md` with owner and mark each
      field as main grid, review/finalize, system, deferred, or not needed
- [ ] Lock Calculation Template for Cost Workspace: inputs, allocation basis,
      backend calculation source, output columns, golden tests, and snapshot
      traceability
- [ ] Add source/mode dimensions: `MANUAL | AXON_AWARDED` and `SINGLE | BULK`
- [ ] Add PartCatalog Review / Finalize step before writing real Item/Term
      master data
- [x] สร้าง SQL scripts: `server/sql/20260512_bulk_cost_full_schema.sql` and
      `server/sql/20260519_bulk_cost_manual_revision.sql`
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
- [ ] Audit live `PART_CATALOG_AIX` schema before any replacement:
      `BulkCostRun`, `DraftItem`, and `DraftTerm` are current live tables and
      must be kept until Cost Workspace replacement schema is approved
- [ ] ออกแบบ Awarded reverse mapping flow แยก Phase ถัดไป (ยังไม่สร้าง endpoint)
- [x] Manual New Allocation supplier selection loads vendor master data from
      `@OCRD` through the existing lookup API

### 3B — AXON Integration

อ่าน `.docs/AXON_HANDOFF_CONTRACT.md` ก่อนเสมอ. ไฟล์ handoff contract นี้เป็น
source ล่าสุดสำหรับการเชื่อม AXON; เอกสาร API/push รุ่นเก่าถูกลบออกเพื่อไม่ให้
agent สับสนกับทิศทาง SQL/shared-view handoff ปัจจุบัน.

**Business Decisions ยืนยันแล้ว (2026-05-12; wording refreshed 2026-05-25):**
- [x] AXON Model = **Hybrid Push+Pull**: AXON push เข้า DB อัตโนมัติ, เซลล์ Pull ผ่าน Dashboard
- [x] Item Group = AI Suggest (🪄) → Sales Edit → Manager Approve in the
      AXON/awarded flow; PartCatalog consumes awarded rows and does not own
      Award selection
- [x] Three-tier fallback สำหรับ CWeight: existing/export data → AI suggestion (ภายหลัง) → User manual (เสมอแก้ได้)
- [x] Scope ล่าสุด: Kim/Codex ทำเฉพาะ CWeight / Weight & Dimension; HS Code, Duty, Permit, Shelf Life เป็น AXON/ทีมอื่น

**งาน codebase owner หลัง architecture reset:**
- [x] Switch Cost Workspace route-local navigation from top tabs to hybrid left sidebar while keeping the global Part Catalog topbar (May 2026 UAT setup)
- [x] Create AXON Awarded Intake placeholder UI as a non-connected integration tab under /bulk-cost (May 2026 UAT setup)
- [ ] A2: AXON Chain inbox/import loads awarded rows from real SQL view by
      `ChainId` / AIX ID
- [ ] A3: Read-only AXON final comparison handoff by `ChainId`
      (shared DB/view/module; do not start with public REST API)
- [ ] B1: SQL read model / snapshot repository for AXON comparison clone
- [ ] B2: Origin/Latest model ใน BulkCostWorkspace UI
- [ ] B3: Item Group dropdown + 🪄 AI suggest indicator
- [ ] B4: Supplier matching confirmation UI (AXON hint → user confirm/reject)
- [ ] B5: Three-tier badge UI (AXON / AI / manual)
- [ ] B6: Workspace columns ตาม legacy Term form (UOM dropdown, Ship Mode ฯลฯ)
- [x] C5: Wire CWeight service route ภายหลังเมื่อ local pattern ผ่าน test แล้ว
- [ ] C6: Verify Codex CWeight response ตรง Bulk Cost weight fields
- [ ] D1: PartCatalog Review / Finalize validation for a saved revision
      (no Award ownership; AXON owns Award)
- [ ] D2: Reverse Mapping summary / read-only preview after Review/Finalize
      and business/order gate approval

**งาน Codex / GPT 5.5 (CWeight layer — isolated):**
- [x] C1: CWeight / Weight & Dimension local research module
- [x] C2: Pattern tests สำหรับ dimensional weight, chargeable weight, divisor, rounding, ship mode, dim unit
- [x] C3: Matching strategy เริ่มจาก exact/rule-based fields (supplier order code, mfr no, brand, vendor, description)
- [ ] C4: CWeight prompt/research notes เฉพาะกรณีที่ต้องใช้ AI ภายหลัง

**ทำพร้อมกันได้ (parallel):** A2/A3/B1-B6 (Claude/AXON) + C6 (Codex CWeight response verify)
**ต้องรอลำดับ:** C6 รอ Codex CWeight AI output ก่อน | D1 รอ
Manual Workspace field/formula coverage ก่อน

### 3C — Prisma ORM (ขึ้นอยู่กับ 3A)

- [ ] ติดตั้ง Prisma + `prisma-dbml-generator`
- [ ] สร้าง schema สำหรับ BulkCost tables
- [ ] Raw mssql escape hatch สำหรับ stored procedures เดิม

---

## Phase 4 — Auth Migration → Better Auth ⏳

**Current auth status:** production uses Trusted Reverse Proxy Header Auth.
Nginx/SSO authenticates the internal AD/domain user, strips and overwrites
identity headers, then Express reads only trusted `x-forwarded-*` headers.
IIS/iisnode is not part of the auth flow.

**Phase 0 hardening first:** keep the current auth method and secure the
transport path before changing auth architecture.

- [ ] Express API binds to loopback only (`127.0.0.1`), never public
      `0.0.0.0`
- [ ] `auth.middleware.ts` validates `TRUSTED_PROXY_IPS` using
      `req.socket.remoteAddress` before trusting identity headers
- [ ] Requests carrying proxy identity headers from untrusted IPs return `401`
- [ ] Nginx/SSO config strips incoming client `x-forwarded-*` identity headers
      and writes the trusted values itself
- [ ] Add tests for trusted proxy, untrusted proxy, missing identity, group
      mapping, and elevated role mapping
- [ ] Optional: add HMAC signature verification for identity headers if the
      proxy/SSO layer can sign headers with a shared secret
- [ ] AD server cutover runbook: Express app is unchanged; update only
      Nginx/SSO AD target, then smoke test login and role mapping

**Better Auth trigger:** do this later only when role changes must be DB-backed
without redeploy, external users must be supported, or AI/service-account
identity requires first-class auth.

**สาเหตุ:** legacy Windows-bound auth ไม่เหมาะกับ AI/agent identity และ service account

- [ ] ติดตั้ง Better Auth
- [ ] JWT + Org plugin (RBAC)
- [ ] User roles: Manager, Supervisor, Staff
- [ ] Multi-tenant prep (ถ้าจำเป็น)
- [ ] Migrate session model ใน next-shell
- [x] Legacy host-bound auth removal from active runtime: production auth reads
  only trusted Nginx/proxy identity headers
- [x] Bulk Cost access control: authenticated domain/catalog users can access and save normal work; manager/supervisor reserved for elevated actions

**Prerequisites:** Phase 3A เสร็จก่อน (เพราะ auth กระทบ Bulk Cost save permissions)

---

## Phase 5 — Full AI Automation ⏳

Automation requires module separation first. Read
`.docs/AUTOMATION_READINESS.md`; do not automate browser clicks for core
business logic.

ระบบอัตโนมัติเต็มรูปแบบ:

- [ ] AXON Email → SupplierReply → Quote Extraction pipeline publishes awarded
      rows into Cost Workspace handoff
- [ ] AI-assisted field suggestion (Warning + Suggestion mode)
- [ ] AI Quote Ranker (Stage G3) ส่งผลไปยัง SupplierSelection sorting
- [ ] Auto-prefill Item/Term fields จาก AI extraction
- [ ] Qdrant vector search สำหรับ duplicate item detection
- [ ] Approval matrix / governance flow สำหรับ Cost Workspace revisions
- [ ] Python orchestrator deploy เป็น NSSM daemon service

---

## Target Architecture (Phase 4-5)

```
Browser
└── Next.js 16 (App Router + RSC + Server Actions)
    ├── Better Auth (JWT + Org/RBAC)
    ├── Prisma ORM (30+ models → SQL Server 2022)
    └── /api/* → Express (legacy escape hatch)

Python AXON Orchestrator (NSSM daemon, AXON side)
├── OpenAI / Gemini Vision / Claude CLI
├── Qdrant vector DB (192.168.2.54)
└── Publish final comparison by ChainId through shared DB/view/module handoff

Deploy: NSSM + Nginx reverse proxy + standalone Next.js
```

---

## QTEC Floor Standard Checklist

| รายการ | สถานะ |
|---|---|
| `biome.json` (linting) | ✅ สร้างแล้ว (2026-05-27) |
| `CLAUDE.md` (~70 lines) | ✅ สร้างแล้ว |
| `.github/workflows/lint.yml` | ❌ ยังไม่มี |
| `lefthook.yml` (pre-commit) | ✅ สร้างแล้ว (2026-05-27) |
| `.gitattributes` (LF normalization) | ✅ สร้างแล้ว (2026-05-27) |
| `.editorconfig` | ✅ สร้างแล้ว (2026-05-27) |
| npm workspaces (`packages/*`) | ✅ เพิ่มแล้ว (2026-05-27) |
| `@partcatalog/shared-types` package | ✅ สร้างแล้ว (2026-05-27) |
| Cost Workspace M1 SQL script | ✅ สร้างแล้ว; ⏸ รอ execute บน DB |

| Unit tests pass | ดู count ล่าสุดใน `.docs/FEATURE_STATUS.md` |
| TypeScript strict | ✅ |

---

*อัปเดตไฟล์นี้เมื่อ phase เสร็จ, ตัดสินใจ blocking question, หรือ scope เปลี่ยน*
