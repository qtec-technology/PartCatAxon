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
        // ggCode is Grainger's catalog number (E6: GG CODE); graingerNo is generic fallback key
        graingerNo: firstText(latest.ggCode, latest.graingerNo),
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
        description: firstText(latest.sapDescription, latest.description, latest.itemDescription),
        category1: firstText(latest.itemCategory, latest.category1),
        category2: firstText(latest.category2),
        category3: firstText(latest.category3),
        // Intentionally omit itemWeightKg / length / width / height / dimUnit here.
        // CWeight prefill is a DB identifier lookup — it must not short-circuit via
        // resolveDirectFormula when the user already has an item weight on the form.
        // Direct-formula mode is reserved for when the user explicitly supplies
        // dimensions to compute a dimensional weight, not for prefill.
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
