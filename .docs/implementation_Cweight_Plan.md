# CWeight Implementation Plan

> Last updated: 2026-06-02
> Status: SQL lookup phase active. Vector Search is deferred.

## Current Decision

CWeight lookup for PartCatalog must use:

```text
[PART_CATALOG_AIX].[dbo].[@GRAINGER_CWEIGHT]
```

Do not move CWeight lookup to a separate `[GRAINGER]` database in the current
PartCatalog runtime. The active server object is:

```ts
dbObjects.tables.qtec.cweight
```

This resolves through `DB_NAME_QTEC`, which is currently `PART_CATALOG_AIX`.

## Active Input Contract

Runtime callers may provide:

```text
supplierOrderCode
graingerNo
manufacturerPartNo
manufacturerName
description
category1
category2
category3
shipModeNo
```

For Bulk Cost prefill, user-entered item weight and dimensions are intentionally
not sent as direct-formula inputs. Bulk Cost prefill should search the reference
database first and let users decide whether to apply the suggestion.

## Active SQL Pipeline

The current pipeline is:

1. Direct Formula
   - Used only when explicit weight/dimension inputs are intentionally supplied.
   - Returns `AUTO_ACCEPT`.

2. Normalize Grainger No
   - `graingerNo` can be used as fallback for `supplierOrderCode`.

3. Exact SQL Match
   - Query `@GRAINGER_CWEIGHT` by Grainger No or MFG Part No.
   - MFG Part No + brand is the strongest manufacturer match.
   - Unique MFG Part No can be auto accepted.
   - Ambiguous MFG Part No returns `REVIEW_SUGGESTION`.

4. Normalized MFG Part No
   - Strips dash, dot, and space before comparing.
   - Always reviewable, not auto-accepted.

5. Description Keyword SQL
   - Uses significant keywords against `SHORT DESC`.
   - Optional `category1` narrows the result.
   - Always reviewable.

6. Vector Candidate Stub
   - Interface exists in `cweight-vector.service.ts`.
   - Current implementation returns `[]`.
   - No Qdrant/OpenAI runtime dependency is required in this phase.

7. Not Found
   - Returns `NOT_FOUND`.
   - UI should ask the user to enter/confirm weight manually.

## Decision Rules

```text
AUTO_ACCEPT:
  - direct_formula
  - exact Grainger No
  - exact MFG Part No + brand
  - unique exact MFG Part No

REVIEW_SUGGESTION:
  - ambiguous MFG Part No
  - normalized MFG Part No
  - description keyword
  - future vector candidate
  - future internet candidate

NOT_FOUND:
  - no usable SQL/vector/internet/manual evidence
```

## Current Code Map

```text
server/src/services/cweight.service.ts
  Result types and direct formula.

server/src/services/cweight-lookup.service.ts
  Orchestrates the lookup pipeline.

server/src/repositories/cweight.repository.ts
  SQL lookup against PART_CATALOG_AIX.dbo.@GRAINGER_CWEIGHT.

server/src/services/cweight-vector.service.ts
  Deferred vector interface. Stub returns [].

server/src/services/bulk-cost-cweight.service.ts
  Maps Bulk Cost line data into CWeight lookup input.

next-shell/src/features/bulk-cost/BulkCostWorkspace.tsx
  CWeight lookup buttons and suggestion UI.
```

## Deferred Vector Search Plan

Do not implement this until the owner explicitly approves Step 3.

Planned infrastructure:

```text
Qdrant collection: grainger_cweight
Embedding model: OpenAI text-embedding-3-large or approved successor
Payload: graingerNo, mfgPartNo, brand, category1, shortDesc
```

Planned offline index script:

```text
server/scripts/cweight-build-index.ts
```

Planned runtime:

```text
input description/category/brand
  -> embed query
  -> Qdrant top-N
  -> return Grainger No payload
  -> SQL lookup in @GRAINGER_CWEIGHT
  -> REVIEW_SUGGESTION only
```

## Current Open Items

1. Add SQL indexes on `@GRAINGER_CWEIGHT` if not present:
   - `[GRAINGER NO]`
   - `[MFG PART NO]`
   - `[MFG NAME]`
   - optionally `[CATEGORY 1]`

2. Confirm with users whether CWeight suggestions should apply to:
   - `Item Weight`
   - `Dim Weight`
   - `Chargeable Wt/Ea`

3. Keep Vector Search deferred until:
   - Qdrant endpoint is confirmed
   - OpenAI API key handling is approved
   - index build cost and refresh cadence are approved
