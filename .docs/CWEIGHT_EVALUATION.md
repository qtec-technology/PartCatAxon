# CWeight Evaluation

Updated: 2026-05-14

## Scope

This evaluation covers only CWeight / Weight & Dimension behavior in
`ai-services/src/services/cweight-*.ts`.

Out of scope:

- HS Code
- Duty
- Permit
- Shelf Life
- UI changes
- SAP writes
- API key commits

## Dataset

The evaluation uses local `.datatest` exports only:

| Source | Rows |
|---|---:|
| `.datatest/@GRAINGER_CWEIGHT.csv` | 1000 |
| `.datatest/vw@PITM1*.csv` after de-duplication | 645 |
| `.datatest/@CHARGEABLEWEIGHT.csv` | 500 |

The local report merges chargeable-weight rows into the Grainger lookup source
only when a Grainger code is not already present. In the current sample, merged
Grainger rows remain 1000.

## Local-Only Results

Command:

```bash
npm.cmd --prefix ai-services run report:cweight:policy
```

Measured results:

| Scenario | Total | AUTO_ACCEPT | REVIEW_SUGGESTION | NOT_FOUND | Precision | Recall |
|---|---:|---:|---:|---:|---:|---:|
| supplier code only | 1126 | 1126 | 0 | 0 | n/a | 1.000000 |
| manufacturer/catalog part only | 1645 | 1645 | 0 | 0 | n/a | 1.000000 |
| full description only | 1645 | 0 | 1196 | 449 | n/a | n/a |
| short description only | 1645 | 0 | 835 | 810 | 0.949701 | 0.482067 |
| noisy description only | 1645 | 0 | 954 | 691 | 0.989518 | 0.573860 |

Interpretation:

- Exact trusted identifiers are sufficient for automatic acceptance in the
  sampled local data.
- Description matching is useful, especially with noisy but descriptive quote
  text, but it is not safe as automatic truth.
- Short descriptions lose variant detail often enough that the correct behavior
  is either `REVIEW_SUGGESTION` or `NOT_FOUND`.

## API-Assisted Comparison

No API call or API key was used for this Scope 1 evaluation.

Reason:

- Local exact identifiers already reach 100% coverage in the sampled dataset.
- The remaining gap is description-only recall, not deterministic formula or
  exact-key accuracy.
- API estimates would still be product guesses without a verified product page
  or local row, so they must not become `AUTO_ACCEPT`.

Controlled API fallback design:

| Path | Local-only result | API-assisted allowed result |
|---|---|---|
| direct formula | `AUTO_ACCEPT` | no API call |
| exact Grainger / manufacturer / PITM1 key | `AUTO_ACCEPT` | no API call |
| local description match | `REVIEW_SUGGESTION` | no API call |
| local description `NOT_FOUND` | `NOT_FOUND` | optional `REVIEW_SUGGESTION` only |
| ambiguous or weak API response | `NOT_FOUND` | `NOT_FOUND` |

Potential future trial pool from current local data:

| Scenario | Local NOT_FOUND rows eligible for API trial |
|---|---:|
| short description only | 810 |
| noisy description only | 691 |

The API-assisted path may improve review coverage in those rows, but it must not
improve the `AUTO_ACCEPT` count. Any future API comparison should be run as a
separate labeled trial that records prompt version, provider/model, input text,
JSON response, and human-verified correctness.

## Simulated API Fallback

Command:

```bash
npm.cmd --prefix ai-services run report:cweight:api-sim
```

This simulation uses Codex/local deterministic matching as a stand-in for a
future production API. It runs only after the local module returns `NOT_FOUND`
for description-only inputs. No network call and no API key are used.

Compared methods:

- `verified_catalog_match`: stricter token coverage and ambiguity rejection,
  representing an API response that can cite a verified product source.
- `broad_catalog_match`: looser matching, representing a more eager API-style
  suggestion.

Measured results:

| Scenario | Method | Local NOT_FOUND eligible | REVIEW_SUGGESTION | NOT_FOUND | Precision | Recall vs local NOT_FOUND |
|---|---|---:|---:|---:|---:|---:|
| short description only | verified_catalog_match | 810 | 7 | 803 | 0.857143 | 0.007407 |
| short description only | broad_catalog_match | 810 | 110 | 700 | 0.890909 | 0.120988 |
| noisy description only | verified_catalog_match | 691 | 0 | 691 | 0.000000 | 0.000000 |
| noisy description only | broad_catalog_match | 691 | 119 | 572 | 0.974790 | 0.167873 |

Interpretation:

- Broad simulated matching improves review coverage, but it still produces
  wrong matches on product variants such as motors, fittings, PEX tubing,
  micrometers, and circuit breakers.
- Conservative verified matching avoids most ambiguous cases but has very low
  recall in this simulation.
- The best production direction is not "let API estimate weights"; it is "let
  API search for a verifiable product source, then return a review-only
  candidate if the source is unambiguous."

Production API gate:

- Run only after local `NOT_FOUND`.
- Require cited/verified product source evidence.
- Keep max decision as `REVIEW_SUGGESTION`.
- Return `NOT_FOUND` for ambiguity, missing source evidence, or variant
  conflict.
- Never use API output to write master data automatically.

## Decision Policy

### AUTO_ACCEPT

Allowed only when:

- direct formula has enough numeric input to calculate chargeable weight, or
- exact trusted product identifier match is found:
  - Grainger number
  - manufacturer part number
  - vendor stock item number
  - catalog number

### REVIEW_SUGGESTION

Allowed when:

- description matching is exact or strong enough locally, and not ambiguous, or
- a future API-assisted response returns a plausible candidate after local
  `NOT_FOUND`.

The result must remain review-only and must not overwrite user-entered values or
write master data.

### NOT_FOUND

Required when:

- weight/dimension evidence is missing,
- exact trusted keys do not match,
- description matching is weak,
- description matching is ambiguous,
- size/variant tokens are missing or contradictory, or
- any API response would require guessing.

Return null weights and dimensions instead of inventing values.

## Verification

Executed on 2026-05-14:

```bash
npm.cmd --prefix ai-services test -- --run
npm.cmd --prefix ai-services run build
npm.cmd --prefix ai-services run report:cweight:policy
npm.cmd --prefix ai-services run report:cweight:api-sim
```

Result:

- 12 test files passed.
- 42 tests passed.
- TypeScript build passed.
