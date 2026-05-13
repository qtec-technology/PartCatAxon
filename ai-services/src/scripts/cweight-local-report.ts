import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  type CWeightLocalLookupRequest,
  type CWeightLocalLookupResult,
  type CWeightLocalLookupSources,
  lookupLocalCWeight,
} from "../services/cweight-local-lookup.service.js";
import { type CsvRecord, parseCsv } from "../services/cweight-sample-analyzer.service.js";

export interface CWeightLookupInputCase {
  source: "grainger" | "legacy_term";
  rowKey: string;
  request: CWeightLocalLookupRequest;
}

export interface CWeightLookupSample {
  rowKey: string;
  request: CWeightLocalLookupRequest;
  source: CWeightLocalLookupResult["source"];
  matchMethod: CWeightLocalLookupResult["matchMethod"];
  confidence: number;
  chargeableWeightKg: number | null;
  matchedDescription: string | null;
}

export interface CWeightLookupCoverageReport {
  scenario: string;
  totalInputRows: number;
  matchedRows: number;
  notFoundRows: number;
  averageConfidence: number;
  matchMethods: Record<CWeightLocalLookupResult["matchMethod"], number>;
  lowConfidenceSamples: CWeightLookupSample[];
  notFoundSamples: CWeightLookupSample[];
}

export interface CWeightLocalReport {
  generatedAt: string;
  sourceRows: {
    graingerRows: number;
    pitm1Rows: number;
    chargeableWeightRows: number;
    mergedGraingerRows: number;
  };
  exactKeyCoverage: CWeightLookupCoverageReport;
  descriptionOnlyCoverage: CWeightLookupCoverageReport;
}

const MATCH_METHODS: readonly CWeightLocalLookupResult["matchMethod"][] = [
  "direct_formula",
  "grainger_no_exact",
  "grainger_mfg_part_exact",
  "pitm1_vendor_stock_exact",
  "pitm1_catalog_exact",
  "description_exact",
  "description_semantic",
  "not_found",
];

export function loadDefaultCWeightLocalReport(rootDir = process.cwd()): CWeightLocalReport {
  const resolvedRoot = resolveRepoRoot(rootDir);
  const datatestDir = join(resolvedRoot, ".datatest");
  const graingerRows = readCsvIfExists(join(datatestDir, "@GRAINGER_CWEIGHT.csv"));
  const pitm1Rows = readPitm1CsvFiles(datatestDir);
  const chargeableWeightRows = readChargeableWeightCsvIfExists(join(datatestDir, "@CHARGEABLEWEIGHT.csv"));

  return buildCWeightLocalReport({
    graingerRows,
    pitm1Rows,
    chargeableWeightRows,
  });
}

export function resolveRepoRoot(rootDir: string): string {
  if (existsSync(join(rootDir, ".datatest"))) return rootDir;

  const parent = join(rootDir, "..");
  if (existsSync(join(parent, ".datatest"))) return parent;

  return rootDir;
}

export function buildCWeightLocalReport(input: {
  graingerRows: readonly CsvRecord[];
  pitm1Rows: readonly CsvRecord[];
  chargeableWeightRows?: readonly CsvRecord[];
}): CWeightLocalReport {
  const chargeableWeightRows = input.chargeableWeightRows ?? [];
  const graingerRows = mergeGraingerRows(input.graingerRows, chargeableWeightRows);
  const sources: CWeightLocalLookupSources = {
    graingerRows,
    pitm1Rows: input.pitm1Rows,
  };
  const exactCases = [
    ...graingerRows.map(graingerExactCase).filter(isCase),
    ...input.pitm1Rows.map(pitm1ExactCase).filter(isCase),
  ];
  const descriptionCases = exactCases
    .map(toDescriptionOnlyCase)
    .filter(isCase);

  return {
    generatedAt: new Date().toISOString(),
    sourceRows: {
      graingerRows: input.graingerRows.length,
      pitm1Rows: input.pitm1Rows.length,
      chargeableWeightRows: chargeableWeightRows.length,
      mergedGraingerRows: graingerRows.length,
    },
    exactKeyCoverage: buildCoverageReport("exact_keys", exactCases, sources),
    descriptionOnlyCoverage: buildCoverageReport("description_only", descriptionCases, sources),
  };
}

export function buildCoverageReport(
  scenario: CWeightLookupCoverageReport["scenario"],
  cases: readonly CWeightLookupInputCase[],
  sources: CWeightLocalLookupSources,
): CWeightLookupCoverageReport {
  const results = cases.map((inputCase) => ({
    inputCase,
    result: lookupLocalCWeight(inputCase.request, sources),
  }));
  const matched = results.filter(({ result }) => result.source !== "not_found");
  const matchMethods = Object.fromEntries(MATCH_METHODS.map((method) => [method, 0])) as CWeightLookupCoverageReport["matchMethods"];
  for (const { result } of results) {
    matchMethods[result.matchMethod]++;
  }

  return {
    scenario,
    totalInputRows: cases.length,
    matchedRows: matched.length,
    notFoundRows: results.length - matched.length,
    averageConfidence: round6(matched.reduce((sum, item) => sum + item.result.confidence, 0) / (matched.length || 1)),
    matchMethods,
    lowConfidenceSamples: results
      .filter(({ result }) => result.source !== "not_found" && result.confidence < 0.7)
      .slice(0, 10)
      .map(toSample),
    notFoundSamples: results
      .filter(({ result }) => result.source === "not_found")
      .slice(0, 10)
      .map(toSample),
  };
}

function graingerExactCase(row: CsvRecord): CWeightLookupInputCase | null {
  const graingerNo = textField(row, "GRAINGER_NO");
  const mfrPartNo = textField(row, "MFG_PART_NO");
  const description = textField(row, "SHORT_DESC");
  if (graingerNo === null && mfrPartNo === null && description === null) return null;

  return {
    source: "grainger",
    rowKey: graingerNo ?? mfrPartNo ?? description ?? "",
    request: {
      supplierOrderCode: graingerNo,
      mfrCatalogNo: mfrPartNo,
      mfrBrand: textField(row, "MFG_NAME"),
      description,
    },
  };
}

function pitm1ExactCase(row: CsvRecord): CWeightLookupInputCase | null {
  const vendorStockItemNo = textField(row, "VendorStockItemNo");
  const catalogNo = textField(row, "U_CalalogNo");
  const description = textField(row, "ItemDescription");
  if (vendorStockItemNo === null && catalogNo === null && description === null) return null;

  return {
    source: "legacy_term",
    rowKey: textField(row, "TermID", "ItemID", "VendorStockItemNo", "U_CalalogNo") ?? "",
    request: {
      supplierOrderCode: vendorStockItemNo,
      vendorStockItemNo,
      mfrCatalogNo: catalogNo,
      description,
    },
  };
}

function toDescriptionOnlyCase(inputCase: CWeightLookupInputCase): CWeightLookupInputCase | null {
  const description = inputCase.request.description;
  if (description === undefined || description === null || description.trim() === "") return null;
  return {
    source: inputCase.source,
    rowKey: inputCase.rowKey,
    request: { description },
  };
}

function toSample(item: { inputCase: CWeightLookupInputCase; result: CWeightLocalLookupResult }): CWeightLookupSample {
  return {
    rowKey: item.inputCase.rowKey,
    request: item.inputCase.request,
    source: item.result.source,
    matchMethod: item.result.matchMethod,
    confidence: item.result.confidence,
    chargeableWeightKg: item.result.chargeableWeightKg,
    matchedDescription: item.result.matchedDescription,
  };
}

function mergeGraingerRows(
  graingerRows: readonly CsvRecord[],
  chargeableWeightRows: readonly CsvRecord[],
): CsvRecord[] {
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

export function readCsvIfExists(path: string): CsvRecord[] {
  return existsSync(path) ? parseCsv(readFileSync(path, "utf8")) : [];
}

export function readPitm1CsvFiles(datatestDir: string): CsvRecord[] {
  if (!existsSync(datatestDir)) return [];
  const rows = readdirSync(datatestDir)
    .filter((name) => /^vw@PITM1.*\.csv$/i.test(name))
    .flatMap((name) => readCsvIfExists(join(datatestDir, name)));

  return dedupePitm1Rows(rows);
}

export function dedupePitm1Rows(rows: readonly CsvRecord[]): CsvRecord[] {
  const seen = new Set<string>();
  const deduped: CsvRecord[] = [];

  for (const row of rows) {
    const key = pitm1DedupeKey(row);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(row);
  }

  return deduped;
}

export function readChargeableWeightCsvIfExists(path: string): CsvRecord[] {
  if (!existsSync(path)) return [];
  const text = readFileSync(path, "utf8");
  return text.split(/\r?\n/)
    .slice(1)
    .map((line) => line.trim())
    .filter((line) => line !== "")
    .map((line) => {
      const [graingerNo, cWeight] = line.split(",");
      return {
        GRAINGER_NO: graingerNo?.replace(/^"|"$/g, "").trim() ?? "",
        CWeight: cWeight?.replace(/^"|"$/g, "").trim() ?? "",
        Chargeable_Weight_kgs: cWeight?.replace(/^"|"$/g, "").trim() ?? "",
      };
    })
    .filter((row) => row.GRAINGER_NO !== "");
}

function pitm1DedupeKey(row: CsvRecord): string {
  return textField(row, "TermID")
    ?? [
      textField(row, "VendorCode") ?? "",
      textField(row, "VendorStockItemNo") ?? "",
      textField(row, "U_CalalogNo") ?? "",
      textField(row, "ItemDescription") ?? "",
    ].join("|");
}

function isCase(value: CWeightLookupInputCase | null): value is CWeightLookupInputCase {
  return value !== null;
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
  console.log(JSON.stringify(loadDefaultCWeightLocalReport(), null, 2));
}
