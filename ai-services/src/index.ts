export type {
  CWeightInput,
  CWeightPatternAnalysis,
  CWeightPatternCandidate,
  CWeightResult,
  CWeightSampleRow,
  DimUnit,
  ShipModeNo,
} from "./services/cweight-pattern.service.js";
export {
  analyzeCWeightSample,
  calculateChargeableWeightKg,
  calculateDimensionalWeightKg,
  getShipModeDimensionalDivisor,
  normalizeDimUnit,
  normalizeShipModeNo,
} from "./services/cweight-pattern.service.js";
export type {
  CsvRecord,
  GraingerCWeightRowAnalysis,
  GraingerCWeightSummary,
  Pitm1CWeightRowAnalysis,
  Pitm1CWeightSummary,
} from "./services/cweight-sample-analyzer.service.js";
export {
  analyzeGraingerCWeightCsv,
  analyzeGraingerCWeightRecord,
  analyzeGraingerCWeightRecords,
  analyzePitm1Csv,
  analyzePitm1Record,
  analyzePitm1Records,
  parseCsv,
} from "./services/cweight-sample-analyzer.service.js";
export type {
  CWeightLookupDecision,
  CWeightLocalLookupRequest,
  CWeightLocalLookupResult,
  CWeightLocalLookupSources,
  CWeightLocalMatchMethod,
} from "./services/cweight-local-lookup.service.js";
export {
  lookupLocalCWeight,
  normalizeLookupText,
} from "./services/cweight-local-lookup.service.js";
export type {
  CWeightSearchDocument,
  CWeightSemanticSearchHit,
} from "./services/cweight-semantic-search.service.js";
export {
  normalizeSemanticText,
  searchCWeightDescriptions,
} from "./services/cweight-semantic-search.service.js";
export type {
  CWeightLocalReport,
  CWeightLookupCoverageReport,
  CWeightLookupInputCase,
  CWeightLookupSample,
} from "./scripts/cweight-local-report.js";
export {
  buildCoverageReport,
  buildCWeightLocalReport,
  dedupePitm1Rows,
  loadDefaultCWeightLocalReport,
  readPitm1CsvFiles,
} from "./scripts/cweight-local-report.js";
export type {
  CWeightIncompleteInputReport,
  CWeightIncompleteScenario,
} from "./scripts/cweight-incomplete-input-report.js";
export {
  buildIncompleteInputCases,
  buildCWeightIncompleteInputReport,
  loadDefaultCWeightIncompleteInputReport,
} from "./scripts/cweight-incomplete-input-report.js";
export type {
  CWeightSemanticEvaluationReport,
  CWeightSemanticScenarioEvaluation,
  CWeightSemanticWrongMatchSample,
} from "./scripts/cweight-semantic-evaluation-report.js";
export {
  buildCWeightSemanticEvaluationReport,
  loadDefaultCWeightSemanticEvaluationReport,
} from "./scripts/cweight-semantic-evaluation-report.js";
export type {
  CWeightApiAssistedComparison,
  CWeightPolicyDecision,
  CWeightPolicyEvaluationReport,
  CWeightPolicyRule,
  CWeightScenarioPolicyMetrics,
} from "./scripts/cweight-policy-evaluation-report.js";
export {
  buildCWeightPolicyEvaluationReport,
  loadDefaultCWeightPolicyEvaluationReport,
} from "./scripts/cweight-policy-evaluation-report.js";
