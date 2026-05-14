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
```

Result:

- 11 test files passed.
- 40 tests passed.
- TypeScript build passed.
