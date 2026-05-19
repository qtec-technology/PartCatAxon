# Automation Readiness Plan

Last updated: 2026-05-19

Pi-Jo's warning is correct: PartCatalogAxon will be hard to automate if the
system remains a set of page-specific flows. Automation requires clear modules
and backend operations that can be called by UI, scheduled jobs, or future AI
agents without relying on browser clicks.

## Goal

```text
Human-first now
Automation-ready later
```

Sales users still review and approve work in the UI, but every important action
must map to a backend operation with clear inputs, outputs, permissions, and
audit.

## Why Module Split Matters

Automation becomes fragile when business behavior exists only inside UI
components or ad hoc route handlers. The risks are:

- AI or scheduled jobs must imitate browser clicks.
- Calculation can drift between preview, save, and later reverse mapping.
- Auth cannot distinguish a human user from a service action.
- Audit cannot explain what changed, why, and from which source.
- AXON handoff cannot be traced from `ChainId` to final Item/Term work.

## Required Module Layers

```text
UI Layer
  -> calls operation layer

Operation Layer
  -> validates actor + workflow state
  -> coordinates domain services
  -> writes audit

Domain Services
  -> calculation, clone, snapshot, item/term rules

Repositories
  -> SQL Server queries and transactions

External/Shared Sources
  -> AXON read-only views, SAP-side lookup tables, UNC file shares
```

## Target Operations

These are the backend operations that should exist before real automation:

| Operation | Purpose | Automation Status |
|---|---|---|
| `loadAxonComparison(chainId)` | Read AXON final comparison by `ChainId` | Needed for AXON handoff |
| `cloneAxonComparison(chainId, sourceRevision)` | Create immutable Origin snapshot and editable Latest copy | Needed before real Bulk Cost entry |
| `calculateBulkCost(runId)` | Run authoritative Bulk Cost calculation | Must be backend/shared before Award automation |
| `saveBulkCostDraft(runId)` | Persist draft snapshots | Exists partially through API, should be operation-owned |
| `markQuoted(runId)` | Mark sales quotation stage | Needs workflow rule |
| `requestAwardApproval(runId)` | Start approval without SAP write | Design needed |
| `reverseMapAwardedRun(runId)` | Create/update Item/Term after approval | Do not implement until insert/update rules are approved |

## Actor Model

Every operation must accept or derive an actor:

```text
actorType = human | service | ai_assistant
actorId
displayName
sourceSystem
```

Current Windows/domain-style auth can remain during stabilization, but the
operation layer must not assume every caller is an interactive browser user.

## Audit Requirement

Every automation-ready operation must be able to answer:

- Which `ChainId` was used?
- Which AXON comparison revision/source line was cloned?
- What did Origin contain?
- What did the user or service change in Latest?
- Which calculation version produced Result?
- Who approved or rejected the action?
- Was anything written to Item/Term master?

## Reset Scope

This plan does not require a full rewrite today. The immediate work is:

1. Keep existing Express API and raw `mssql`.
2. Add operation boundaries around the existing routes/services.
3. Move browser-only business logic toward backend/shared services only where it
   blocks handoff, calculation correctness, or future automation.
4. Keep AXON pipeline ownership outside PartCatalogAxon.
