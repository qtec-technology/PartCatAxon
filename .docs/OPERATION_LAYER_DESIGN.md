# Operation Layer Design

Last updated: 2026-05-19

This document maps the automation-readiness plan to the current codebase. It is
the bridge between architecture docs and implementation.

## Current First Step

`server/src/services/bulk-cost-operation.service.ts` is the first operation
boundary for Bulk Cost. Controllers should call operations instead of reaching
repositories directly.

Current wrapper operations:

| Operation service function | Current repository behavior | Future role |
|---|---|---|
| `listAxonQueueForReview()` | Reads existing AIX queue rows | Superseded by `loadAxonComparison(chainId)` once AXON view exists |
| `saveBulkCostDraft(input, actor)` | Creates `BulkCostRun` + `DraftItem` + `DraftTerm` | Becomes audited `saveBulkCostDraft(runId)` operation |
| `listBulkCostRuns(input)` | Lists saved runs | Remains read operation |
| `loadBulkCostRun(runId)` | Loads saved run + snapshots | Used by UI restore and future automation review |
| `markBulkCostRunStatus(runId, status, actor)` | Marks DRAFT as AWARDED/LOST | Will split into quote/award/approval operations |

## Actor Boundary

The operation layer now accepts an `OperationActor` shape:

```typescript
type OperationActorType = 'human' | 'service' | 'ai_assistant';

interface OperationActor {
  type: OperationActorType;
  displayName: string;
  id?: string;
  sourceSystem?: string;
}
```

The current controller creates a human actor from the existing auth header. This
does not change current auth behavior, but it creates a place for future service
and AI actors.

## Next Code Slices

### Slice 1 — AXON Handoff Read Model

Add an `axon-handoff` server module:

```text
server/src/types/axon-handoff.types.ts
server/src/repositories/axon-handoff.repository.ts
server/src/services/axon-handoff-operation.service.ts
server/src/routes/axon-handoff.routes.ts
server/src/controllers/axon-handoff.controller.ts
```

First operation:

```text
loadAxonComparison(chainId)
```

Status: scaffolded. The route is:

```text
GET /api/axon-handoff/comparisons/:chainId
```

It is read-only and targets Pi-Jo's final comparison views once these env vars
are set:

```text
DB_VIEW_AXON_FINAL_COMPARISON_HEADER
DB_VIEW_AXON_FINAL_COMPARISON_LINES
```

Until the view names are confirmed, the operation returns `501` instead of
querying a guessed object.

### Slice 2 — Clone Operation

After the read model is confirmed:

```text
cloneAxonComparison(chainId, sourceRevision, selectedLineIds, actor)
```

It should create:

- immutable Origin snapshot
- editable Latest snapshot
- `BulkCostRun` linked to `ChainId`
- source revision and AXON line ids on every line

### Slice 3 — Backend/Shared Calculation

Before Award/SAP automation:

```text
calculateBulkCost(runId, actor)
```

This should use a backend/shared calculation source of truth. The current
frontend Bulk Cost calculation remains a temporary preview path until this is
implemented.

## Rules

- Controllers do request parsing and HTTP response only.
- Operations own workflow state, actor, permission, and audit boundaries.
- Repositories own SQL.
- Domain services own calculation/mapping rules.
- No automation should write SQL directly or drive browser clicks for core
  business behavior.
