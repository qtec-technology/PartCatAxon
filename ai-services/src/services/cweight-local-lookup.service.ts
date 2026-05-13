import {
  calculateChargeableWeightKg,
  normalizeDimUnit,
  type CWeightInput,
  type DimUnit,
} from "./cweight-pattern.service.js";
import { searchCWeightDescriptions, type CWeightSearchDocument } from "./cweight-semantic-search.service.js";
import type { CsvRecord } from "./cweight-sample-analyzer.service.js";

export interface CWeightLocalLookupRequest {
  supplierOrderCode?: string | null;
  vendorStockItemNo?: string | null;
  mfrBrand?: string | null;
  mfrCatalogNo?: string | null;
  description?: string | null;
  uom?: string | null;
  itemWeightKg?: number | null;
  length?: number | null;
  width?: number | null;
  height?: number | null;
  dimUnit?: CWeightInput["dimUnit"];
  shipModeNo?: CWeightInput["shipModeNo"];
}

export interface CWeightLocalLookupSources {
  graingerRows?: readonly CsvRecord[];
  pitm1Rows?: readonly CsvRecord[];
}

export type CWeightLocalMatchMethod =
  | "direct_formula"
  | "grainger_no_exact"
  | "grainger_mfg_part_exact"
  | "pitm1_vendor_stock_exact"
  | "pitm1_catalog_exact"
  | "description_exact"
  | "description_semantic"
  | "not_found";

export type CWeightLookupDecision = "AUTO_ACCEPT" | "REVIEW_SUGGESTION" | "NOT_FOUND";

export interface CWeightLocalLookupResult {
  itemWeightKg: number | null;
  chargeableWeightKg: number | null;
  dimensionL: number | null;
  dimensionW: number | null;
  dimensionH: number | null;
  dimUnit: DimUnit | null;
  source: "direct_formula" | "grainger" | "legacy_term" | "not_found";
  confidence: number;
  matchMethod: CWeightLocalMatchMethod;
  decision: CWeightLookupDecision;
  matchedKey: string | null;
  matchedDescription: string | null;
  rawRow?: CsvRecord;
}

const notFound = (): CWeightLocalLookupResult => ({
  itemWeightKg: null,
  chargeableWeightKg: null,
  dimensionL: null,
  dimensionW: null,
  dimensionH: null,
  dimUnit: null,
  source: "not_found",
  confidence: 0,
  matchMethod: "not_found",
  decision: "NOT_FOUND",
  matchedKey: null,
  matchedDescription: null,
});

export function lookupLocalCWeight(
  request: CWeightLocalLookupRequest,
  sources: CWeightLocalLookupSources,
): CWeightLocalLookupResult {
  const graingerRows = sources.graingerRows ?? [];
  const pitm1Rows = sources.pitm1Rows ?? [];
  const directFormula = directFormulaResult(request);
  if (directFormula !== null) return directFormula;

  const graingerNo = normalizeKey(request.supplierOrderCode);
  if (graingerNo !== null) {
    const row = findByNormalizedField(graingerRows, "GRAINGER_NO", graingerNo);
    if (row !== null) return graingerResult(row, "grainger_no_exact", graingerNo, 0.97);
  }

  const mfrCatalogNo = normalizeKey(request.mfrCatalogNo);
  if (mfrCatalogNo !== null) {
    const row = findByNormalizedField(graingerRows, "MFG_PART_NO", mfrCatalogNo);
    if (row !== null) return graingerResult(row, "grainger_mfg_part_exact", mfrCatalogNo, 0.93);
  }

  const vendorStockItemNo = normalizeKey(request.vendorStockItemNo ?? request.supplierOrderCode);
  if (vendorStockItemNo !== null) {
    const row = findByNormalizedField(pitm1Rows, "VendorStockItemNo", vendorStockItemNo);
    if (row !== null) return pitm1Result(row, "pitm1_vendor_stock_exact", vendorStockItemNo, 0.9);
  }

  if (mfrCatalogNo !== null) {
    const row = findByNormalizedField(pitm1Rows, "U_CalalogNo", mfrCatalogNo);
    if (row !== null) return pitm1Result(row, "pitm1_catalog_exact", mfrCatalogNo, 0.86);
  }

  const description = normalizeText(request.description);
  if (description !== null) {
    const exact = findByNormalizedDescription([...graingerRows, ...pitm1Rows], description);
    if (exact !== null) return rowResult(exact, "description_exact", description, 0.74);

    const semanticMatch = searchCWeightDescriptions(description, buildDescriptionDocuments([...graingerRows, ...pitm1Rows]));
    if (semanticMatch !== null && !semanticMatch.ambiguous) {
      return rowResult(
        semanticMatch.document.row,
        "description_semantic",
        description,
        semanticMatch.score >= 0.72 ? 0.68 : 0.58,
      );
    }
  }

  return notFound();
}

export function normalizeLookupText(value: string | null | undefined): string | null {
  return normalizeText(value);
}

function rowResult(
  row: CsvRecord,
  matchMethod: CWeightLocalMatchMethod,
  matchedKey: string,
  confidence: number,
): CWeightLocalLookupResult {
  return isGraingerRow(row)
    ? graingerResult(row, matchMethod, matchedKey, confidence)
    : pitm1Result(row, matchMethod, matchedKey, confidence);
}

function directFormulaResult(request: CWeightLocalLookupRequest): CWeightLocalLookupResult | null {
  const calculated = calculateChargeableWeightKg({
    itemWeightKg: request.itemWeightKg ?? null,
    length: request.length ?? null,
    width: request.width ?? null,
    height: request.height ?? null,
    dimUnit: request.dimUnit ?? null,
    shipModeNo: request.shipModeNo ?? null,
  });

  if (calculated.chargeableWeightKg === null) return null;

  return {
    itemWeightKg: calculated.itemWeightKg,
    chargeableWeightKg: calculated.chargeableWeightKg,
    dimensionL: numberOrNull(request.length),
    dimensionW: numberOrNull(request.width),
    dimensionH: numberOrNull(request.height),
    dimUnit: calculated.dimUnit,
    source: "direct_formula",
    confidence: 0.99,
    matchMethod: "direct_formula",
    decision: "AUTO_ACCEPT",
    matchedKey: null,
    matchedDescription: normalizeText(request.description),
  };
}

function graingerResult(
  row: CsvRecord,
  matchMethod: CWeightLocalMatchMethod,
  matchedKey: string,
  confidence: number,
): CWeightLocalLookupResult {
  return {
    itemWeightKg: numberField(row, "Sell_Pack_Weight_kgs", "SWeight"),
    chargeableWeightKg: numberField(row, "Chargeable_Weight_kgs", "CWeight"),
    dimensionL: null,
    dimensionW: null,
    dimensionH: null,
    dimUnit: null,
    source: "grainger",
    confidence,
    matchMethod,
    decision: decisionFor(matchMethod),
    matchedKey,
    matchedDescription: textField(row, "SHORT_DESC"),
    rawRow: row,
  };
}

function pitm1Result(
  row: CsvRecord,
  matchMethod: CWeightLocalMatchMethod,
  matchedKey: string,
  confidence: number,
): CWeightLocalLookupResult {
  const dimensionL = numberField(row, "U_Length");
  const dimensionW = numberField(row, "U_Width");
  const dimensionH = numberField(row, "U_Height");
  const itemWeightKg = numberField(row, "U_Weight");
  const dimUnit = normalizeDimUnit(textField(row, "U_DimUnitNo") ?? textField(row, "U_DimUnit"));
  const explicitChargeable = numberField(row, "U_CWeight", "U_ShipWeightCal");
  const calculated = calculateChargeableWeightKg({
    itemWeightKg,
    length: dimensionL,
    width: dimensionW,
    height: dimensionH,
    dimUnit,
    shipModeNo: textField(row, "U_ShipModeNo"),
  });

  return {
    itemWeightKg,
    chargeableWeightKg: explicitChargeable ?? calculated.chargeableWeightKg,
    dimensionL,
    dimensionW,
    dimensionH,
    dimUnit,
    source: "legacy_term",
    confidence,
    matchMethod,
    decision: decisionFor(matchMethod),
    matchedKey,
    matchedDescription: textField(row, "ItemDescription", "SHORT_DESC"),
    rawRow: row,
  };
}

function findByNormalizedField(rows: readonly CsvRecord[], field: string, normalizedValue: string): CsvRecord | null {
  return rows.find((row) => normalizeKey(row[field]) === normalizedValue) ?? null;
}

function findByNormalizedDescription(rows: readonly CsvRecord[], normalizedDescription: string): CsvRecord | null {
  const matches = rows.filter((row) => normalizeText(textField(row, "SHORT_DESC", "ItemDescription")) === normalizedDescription);
  return matches.length === 1 ? matches[0] : null;
}

function buildDescriptionDocuments(rows: readonly CsvRecord[]): CWeightSearchDocument[] {
  return rows
    .map((row, index) => {
      const description = textField(row, "SHORT_DESC", "ItemDescription");
      return description === null
        ? null
        : {
          id: textField(row, "GRAINGER_NO", "TermID", "ItemID", "VendorStockItemNo", "U_CalalogNo") ?? String(index),
          description,
          row,
        };
    })
    .filter((document): document is CWeightSearchDocument => document !== null);
}

function isGraingerRow(row: CsvRecord): boolean {
  return textField(row, "GRAINGER_NO") !== null;
}

function normalizeKey(value: string | null | undefined): string | null {
  const normalized = value?.trim().toUpperCase();
  return normalized === undefined || normalized === "" || normalized === "NULL" ? null : normalized;
}

function normalizeText(value: string | null | undefined): string | null {
  const normalized = value
    ?.toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
  return normalized === undefined || normalized === "" || normalized === "null" ? null : normalized;
}

function textField(record: CsvRecord, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key]?.trim();
    if (value !== undefined && value !== "" && value.toUpperCase() !== "NULL") return value;
  }
  return null;
}

function numberField(record: CsvRecord, ...keys: string[]): number | null {
  for (const key of keys) {
    const value = record[key]?.trim().replace(/,/g, "");
    if (value === undefined || value === "" || value.toUpperCase() === "NULL") continue;
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return null;
}

function numberOrNull(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

function decisionFor(matchMethod: CWeightLocalMatchMethod): CWeightLookupDecision {
  if (matchMethod === "not_found") return "NOT_FOUND";
  if (matchMethod === "description_exact" || matchMethod === "description_semantic") return "REVIEW_SUGGESTION";
  return "AUTO_ACCEPT";
}
