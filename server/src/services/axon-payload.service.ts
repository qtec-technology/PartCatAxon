export type HeaderCostBasis = 'HEADER_TOTAL' | 'PER_LINE' | 'PER_UNIT' | 'UNKNOWN';

export interface HeaderCostSuggestion {
    amount: number | null;
    percent?: number | null;
    currency: string | null;
    basis: HeaderCostBasis;
    sourceText: string | null;
    confidence: number;
    needsReview: boolean;
}

export interface HeaderCostSuggestions {
    packingHandling: HeaderCostSuggestion;
    supplierOutboundCost: HeaderCostSuggestion;
    freight: HeaderCostSuggestion;
    customClearance: HeaderCostSuggestion;
    wireTransferFee: HeaderCostSuggestion;
    insurance: HeaderCostSuggestion;
    otherCharges: HeaderCostSuggestion[];
}

const HEADER_COST_KEYS = [
    'packingHandling',
    'supplierOutboundCost',
    'freight',
    'customClearance',
    'wireTransferFee',
    'insurance',
] as const;

type HeaderCostKey = (typeof HEADER_COST_KEYS)[number];

const BASIS_VALUES = new Set<HeaderCostBasis>(['HEADER_TOTAL', 'PER_LINE', 'PER_UNIT', 'UNKNOWN']);

export function extractHeaderCostSuggestions(rawPayloadJson: string | null): HeaderCostSuggestions | null {
    const payload = parseObject(rawPayloadJson);
    if (payload === null) return null;

    const headerCosts = asRecord(payload['headerCosts']);
    const legacySupplierCosts = asRecord(payload['supplierCosts']);
    if (headerCosts === null && legacySupplierCosts === null) return null;

    return {
        packingHandling: normalizeCost(headerCosts?.['packingHandling'] ?? legacySupplierCosts?.['pkhTotal']),
        supplierOutboundCost: normalizeCost(headerCosts?.['supplierOutboundCost'] ?? legacySupplierCosts?.['socTotal']),
        freight: normalizeCost(headerCosts?.['freight'] ?? legacySupplierCosts?.['freightTotal']),
        customClearance: normalizeCost(headerCosts?.['customClearance'] ?? legacySupplierCosts?.['customClearTotal']),
        wireTransferFee: normalizeCost(headerCosts?.['wireTransferFee'] ?? legacySupplierCosts?.['wireTTTotal']),
        insurance: normalizeCost(headerCosts?.['insurance'] ?? legacyInsurancePercent(legacySupplierCosts?.['insurancePercent'])),
        otherCharges: normalizeOtherCharges(headerCosts?.['otherCharges']),
    };
}

function legacyInsurancePercent(value: unknown): Record<string, unknown> | null {
    const percent = positiveOrNull(value);
    return percent === null ? null : { percent, confidence: 0.5, needsReview: true };
}

function normalizeOtherCharges(value: unknown): HeaderCostSuggestion[] {
    return Array.isArray(value) ? value.map(normalizeCost).filter(hasCostEvidence) : [];
}

function normalizeCost(value: unknown): HeaderCostSuggestion {
    const record = asRecord(value);
    if (record === null) {
        const amount = positiveOrNull(value);
        return {
            amount,
            currency: null,
            basis: 'UNKNOWN',
            sourceText: null,
            confidence: amount === null ? 0 : 0.5,
            needsReview: true,
        };
    }

    return {
        amount: positiveOrNull(record['amount']),
        percent: positiveOrNull(record['percent']),
        currency: textOrNull(record['currency']),
        basis: normalizeBasis(record['basis']),
        sourceText: textOrNull(record['sourceText']),
        confidence: clamp(numberOrNull(record['confidence']) ?? 0, 0, 1),
        needsReview: typeof record['needsReview'] === 'boolean' ? record['needsReview'] : true,
    };
}

function hasCostEvidence(value: HeaderCostSuggestion): boolean {
    return value.amount !== null
        || value.percent !== null
        || value.currency !== null
        || value.sourceText !== null
        || value.confidence > 0;
}

function parseObject(rawPayloadJson: string | null): Record<string, unknown> | null {
    if (rawPayloadJson === null || rawPayloadJson.trim() === '') return null;
    try {
        return asRecord(JSON.parse(rawPayloadJson));
    } catch {
        return null;
    }
}

function asRecord(value: unknown): Record<string, unknown> | null {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown>
        : null;
}

function normalizeBasis(value: unknown): HeaderCostBasis {
    const normalized = textOrNull(value)?.toUpperCase();
    return normalized !== null && BASIS_VALUES.has(normalized as HeaderCostBasis)
        ? normalized as HeaderCostBasis
        : 'UNKNOWN';
}

function positiveOrNull(value: unknown): number | null {
    const numeric = numberOrNull(value);
    return numeric !== null && numeric >= 0 ? numeric : null;
}

function numberOrNull(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function textOrNull(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    const normalized = String(value).trim();
    return normalized === '' ? null : normalized;
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}
