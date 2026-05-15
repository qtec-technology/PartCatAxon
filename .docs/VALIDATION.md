# Validation

Updated: 2026-05-15

## Required Validation Before Code Handoff

From repository root:

```powershell
npm run typecheck
npm test
npm run build
```

If sandboxed test execution fails while loading `server/vitest.config.ts` with
an access-denied error, rerun `npm.cmd test` outside the sandbox if the user
approves.

## Last Known Full Verification

For the latest Bulk Cost Step 3 mapping pass before commit:

```text
npm run typecheck: passed
npm test: passed, server 105 + next-shell 66
npm run build: passed
```

## Focused Bulk Cost Tests Used Recently

```powershell
npm.cmd --prefix next-shell test -- --run bulk-cost-final-result bulk-cost-calc
npm.cmd --prefix next-shell test -- --run bulk-cost-calc bulk-cost-formula-audit
npm.cmd --prefix next-shell test -- --run bulk-cost-formula-audit bulk-cost-final-result
```

## Validation Guidance For Next Work

- Label-only Bulk Cost changes: run focused next-shell tests first, then full
  verification before commit.
- Formula changes: add or update backend Term tests and frontend Bulk Cost
  audit tests before changing implementation.
- Persistence changes: add server mapper/repository tests and confirm no write
  touches `@POITM` / `@PITM1`.
- Browser verification is useful for Step 3 display changes, but do not rely on
  it as the only validation.
