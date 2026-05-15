# Tasks

Updated: 2026-05-15

## Ready For Copilot

These are small, isolated, low-risk tasks. Copilot may do them only after
reading `.docs/HANDOFF.md` and checking `git status`.

- [ ] Ready for Copilot: Investigate current Bulk Cost Step 3 visible columns.
  Produce a short note listing existing keys in `REVIEW_RESULT_KEYS`,
  `FORMULA_RESULT_KEYS`, and final-result column definitions. No code changes.
- [ ] Ready for Copilot: Add or update tests that assert display labels only,
  without changing formula math. Candidate files:
  `next-shell/tests/unit/bulk-cost-final-result.test.ts`.
- [x] Ready for Copilot: Rename display-only header `OP1 Src` to `OP1 (PSC)`
  if it maps only to the existing diagnostic `op1Source` field. Do not change
  formula math. Run focused tests.
- [x] Ready for Copilot: Add `Currency` to Step 3 Review display only if the
  field already exists in `FinalResultColumns` and no persistence contract
  changes are needed. Run focused tests.
- [x] Ready for Copilot: Hide `Exwork` from the Review table only if it remains
  available in Formula/Audit diagnostics. Do not remove it from calculation or
  audit data.
- [x] Ready for Copilot: Prepare a markdown mapping table in
  `.docs/BULK_COST.md` and `.docs/BULK_COST_CALCULATION.md` after code behavior
  is confirmed.
- [x] Ready for Copilot: Ensure Bulk Cost Term preview form data supplies a
  default `Valid From` date. DraftTerm save/database validity mapping remains
  reserved for Codex.

## Reserved For Codex

These are architecture, formula, persistence, or high-risk tasks.

- [x] Reserved for Codex: Add `Documents Fees (FEES)` to backend Term formula.
  This affects `server/src/services/calculation.service.ts`, API input mapping,
  tests, and Term parity with legacy data.
- [ ] Reserved for Codex: Decide whether Bulk Cost document fees should become
  Term formula input fields, separate line items, or both depending on fee basis.
- [x] Reserved for Codex: Add `Chargeable Wt/Ea` as an explicit Step 2 field and
  decide whether it is calculated, editable, persisted, or only displayed.
- [x] Reserved for Codex: Rename `FR Actual (THB)` to `FR QTEC` across final
  result, DraftTerm preview, persistence semantics, and formula audit without
  reintroducing the earlier `U_FR` vs `U_FreightQTEC` confusion.
- [ ] Reserved for Codex: Make `Valid From` mandatory for Bulk Cost DraftTerm
  preview/save, including defaulting rules and database mapping.
- [ ] Reserved for Codex: Design the best preview/save path that uses the
  backend Term formula source of truth instead of duplicating Term logic in the
  frontend.
- [ ] Reserved for Codex: Move Bulk Cost calculation to backend/shared before
  Award/SAP automation.
- [ ] Reserved for Codex: Any change touching Award/SAP write flow,
  `@POITM`, `@PITM1`, reverse mapping, or DraftTerm database schema.

## Do Not Start Until Clarified

- [x] Clarify whether `OP1 (PSC)` is the intended label or whether it is a typo
  for `OP1 (PCS)`. Current implementation follows the user's explicit
  `OP1 (PSC)` wording.
- [ ] Clarify whether mixed-currency Step 2 costs are expected now or remain
  manually normalized before CAL.
