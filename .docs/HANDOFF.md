# Handoff

Updated: 2026-05-15

## Immediate Restart Checklist

1. Run `git status --short`.
2. Inspect any modified files before editing. At this handoff, the worktree was
   clean.
3. Read:
   - `AGENTS.md`
   - `CLAUDE.md`
   - `.github/copilot-instructions.md`
   - `.docs/FEATURE_STATUS.md`
   - `.docs/BULK_COST.md`
   - `.docs/BULK_COST_CALCULATION.md`
   - `.docs/AXON_INTEGRATION.md`
4. Reconcile any commits made by Copilot/other agents since `a0a10d0`.
5. Only then decide whether to continue Bulk Cost architecture work.

## Last Completed Work

Latest completed commits:

- `a0a10d0 fix: persist bulk cost draft term valid from`
  - Bulk Cost DraftTerm save inserts `U_ValidFrom`.
  - Default is server save date.
  - `U_ValidTo` remains null until business default is confirmed.
- `e5564ca fix: align bulk cost step 3 term mapping`
  - Review shows document-fee total, Currency, `OP1 (PSC)`, and `FR QTEC`.
  - Exwork is hidden from Review but kept in Formula/Audit.
  - Step 2 Weight view includes read-only `Chargeable Wt/Ea`.
  - Term preview supplies default `Valid From`.
  - Backend Term calculation accepts optional document fees defaulting to zero.
- `82007fc fix: clarify bulk cost currency display`
  - Step 2 Cost Bar inputs show selected quote currency.
  - Final output labels identify THB-valued fields.
  - SPK/QOC are fixed THB adders, not percentages.
- Full verification for latest pass:
  - `npm run typecheck`
  - `npm test` with server 106 + next-shell 66
  - `npm run build`

## User Request Preserved And Mostly Implemented

The user wants Bulk Cost Step 3 mapped to the Term page. Their requested mapping
starts with these areas.

### 1. Order Price OP1

Term fields / Bulk Cost Step 3 fields:

| Term | Bulk Cost Step 3 |
|---|---|
| Product Cost (PCS) | PCS |
| Packing Handling (PKH) | PKH |
| Supplier Outb Cost (SOC) | SOC |
| Documents Fees (FEES) | FEES |
| Order Price (OP1) (PCS) | OP1 (PSC) |
| Currency | Currency |
| Exchange Rates (Ex. Rate) | EX.RATE |
| Order Price (OP1) (THB) | OP1 (THB) |

Requested notes and status:

- Add a `Documents Fees (FEES)` column to OP1 and adjust the Term formula:
  implemented as a diagnostic final-result field and optional backend Term calc
  input that defaults to zero.
- In Bulk Cost, change header `OP1 Src` to `OP1 (PSC)`: implemented.
- Add `Currency` in Bulk Cost Step 3 table: implemented.
- Do not show `Exwork` in Review: implemented; still in Formula/Audit.

### 2. Freight To QTEC FR

Term fields / Bulk Cost Step 3 fields:

| Term | Bulk Cost Step 3 |
|---|---|
| Ship Mode | Ship Mode |
| Dimensions | Dim Unit |
| Length | Length |
| Width | Width |
| Height | Height |
| Dim Weight (DW) | Dim Wt/Ea |
| Item Weight (KG) | Item Wt/Ea |
| Chargeable W (KG) | Chargeable Wt/Ea |
| Shipping Weight | Ship Wt/Ea |
| Freight to QTEC WH | FR Actual (THB) |

Requested notes and status:

- Add `Chargeable Wt/Ea` support for Step 2 automatic weight calculation:
  implemented as read-only derived display from max item/dim weight before
  shipping-weight ceiling.
- Rename `FR Actual (THB)` to `FR QTEC`: implemented.
- Step 3 should show all fields useful for mapping to Term: partially
  implemented; continue carefully if more fields are requested.
- Draft preview labels should align with Term: partially implemented.
- `Valid From` must always be present: preview and DraftTerm save implemented.
- Since the Term page already has the formula, find the safest preview/save
  path that respects database persistence: still open as architecture work.

## Key Interpretation

The completed work intentionally avoided Award/SAP and master table writes.
Remaining work is not one safe UI-only task. It includes:

- Bulk Cost parity/audit changes.
- Whether Bulk Cost should call backend Term formula for preview/save.
- Whether document fees should be persisted in DraftTerm as a formal column or
  remain snapshot/diagnostic until a schema decision is made.
- Moving Bulk Cost calculation to backend/shared before Award/SAP automation.

Do not implement all at once. Split and test.
