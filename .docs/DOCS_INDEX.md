# Documentation Index And Cleanup Map

Last updated: 2026-05-25

Purpose: keep agents from reading stale documents as if they were current
truth. This file classifies docs by status and tells agents what to read first.

## Status Labels

| Status | Meaning |
|---|---|
| `ACTIVE` | Current source of truth. Keep updated. |
| `REFERENCE` | Useful background, but not the first source of truth. |

## Always Read First

| File | Status | Role |
|---|---|---|
| `AGENTS.md` | ACTIVE | Repo-level instructions and commands |
| `.docs/AGENT_START_HERE.md` | ACTIVE | First agent entry point |
| `.docs/SYSTEM_OVERVIEW.md` | ACTIVE | Whole-system business and technical overview |
| `.docs/FEATURE_STATUS.md` | ACTIVE | Workstream status and decision log |
| `.docs/ROADMAP.md` | ACTIVE | Phase plan and next work |

## Architecture

| File | Status | Notes |
|---|---|---|
| `.docs/SYSTEM_OVERVIEW.md` | ACTIVE | Whole-system overview: modules, flows, data ownership, current status |
| `.docs/COST_WORKSPACE_ARCHITECTURE.md` | ACTIVE | Current Cost Workspace decision |
| `.docs/ARCHITECTURE.md` | ACTIVE | Technical architecture |
| `.docs/EXECUTIVE_ALIGNMENT.md` | ACTIVE | Executive direction from meetings |
| `.docs/MODULE_BOUNDARIES.md` | ACTIVE | Module ownership and automation boundaries |
| `.docs/AUTOMATION_READINESS.md` | ACTIVE | Future agent/automation rules |
| `.docs/OPERATION_LAYER_DESIGN.md` | ACTIVE | Operation-service direction |
| `.docs/TEMPLATE_STRATEGY.md` | ACTIVE | Shared UI and calculation template strategy for humans and agents |

## Cost Workspace / Bulk Cost

| File | Status | Notes |
|---|---|---|
| `.docs/COST_WORKSPACE_FIELD_COVERAGE.md` | ACTIVE | Field matrix for schema/UI/finalize planning |
| `.docs/TEMPLATE_STRATEGY.md` | ACTIVE | Calculation template and UI template guardrails |
| `.docs/BULK_COST.md` | ACTIVE | Current implementation guide; still uses legacy route/code names |
| `.docs/BULK_COST_CALCULATION.md` | ACTIVE | Formula and Term reconciliation reference |
| `.docs/BULK_COST_TEST_DATA_AUDIT.md` | REFERENCE | Golden-case coverage and missing export notes; use only after active formula docs |

## AXON

| File | Status | Notes |
|---|---|---|
| `.docs/AXON_HANDOFF_CONTRACT.md` | ACTIVE | Current ChainId/shared-view contract |

## Data / DB / Cleanup

| File | Status | Notes |
|---|---|---|
| `.docs/DATA_SCHEMA.md` | ACTIVE | Item/Term DB mapping source |
| `.docs/CLEANUP_INVENTORY.md` | ACTIVE | Cleanup/dead-code/drop-candidate plan |
| `.docs/DEPLOYMENT_RUNBOOK.md` | ACTIVE | Nginx/NSSM/proxy target |
| `.docs/CWEIGHT_DECISION_NOTE.md` | ACTIVE | CWeight module decision |
| `.docs/CWEIGHT_EVALUATION.md` | ACTIVE | CWeight evaluation notes |

## Handoff / Session Utilities

| File | Status | Notes |
|---|---|---|
| `.docs/DOCS_INDEX.md` | ACTIVE | This map; use to decide which docs are current vs reference |
| `.docs/PROMPTS.md` | ACTIVE | Agent startup and scoped task prompts |

## Cleanup Rules

Do not delete docs only because they look old. First:

1. Confirm the active replacement.
2. Search references with `rg`.
3. Move content still needed into active docs.
4. Ask the owner before deleting large historical files.

Historical handoff and scratch documents have been removed from the working
tree. Do not recreate them or reference them from prompts/startup instructions.
