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

## Browser Note

During the previous implementation, the in-app browser automation connected but
opening `http://localhost:3010/bulk-cost` was blocked by the browser environment
with `net::ERR_BLOCKED_BY_CLIENT`. Tests/build passed, but no browser visual
confirmation was completed.

