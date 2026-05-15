# Handoff

Updated: 2026-05-15

## Immediate Restart Checklist

1. Run `git status --short`.
2. Inspect any modified files before editing. At this handoff,
   `next-shell/next-env.d.ts` had generated Next.js churn.
3. Read:
   - `AGENTS.md`
   - `CLAUDE.md`
   - `.github/copilot-instructions.md`
   - `.docs/FEATURE_STATUS.md`
   - `.docs/BULK_COST.md`
   - `.docs/BULK_COST_CALCULATION.md`
   - `.docs/AXON_INTEGRATION.md`
4. Reconcile any commits made by other agents since `82007fc`.
5. Only then decide whether to implement Bulk Cost Step 3 mapping changes.

## Last Completed Work

Commit `82007fc fix: clarify bulk cost currency display`:

- Step 2 Cost Bar inputs show selected quote currency.
- Final AY-CP and Term preview labels identify THB fields for FR, CC, TT, SPK,
  and QOC.
- SPK/QOC were confirmed as fixed THB adders, not percentages.
- Verification passed:
  - `npm run typecheck`
  - `npm test` with server 104 + next-shell 65
  - `npm run build`

## New User Request To Preserve

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

Requested notes:

- Add a `Documents Fees (FEES)` column to OP1 and adjust the Term formula.
- In Bulk Cost, change header `OP1 Src` to `OP1 (PSC)`.
- Add `Currency` in Bulk Cost Step 3 table.
- Do not show `Exwork` in Review.

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

Requested notes:

- Add `Chargeable Wt/Ea` support for Step 2 automatic weight calculation.
- Rename `FR Actual (THB)` to `FR QTEC`.
- Step 3 should show all fields that are useful for mapping to Term.
- Draft preview labels should align with Term.
- `Valid From` must always be present.
- Since the Term page already has the formula, find the safest preview/save
  path that respects database persistence.

## Key Interpretation

This is not one safe UI-only task. It includes:

- Display label changes.
- Step 3 table column composition.
- Backend Term formula changes for document fees.
- Bulk Cost parity/audit changes.
- DraftTerm persistence requirements.
- Potential DB schema or mapping changes around validity dates.

Do not implement all at once. Split and test.

