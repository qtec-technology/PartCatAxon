export type DimUnit = "CM" | "INCH";

export type ShipModeNo = 1 | 2 | 3 | 4 | 5 | 6;

export interface CWeightInput {
  itemWeightKg: number | null;
  length: number | null;
  width: number | null;
  height: number | null;
  dimUnit: DimUnit | number | string | null;
  shipModeNo: ShipModeNo | number | string | null;
}

export interface CWeightResult {
  itemWeightKg: number | null;
  dimensionalWeightKg: number | null;
  chargeableWeightKg: number | null;
  dimUnit: DimUnit | null;
  shipModeNo: ShipModeNo | null;
  divisor: number | null;
  volume: number | null;
  adjustedVolume: number | null;
  roundingStepKg: number;
  rule: "max_item_dim_ceiling_0_5" | "missing_required_fields";
}

export interface CWeightSampleRow extends CWeightInput {
  expectedDimensionalWeightKg?: number | null;
  expectedChargeableWeightKg?: number | null;
}

export interface CWeightPatternCandidate {
  divisor: number;
  dimensionalWeightKg: number | null;
  chargeableWeightKg: number | null;
  dimWeightDelta: number | null;
  chargeableWeightDelta: number | null;
  matchesDimWeight: boolean | null;
  matchesChargeableWeight: boolean | null;
}

export interface CWeightPatternAnalysis {
  normalizedInput: CWeightResult;
  candidates: CWeightPatternCandidate[];
  bestCandidate: CWeightPatternCandidate | null;
}

const SHIP_MODE_DIVISOR: Readonly<Record<ShipModeNo, number>> = {
  1: 6000,
  2: 1000,
  3: 5000,
  4: 6000,
  5: 6000,
  6: 5000,
};

const RESEARCH_DIVISORS = [5000, 6000, 1000] as const;
const ROUNDING_STEP_KG = 0.5;
const INCH_TO_LEGACY_CM_VOLUME_FACTOR = 17;
const SEA_MIN_DIM_WEIGHT_KG = 1000;
const MATCH_TOLERANCE_KG = 0.000001;

export function normalizeDimUnit(value: CWeightInput["dimUnit"]): DimUnit | null {
  if (value === 1) return "CM";
  if (value === 2) return "INCH";
  if (typeof value !== "string") return null;

  const normalized = value.trim().toUpperCase();
  if (normalized === "1") return "CM";
  if (normalized === "2") return "INCH";
  if (normalized === "CM" || normalized === "CENTIMETER" || normalized === "CENTIMETERS") {
    return "CM";
  }
  if (normalized === "INCH" || normalized === "IN" || normalized === "INCHES") {
    return "INCH";
  }
  return null;
}

export function normalizeShipModeNo(value: CWeightInput["shipModeNo"]): ShipModeNo | null {
  const numeric = typeof value === "string" ? Number(value.trim()) : value;
  if (numeric === 1 || numeric === 2 || numeric === 3 || numeric === 4 || numeric === 5 || numeric === 6) {
    return numeric;
  }
  return null;
}

export function getShipModeDimensionalDivisor(shipModeNo: ShipModeNo | number | string | null): number | null {
  const normalized = normalizeShipModeNo(shipModeNo);
  return normalized === null ? null : SHIP_MODE_DIVISOR[normalized];
}

export function calculateDimensionalWeightKg(input: CWeightInput, divisorOverride?: number): number | null {
  const l = positiveOrNull(input.length);
  const w = positiveOrNull(input.width);
  const h = positiveOrNull(input.height);
  const unit = normalizeDimUnit(input.dimUnit);
  const divisor = divisorOverride ?? getShipModeDimensionalDivisor(input.shipModeNo);

  if (l === null || w === null || h === null || unit === null || divisor === null || divisor <= 0) {
    return null;
  }

  const adjustedVolume = calculateAdjustedVolume(l, w, h, unit);
  const dimensionalWeight = adjustedVolume / divisor;
  const appliesSeaMinimum = divisorOverride === undefined && normalizeShipModeNo(input.shipModeNo) === 2;
  return appliesSeaMinimum && dimensionalWeight < SEA_MIN_DIM_WEIGHT_KG
    ? SEA_MIN_DIM_WEIGHT_KG
    : round6(dimensionalWeight);
}

export function calculateChargeableWeightKg(input: CWeightInput): CWeightResult {
  const itemWeightKg = positiveOrNull(input.itemWeightKg);
  const dimUnit = normalizeDimUnit(input.dimUnit);
  const shipModeNo = normalizeShipModeNo(input.shipModeNo);
  const divisor = getShipModeDimensionalDivisor(shipModeNo);
  const dimensionalWeightKg = calculateDimensionalWeightKg(input);
  const volume = calculateRawVolume(input.length, input.width, input.height);
  const adjustedVolume =
    volume !== null && dimUnit !== null
      ? calculateAdjustedVolume(input.length as number, input.width as number, input.height as number, dimUnit)
      : null;

  if (itemWeightKg === null && dimensionalWeightKg === null) {
    return {
      itemWeightKg,
      dimensionalWeightKg,
      chargeableWeightKg: null,
      dimUnit,
      shipModeNo,
      divisor,
      volume,
      adjustedVolume,
      roundingStepKg: ROUNDING_STEP_KG,
      rule: "missing_required_fields",
    };
  }

  const baseWeight = Math.max(itemWeightKg ?? 0, dimensionalWeightKg ?? 0);
  return {
    itemWeightKg,
    dimensionalWeightKg,
    chargeableWeightKg: ceilTo(baseWeight, ROUNDING_STEP_KG),
    dimUnit,
    shipModeNo,
    divisor,
    volume,
    adjustedVolume,
    roundingStepKg: ROUNDING_STEP_KG,
    rule: "max_item_dim_ceiling_0_5",
  };
}

export function analyzeCWeightSample(row: CWeightSampleRow): CWeightPatternAnalysis {
  const candidates = RESEARCH_DIVISORS.map((divisor) => buildCandidate(row, divisor));
  const bestCandidate = candidates
    .filter((candidate) => candidate.matchesChargeableWeight || candidate.matchesDimWeight)
    .sort((a, b) => candidateScore(a) - candidateScore(b))[0] ?? null;

  return {
    normalizedInput: calculateChargeableWeightKg(row),
    candidates,
    bestCandidate,
  };
}

function buildCandidate(row: CWeightSampleRow, divisor: number): CWeightPatternCandidate {
  const dimensionalWeightKg = calculateDimensionalWeightKg(row, divisor);
  const itemWeightKg = positiveOrNull(row.itemWeightKg);
  const chargeableWeightKg =
    dimensionalWeightKg === null && itemWeightKg === null
      ? null
      : ceilTo(Math.max(dimensionalWeightKg ?? 0, itemWeightKg ?? 0), ROUNDING_STEP_KG);
  const expectedDim = positiveOrNull(row.expectedDimensionalWeightKg);
  const expectedChargeable = positiveOrNull(row.expectedChargeableWeightKg);
  const dimWeightDelta = delta(dimensionalWeightKg, expectedDim);
  const chargeableWeightDelta = delta(chargeableWeightKg, expectedChargeable);

  return {
    divisor,
    dimensionalWeightKg,
    chargeableWeightKg,
    dimWeightDelta,
    chargeableWeightDelta,
    matchesDimWeight: dimWeightDelta === null ? null : dimWeightDelta <= MATCH_TOLERANCE_KG,
    matchesChargeableWeight: chargeableWeightDelta === null ? null : chargeableWeightDelta <= MATCH_TOLERANCE_KG,
  };
}

function candidateScore(candidate: CWeightPatternCandidate): number {
  return (candidate.chargeableWeightDelta ?? Number.MAX_SAFE_INTEGER) + (candidate.dimWeightDelta ?? 0);
}

function calculateRawVolume(l: number | null, w: number | null, h: number | null): number | null {
  const length = positiveOrNull(l);
  const width = positiveOrNull(w);
  const height = positiveOrNull(h);
  return length === null || width === null || height === null ? null : round6(length * width * height);
}

function calculateAdjustedVolume(l: number, w: number, h: number, dimUnit: DimUnit): number {
  const volume = l * w * h;
  return round6(dimUnit === "INCH" ? volume * INCH_TO_LEGACY_CM_VOLUME_FACTOR : volume);
}

function positiveOrNull(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

function delta(actual: number | null, expected: number | null): number | null {
  return actual === null || expected === null ? null : Math.abs(round6(actual - expected));
}

function ceilTo(value: number, step: number): number {
  return round6(Math.ceil(value / step) * step);
}

function round6(value: number): number {
  return Math.round(value * 1000000) / 1000000;
}
