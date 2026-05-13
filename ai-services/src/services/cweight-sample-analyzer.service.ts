import {
  analyzeCWeightSample,
  calculateChargeableWeightKg,
  calculateDimensionalWeightKg,
  type CWeightPatternAnalysis,
  type CWeightSampleRow,
} from "./cweight-pattern.service.js";

export type CsvRecord = Record<string, string>;

export interface Pitm1CWeightRowAnalysis {
  rowKey: string;
  vendorCode: string | null;
  vendorStockItemNo: string | null;
  description: string | null;
  input: CWeightSampleRow;
  calculatedDimensionalWeightKg: number | null;
  calculatedChargeableWeightKg: number | null;
  expectedShipWeightCalKg: number | null;
  expectedCWeightKg: number | null;
  dimensionalWeightMatches: boolean | null;
  shipWeightCalMatches: boolean | null;
  cWeightMatches: boolean | null;
  bestDivisor: number | null;
  issue: "ok" | "missing_dimensions" | "missing_item_weight" | "missing_expected_weight" | "formula_mismatch";
}

export interface Pitm1CWeightSummary {
  totalRows: number;
  analyzableRows: number;
  missingDimensions: number;
  missingItemWeight: number;
  missingExpectedWeight: number;
  dimensionalWeightMatches: number;
  shipWeightCalMatches: number;
  cWeightMatches: number;
  divisorMatches: Record<"5000" | "6000" | "1000", number>;
  formulaMismatches: number;
  rows: Pitm1CWeightRowAnalysis[];
}

export interface GraingerCWeightRowAnalysis {
  graingerNo: string;
  mfgName: string | null;
  mfgPartNo: string | null;
  description: string | null;
  sellPackWeightKg: number | null;
  volumetricWeightKg: number | null;
  chargeableWeightKg: number | null;
  expectedMaxWeightKg: number | null;
  chargeableMatchesMaxWeight: boolean | null;
}

export interface GraingerCWeightSummary {
  totalRows: number;
  analyzableRows: number;
  chargeableMatchesMaxWeight: number;
  missingWeightFields: number;
  mismatches: number;
  rows: GraingerCWeightRowAnalysis[];
}

export function parseCsv(text: string): CsvRecord[] {
  const rows = parseCsvRows(text);
  if (rows.length === 0) return [];

  const headers = rows[0].map((header) => header.trim());
  return rows.slice(1)
    .filter((row) => row.some((cell) => cell.trim() !== ""))
    .map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index]?.trim() ?? ""])));
}

export function analyzePitm1Csv(text: string, options: { includeRows?: boolean } = {}): Pitm1CWeightSummary {
  return analyzePitm1Records(parseCsv(text), options);
}

export function analyzePitm1Records(
  records: readonly CsvRecord[],
  options: { includeRows?: boolean } = {},
): Pitm1CWeightSummary {
  const rows = records.map(analyzePitm1Record);
  const includedRows = options.includeRows === false ? [] : rows;

  return {
    totalRows: records.length,
    analyzableRows: rows.filter((row) => row.issue === "ok").length,
    missingDimensions: rows.filter((row) => row.issue === "missing_dimensions").length,
    missingItemWeight: rows.filter((row) => row.issue === "missing_item_weight").length,
    missingExpectedWeight: rows.filter((row) => row.issue === "missing_expected_weight").length,
    dimensionalWeightMatches: countTrue(okRows(rows).map((row) => row.dimensionalWeightMatches)),
    shipWeightCalMatches: countTrue(okRows(rows).map((row) => row.shipWeightCalMatches)),
    cWeightMatches: countTrue(okRows(rows).map((row) => row.cWeightMatches)),
    divisorMatches: {
      "5000": okRows(rows).filter((row) => row.bestDivisor === 5000).length,
      "6000": okRows(rows).filter((row) => row.bestDivisor === 6000).length,
      "1000": okRows(rows).filter((row) => row.bestDivisor === 1000).length,
    },
    formulaMismatches: rows.filter((row) => row.issue === "formula_mismatch").length,
    rows: includedRows,
  };
}

export function analyzeGraingerCWeightCsv(
  text: string,
  options: { includeRows?: boolean } = {},
): GraingerCWeightSummary {
  return analyzeGraingerCWeightRecords(parseCsv(text), options);
}

export function analyzeGraingerCWeightRecords(
  records: readonly CsvRecord[],
  options: { includeRows?: boolean } = {},
): GraingerCWeightSummary {
  const rows = records.map(analyzeGraingerCWeightRecord);
  const includedRows = options.includeRows === false ? [] : rows;

  return {
    totalRows: records.length,
    analyzableRows: rows.filter((row) => row.chargeableMatchesMaxWeight !== null).length,
    chargeableMatchesMaxWeight: countTrue(rows.map((row) => row.chargeableMatchesMaxWeight)),
    missingWeightFields: rows.filter((row) => row.chargeableMatchesMaxWeight === null).length,
    mismatches: rows.filter((row) => row.chargeableMatchesMaxWeight === false).length,
    rows: includedRows,
  };
}

export function analyzePitm1Record(record: CsvRecord): Pitm1CWeightRowAnalysis {
  const expectedShipWeightCalKg = numberField(record, "U_ShipWeightCal");
  const expectedCWeightKg = numberField(record, "U_CWeight");
  const input: CWeightSampleRow = {
    itemWeightKg: numberField(record, "U_Weight"),
    length: numberField(record, "U_Length"),
    width: numberField(record, "U_Width"),
    height: numberField(record, "U_Height"),
    dimUnit: firstText(record, "U_DimUnitNo", "U_DimUnit"),
    shipModeNo: firstText(record, "U_ShipModeNo", "U_ShipMode"),
    expectedDimensionalWeightKg: numberField(record, "U_DimWeight"),
    expectedChargeableWeightKg: expectedCWeightKg ?? expectedShipWeightCalKg,
  };
  const calculated = calculateChargeableWeightKg(input);
  const pattern = analyzeCWeightSample(input);
  const cWeightMatches = closeOrNull(calculated.chargeableWeightKg, expectedCWeightKg);
  const shipWeightCalMatches = closeOrNull(calculated.chargeableWeightKg, expectedShipWeightCalKg);
  const dimensionalWeightMatches = closeOrNull(calculated.dimensionalWeightKg, input.expectedDimensionalWeightKg ?? null);

  return {
    rowKey: firstText(record, "TermID", "ItemID", "VendorStockItemNo") ?? "",
    vendorCode: firstText(record, "VendorCode"),
    vendorStockItemNo: firstText(record, "VendorStockItemNo"),
    description: firstText(record, "ItemDescription", "SHORT_DESC"),
    input,
    calculatedDimensionalWeightKg: calculated.dimensionalWeightKg,
    calculatedChargeableWeightKg: calculated.chargeableWeightKg,
    expectedShipWeightCalKg,
    expectedCWeightKg,
    dimensionalWeightMatches,
    shipWeightCalMatches,
    cWeightMatches,
    bestDivisor: calculated.dimensionalWeightKg === null ? null : bestDivisor(pattern),
    issue: classifyPitm1Issue(input, expectedShipWeightCalKg, expectedCWeightKg, shipWeightCalMatches, cWeightMatches),
  };
}

export function analyzeGraingerCWeightRecord(record: CsvRecord): GraingerCWeightRowAnalysis {
  const sellPackWeightKg = numberField(record, "Sell_Pack_Weight_kgs", "SWeight");
  const volumetricWeightKg = numberField(record, "Volumetric_Weight_kgs", "VWeight");
  const chargeableWeightKg = numberField(record, "Chargeable_Weight_kgs", "CWeight");
  const expectedMaxWeightKg =
    sellPackWeightKg === null && volumetricWeightKg === null
      ? null
      : Math.max(sellPackWeightKg ?? 0, volumetricWeightKg ?? 0);

  return {
    graingerNo: firstText(record, "GRAINGER_NO") ?? "",
    mfgName: firstText(record, "MFG_NAME"),
    mfgPartNo: firstText(record, "MFG_PART_NO"),
    description: firstText(record, "SHORT_DESC"),
    sellPackWeightKg,
    volumetricWeightKg,
    chargeableWeightKg,
    expectedMaxWeightKg,
    chargeableMatchesMaxWeight: closeOrNull(chargeableWeightKg, expectedMaxWeightKg),
  };
}

function classifyPitm1Issue(
  input: CWeightSampleRow,
  expectedShipWeightCalKg: number | null,
  expectedCWeightKg: number | null,
  shipWeightCalMatches: boolean | null,
  cWeightMatches: boolean | null,
): Pitm1CWeightRowAnalysis["issue"] {
  if (input.length === null || input.width === null || input.height === null || input.dimUnit === null) {
    return "missing_dimensions";
  }
  if (input.itemWeightKg === null) {
    return "missing_item_weight";
  }
  if (expectedShipWeightCalKg === null && expectedCWeightKg === null) {
    return "missing_expected_weight";
  }
  if (shipWeightCalMatches === true || cWeightMatches === true) {
    return "ok";
  }
  return "formula_mismatch";
}

function bestDivisor(pattern: CWeightPatternAnalysis): number | null {
  return pattern.bestCandidate?.divisor ?? null;
}

function okRows(rows: readonly Pitm1CWeightRowAnalysis[]): Pitm1CWeightRowAnalysis[] {
  return rows.filter((row) => row.issue === "ok");
}

function numberField(record: CsvRecord, ...keys: string[]): number | null {
  for (const key of keys) {
    const value = parseNumber(record[key]);
    if (value !== null) return value;
  }
  return null;
}

function firstText(record: CsvRecord, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key]?.trim();
    if (value !== undefined && value !== "" && value.toUpperCase() !== "NULL") {
      return value;
    }
  }
  return null;
}

function parseNumber(value: string | undefined): number | null {
  if (value === undefined) return null;
  const normalized = value.trim().replace(/,/g, "");
  if (normalized === "" || normalized.toUpperCase() === "NULL") return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function closeOrNull(actual: number | null, expected: number | null): boolean | null {
  if (actual === null || expected === null) return null;
  return Math.abs(actual - expected) <= 0.000001;
}

function countTrue(values: readonly (boolean | null)[]): number {
  return values.filter((value) => value === true).length;
}

function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (char === "\"") {
      if (inQuotes && next === "\"") {
        cell += "\"";
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}
