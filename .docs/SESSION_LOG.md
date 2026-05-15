# Session Log

Updated: 2026-05-15

## 2026-05-15

- Reviewed current Bulk Cost formula/display issue around FR, CC, TT, SPK, and
  QOC.
- Confirmed SPK/QOC are fixed THB adders after QLC conversion, not percentages.
- Committed `82007fc fix: clarify bulk cost currency display`.
- Verification for `82007fc` passed:
  - `npm run typecheck`
  - `npm test` with server 104 + next-shell 65
  - `npm run build`
- User then requested Bulk Cost Step 3 to Term mapping work:
  - OP1 section should include Documents Fees.
  - `OP1 Src` should become `OP1 (PSC)`.
  - Step 3 should include Currency.
  - Exwork should not show in Review.
  - Freight/weight section should include Chargeable Wt/Ea and align labels
    with Term.
  - `FR Actual (THB)` should become `FR QTEC`.
  - Draft preview should align with Term, and `Valid From` must always exist.
- User then instructed pre-quota shutdown mode:
  - Do not start feature work.
  - Do not refactor application logic.
  - Update only documentation/instructions necessary for safe handoff.
- Repo inspection found one generated uncommitted file:
  - `next-shell/next-env.d.ts`.
- Continued after quota warning because the owner asked to keep going.
- Implemented the safe Bulk Cost Step 3 mapping pass:
  - Review includes document-fee total, Currency, `OP1 (PSC)`, and `FR QTEC`.
  - Exwork is hidden from Review and remains in Formula/Audit.
  - Step 2 weight preset includes read-only `Chargeable Wt/Ea`.
  - Term preview form data supplies a default `Valid From`.
  - Backend Term calculation accepts optional `U_DocFees` / `U_FEES` /
    `U_Fees`, defaulting to zero.
- Focused verification passed:
  - `npm.cmd --prefix next-shell test -- --run bulk-cost-final-result bulk-cost-calc bulk-cost-api`
  - `npm.cmd --prefix next-shell run typecheck`
  - `npm.cmd --prefix server test -- --run calculation.service` (outside sandbox after config access denial)
- Full verification passed:
  - `npm.cmd run typecheck`
  - `npm.cmd test` with server 105 + next-shell 66
  - `npm.cmd run build`
- Browser check was attempted again through the in-app browser against
  `http://127.0.0.1:3010/bulk-cost?...`; the browser environment blocked the
  local page with `net::ERR_BLOCKED_BY_CLIENT`.
- Continued with DraftTerm save parity:
  - `server/src/repositories/bulk-cost.repository.ts` now binds `U_ValidFrom`
    as the server save date.
  - `server/src/queries/domains/bulk-cost/bulk-cost.write.ts` inserts
    `U_ValidFrom` into DraftTerm.
  - Added `server/src/__tests__/bulk-cost-write-sql.test.ts`.
  - Focused verification passed:
    `npm.cmd --prefix server test -- --run bulk-cost-write-sql calculation.service`.
  - Full verification passed:
    `npm.cmd run typecheck`, `npm.cmd test` with server 106 + next-shell 66,
    and `npm.cmd run build`.

## Browser Note

During the previous implementation, the in-app browser automation connected but
opening `http://localhost:3010/bulk-cost` was blocked by the browser environment
with `net::ERR_BLOCKED_BY_CLIENT`. Tests/build passed, but no browser visual
confirmation was completed.
