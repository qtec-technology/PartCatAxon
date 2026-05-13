import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { lookupLocalCWeight, type CWeightLocalLookupSources } from "../services/cweight-local-lookup.service.js";
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

export interface CWeightSemanticWrongMatchSample {
  scenario: CWeightIncompleteScenario;
  inputRowKey: string;
  matchedRowKey: string | null;
  inputDescription: string | null;
  matchedDescription: string | null;
  confidence: number;
  chargeableWeightKg: number | null;
}

export interface CWeightSemanticScenarioEvaluation {
  scenario: CWeightIncompleteScenario;
  total: number;
  correct: number;
  wrong: number;
  notFound: number;
  precision: number;
  recall: number;
  wrongSamples: CWeightSemanticWrongMatchSample[];
}

export interface CWeightSemanticEvaluationReport {
  generatedAt: string;
  sourceRows: {
    graingerRows: number;
    pitm1Rows: number;
    chargeableWeightRows: number;
  };
  scenarios: Partial<Record<CWeightIncompleteScenario, CWeightSemanticScenarioEvaluation>>;
}

const SEMANTIC_SCENARIOS: readonly CWeightIncompleteScenario[] = [
  "short_description_only",
  "noisy_description_only",
];

export function loadDefaultCWeightSemanticEvaluationReport(rootDir = process.cwd()): CWeightSemanticEvaluationReport {
  const resolvedRoot = resolveRepoRoot(rootDir);
  const datatestDir = join(resolvedRoot, ".datatest");
  return buildCWeightSemanticEvaluationReport({
    graingerRows: readCsvIfExists(join(datatestDir, "@GRAINGER_CWEIGHT.csv")),
    pitm1Rows: readPitm1CsvFiles(datatestDir),
    chargeableWeightRows: readChargeableWeightCsvIfExists(join(datatestDir, "@CHARGEABLEWEIGHT.csv")),
  });
}

export function buildCWeightSemanticEvaluationReport(input: {
  graingerRows: readonly CsvRecord[];
  pitm1Rows: readonly CsvRecord[];
  chargeableWeightRows?: readonly CsvRecord[];
}): CWeightSemanticEvaluationReport {
  const chargeableWeightRows = input.chargeableWeightRows ?? [];
  const sources: CWeightLocalLookupSources = {
    graingerRows: mergeGraingerRows(input.graingerRows, chargeableWeightRows),
    pitm1Rows: input.pitm1Rows,
  };
  const scenarioCases = buildIncompleteInputCases({
    graingerRows: input.graingerRows,
    pitm1Rows: input.pitm1Rows,
  });

  return {
    generatedAt: new Date().toISOString(),
    sourceRows: {
      graingerRows: input.graingerRows.length,
      pitm1Rows: input.pitm1Rows.length,
      chargeableWeightRows: chargeableWeightRows.length,
    },
    scenarios: Object.fromEntries(
      SEMANTIC_SCENARIOS.map((scenario) => [scenario, evaluateScenario(scenario, scenarioCases[scenario], sources)]),
    ),
  };
}

function evaluateScenario(
  scenario: CWeightIncompleteScenario,
  cases: readonly CWeightLookupInputCase[],
  sources: CWeightLocalLookupSources,
): CWeightSemanticScenarioEvaluation {
  let correct = 0;
  let wrong = 0;
  let notFound = 0;
  const wrongSamples: CWeightSemanticWrongMatchSample[] = [];

  for (const inputCase of cases) {
    const result = lookupLocalCWeight(inputCase.request, sources);
    if (result.source === "not_found") {
      notFound++;
      continue;
    }

    const matchedRowKey = result.rawRow === undefined ? null : rowIdentity(result.rawRow);
    const isCorrect = matchedRowKey === inputCase.rowKey;
    if (isCorrect) {
      correct++;
    } else {
      wrong++;
      if (wrongSamples.length < 10) {
        wrongSamples.push({
          scenario,
          inputRowKey: inputCase.rowKey,
          matchedRowKey,
          inputDescription: inputCase.request.description ?? null,
          matchedDescription: result.matchedDescription,
          confidence: result.confidence,
          chargeableWeightKg: result.chargeableWeightKg,
        });
      }
    }
  }

  return {
    scenario,
    total: cases.length,
    correct,
    wrong,
    notFound,
    precision: round6(correct / ((correct + wrong) || 1)),
    recall: round6(correct / (cases.length || 1)),
    wrongSamples,
  };
}

function rowIdentity(row: CsvRecord): string {
  return textField(row, "GRAINGER_NO", "TermID", "ItemID", "VendorStockItemNo", "U_CalalogNo") ?? "";
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
  console.log(JSON.stringify(loadDefaultCWeightSemanticEvaluationReport(), null, 2));
}
