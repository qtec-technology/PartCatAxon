# FEATURE_STATUS.md — Workstream Status & Decision Log

ปรับปรุงล่าสุด: 13 พฤษภาคม 2026 (updated)
**Agent: อัปเดตไฟล์นี้หลังทำงานเสร็จทุกครั้ง**

---

## 1. สถานะ Workstream ปัจจุบัน

| Workstream | สถานะ | รายละเอียด |
|---|---|---|
| Legacy to Web baseline | ✅ Completed | ระบบหลักย้ายจาก Access มาเป็นเว็บแล้ว |
| Search / Part Catalog | ✅ Active | ใช้งานได้ใน next-shell (native page) |
| Item page | ✅ Active | ใช้งานได้ใน next-shell (native page) |
| Term page | ✅ Active | ใช้งานได้ใน next-shell (native page) |
| Term calculation engine | ✅ Active | ใช้งานจริงผ่าน backend; golden-case parity verified against production CSV (83 server tests) |
| Item/Term attachment flow | ✅ Active | ใช้งานได้ |
| Next.js Phase 1 (BFF proxy) | ✅ Done | `/api/*` route handler พร้อม |
| Next.js Phase 2 (native pages) | ✅ Done | Item, Term, PartCatalog native แล้ว |
| Bulk Cost UI + DB live | ✅ Active | UI พร้อม, DB connected (mock fallbacks removed), next-shell 51 tests, server 83 tests |
| Bulk Cost Run List + Status | ✅ Done | 2 tabs (Allocations / New Allocation), GET /runs, GET /runs/:id, PATCH /runs/:id/status, restore saved run, saleIncharge filter |
| Bulk Cost backend API + DB | ✅ Phase 3A Live | `BulkCostRun` / `DraftItem` / `DraftTerm` tables in `PART_CATALOG_AIX`; `BulkCostLine` removed from live schema; POST /api/bulk-cost/runs, mock fallbacks removed; AxonExtractionQueue seeded (13 rows) |
| Bulk Cost viewport-locked layout | ✅ Done | `/bulk-cost` pages use app-shell-locked layout (internal scroll, no page scroll) matching `/partcatalog` |
| AI-assisted workflow | 🚧 In Progress | CWeight / Weight & Dimension local research and backend-only wrapper are current Kim/Codex scope; HS Code, Duty, Permit, Shelf Life are AXON/team scope |
| Executive requirement collection | 🔄 Active | ใช้ `10.Excutive Questions.md` |
| AIX intake automation | ❌ Not Started | |
| client/ retirement | ✅ Done | ลบ 2026-05-07 — all smoke tests passed |

---

## 2. สิ่งที่มีในระบบปัจจุบัน (ณ 8 พ.ค. 2026)

### Web Baseline
- หน้า Search / Part Catalog: ค้นหา item, expand term, เปิด item/term
- หน้า Item: mode `new / view / edit`, upload image, attachment, search-before-create
- หน้า Term: mode `new / view / edit`, preview/save calculation, RFQ mailto, attachment
- Backend calculation engine (source of truth สำหรับ Term)

### Next.js Shell
- `/partcatalog` — native search page (SearchCriteriaPanel + PartItemsGrid + sub-tabs)
- `/item/[id]`, `/item/new` — native ItemPage
- `/item/preview` — read-only preview สำหรับ Bulk Cost
- `/term/[itemId]`, `/term/new` — native TermPage
- `/term/preview` — read-only preview สำหรับ Bulk Cost
- `/bulk-cost` — Bulk Cost workspace (connected to real DB, viewport-locked layout)
- `/api/*` BFF proxy → Express

### Bulk Cost (Prototype)
- SupplierSelection table (400 records per page, resizable columns, expandable item preview)
- BulkCostWorkspace: Steps 1-3 (Cost Bar → Source Lines → Result Review)
- Origin / Latest / Changes views
- Live preview calculation (pure frontend, mock data)
- Per-line document fees, editable final result
- Pure document-fee basis helper/tests: Per Each, item-total normalization, By Lot / Batch service-line candidates
- Item/Term preview via localStorage bridge
- 44 next-shell unit tests ผ่าน (allocation, rounding, warnings, Excel golden regression, document-fee basis, item API mapping, lookup cache/sub-location regressions)
- 83 server unit tests ผ่าน (45 calc engine + 28 golden-case + 10 exact parity vs production CSV)

---

## 3. สิ่งที่ยังไม่มีในระบบ

- Bulk Cost Award/Reverse-map endpoint
- Bulk Cost master write flow to Item/Term after Awarded
- Real AXON/UI/API persistence for explicit `DocumentFeeBasis` and generated
  By Lot / Batch document-fee line candidates
- Real SQL Server `PART_CATALOG_AIX` DB: `BulkCostRun`, `DraftItem`, `DraftTerm`, `AxonExtractionQueue` tables live; `BulkCostLine` removed from live schema; mock fallbacks removed
- `ai-services/` package scaffolded: local CWeight formula, local lookup, sample analyzer, semantic evaluation reports/tests implemented; HS Code, Duty, Permit, Shelf Life are not Kim/Codex scope in the current phase
- Backend CWeight wrapper exists at `server/src/services/cweight.service.ts`; backend-only exact `[GRAINGER].[dbo].[@GRAINGER_CWEIGHT]` lookup is available through `server/src/services/cweight-lookup.service.ts`, `POST /api/cweight/resolve`, and review-only Bulk Cost prefill endpoint `POST /api/bulk-cost/cweight-prefill`; it is not wired to Next.js UI.
- AIX `GraingerWeightData` / `GraingerWeightImportLog` staging tables are obsolete for the active CWeight path; the real source is `[GRAINGER].[dbo].[@GRAINGER_CWEIGHT]`.
- AI extraction จากเอกสารหรือ quotation
- AI prefill ใน Item/Term
- Draft intake queue จาก AIX
- Approval matrix / governance flow

---

## 4. Implementation Log

| วันที่ | การเปลี่ยนแปลง | Verification |
|---|---|---|
| 2026-05-11 | Allocation List footer UX: Allocations now always renders the same table footer pattern as SupplierSelection (visible horizontal scrollbar, `Showing X-Y of Z records`, Prev/current/Next buttons, `400 per page`) instead of collapsing to plain text on a single page | `npm --prefix next-shell run typecheck` |
| 2026-05-11 | Fixed Bulk Cost run-list mock fallback blocker on older SQL Server compatibility levels: replaced `OFFSET ... FETCH NEXT` pagination with `ROW_NUMBER()` paging so missing `BulkCostRun` table reaches the intended mock fallback instead of throwing "Invalid usage of the option NEXT" | `npm --prefix server run build`, `npm --prefix server test -- --run` (83), manual GET `/api/bulk-cost/runs?page=1&pageSize=400` via ports 3010 and 3001 |
| 2026-05-11 | Completed pending Bulk Cost Allocation List work from interrupted agent: fixed TypeScript syntax in list query schema/repository mock restore, added server-side 400-row pagination metadata for `GET /api/bulk-cost/runs`, split Supplier and Vendor Code columns, enabled resizable/double-click autofit columns, kept rows visible with refresh overlay on filter changes, and populated mock Run #1 with source lines + preview so opening it shows Step 3 results | `npm --prefix server run build`, `npm --prefix server test -- --run` (83), `npm --prefix next-shell run typecheck`, `npm --prefix next-shell test -- --run` (51), `npm --prefix next-shell run build` |
| 2026-05-11 | Bulk Cost Run List + Status Flow: (1) `/bulk-cost` แบ่งเป็น 2 แท็บ (Allocations / New Allocation) ด้วย URL `?tab=`; (2) `AllocationList` component — search, status filter pills, saleIncharge dropdown, table cols: Run # / Supplier / Lines / Amount / Currency / Updated / Updated By / Status / Reference No.; (3) GET `/api/bulk-cost/runs` + PATCH `/api/bulk-cost/runs/:id/status` endpoints; (4) GET `/api/bulk-cost/runs/:id` เพื่อ restore saved run; (5) Workspace เพิ่ม Awarded (green) / Lost (red) buttons หลัง Save Draft; (6) Opening run จาก Allocations tab รีโหลด calculation ใน Step 3 โดยอัตโนมัติ; Mock fallback ครบ | `npm run typecheck` pass, `npm test` (server 83 + next-shell 51) pass | (1) Fixed `LINE_TABLE_COLUMNS` order so Weight preset renders itemWeight → dimUnit → L/W/H → dimWeight🔒 → shipWeight🔒 (was dimWeight/shipWeight appearing before dimUnit); (2) Fixed sticky `<td>` cells in Result Review table — added explicit `position:'sticky'` + `zIndex:1` inline styles so body rows lock with header; added `sticky-col-last` box-shadow CSS to UOM column as visual separator between frozen and scrollable areas; (3) Updated Price preset hint text: clarifies that Currency is the supplier's quote currency applied to Unit Price/PKH/SOC/DocFees via Exchange Rate → THB, while Freight/TT/CC are already in THB and bypass Exchange Rate; (4) `costs.currency` auto-syncs from dominant line currency; scroll-to-PCS on Result Review table initial render | `npm run typecheck` pass, `npm test` (server 83 + next-shell 51) pass |
| 2026-05-11 | Bulk Cost Step 2 UX: (1) Auto-calc Dim Weight from L×W×H (server formula replicated on frontend via `calcLineDimWeight`); Ship Weight = Max(Item Wt, Dim Wt) CEILING 0.5 — both locked/read-only; (2) Reordered Weight preset columns: itemWeight → dimUnit → L/W/H → dimWeight(🔒) → shipWeight(🔒); (3) Added Thai-language preset hint notes below column tabs; (4) Renamed "+ Add Line" → "+ Add Item" with `primary-button` style; (5) Sticky-freeze first 6 columns (No/Group/Supp Order Code/Description/Qty/UOM) in Result Review table via `getStickyLeft` in `useResizableTableColumns` | `npm run typecheck` pass, `npm test` (server 83 + next-shell 51) pass |
| 2026-05-11 | Fixed Bulk Cost Item/Term preview banner overlap while scrolling: preview banner now stays in normal document flow instead of sticky positioning, preventing it from covering AppShell or Item/Term form headers | `npm --prefix next-shell run typecheck`, `npm --prefix next-shell run build` |
| 2026-05-11 | Improved Bulk Cost manual quote numeric input UX: focusing a zero-value `FormattedNumberInput` now clears the edit draft, and focusing a non-zero value selects the full number so users can type replacement values without manually deleting the old value | `npm --prefix next-shell run typecheck`, `npm --prefix next-shell test -- --run` (51) |
| 2026-05-11 | Hidden `matchStatus` column from all Bulk Cost line presets (basic/price/docs/weight/term/all) per executive directive — no duplicate check during quotation phase; `itemCode` and match fields kept in types for Awarded Reverse Mapping; added Per Each tooltip on doc fee input ("enter per-unit amount; divide total by qty if supplier quotes lump sum"); updated Decision Log | `npm --prefix next-shell run typecheck` |
| 2026-05-11 | UX improvements for Bulk Cost: (1) Replaced "Advanced ▼" toggle + forced view-reset with `NEXT_PUBLIC_SHOW_FORMULA` build-time env gate — Formula/All Columns tabs hidden in production, visible when `true`; (2) Vendor combobox in Manual Quote dialog upgraded to startsWith-first ranked results (cardCode/cardName startsWith before includes); (3) Fixed `add-line-btn` CSS margin conflict with `.line-view-toolbar small` (both had `margin-left: auto`); (4) Removed AXON-specific text from Step 3 empty state; (5) Added `.env.local`/`.env.example` for `NEXT_PUBLIC_SHOW_FORMULA` | `npm --prefix next-shell run typecheck` pass |
| 2026-05-11 | Added Create Manual Quote flow: "New Manual Quote" button on SupplierSelection opens a dialog (vendor code + name inputs); unknown vendor code opens a blank workspace with 0 lines; "+ Add Line" button in Step 2 toolbar creates blank `AllocationLineSource` rows (pre-filled from current costs context); mock fallback changed to return empty lines/costs for unknown vendor codes instead of falling back to Grainger demo | `npm --prefix next-shell test -- --run` (51), `npm --prefix next-shell run typecheck`, `npm --prefix server test -- --run` (83) |
| 2026-05-11 | Added DocumentFeeBasis UI to Bulk Cost workspace: `docFeeBasis` field on `AllocationLineSource` (optional per-fee-kind toggle `PER_EACH \| BY_LOT_BATCH`); Per Each/Lot toggle buttons on each doc fee cell in docs preset; `effectiveSelectedLines` zeros out BY_LOT_BATCH fees before calc engine; `docFeeCandidates` memo collects service-line candidates; "By Lot / Batch Service Line Candidates" panel renders between Step 2 and Step 3; CSS for toggle and badge | `npm --prefix next-shell test -- --run` (51), `npm --prefix next-shell run typecheck`, `npm --prefix server test -- --run` (83) |
| 2026-05-11 | Added ET/MT/MiscTax/SCC/STK to Bulk Cost calc engine (`computeFinalResult`): `QLC = CEILING(preQLC + STK, 0.01)` where `preQLC = OP1 + INS + FR + DT + ET + MT + MiscTax + TT + CC + SCC`; ET uses same reverse formula as Term engine; added `scc` field to `AllocationLineSource` and new output fields (`et`, `mt`, `miscTaxVal`, `scc`, `preQLC`, `stk`) to `FinalResultColumns`; added 7 new unit tests covering each component | `npm --prefix next-shell test -- --run` (51), `npm --prefix next-shell run typecheck`, `npm --prefix server test -- --run` (83) |
| 2026-05-11 | Created golden-case + exact parity test suites from `.datatest` CSV exports: 28 golden-case tests covering DDP/Exwork/FCA/FAS/FOB/CIF/CFR/CPT/DDU/DAP/EX-FACTORY-Thailand + STK/SCC/MiscTax/INCH; 10 exact parity tests comparing every output field against production persisted values | `npm --prefix server test -- --run` (83), `npm --prefix next-shell test -- --run` (44) |
| 2026-05-11 | Exported 8 additional `.datatest` CSVs for missing order terms (CIF/FOB/CFR/FAS/CPT/DDU/INCH) and missing features (ET/MiscTax/STK/SCC/CWeight); created `EXPORT_QUERIES.sql`; added `@SUBLOCATION.csv` | Data audit update |
| 2026-05-08 | Fixed Term DT display bug: "Duty Tax (DT)(FR)(THB)" row was showing MAX(DT_FR, DT_FRZONE) instead of the CIF-based DT_FR component; added `DT_FR` field to `TermCalcResults`; critical for Exwork + Air Courier (mode 6) where both CIF and CIFZONE are non-zero | `npm --prefix next-shell test -- --run` (44), `npm --prefix server test -- --run` (45), `npm --prefix next-shell run typecheck`, `npm --prefix server run build`, `npm --prefix next-shell run build` |
| 2026-05-08 | Term audit after Next migration: no additional blocking Term bug found after targeted scan; hardened Term attachment dialog file-input reset and invalid UpdatedDate display handling | `npm --prefix next-shell test -- --run` (44), `npm --prefix server test -- --run` (44), `npm --prefix next-shell run typecheck`, `npm --prefix server run build`, `npm --prefix next-shell run build` |
| 2026-05-08 | Fixed Term Purchase Sub Location filtering: after selecting `@LOCATION`, Purchase Sub Location now loads only `@SUBLOCATION` rows where `Module='AP'` and `Country=<Term Location>`, ordered by `Priority, Name` | `npm --prefix next-shell test -- --run` (44), `npm --prefix server test -- --run` (44), `npm --prefix next-shell run typecheck`, `npm --prefix server run build`, `npm --prefix next-shell run build` |
| 2026-05-08 | Fixed New Term lookup cache bug: shared `term-form` lookup cache no longer uses component `AbortSignal`, preventing React dev/Strict Mode abort from leaving Supplier/Contact/lookup options empty | `npm --prefix next-shell test -- --run` (43), `npm --prefix server test -- --run` (44), `npm --prefix next-shell run typecheck`, `npm --prefix next-shell run build` |
| 2026-05-08 | Fixed New Item B1 Item No handling: blank B1 value now maps to API `null` and SQL `NULL`; added server/frontend unit tests | `npm --prefix next-shell test -- --run` (42), `npm --prefix server test -- --run` (44), `npm --prefix next-shell run typecheck`, `npm --prefix server run build`, `npm --prefix next-shell run build` |
| 2026-05-08 | Fixed controlled Select warning risk in Add File/attachment flow by keeping Radix Select values controlled and clearing file input after dialog/save | Same verification as above |
| 2026-05-08 | Updated Bulk Cost formula implementation/tests: split `MIXED_VENDOR` and `MIXED_CURRENCY`, locked document-fee basis helper, and corrected Grainger mock to Excel internal shipping-weight total `194.43675` | Same verification as above |
| 2026-05-08 | `.datatest` refreshed as CSV/XLSX exports: 500-row Term/Item/vendor synonym samples, 1000-brand sample, lookup CSVs, and `AXON_Extraction_Calculation.xlsx` exact baseline | Docs/data audit update |
| 2026-05-07 | Prepared `client/` retirement: root scripts now run/build/test `server + next-shell`, CSRF/CORS dev origin moved to `3010` | `npm run typecheck`, `npm test` (`server` 37 + `next-shell` 33), `npm run build`, production smoke health/redirect/item-list pass |
| 2026-05-08 | Implemented Bulk Cost Phase 3A draft snapshot save: `POST /api/bulk-cost/runs`, transactional draft snapshot inserts, Next Save Draft button, SQL creation script. Superseded 2026-05-14: live schema uses `DraftItem` / `DraftTerm`, not `BulkCostLine`. | `npm --prefix server run build`, `npm --prefix next-shell run typecheck`, server tests 40 pass, next-shell tests 34 pass |
| 2026-05-08 | Updated Bulk Cost/AXON docs: Qty is AXON-suggested from `QuotedQty`/`RfqQty` then sales verifies/edits; existing SQL Agent sync target `PART_CATALOGSQL` is acceptable because `PART_CATALOG_AIX` exposes synonyms | Docs-only update |
| 2026-05-08 | Updated Bulk Cost document-fee rule: Per Each / UOM By Each fees enter OP1; By Lot / Batch fees become separate new line items and require Golden Case verification before DB execution | Docs-only update |
| 2026-05-08 | Updated Bulk Cost test data handoff for current `.datatest` CSV/XLSX exports; corrected `@PITM1_BRAND_VENDOR`, `@PITM1_VENDOR_BRAND`, and `@FULLTEXT` as synonyms, not views | Docs-only update |
| 2026-05-08 | Added `.docs/BULK_COST_TEST_DATA_AUDIT.md`: historical TOP 200 Term comparison preserved, current TOP 500 CSV/XLSX source list added, UOM conversion remains the main parity risk | Docs-only analysis |
| 2026-05-07 | client/ deleted | All smoke tests + upload test passed |
| 2026-05-07 | Docs update: ARCHITECTURE / FEATURE_STATUS / copilot-instructions / CLAUDE.md updated post-deletion; Permission Model corrected; BULK_COST_CALCULATION.md rewritten as full formula reference; PartCatalogApp→PartCatalog rename; ItemForm line count corrected | `npm run typecheck`, `npm test` (server 37 + next-shell 33), `npm run build` pass |
| 2026-05-07 | Added `.docs/BULK_COST_CALCULATION.md`; confirmed quote-level Currency/Order Term/Location and OP1 with document fees | Pending doc review |
| 2026-05-07 | Fixed Turbopack root issue: `next.config.ts` เพิ่ม `resolveAlias` สำหรับ tailwindcss + tw-animate-css | `npm run build` pass |
| 2026-05-07 | Fixed `BulkCostPage` page-refresh bug: ย้าย supplier state ไปเก็บใน URL search params (`?supplier=CODE&supplierName=NAME`) + ครอบ `<Suspense>` | `/bulk-cost` HTTP 200 pass |
| 2026-05-07 | Fixed `ItemForm` infinite loop: เปลี่ยน `attachments: initialAttachments = []` เป็น `EMPTY_ATTACHMENTS` module-level constant | `npm run typecheck`, `npm test -- --run` (33) pass |
| 2026-05-07 | สร้าง `.docs/DATA_SCHEMA.md` — reference ครบจาก repo/local docs (column mapping, formula, SP, DB objects) | — |
| 2026-05-07 | Bug check: partcatalog, item, term pages ไม่พบ critical bug เพิ่มเติม | อ่าน source แล้ว — EMPTY_ATTACHMENTS fix ครอบ root cause แล้ว |
| 2026-05-07 | Code vs docs audit: แก้ `DATA_SCHEMA.md` section 4.4 — `B1ItemNo` + `shelfLifeRequired` ไม่ใช่ gap (ทำงานครบ); เพิ่ม `punchOut` ghost field note | ยืนยันจาก item.api.ts + item.write.ts |
| 2026-05-07 | แก้ path references ทั้งหมดใน `CLAUDE.md` + `copilot-instructions.md` จาก `docs/` → `.docs/` | grep ยืนยัน path ถูกต้องทุกไฟล์ |
| 2026-05-07 | สร้าง `.github/copilot-instructions.md`, `.docs/ARCHITECTURE.md`, `.docs/FEATURE_STATUS.md`, `.docs/BULK_COST.md` | — |
| 2026-05-07 | เพิ่ม `.npmrc` ที่ root เพื่อป้องกัน package-lock.json ใหม่ | — |
| 2026-05-06 | Added read-only post-CAL Item/Term Draft Preview in Bulk Cost Step 3 | `npm run typecheck`, `npm test` (33), `npm run build` pass |
| 2026-05-06 | Added Step 2 preset-owned editing | `npm run typecheck`, `npm test` (33), `npm run build` pass |
| 2026-05-06 | Corrected Bulk Cost mock source to multi-quote structure (Grainger + 12 suppliers) | `npm run typecheck`, `npm test` (33), `npm run build` pass |
| 2026-05-06 | Updated previous external bulk-cost notes re: OP1 formula + supplier-level vs item-level fields | Superseded by `.docs/BULK_COST_CALCULATION.md` |
| 2026-05-05 | Added missing Item master review fields (Item Category, Country of Origin, HS Code) | `npm run typecheck`, `npm test` (30), `npm run build` pass |
| 2026-05-05 | Reworked Bulk Cost Allocation flow (3 steps) | `npm run typecheck`, `npm test` (30), `npm run build` pass |
| 2026-05-04 | Fixed Term Call By/Sourced By display fallback (`SlpCode=0 → blank`) | `npm run typecheck`, `npm test` (29), `npm run build` pass |
| 2026-05-04 | Added Next.js BFF API route handler; removed rewrite proxy | `npm run build` pass |
| 2026-05-04 | Verified live during earlier migration: Express + Next + SPA ran together | Superseded by 2026-05-07 client retirement prep |
| 2026-04-30 | Replaced `/partcatalog` iframe bridge with native locked workspace | `npm run typecheck`, `npm test` (25), `npm run build` pass |
| 2026-04-30 | สร้าง Native ItemPage + TermPage routes | HTTP 200; typecheck/test/build pass |
| 2026-04-30 | ติดตั้ง vitest + สร้าง 23 initial tests | `npm test` pass |
| 2026-04-30 | สร้าง `PartCatalog/next-shell` Next.js prototype | — |
| 2026-04-29 | เริ่ม workstream Bulk Cost Allocation Phase 2A | — |

---

## 5. Decision Log

| วันที่ | Decision | เหตุผล |
|---|---|---|
| 2026-05-13 | Viewport-locked layout for `/bulk-cost`: extended `app-shell-locked` class to `/bulk-cost` paths in AppShell; added CSS classes `bulk-cost-page-root`, `bulk-cost-tabs-root`, `bulk-cost-tab-content`, `bulk-cost-workspace`, `bulk-cost-workspace-body`; toolbar fixed, body scrolls internally matching `/partcatalog` behaviour | `npm --prefix next-shell run typecheck` |
| 2026-05-14 | Tightened local CWeight semantic-search numeric matching so extra or missing quote size tokens reject unsafe description matches before any review suggestion is returned | `npm.cmd --prefix ai-services test -- --run`, `npm.cmd --prefix ai-services run build` |
| 2026-05-14 | Added local CWeight policy evaluation report from `.datatest`: exact supplier/manufacturer/catalog keys are `AUTO_ACCEPT`; description-only remains `REVIEW_SUGGESTION` or `NOT_FOUND`; future API fallback is designed as review-only after local `NOT_FOUND` with no API key used in Scope 1 | `npm.cmd --prefix ai-services test -- --run`, `npm.cmd --prefix ai-services run build`, `npm.cmd --prefix ai-services run report:cweight:policy` |
| 2026-05-14 | Added simulated CWeight API fallback evaluation with no network/API key: broad matching increases review suggestions but produces unsafe variant mismatches, so the recommended production method is verified-source API lookup only after local `NOT_FOUND`, max `REVIEW_SUGGESTION` | `npm.cmd --prefix ai-services test -- --run`, `npm.cmd --prefix ai-services run build`, `npm.cmd --prefix ai-services run report:cweight:api-sim` |
| 2026-05-14 | Confirmed live Phase 3A persistence architecture update: `BulkCostLine` was removed from `PART_CATALOG_AIX`; draft snapshots now persist through `BulkCostRun` + `DraftItem` + `DraftTerm` | Architecture update |
| 2026-05-14 | Validated compiled Bulk Cost CWeight prefill helper against live `[GRAINGER].[dbo].[@GRAINGER_CWEIGHT]`: Grainger exact code and manufacturer part+brand return `AUTO_ACCEPT`, unknown returns `NOT_FOUND`, and locked/user-edited lines return `prefillAllowed: false` | `node -e` against `server/dist/services/bulk-cost-cweight.service.js` |
| 2026-05-14 | Added backend-only Bulk Cost CWeight prefill helper and `POST /api/bulk-cost/cweight-prefill`; it maps draft line fields to the CWeight resolver and returns reviewable suggestions with `prefillAllowed`, without saving or overwriting user edits | `npm --prefix server test -- --run`, `npm --prefix server run build` |
| 2026-05-14 | Validated compiled backend CWeight lookup against live `[GRAINGER].[dbo].[@GRAINGER_CWEIGHT]`: `100G64` => `AUTO_ACCEPT` / `53.92`, `100FN6` => `AUTO_ACCEPT` / `0.09`, `1292G` + `LIBMAN` => `AUTO_ACCEPT` / `53.92`, unknown code => `NOT_FOUND` | `node -e` against `server/dist/services/cweight-lookup.service.js` |
| 2026-05-14 | Added backend-only `POST /api/cweight/resolve` endpoint for one-line CWeight resolution; request schema is limited to weight/dimension and product identifiers, rejecting HS Code/other scope fields; no UI/Next.js integration added | `npm --prefix server test -- --run`, `npm --prefix server run build` |
| 2026-05-14 | Switched backend-only CWeight exact lookup from AIX staging to `[GRAINGER].[dbo].[@GRAINGER_CWEIGHT]`; Grainger rows use `Chargeable_Weight_kgs` / `CWeight` directly and leave dimensions null because the source has no length/width/height columns | `npm --prefix server test -- --run`, `npm --prefix server run build` |
| 2026-05-14 | Added backend-only CWeight exact lookup composition: direct formula still wins, then local Grainger exact code/part match can return `AUTO_ACCEPT`; no route, UI, external API, or API-key integration added | `npm --prefix server test -- --run`, `npm --prefix server run build` |
| 2026-05-13 | Added backend-only CWeight wrapper service: `resolveChargeableWeight(input)` returns `AUTO_ACCEPT`, `REVIEW_SUGGESTION`, or `NOT_FOUND` for direct formula/local research results; no route, UI, external API, or API-key integration added | `npm --prefix server test -- --run`, `npm --prefix server run build` |
| 2026-05-14 | AXON `RawPayloadJson` contract updated and backend parser added: document-level supplier costs are extracted under `headerCosts` as reviewable Cost Bar suggestions (`pkh`, `soc`, `freight`, `customs`/`cc`, `wireTT`, insurance), separate from line items and By Lot / Batch document-fee candidates | `npm --prefix server test -- --run`, `npm --prefix server run build` |
| 2026-05-13 | Removed all mock fallbacks from `bulk-cost.repository.ts`: deleted `MOCK_QUEUE_ITEMS`, `MOCK_RUNS`, `MOCK_RUN1_LINES`, `MOCK_RUN1_PREVIEW`, `applyMockFilters`, `isMissingTableError`; `listAxonQueueItems`, `listBulkCostRuns`, `loadBulkCostRun` now use real DB only | `npm --prefix server run build`, `npm --prefix server test -- --run` (83), `npm --prefix next-shell run typecheck` |
| 2026-05-13 | Created SQL scripts: `20260512_grainger_weight_table.sql` (GraingerWeightData + GraingerWeightImportLog tables + 11 seed rows), `20260512_seed_mock_data.sql` (AxonExtractionQueue 13 rows), `20260512_axon_ai_tables.sql` (AXON AI helper tables); all run via SSMS (partcataloguser lacks DDL rights) | Manual SSMS execution confirmed |
| 2026-05-13 | Confirmed current AI scope: Kim/Codex works only on CWeight / Weight & Dimension local research and pattern tests first; HS Code, Duty, Permit, Shelf Life are AXON/team scope; production endpoint/API-key work comes later | Docs-only update |
| 2026-05-13 | Scaffolded `ai-services/` package: CWeight/Grainger weight lookup (`weight-lookup.service.ts`) with Grainger-first path; HS Code/Permit stubs exist from earlier scaffold but are not active scope | `npm --prefix ai-services install` — types restored |
| 2026-05-13 | 2026-05-12 Decision Log update superseded for Kim/Codex scope: AXON hybrid model and Item Group flow remain; Kim/Codex current scope narrowed to CWeight / Weight & Dimension only | Docs-only update |
| 2026-05-12 | Confirmed business decisions from Pi-Or/Pi-Jo: (1) AXON Model = Hybrid Push+Pull — AXON pushes Origin snapshot to DB automatically, sales pulls via Dashboard; (2) Item Group = AI Suggest (🪄 icon) + Sales Edit dropdown + Manager Approve at AWARDED stage — no SAP impact until Awarded; (3) AI auto-recommend scope was initially listed as Weight/Dim, HS Code, Permit/Shelf Life but Kim/Codex scope was narrowed on 2026-05-13 to CWeight only; (4) Three-tier fallback remains suggestion → user manual; (5) Workspace columns must match legacy Term form with inter-field dependencies preserved | Docs updated: AXON_INTEGRATION.md §10, ROADMAP.md Phase 3B |
| 2026-05-12 | Fixed Term SlpName / SlpSprtName / CntctName always empty in Term page response: `vw@PITM1` does not JOIN `[@OSLP]`/`[@OCPR]` for name resolution so all three name fields returned empty strings. Added `enrichTermNames` post-load step in `getTermById` (repository) that runs parallel `queryOne` lookups against `[@OSLP]` (for SlpCode, SlpSprtCode) and `[@OCPR]` (for CntctCode) when codes are set but names are blank. Also added `SlpName`, `SlpSprtName`, `CntctName` to the server `Term` TypeScript interface (previously omitted despite being in `TERM_PAGE_COLUMNS`). Bug was pre-existing — not introduced by Next.js migration. | `npm run typecheck`, `npm test` (server 83 + next-shell 51) pass |
| 2026-05-12 | Completed Phase 5 AllocationList UI polish: (1) Tab active color → `#2264A0` (matches rest of app); (2) AllocationList rewritten — resizable columns (useResizableTableColumns), double-click auto-fit, separate Supplier / Vendor Code columns, 400-row server-side pagination with TablePager, anti-flicker with refresh overlay; (3) BulkCostWorkspace restore auto-scrolls to Result Review (Step 3) when previewSnapshot is loaded; (4) Server pagination in `listBulkCostRuns` repository + controller `meta` response; (5) Mock Run #1 now has 3 lines + pre-calculated preview snapshot | `npm run typecheck`, `npm test` (server 83 + next-shell 51) pass |
| 2026-05-11 | Hide `matchStatus` column from all Bulk Cost line presets (basic/price/docs/weight/term/all) | During quotation phase no duplicate check occurs — column always shows "New Item" which confuses sales. Field `itemCode` and match-related backend fields (`MatchMethod`, `MatchConfidence`, `UniqueLineID`) are preserved in TypeScript types for future Awarded Reverse Mapping (Pi-Or directive) |
| 2026-05-11 | Virtual Key / No duplicate check during quotation; Awarded-only Reverse Mapping | Pi-Or directive: item duplicate check is the "hardest part" — skip entirely for quotation/UAT phase; create virtual FG keys immediately; only reverse-map to real SAP item codes when status reaches Awarded. AXON Stage D Semantic Search may surface historical pricing hints but does NOT gate quotation flow |
| 2026-05-11 | Per Each doc fee = per-unit amount (divide total by qty); By Lot doc fee = single lump-sum on one line | Sales must enter per-unit cost for /Ea fees (not total); By Lot fees entered once on one representative line then become service line candidates. Batch-level doc fee panel at Step 1 deferred to future phase |
| 2026-05-08 | New Item blank `B1ItemNo` must save as `NULL` | B1 Item No is not known for newly created PartCatalog items; sending an empty string creates false data |
| 2026-05-08 | Sales keeps manual override over document-fee lines | AXON can prefill By Lot / Batch fee items, but sales must add/edit/delete/redistribute based on customer-specific quotation rules |
| 2026-05-07 | ใช้ URL search params แทน local state สำหรับ selectedSupplier | Page refresh ต้อง restore workspace state ได้ |
| 2026-05-07 | ใช้ module-level `EMPTY_ATTACHMENTS` constant ใน ItemForm | `= []` literal ทำให้ useEffect infinite loop เพราะ reference ใหม่ทุก render |
| 2026-05-07 | `turbopack.resolveAlias` pin tailwindcss/tw-animate-css | Turbopack หา package ผิดที่เมื่อมี root package-lock.json |
| 2026-05-06 | Bulk Cost Step 1 ใช้ two-row quote layout | Row 1: Purchase Term/Ship Mode/Location; Row 2: PKH SOC / FR CC TT / Currency Exchange Rate |
| 2026-05-06 | Manager confirmed OP1 formula | `OP1 (THB) = (PCS + PKH + SOC + COC + Mill + Test Cert + COO + Any Other) * Exchange Rate` |
| 2026-05-08 | Document fee basis split | Per Each / UOM By Each document fees enter OP1; By Lot / Batch certificate/test fees become separate new line items and must not be allocated into product OP1 |
| 2026-05-07 | Quote-level fields confirmed | Currency, Order Term, and Location are shared by all lines in the same quotation; mixed extracted values must be split or resolved before CAL |
| 2026-05-07 | Access model clarified | Authenticated domain/catalog users can access normal work; manager/supervisor remain elevated for delete/approval/admin actions |
| 2026-05-14 | Bulk Cost Phase 3A persistence | Store `BulkCostRun` + `DraftItem` + `DraftTerm` draft snapshots in `PART_CATALOG_AIX`; `BulkCostLine` removed from live schema; avoid master DB writes before Awarded |
| 2026-05-08 | Bulk Cost status lifecycle | `DRAFT -> QUOTED -> AWARDED -> REVERSE_MAPPED -> LOST -> ARCHIVED`; current implementation starts with `DRAFT` |
| 2026-05-08 | AXON matching hints hidden | Persist `UniqueLineID`, `MatchMethod`, `MatchConfidence` behind the scenes; sales UI does not confirm them |
| 2026-05-08 | Bulk Cost Qty ownership | AXON provides suggested `QuotedQty` or `RfqQty`; sales users verify and edit instead of entering Qty from blank every time |
| 2026-05-04 | Bulk Cost final result คือ 1 editable row per source item/term | User confirmed: output ต้อง split เป็น item/term rows พร้อม price per 1 piece |
| 2026-05-04 | Origin = read-only; Latest = editable; Latest เท่านั้นที่ใช้ CAL | ต้องเก็บต้นฉบับจาก AXON/Excel ไว้เปรียบเทียบ |
| 2026-05-04 | Replace Next.js rewrites ด้วย BFF route handler | Superseded: current active frontend origin is Next `3010` |
| 2026-04-30 | Bulk Cost แยกจาก master Item/Term (superseded 2026-05-14) | ไม่เขียน `@POITM` / `@PITM1` ก่อน Awarded; persistence จริงใช้ `PART_CATALOG_AIX` tables `BulkCostRun` / `DraftItem` / `DraftTerm` |
| 2026-04-30 | Auth เป้าหมายต้องเปลี่ยน — ไม่ใช้ Windows/IIS auth เก่า | Windows auth ยึดติดกับ IIS มากเกินไปสำหรับ future AI/agent identity |
| 2026-04-30 | Next.js BFF/Shell + Express core (ไม่ big-bang migrate) | ลด risk, รักษา UI parity, rollback ได้ |
| 2026-04-29 | Bulk Cost เป็น Phase 2 หลัง UAT รอบแรก | ไม่ให้กระทบ Phase 1 UAT |
| 2026-04-29 | CC (Custom Clear) จัดสรรตามน้ำหนัก ไม่ใช่ตามมูลค่า | ตาม spec business |
| 2026-04-29 | Prisma deferred — เริ่มด้วย mssql เดิม | ลด scope ก่อน ค่อยเปลี่ยนทีหลัง |

---

## 6. งานถัดไปที่เหมาะสม

### Phase 2 Next.js Migration

- [ ] ทำ UI parity checklist สำหรับ Item/Term (เทียบ next-shell กับ legacy SPA)
- [ ] ตัดสินใจ entry point: user เข้าที่ Next.js แทน SPA ใน production
- [ ] วางแผน deployment topology

### Bulk Cost

- [x] Build CWeight local research module/tests: formula, divisor, rounding, ship mode, dim unit, matching fields
- [x] Add backend-only CWeight wrapper service without route/UI integration
- [x] Add backend-only local `[GRAINGER].[dbo].[@GRAINGER_CWEIGHT]` exact lookup composition without route/UI integration
- [x] Add backend-only `POST /api/cweight/resolve` endpoint without UI/Next.js integration
- [x] Add backend-only Bulk Cost CWeight prefill helper without save/UI/Next.js integration
- [x] Validate compiled Bulk Cost CWeight prefill helper against live `[GRAINGER].[dbo].[@GRAINGER_CWEIGHT]`
- [x] Validate compiled backend CWeight lookup against live `[GRAINGER].[dbo].[@GRAINGER_CWEIGHT]`
- [x] Confirm AIX `GraingerWeightData` staging table is not needed for the active CWeight path
- [ ] Wire CWeight lookup endpoint later only after business approval; source should be `[GRAINGER].[dbo].[@GRAINGER_CWEIGHT]`
- [ ] Connect real AXON data source (replace AxonExtractionQueue seed data with live AXON push)
- [ ] Design Awarded reverse mapping flow before creating award/reverse-map endpoint
- [ ] คุยกับผู้บริหารเรื่อง UI acceptance + Golden Case verification สำหรับ document fee basis
- [ ] E2E test: full allocation → save snapshot flow

### AI-Assisted Workflow (ระยะยาว)

- [ ] ออกแบบ auth model ใหม่ (รองรับ service account + AI agent identity)
- [ ] สร้าง structured error codes
- [ ] สร้าง audit trail layer
- [ ] สร้าง agent-safe operation layer
