import { fileURLToPath } from "node:url";
import {
  type CWeightIncompleteInputReport,
  type CWeightIncompleteScenario,
  loadDefaultCWeightIncompleteInputReport,
} from "./cweight-incomplete-input-report.js";
import {
  type CWeightSemanticEvaluationReport,
  loadDefaultCWeightSemanticEvaluationReport,
} from "./cweight-semantic-evaluation-report.js";

export type CWeightPolicyDecision = "AUTO_ACCEPT" | "REVIEW_SUGGESTION" | "NOT_FOUND";

export interface CWeightPolicyRule {
  decision: CWeightPolicyDecision;
  allowedMethods: string[];
  policy: string;
}

export interface CWeightScenarioPolicyMetrics {
  scenario: CWeightIncompleteScenario;
  total: number;
  autoAccept: number;
  reviewSuggestion: number;
  notFound: number;
  precision: number | null;
  recall: number | null;
}

export interface CWeightApiAssistedComparison {
  status: "designed_not_executed";
  reason: string;
  eligibleAfterLocalNotFound: {
    shortDescriptionOnly: number;
    noisyDescriptionOnly: number;
  };
  maxAllowedDecision: "REVIEW_SUGGESTION";
  autoAcceptImprovement: 0;
}

export interface CWeightPolicyEvaluationReport {
  generatedAt: string;
  dataset: CWeightIncompleteInputReport["sourceRows"];
  localOnly: {
    supplierCodeOnly: CWeightScenarioPolicyMetrics;
    mfrPartOnly: CWeightScenarioPolicyMetrics;
    descriptionOnly: CWeightScenarioPolicyMetrics;
    shortDescriptionOnly: CWeightScenarioPolicyMetrics;
    noisyDescriptionOnly: CWeightScenarioPolicyMetrics;
  };
  apiAssisted: CWeightApiAssistedComparison;
  policies: {
    autoAccept: CWeightPolicyRule;
    reviewSuggestion: CWeightPolicyRule;
    notFound: CWeightPolicyRule;
  };
}

export function loadDefaultCWeightPolicyEvaluationReport(rootDir = process.cwd()): CWeightPolicyEvaluationReport {
  return buildCWeightPolicyEvaluationReport({
    incomplete: loadDefaultCWeightIncompleteInputReport(rootDir),
    semantic: loadDefaultCWeightSemanticEvaluationReport(rootDir),
  });
}

export function buildCWeightPolicyEvaluationReport(input: {
  incomplete: CWeightIncompleteInputReport;
  semantic: CWeightSemanticEvaluationReport;
}): CWeightPolicyEvaluationReport {
  const shortSemantic = input.semantic.scenarios.short_description_only;
  const noisySemantic = input.semantic.scenarios.noisy_description_only;

  return {
    generatedAt: new Date().toISOString(),
    dataset: input.incomplete.sourceRows,
    localOnly: {
      supplierCodeOnly: exactScenario(input.incomplete, "supplier_code_only"),
      mfrPartOnly: exactScenario(input.incomplete, "mfr_part_only"),
      descriptionOnly: reviewScenario(input.incomplete, "description_only", null),
      shortDescriptionOnly: reviewScenario(input.incomplete, "short_description_only", shortSemantic ?? null),
      noisyDescriptionOnly: reviewScenario(input.incomplete, "noisy_description_only", noisySemantic ?? null),
    },
    apiAssisted: {
      status: "designed_not_executed",
      reason:
        "No API call or API key was used. Local exact identifiers already reach 100% coverage in the sampled data; API fallback is only justified as a future review-only trial for local NOT_FOUND description cases.",
      eligibleAfterLocalNotFound: {
        shortDescriptionOnly: input.incomplete.scenarios.short_description_only.notFoundRows,
        noisyDescriptionOnly: input.incomplete.scenarios.noisy_description_only.notFoundRows,
      },
      maxAllowedDecision: "REVIEW_SUGGESTION",
      autoAcceptImprovement: 0,
    },
    policies: {
      autoAccept: {
        decision: "AUTO_ACCEPT",
        allowedMethods: [
          "direct_formula",
          "grainger_no_exact",
          "grainger_mfg_part_exact",
          "pitm1_vendor_stock_exact",
          "pitm1_catalog_exact",
        ],
        policy: "Accept only deterministic formula results or exact trusted product identifier matches.",
      },
      reviewSuggestion: {
        decision: "REVIEW_SUGGESTION",
        allowedMethods: ["description_exact", "description_semantic", "api_description_candidate"],
        policy:
          "Require human review for description-only matches, including any future API-assisted candidate; never write back automatically.",
      },
      notFound: {
        decision: "NOT_FOUND",
        allowedMethods: ["not_found"],
        policy:
          "Return null weights when local evidence is weak, ambiguous, missing size tokens, or the only possible result would be a guess.",
      },
    },
  };
}

function exactScenario(
  report: CWeightIncompleteInputReport,
  scenario: "supplier_code_only" | "mfr_part_only",
): CWeightScenarioPolicyMetrics {
  const coverage = report.scenarios[scenario];
  return {
    scenario,
    total: coverage.totalInputRows,
    autoAccept: coverage.matchedRows,
    reviewSuggestion: 0,
    notFound: coverage.notFoundRows,
    precision: null,
    recall: coverage.totalInputRows === 0 ? null : round6(coverage.matchedRows / coverage.totalInputRows),
  };
}

function reviewScenario(
  report: CWeightIncompleteInputReport,
  scenario: "description_only" | "short_description_only" | "noisy_description_only",
  semantic: CWeightSemanticEvaluationReport["scenarios"]["short_description_only"] | null,
): CWeightScenarioPolicyMetrics {
  const coverage = report.scenarios[scenario];
  return {
    scenario,
    total: coverage.totalInputRows,
    autoAccept: 0,
    reviewSuggestion: coverage.matchedRows,
    notFound: coverage.notFoundRows,
    precision: semantic?.precision ?? null,
    recall: semantic?.recall ?? null,
  };
}

function round6(value: number): number {
  return Math.round(value * 1000000) / 1000000;
}

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]) {
  console.log(JSON.stringify(loadDefaultCWeightPolicyEvaluationReport(), null, 2));
}
