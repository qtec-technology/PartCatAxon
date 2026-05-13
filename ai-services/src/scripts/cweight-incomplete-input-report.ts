import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { CWeightLocalLookupRequest, CWeightLocalLookupSources } from "../services/cweight-local-lookup.service.js";
import type { CsvRecord } from "../services/cweight-sample-analyzer.service.js";
import {
  buildCoverageReport,
  type CWeightLookupCoverageReport,
  type CWeightLookupInputCase,
  readChargeableWeightCsvIfExists,
  readCsvIfExists,
  readPitm1CsvFiles,
  resolveRepoRoot,
} from "./cweight-local-report.js";

export type CWeightIncompleteScenario =
  | "supplier_code_only"
  | "mfr_part_only"
  | "description_only"
  | "short_description_only"
  | "noisy_description_only";

export interface CWeightIncompleteInputReport {
  generatedAt: string;
  sourceRows: {
    graingerRows: number;
    pitm1Rows: number;
    chargeableWeightRows: number;
  };
  scenarios: Record<CWeightIncompleteScenario, CWeightLookupCoverageReport>;
}

export function loadDefaultCWeightIncompleteInputReport(rootDir = process.cwd()): CWeightIncompleteInputReport {
  const resolvedRoot = resolveRepoRoot(rootDir);
  const datatestDir = join(resolvedRoot, ".datatest");
  return buildCWeightIncompleteInputReport({
    graingerRows: readCsvIfExists(join(datatestDir, "@GRAINGER_CWEIGHT.csv")),
    pitm1Rows: readPitm1CsvFiles(datatestDir),
    chargeableWeightRows: readChargeableWeightCsvIfExists(join(datatestDir, "@CHARGEABLEWEIGHT.csv")),
  });
}

export function buildCWeightIncompleteInputReport(input: {
  graingerRows: readonly CsvRecord[];
  pitm1Rows: readonly CsvRecord[];
  chargeableWeightRows?: readonly CsvRecord[];
}): CWeightIncompleteInputReport {
  const chargeableWeightRows = input.chargeableWeightRows ?? [];
  const sources: CWeightLocalLookupSources = {
    graingerRows: mergeGraingerRows(input.graingerRows, chargeableWeightRows),
    pitm1Rows: input.pitm1Rows,
  };
  const baseCases = [
    ...input.graingerRows.map(graingerBaseCase).filter(isCase),
    ...input.pitm1Rows.map(pitm1BaseCase).filter(isCase),
  ];

  return {
    generatedAt: new Date().toISOString(),
    sourceRows: {
      graingerRows: input.graingerRows.length,
      pitm1Rows: input.pitm1Rows.length,
      chargeableWeightRows: chargeableWeightRows.length,
    },
    scenarios: {
      supplier_code_only: buildCoverageReport("supplier_code_only", scenarioCases(baseCases, supplierCodeOnly), sources),
      mfr_part_only: buildCoverageReport("mfr_part_only", scenarioCases(baseCases, mfrPartOnly), sources),
      description_only: buildCoverageReport("description_only", scenarioCases(baseCases, descriptionOnly), sources),
      short_description_only: buildCoverageReport("short_description_only", scenarioCases(baseCases, shortDescriptionOnly), sources),
      noisy_description_only: buildCoverageReport("noisy_description_only", scenarioCases(baseCases, noisyDescriptionOnly), sources),
    },
  };
}

export function buildIncompleteInputCases(input: {
  graingerRows: readonly CsvRecord[];
  pitm1Rows: readonly CsvRecord[];
}): Record<CWeightIncompleteScenario, CWeightLookupInputCase[]> {
  const baseCases = [
    ...input.graingerRows.map(graingerBaseCase).filter(isCase),
    ...input.pitm1Rows.map(pitm1BaseCase).filter(isCase),
  ];

  return {
    supplier_code_only: scenarioCases(baseCases, supplierCodeOnly),
    mfr_part_only: scenarioCases(baseCases, mfrPartOnly),
    description_only: scenarioCases(baseCases, descriptionOnly),
    short_description_only: scenarioCases(baseCases, shortDescriptionOnly),
    noisy_description_only: scenarioCases(baseCases, noisyDescriptionOnly),
  };
}

function graingerBaseCase(row: CsvRecord): CWeightLookupInputCase | null {
  const graingerNo = textField(row, "GRAINGER_NO");
  const description = textField(row, "SHORT_DESC");
  if (graingerNo === null && description === null) return null;
  return {
    source: "grainger",
    rowKey: graingerNo ?? description ?? "",
    request: {
      supplierOrderCode: graingerNo,
      mfrCatalogNo: textField(row, "MFG_PART_NO"),
      mfrBrand: textField(row, "MFG_NAME"),
      description,
    },
  };
}

function pitm1BaseCase(row: CsvRecord): CWeightLookupInputCase | null {
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

function scenarioCases(
  cases: readonly CWeightLookupInputCase[],
  mapper: (inputCase: CWeightLookupInputCase) => CWeightLocalLookupRequest | null,
): CWeightLookupInputCase[] {
  return cases
    .map((inputCase) => {
      const request = mapper(inputCase);
      return request === null ? null : { ...inputCase, request };
    })
    .filter(isCase);
}

function supplierCodeOnly(inputCase: CWeightLookupInputCase): CWeightLocalLookupRequest | null {
  const code = inputCase.request.supplierOrderCode ?? inputCase.request.vendorStockItemNo;
  return code === undefined || code === null || code.trim() === "" ? null : { supplierOrderCode: code };
}

function mfrPartOnly(inputCase: CWeightLookupInputCase): CWeightLocalLookupRequest | null {
  const mfrCatalogNo = inputCase.request.mfrCatalogNo;
  return mfrCatalogNo === undefined || mfrCatalogNo === null || mfrCatalogNo.trim() === "" ? null : { mfrCatalogNo };
}

function descriptionOnly(inputCase: CWeightLookupInputCase): CWeightLocalLookupRequest | null {
  const description = inputCase.request.description;
  return description === undefined || description === null || description.trim() === "" ? null : { description };
}

function shortDescriptionOnly(inputCase: CWeightLookupInputCase): CWeightLocalLookupRequest | null {
  const description = trimDescription(inputCase.request.description, 6);
  return description === null ? null : { description };
}

function noisyDescriptionOnly(inputCase: CWeightLookupInputCase): CWeightLocalLookupRequest | null {
  const description = trimDescription(inputCase.request.description, 8);
  if (description === null) return null;
  return { description: `${description} quote line supplier pack` };
}

function trimDescription(description: string | null | undefined, maxTokens: number): string | null {
  if (description === undefined || description === null) return null;
  const tokens = description
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (tokens.length === 0) return null;
  return tokens.slice(0, maxTokens).join(" ");
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

function isCase(value: CWeightLookupInputCase | null): value is CWeightLookupInputCase {
  return value !== null;
}

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]) {
  console.log(JSON.stringify(loadDefaultCWeightIncompleteInputReport(), null, 2));
}
