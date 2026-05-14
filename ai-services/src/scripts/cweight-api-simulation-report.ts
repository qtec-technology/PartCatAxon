import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  lookupLocalCWeight,
  type CWeightLocalLookupSources,
} from "../services/cweight-local-lookup.service.js";
import type { CsvRecord } from "../services/cweight-sample-analyzer.service.js";
import {
  buildIncompleteInputCases,
  type CWeightIncompleteScenario,
} from "./cweight-incomplete-input-report.js";
import {
  type CWeightLookupInputCase,
  readChargeableWeightCsvIfExists,
  readCsvIfExists,
  readPitm1CsvFiles,
  resolveRepoRoot,
} from "./cweight-local-report.js";

export type CWeightApiSimulationMethod = "verified_catalog_match" | "broad_catalog_match";

export interface CWeightApiSimulationSample {
  inputRowKey: string;
  matchedRowKey: string | null;
  inputDescription: string | null;
  matchedDescription: string | null;
  confidence: number;
  correct: boolean;
}

export interface CWeightApiSimulationScenarioResult {
  scenario: Extract<CWeightIncompleteScenario, "short_description_only" | "noisy_description_only">;
  method: CWeightApiSimulationMethod;
  localNotFoundEligible: number;
  reviewSuggestion: number;
  notFound: number;
  correct: number;
  wrong: number;
  precision: number;
  recallAgainstLocalNotFound: number;
  maxDecision: "REVIEW_SUGGESTION";
  wrongSamples: CWeightApiSimulationSample[];
}

export interface CWeightApiSimulationReport {
  generatedAt: string;
  sourceRows: {
    graingerRows: number;
    pitm1Rows: number;
    chargeableWeightRows: number;
  };
  scenarios: CWeightApiSimulationScenarioResult[];
  recommendation: {
    preferredMethod: CWeightApiSimulationMethod;
    reason: string;
    productionGate: string;
  };
}

const SIMULATION_SCENARIOS = ["short_description_only", "noisy_description_only"] as const;

export function loadDefaultCWeightApiSimulationReport(rootDir = process.cwd()): CWeightApiSimulationReport {
  const resolvedRoot = resolveRepoRoot(rootDir);
  const datatestDir = join(resolvedRoot, ".datatest");
  const graingerRows = readCsvIfExists(join(datatestDir, "@GRAINGER_CWEIGHT.csv"));
  const pitm1Rows = readPitm1CsvFiles(datatestDir);
  const chargeableWeightRows = readChargeableWeightCsvIfExists(join(datatestDir, "@CHARGEABLEWEIGHT.csv"));

  return buildCWeightApiSimulationReport({ graingerRows, pitm1Rows, chargeableWeightRows });
}

export function buildCWeightApiSimulationReport(input: {
  graingerRows: readonly CsvRecord[];
  pitm1Rows: readonly CsvRecord[];
  chargeableWeightRows?: readonly CsvRecord[];
}): CWeightApiSimulationReport {
  const chargeableWeightRows = input.chargeableWeightRows ?? [];
  const sources: CWeightLocalLookupSources = {
    graingerRows: mergeGraingerRows(input.graingerRows, chargeableWeightRows),
    pitm1Rows: input.pitm1Rows,
  };
  const catalog = buildCatalog([...(sources.graingerRows ?? []), ...(sources.pitm1Rows ?? [])]);
  const cases = buildIncompleteInputCases({
    graingerRows: input.graingerRows,
    pitm1Rows: input.pitm1Rows,
  });
  const scenarios = SIMULATION_SCENARIOS.flatMap((scenario) => [
    evaluateScenario(scenario, "verified_catalog_match", cases[scenario], sources, catalog),
    evaluateScenario(scenario, "broad_catalog_match", cases[scenario], sources, catalog),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    sourceRows: {
      graingerRows: input.graingerRows.length,
      pitm1Rows: input.pitm1Rows.length,
      chargeableWeightRows: chargeableWeightRows.length,
    },
    scenarios,
    recommendation: {
      preferredMethod: "verified_catalog_match",
      reason:
        "The conservative simulation requires stronger token coverage and rejects ambiguous ties, so it is the only method suitable for production review suggestions.",
      productionGate:
        "Run API only after local NOT_FOUND, require a cited/verified product source, keep max decision REVIEW_SUGGESTION, and return NOT_FOUND for ambiguity.",
    },
  };
}

function evaluateScenario(
  scenario: CWeightApiSimulationScenarioResult["scenario"],
  method: CWeightApiSimulationMethod,
  cases: readonly CWeightLookupInputCase[],
  sources: CWeightLocalLookupSources,
  catalog: readonly CatalogDocument[],
): CWeightApiSimulationScenarioResult {
  let eligible = 0;
  let reviewSuggestion = 0;
  let notFound = 0;
  let correct = 0;
  let wrong = 0;
  const wrongSamples: CWeightApiSimulationSample[] = [];

  for (const inputCase of cases) {
    const localResult = lookupLocalCWeight(inputCase.request, sources);
    if (localResult.decision !== "NOT_FOUND") continue;
    eligible++;

    const apiResult = simulateApiFallback(inputCase, catalog, method);
    if (apiResult === null) {
      notFound++;
      continue;
    }

    reviewSuggestion++;
    if (apiResult.correct) {
      correct++;
    } else {
      wrong++;
      if (wrongSamples.length < 10) wrongSamples.push(apiResult);
    }
  }

  return {
    scenario,
    method,
    localNotFoundEligible: eligible,
    reviewSuggestion,
    notFound,
    correct,
    wrong,
    precision: round6(correct / ((correct + wrong) || 1)),
    recallAgainstLocalNotFound: round6(correct / (eligible || 1)),
    maxDecision: "REVIEW_SUGGESTION",
    wrongSamples,
  };
}

function simulateApiFallback(
  inputCase: CWeightLookupInputCase,
  catalog: readonly CatalogDocument[],
  method: CWeightApiSimulationMethod,
): CWeightApiSimulationSample | null {
  const query = inputCase.request.description;
  if (query === undefined || query === null) return null;

  const queryTokens = tokensFor(query);
  if (queryTokens.length < 4) return null;

  const scored = catalog
    .map((document) => ({ document, score: scoreDocument(queryTokens, document.tokens, method) }))
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score);

  const best = scored[0];
  if (best === undefined) return null;

  const secondScore = scored[1]?.score ?? 0;
  const minScore = method === "verified_catalog_match" ? 0.78 : 0.58;
  const ambiguityGap = method === "verified_catalog_match" ? 0.12 : 0.04;
  if (best.score < minScore || best.score - secondScore < ambiguityGap) return null;

  const matchedRowKey = best.document.rowKey;
  return {
    inputRowKey: inputCase.rowKey,
    matchedRowKey,
    inputDescription: query,
    matchedDescription: best.document.description,
    confidence: method === "verified_catalog_match" ? 0.62 : 0.5,
    correct: matchedRowKey === inputCase.rowKey,
  };
}

interface CatalogDocument {
  rowKey: string;
  description: string;
  tokens: string[];
}

function buildCatalog(rows: readonly CsvRecord[]): CatalogDocument[] {
  return rows
    .map((row, index) => {
      const description = textField(row, "SHORT_DESC", "ItemDescription");
      if (description === null) return null;
      return {
        rowKey: textField(row, "GRAINGER_NO", "TermID", "ItemID", "VendorStockItemNo", "U_CalalogNo") ?? String(index),
        description,
        tokens: tokensFor(description),
      };
    })
    .filter((document): document is CatalogDocument => document !== null);
}

function scoreDocument(
  queryTokens: readonly string[],
  documentTokens: readonly string[],
  method: CWeightApiSimulationMethod,
): number {
  const query = new Set(queryTokens);
  const document = new Set(documentTokens);
  const queryNumbers = [...query].filter(isNumericLike);
  const documentNumbers = new Set([...document].filter(isNumericLike));
  const numericCoverage =
    queryNumbers.length === 0
      ? 1
      : queryNumbers.filter((token) => documentNumbers.has(token)).length / Math.max(queryNumbers.length, documentNumbers.size);
  const alphaTokens = [...query].filter((token) => !isNumericLike(token));
  const alphaCoverage =
    alphaTokens.length === 0
      ? 1
      : alphaTokens.filter((token) => document.has(token)).length / alphaTokens.length;

  const numericGate = method === "verified_catalog_match" ? 0.9 : 0.6;
  const alphaGate = method === "verified_catalog_match" ? 0.7 : 0.5;
  if (numericCoverage < numericGate || alphaCoverage < alphaGate) return 0;

  return round6((alphaCoverage * 0.65) + (numericCoverage * 0.35));
}

function mergeGraingerRows(graingerRows: readonly CsvRecord[], chargeableWeightRows: readonly CsvRecord[]): CsvRecord[] {
  const merged = [...graingerRows];
  const existing = new Set(merged.map((row) => textField(row, "GRAINGER_NO")).filter((value): value is string => value !== null));
  for (const row of chargeableWeightRows) {
    const graingerNo = textField(row, "GRAINGER_NO");
    if (graingerNo !== null && !existing.has(graingerNo)) {
      merged.push(row);
      existing.add(graingerNo);
    }
  }
  return merged;
}

function tokensFor(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/([a-z])([0-9])/g, "$1 $2")
    .replace(/([0-9])([a-z])/g, "$1 $2")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .map((token) => (token === "inch" || token === "inches" ? "in" : token))
    .filter((token) => token.length > 1 || isNumericLike(token));
}

function isNumericLike(token: string): boolean {
  return /[0-9]/.test(token);
}

function textField(record: CsvRecord, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key]?.trim();
    if (value !== undefined && value !== "" && value.toUpperCase() !== "NULL") return value;
  }
  return null;
}

function round6(value: number): number {
  return Math.round(value * 1000000) / 1000000;
}

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]) {
  console.log(JSON.stringify(loadDefaultCWeightApiSimulationReport(), null, 2));
}
