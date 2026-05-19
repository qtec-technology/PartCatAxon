# Module Boundaries

Last updated: 2026-05-19

This document defines the intended module boundaries for the architecture reset.
It is a cleanup guide, not a command to move every file at once.

## Principles

- Keep working code stable while making ownership explicit.
- Move logic only when there is a test or clear behavior check around it.
- Domain services should be callable by UI and future automation without
  browser-only assumptions.
- Repositories own SQL and persistence. Services own business rules.
- AI/AXON suggestions are inputs, not final decisions.
- Module split is required for future automation. If a business action cannot be
  called without browser interaction, it is not automation-ready.

Read `.docs/AUTOMATION_READINESS.md` for the operation-layer target.

## Server Modules

| Module | Owns | Must Not Own |
|---|---|---|
| `auth` | User identity, domain/header auth, future service identity | Business decisions |
| `db` | SQL connection, transaction helpers, SQL Server config | Feature-specific SQL |
| `files` | UNC file writes, path guards, attachment storage access | Attachment metadata rules |
| `audit` | Change metadata, actor/action/source trace | Calculation logic |
| `lookup` | Shared lookups and cache policy | Feature workflows |
| `item` | Item CRUD and validation | Bulk Cost reverse mapping decisions before approved |
| `term` | Term CRUD and backend calculation source of truth | AXON extraction |
| `attachment` | Attachment metadata + file coordination | Item/Term form state |
| `calculation` | Shared calculation primitives/source of truth | UI display formatting |
| `bulk-cost` | Costing run, snapshot, allocation workflow | AXON RFQ lifecycle |
| `axon-handoff` | Read-only AXON comparison access by `ChainId` | AXON pipeline execution |

## Next.js Modules

| Module | Owns |
|---|---|
| `features/partcatalog` | Search and catalog browsing |
| `features/item` | Item page UI |
| `features/term` | Term page UI |
| `features/bulk-cost` | Costing workspace UI |
| `features/axon-handoff` | Chain inbox/comparison clone UI |
| `components/ui` | Shared UI primitives |
| `lib/api` | BFF/API clients and response mapping |
| `lib/auth` | Client-side auth context and permissions |

## Operation Layer Target

Future automation must call the same backend operations as the UI. The target
operation names are:

```text
loadAxonComparison(chainId)
cloneAxonComparison(chainId, sourceRevision)
calculateBulkCost(runId)
saveBulkCostDraft(runId)
markQuoted(runId)
requestAwardApproval(runId)
reverseMapAwardedRun(runId)  // design only until approved
```

These operations should:

- be implemented as backend operations before being exposed to UI or automation
- accept an actor/service identity
- validate permissions
- write audit records
- return structured errors
- never require browser automation for core business logic

## Cleanup Rules

- Retired `client/` references must be removed from normal dev/build/deploy docs
  and scripts.
- Mock data may remain in tests or explicit local dev fixtures, but production
  paths must not silently fall back to mock data.
- Frontend-only business logic should be treated as temporary if it affects
  persistence, automation, or SAP mapping.
- Bulk Cost calculations must be revision/snapshot based. Do not lock a
  calculation to one immutable `JobId`, job name, or `ChainId` primary key;
  sales must be able to recalculate after supplier data, line selection,
  payment split, shipment split, or cost allocation assumptions change.
