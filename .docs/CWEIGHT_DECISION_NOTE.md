# CWeight Decision Note

Updated: 2026-05-14

## Purpose

The CWeight module is intended to help PartCatalog find or suggest the weight used for freight calculation when supplier/product data is incomplete.

The module must stay limited to weight and dimension work:

- Chargeable Weight
- Item weight
- Shipping weight
- Dimensions
- Dimension unit
- Ship mode

It must not handle HS Code, Duty, Permit, Shelf Life, UI changes, external APIs, or API-key based AI calls.

## Business Meaning

Chargeable Weight is the weight used to calculate freight cost.

In normal freight logic, the chargeable weight is the greater value between actual weight and dimensional weight:

```text
chargeable weight = max(actual weight, dimensional weight)
```

Actual weight is the physical product or shipping weight.

Dimensional weight is the volume-based freight weight:

```text
dimensional weight = length x width x height / divisor
```

The divisor depends on ship mode and legacy calculation behavior.

If the product is physically light but large, dimensional weight may be higher than actual weight. If the product is heavy but small, actual weight is usually higher.

## Current Research Logic

The current local module uses three layers. The active `ai-services/src/index.ts`
barrel export is intentionally limited to local CWeight research exports so
HS Code, Duty, Permit, and Shelf Life work does not appear as active Codex
scope from the package entrypoint.

### 1. Direct Formula

If the input already has enough numeric data:

- item weight
- length
- width
- height
- dimension unit
- ship mode

then the module calculates dimensional weight and chargeable weight directly.

This is the safest path because it does not require product matching.

Result decision:

```text
AUTO_ACCEPT
```

Current implementation:

```text
lookupLocalCWeight(...) -> source: direct_formula, matchMethod: direct_formula
```

### 2. Exact Local Lookup

If direct calculation is not possible, the module tries exact matches against local sample/history data.

Trusted exact keys include:

- Grainger number
- manufacturer part number
- vendor stock item number
- catalog number

Exact identifier matches are treated as strong evidence because they refer to a specific product record.

Result decision:

```text
AUTO_ACCEPT
```

### 3. Local Description Matching

If no exact key is available, the module can compare product descriptions locally.

This is not external AI. It is a pure local TypeScript scoring function that uses:

- normalized text tokens
- numeric tokens
- product family words
- product role words
- ambiguity checks

Example risk:

```text
PEX tubing 1/2 in
```

should not automatically match:

```text
Plastic Ball Valve PEX x FNPT 1/2 in
```

because tubing and valve are different product roles.

Description matching can be helpful, but it is not safe enough to become automatic truth.

Result decision:

```text
REVIEW_SUGGESTION
```

## Decision Levels

Every future CWeight result should include one of these decisions.

```typescript
type CWeightDecision = "AUTO_ACCEPT" | "REVIEW_SUGGESTION" | "NOT_FOUND";
```

### AUTO_ACCEPT

The system can use the result automatically.

Allowed when:

- direct formula has enough numeric inputs, or
- exact trusted product identifier match is found.

### REVIEW_SUGGESTION

The system found a possible match, but a user should confirm it before using it.

Allowed when:

- only description matching is available, and
- the match is strong enough, and
- the match is not ambiguous.

### NOT_FOUND

The system cannot determine a reliable CWeight.

Required when:

- no weight/dimension data exists,
- no exact trusted product key matches,
- description matching is weak,
- description matching is ambiguous, or
- the result would require guessing.

The module must return `null` values instead of inventing weight.

## Current Test Result Summary

The current local research was tested against local sample data only.

Direct formula:

- Legacy PITM1 inch sample matched expected dimensional and shipping weight behavior.
- Grainger sample matched the observed pattern `CWeight = max(SWeight, VWeight)` for analyzable rows.

Exact lookup:

- Exact supplier/code/catalog matching is safe enough for `AUTO_ACCEPT`.

Description matching:

- Noisy description precision: about `98.7%`
- Short description precision: about `94.9%`

Interpretation:

- Noisy but descriptive text is useful as a review suggestion.
- Very short descriptions are still risky because product variants can look almost identical.

Example risky family:

```text
Tee Low Lead Brass PEX 1 Tube
Tee Low Lead Brass PEX 1-1/4 Tube
Tee Low Lead Brass PEX 2 Tube
```

When descriptions lose size or variant detail, the system should prefer `NOT_FOUND` or `REVIEW_SUGGESTION`, not automatic acceptance.

## Desired Architecture

The server architecture does not need a major redesign.

The recommended architecture is a small bounded CWeight service added later, after the local research contract is approved.

```text
Input product data
   |
   v
Normalize weight, dimensions, codes, description
   |
   v
Direct formula possible?
   |-- yes --> AUTO_ACCEPT
   |
   no
   |
   v
Exact trusted local match?
   |-- yes --> AUTO_ACCEPT
   |
   no
   |
   v
Strong local description match?
   |-- yes --> REVIEW_SUGGESTION
   |
   no
   |
   v
NOT_FOUND
```

Future backend shape:

```text
server/src/services/calculation.service.ts
  existing term calculation source of truth

server/src/services/cweight.service.ts
  backend-only orchestration wrapper; no route/UI integration yet

ai-services/src/services/cweight-*.ts
  pure local research functions and tests
```

The production backend should call a single controlled function:

```typescript
resolveChargeableWeight(input): CWeightResult
```

Suggested result contract:

```typescript
interface CWeightResult {
  decision: "AUTO_ACCEPT" | "REVIEW_SUGGESTION" | "NOT_FOUND";
  chargeableWeightKg: number | null;
  itemWeightKg: number | null;
  dimensionL: number | null;
  dimensionW: number | null;
  dimensionH: number | null;
  dimUnit: "CM" | "INCH" | null;
  source: "direct_formula" | "local_exact_match" | "local_semantic_match" | "not_found";
  confidence: number;
  reason: string;
}
```

Current backend wrapper status:

- `server/src/services/cweight.service.ts` exposes `resolveChargeableWeight(input)`.
- Direct formula inputs return `AUTO_ACCEPT` with `source: "direct_formula"`.
- Approved exact local matches can be passed through as `AUTO_ACCEPT`.
- Local description/semantic matches remain `REVIEW_SUGGESTION`.
- Missing or weak evidence returns `NOT_FOUND`.
- `server/src/repositories/cweight.repository.ts` reads the existing local
  Grainger source `[GRAINGER].[dbo].[@GRAINGER_CWEIGHT]` by exact Grainger code
  or manufacturer part number.
- Grainger rows use `Chargeable_Weight_kgs` / `CWeight` directly when present;
  dimensions stay `null` because this source does not provide length, width, or
  height columns.
- `server/src/services/cweight-lookup.service.ts` composes direct formula first,
  then local Grainger exact lookup, and still returns `NOT_FOUND` rather than
  guessing when no usable local weight evidence exists.
- `POST /api/cweight/resolve` exposes this backend-only resolver for one
  quotation line at a time; it is not wired into any UI flow yet.
- No Next.js integration, external API call, or API key path has been added.

## Technology Decision

Use TypeScript for production integration.

Reason:

- PartCatalog backend is already TypeScript/Node.js.
- Pure TypeScript functions are easy to test with Vitest.
- No extra Python or Java runtime is required.
- The logic can later be called directly from the existing Express backend.

Python may be useful later for offline analysis, but it should not be required for the production CWeight path unless there is a separate approved architecture decision.

JDK/Java is not required for this module.

## Recommendation

Approve the following direction:

1. Keep the current local-only CWeight module as the research source.
2. Treat exact code/catalog matches as `AUTO_ACCEPT`.
3. Treat description matches as `REVIEW_SUGGESTION`.
4. Return `NOT_FOUND` when data is too weak.
5. Do not integrate external AI or external APIs in this phase.
6. After review, add a small backend CWeight service wrapper without changing the larger server architecture.
