# Agent Situation

Updated: 2026-05-15

## Current Mode

Final handoff before a 5-day token-limit reset. GitHub Copilot in VS Code may
take over temporarily. Preserve continuity for Codex, Copilot, Claude, and
other agents.

## Repository State At Handoff

- Branch observed: `codex/docs-cweight-scope`
- Latest commit observed: `a0a10d0 fix: persist bulk cost draft term valid from`
- Recent commits:
  - `a0a10d0 fix: persist bulk cost draft term valid from`
  - `e5564ca fix: align bulk cost step 3 term mapping`
  - `8d0e7c5 docs: add agent handoff state`
  - `82007fc fix: clarify bulk cost currency display`
  - `18911e9 fix: split bulk cost freight persistence mapping`
  - `69afede fix: display allocated freight in bulk cost results`
  - `535d3cf test: add bulk cost formula audit`
  - `06bba56 fix: lock bulk cost final result mapping`
- `git status --short` before this handoff was clean.

## Non-Negotiable Rules

- Active frontend is `next-shell/`; backend is `server/`.
- Do not reintroduce old `client/` into normal dev/build/deploy work.
- Term calculation remains backend source of truth:
  `server/src/services/calculation.service.ts`.
- Bulk Cost CAL currently still runs in frontend pure functions and has a
  temporary audit guard.
- Do not overwrite `@POITM` / `@PITM1`.
- Do not change Award/SAP write flow.
- Do not create reverse mapping until Awarded architecture is explicitly
  designed.
- Before handing off code work, run:
  - `npm run typecheck`
  - `npm test`
  - `npm run build`

## Current Business Context

Bulk Cost Step 3 has been mapped closer to the Term page:

- Review shows `Documents Fees (FEES)`, `Currency`, `OP1 (PSC)`, and `FR QTEC`.
- `Exwork` is hidden from Review but remains in Formula/Audit diagnostics.
- Step 2 Weight view shows read-only `Chargeable Wt/Ea`.
- Term preview supplies default `Valid From`.
- DraftTerm save persists `U_ValidFrom` using the server save date.
- Backend Term calculation accepts optional document fees, defaulting to zero.

Remaining high-level target: move Bulk Cost calculation to backend/shared source
of truth before Award/SAP automation.
