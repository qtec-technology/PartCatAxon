import { resolveCWeightLookup, type CWeightLookupInput } from '#src/services/cweight-lookup.service.js';
import type { CWeightResult } from '#src/services/cweight.service.js';

export interface BulkCostCWeightPrefillLineInput {
    lineKey: string;
    latest: Record<string, unknown>;
    lockedByUser?: boolean;
}

export interface BulkCostCWeightPrefillInput {
    defaults?: {
        shipModeNo?: string | number | null;
    };
    lines: BulkCostCWeightPrefillLineInput[];
}

export interface BulkCostCWeightSuggestion extends CWeightResult {
    lineKey: string;
    prefillAllowed: boolean;
}

type ResolveCWeight = (input: CWeightLookupInput) => Promise<CWeightResult>;

export async function resolveBulkCostCWeightPrefill(
    input: BulkCostCWeightPrefillInput,
    resolveCWeight: ResolveCWeight = resolveCWeightLookup,
): Promise<BulkCostCWeightSuggestion[]> {
    const suggestions: BulkCostCWeightSuggestion[] = [];

    for (const line of input.lines) {
        const result = await resolveCWeight(toCWeightLookupInput(line.latest, input.defaults));
        suggestions.push({
            lineKey: line.lineKey,
            prefillAllowed: !line.lockedByUser && result.decision !== 'NOT_FOUND',
            ...result,
        });
    }

    return suggestions;
}

export function toCWeightLookupInput(
    latest: Record<string, unknown>,
    defaults: BulkCostCWeightPrefillInput['defaults'] = {},
): CWeightLookupInput {
    return {
        supplierOrderCode: firstText(
            latest.supplierOrderCode,
            latest.vendorStockItemNo,
            latest.BPStockItemNo,
        ),
        manufacturerPartNo: firstText(
            latest.mfgPartNumber,
            latest.manufacturerPartNo,
            latest.mfrCatalogNo,
            latest.U_Calalogno,
        ),
        manufacturerName: firstText(
            latest.manufacturer,
            latest.manufacturerName,
            latest.mfrBrand,
            latest.U_Brand,
        ),
        itemWeightKg: firstNumber(
            latest.itemWeightKg,
            latest.itemWeightPerEach,
            latest.weight,
            latest.U_Weight,
        ),
        length: firstNumber(latest.length, latest.dimensionL, latest.U_Length),
        width: firstNumber(latest.width, latest.dimensionW, latest.U_Width),
        height: firstNumber(latest.height, latest.dimensionH, latest.U_Height),
        dimUnit: firstDimUnit(latest.dimUnit, latest.dimUnitNo, latest.U_DimUnitNo),
        shipModeNo: firstTextOrNumber(latest.shipModeNo, latest.U_ShipModeNo, defaults?.shipModeNo),
    };
}

function firstText(...values: unknown[]): string | null {
    for (const value of values) {
        if (typeof value !== 'string') continue;
        const normalized = value.trim();
        if (normalized.length > 0) return normalized;
    }
    return null;
}

function firstNumber(...values: unknown[]): number | null {
    for (const value of values) {
        if (value === null || value === undefined || value === '') continue;
        const parsed = typeof value === 'number' ? value : Number(value);
        if (Number.isFinite(parsed)) return parsed;
    }
    return null;
}

function firstTextOrNumber(...values: unknown[]): string | number | null {
    for (const value of values) {
        if (typeof value === 'number' && Number.isFinite(value)) return value;
        if (typeof value !== 'string') continue;
        const normalized = value.trim();
        if (normalized.length > 0) return normalized;
    }
    return null;
}

function firstDimUnit(...values: unknown[]): string | 1 | 2 | null {
    const value = firstTextOrNumber(...values);
    if (value === 1 || value === 2 || typeof value === 'string') return value;
    return null;
}
