export type CWeightDecision = 'AUTO_ACCEPT' | 'REVIEW_SUGGESTION' | 'NOT_FOUND';
export type CWeightDimUnit = 'CM' | 'INCH';
export type CWeightSource = 'direct_formula' | 'local_exact_match' | 'local_semantic_match' | 'not_found';

export interface CWeightLocalResearchMatch {
    decision: Exclude<CWeightDecision, 'NOT_FOUND'>;
    chargeableWeightKg: number | null;
    itemWeightKg: number | null;
    dimensionL: number | null;
    dimensionW: number | null;
    dimensionH: number | null;
    dimUnit: CWeightDimUnit | null;
    source: Exclude<CWeightSource, 'direct_formula' | 'not_found'>;
    confidence: number;
    reason: string;
}

export interface CWeightResolveInput {
    itemWeightKg?: number | null;
    length?: number | null;
    width?: number | null;
    height?: number | null;
    dimUnit?: CWeightDimUnit | 1 | 2 | string | null;
    shipModeNo?: 1 | 2 | 3 | 4 | 5 | 6 | number | string | null;
    localMatch?: CWeightLocalResearchMatch | null;
}

export interface CWeightResult {
    decision: CWeightDecision;
    chargeableWeightKg: number | null;
    itemWeightKg: number | null;
    dimensionL: number | null;
    dimensionW: number | null;
    dimensionH: number | null;
    dimUnit: CWeightDimUnit | null;
    source: CWeightSource;
    confidence: number;
    reason: string;
}

const ROUNDING_STEP_KG = 0.5;
const INCH_TO_LEGACY_CM_VOLUME_FACTOR = 17;
const SEA_MIN_DIM_WEIGHT_KG = 1000;

export function resolveChargeableWeight(input: CWeightResolveInput): CWeightResult {
    const direct = resolveDirectFormula(input);
    if (direct !== null) return direct;

    if (input.localMatch !== undefined && input.localMatch !== null) {
        return normalizeLocalMatch(input.localMatch);
    }

    return notFound('No direct weight/dimension formula inputs or approved local match were provided.');
}

function resolveDirectFormula(input: CWeightResolveInput): CWeightResult | null {
    const itemWeightKg = positiveOrNull(input.itemWeightKg);
    const dimensionL = positiveOrNull(input.length);
    const dimensionW = positiveOrNull(input.width);
    const dimensionH = positiveOrNull(input.height);
    const dimUnit = normalizeDimUnit(input.dimUnit);
    const shipModeNo = normalizeShipModeNo(input.shipModeNo);
    const dimensionalWeightKg =
        dimensionL === null || dimensionW === null || dimensionH === null || dimUnit === null || shipModeNo === null
            ? null
            : calculateDimensionalWeightKg(dimensionL, dimensionW, dimensionH, dimUnit, shipModeNo);

    if (itemWeightKg === null && dimensionalWeightKg === null) {
        return null;
    }

    return {
        decision: 'AUTO_ACCEPT',
        chargeableWeightKg: ceilTo(Math.max(itemWeightKg ?? 0, dimensionalWeightKg ?? 0), ROUNDING_STEP_KG),
        itemWeightKg,
        dimensionL,
        dimensionW,
        dimensionH,
        dimUnit,
        source: 'direct_formula',
        confidence: 0.99,
        reason: 'Calculated locally from supplied actual weight and/or dimensional weight inputs.',
    };
}

function normalizeLocalMatch(match: CWeightLocalResearchMatch): CWeightResult {
    const chargeableWeightKg = positiveOrNull(match.chargeableWeightKg);
    if (chargeableWeightKg === null) {
        return notFound('Local match did not provide a usable chargeable weight.');
    }

    return {
        decision: match.decision,
        chargeableWeightKg,
        itemWeightKg: positiveOrNull(match.itemWeightKg),
        dimensionL: positiveOrNull(match.dimensionL),
        dimensionW: positiveOrNull(match.dimensionW),
        dimensionH: positiveOrNull(match.dimensionH),
        dimUnit: normalizeDimUnit(match.dimUnit),
        source: match.source,
        confidence: clamp(match.confidence, 0, 1),
        reason: match.reason.trim() === '' ? 'Resolved from approved local CWeight research match.' : match.reason.trim(),
    };
}

function calculateDimensionalWeightKg(
    length: number,
    width: number,
    height: number,
    dimUnit: CWeightDimUnit,
    shipModeNo: number,
): number {
    const volume = length * width * height;
    const adjustedVolume = dimUnit === 'INCH' ? volume * INCH_TO_LEGACY_CM_VOLUME_FACTOR : volume;
    const divisor = dimensionalDivisor(shipModeNo);
    const dimensionalWeight = adjustedVolume / divisor;
    return shipModeNo === 2 && dimensionalWeight < SEA_MIN_DIM_WEIGHT_KG
        ? SEA_MIN_DIM_WEIGHT_KG
        : round6(dimensionalWeight);
}

function dimensionalDivisor(shipModeNo: number): number {
    if (shipModeNo === 2) return 1000;
    if (shipModeNo === 3 || shipModeNo === 6) return 5000;
    return 6000;
}

function normalizeDimUnit(value: CWeightResolveInput['dimUnit']): CWeightDimUnit | null {
    if (value === 1) return 'CM';
    if (value === 2) return 'INCH';
    if (typeof value !== 'string') return null;

    const normalized = value.trim().toUpperCase();
    if (normalized === '1' || normalized === 'CM' || normalized === 'CENTIMETER' || normalized === 'CENTIMETERS') {
        return 'CM';
    }
    if (normalized === '2' || normalized === 'INCH' || normalized === 'IN' || normalized === 'INCHES') {
        return 'INCH';
    }
    return null;
}

function normalizeShipModeNo(value: CWeightResolveInput['shipModeNo']): number | null {
    const numeric = typeof value === 'string' ? Number(value.trim()) : value;
    return numeric === 1 || numeric === 2 || numeric === 3 || numeric === 4 || numeric === 5 || numeric === 6
        ? numeric
        : null;
}

function notFound(reason: string): CWeightResult {
    return {
        decision: 'NOT_FOUND',
        chargeableWeightKg: null,
        itemWeightKg: null,
        dimensionL: null,
        dimensionW: null,
        dimensionH: null,
        dimUnit: null,
        source: 'not_found',
        confidence: 0,
        reason,
    };
}

function positiveOrNull(value: number | null | undefined): number | null {
    return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

function ceilTo(value: number, step: number): number {
    return round6(Math.ceil(value / step) * step);
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, Number.isFinite(value) ? value : 0));
}

function round6(value: number): number {
    return Math.round(value * 1000000) / 1000000;
}
