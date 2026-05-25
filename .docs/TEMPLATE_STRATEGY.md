# Template Strategy

Last updated: 2026-05-25

Purpose: define how QTEC PartCatalog should use shared templates so humans and
AI agents build the same UI and calculation behavior repeatedly without
re-inventing structure each time.

## 1. Decision

Use two template layers:

1. **UI Component Templates** for consistent screens, forms, tables, and review
   flows.
2. **Calculation Templates** for consistent cost formulas, allocation basis,
   output columns, tests, and traceability.

Templates are not just visual examples. They are reusable contracts for agents:
read the template first, copy the pattern, then implement only the task-specific
fields and logic.

## 2. UI Component Templates

Base UI stack:

- Next.js App Router in `next-shell`
- Tailwind CSS 4
- shadcn/Radix primitives
- QTEC-specific spacing, table density, colors, and form layout

Create a small internal template registry before generating more screens.

Recommended initial templates:

| Template | Purpose | Current source candidate |
|---|---|---|
| `QtecPageShell` | Full-page app surface with toolbar/content split | `partcatalog`, `bulk-cost` pages |
| `QtecSearchPanel` | Search/filter/action header | Search and Allocation list |
| `QtecDataGrid` | Dense resizable data table with sticky columns | Search result grids, Bulk Cost line grids |
| `QtecFormSection` | Label/input rows matching Item/Term style | Item/Term forms |
| `QtecWorkspaceSteps` | 3-step working-space layout | Cost Workspace |
| `QtecReviewTable` | Grouped result/review table | Bulk Cost Step 3 |
| `QtecStatusBadge` | Draft/calculated/finalized/status indicators | Bulk Cost and future Review/Finalize |

The template registry can be exposed through an internal route such as `/menu`
or `/templates` as a gallery/check page. This route should be internal only and
should not become a business workflow.

## 3. UI Agent Workflow

For new screens:

1. Owner/Codex defines the business purpose, field contract, and acceptance
   rules.
2. Agent reads this file plus the closest existing template.
3. Agent implements the page using the template structure.
4. Visual polish can be delegated to Gemini/Antigravity after structure and
   behavior are correct.
5. Codex or the owner verifies no business logic, field mapping, auth behavior,
   or calculation semantics changed during visual polish.

Use Gemini/Antigravity mainly for:

- spacing and visual density
- Thai label readability
- table/header polish
- responsive fit
- empty/loading/error states

Reserve Claude Opus or high-reasoning agents for:

- architecture decisions
- formula and persistence behavior
- security/auth review
- schema and migration review
- difficult cross-module debugging

## 4. Calculation Templates

Calculation templates are backend/business contracts, not UI decoration.

Current source of truth:

- Term calculation remains backend source of truth.
- Cost Workspace/Bulk Cost calculation must call backend/shared calculation
  services and stay aligned with Term/Excel parity tests.
- Frontend formula helpers are diagnostics or tests only unless explicitly
  promoted to backend/shared source of truth.

Initial calculation template shape:

| Area | Template requirement |
|---|---|
| Inputs | All required Item/Term/Workspace fields, with source and editability |
| Cost basis | Header vs line, supplier currency vs THB, allocation basis |
| Allocation | By weight, by value, or line-specific |
| Output | Final per-line values ready for Review/Finalize |
| Persistence | Draft/Snapshot first; no master Item/Term write |
| Tests | Golden cases, formula audit, edge cases |
| Traceability | Saved revision metadata and full input/output snapshot |

Core allocation conventions:

- PKH / SOC / FR / CC: allocate by weight unless business rule says otherwise.
- Wire TT: allocate by value.
- Document/service fees: preserve explicit line/lot basis; do not hide them in
  SAP-limited fields during workspace calculation.
- SAP-limited mapping happens later at Review/Finalize/Master-write time.

## 5. What Not To Template

Do not use templates to bypass decisions.

- Do not use a UI template to change formula behavior.
- Do not use a calculation template to write `@POITM` / `@PITM1` before
  Review/Finalize, reverse mapping, and business/order gate approval.
- Do not let visual-polish agents rename database-bound fields casually.
- Do not cache draft workspace state, CAL results, or save/revision flows just
  because a UI template uses caching elsewhere.

## 6. 20-Day Delivery Focus

With about 20 days remaining, treat templates as accelerators only if they keep
scope smaller.

Must finish first:

1. Agent-ready docs and prompts.
2. Cost Workspace field coverage.
3. Manual Workspace calculation and UI correctness.
4. Draft/Snapshot persistence clarity.
5. Auth/deploy hardening plan and minimum implementation.
6. Review/Finalize design enough to prevent accidental master writes.

Defer if schedule tight:

- Full UI template gallery beyond the minimal `/menu` or `/templates` reference.
- Better Auth migration.
- Full AXON automation.
- Full AI CWeight web-search automation.
- Large design-system refactor.
