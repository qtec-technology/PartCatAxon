import { getPool, sql } from '#src/config/database.js';
import { dbObjects } from '#src/config/db-objects.js';
import type { CWeightLocalResearchMatch } from '#src/services/cweight.service.js';

export interface GraingerCWeightLookupInput {
    supplierOrderCode?: string | null;
    manufacturerPartNo?: string | null;
    manufacturerName?: string | null;
}

type GraingerMatchMethod = 'grainger_order_code' | 'manufacturer_part_no_brand' | 'manufacturer_part_no';

interface GraingerWeightDataRow {
    GraingerOrderCode: string | null;
    ManufacturerPartNo: string | null;
    ManufacturerName: string | null;
    ItemWeightKg: number | string | null;
    LengthCm: number | string | null;
    WidthCm: number | string | null;
    HeightCm: number | string | null;
    DimWeightKg: number | string | null;
    MatchMethod: GraingerMatchMethod;
}

export async function findGraingerCWeightExactMatch(
    input: GraingerCWeightLookupInput,
): Promise<CWeightLocalResearchMatch | null> {
    const supplierOrderCode = cleanText(input.supplierOrderCode);
    const manufacturerPartNo = cleanText(input.manufacturerPartNo);
    const manufacturerName = cleanText(input.manufacturerName);

    if (supplierOrderCode === null && manufacturerPartNo === null) {
        return null;
    }

    const pool = await getPool();
    const table = dbObjects.tables.qtec.graingerWeightData;
    const request = pool.request();
    request.input('GraingerOrderCode', sql.NVarChar(50), supplierOrderCode);
    request.input('ManufacturerPartNo', sql.NVarChar(100), manufacturerPartNo);
    request.input('ManufacturerName', sql.NVarChar(150), manufacturerName);

    const result = await request.query<GraingerWeightDataRow>(`
        SELECT TOP (1)
            GraingerOrderCode,
            ManufacturerPartNo,
            ManufacturerName,
            ItemWeightKg,
            LengthCm,
            WidthCm,
            HeightCm,
            DimWeightKg,
            CASE
                WHEN @GraingerOrderCode IS NOT NULL AND GraingerOrderCode = @GraingerOrderCode
                    THEN 'grainger_order_code'
                WHEN @ManufacturerName IS NOT NULL AND ManufacturerPartNo = @ManufacturerPartNo AND ManufacturerName = @ManufacturerName
                    THEN 'manufacturer_part_no_brand'
                ELSE 'manufacturer_part_no'
            END AS MatchMethod
        FROM ${table}
        WHERE IsActive = 1
          AND (
            (@GraingerOrderCode IS NOT NULL AND GraingerOrderCode = @GraingerOrderCode)
            OR (@ManufacturerPartNo IS NOT NULL AND ManufacturerPartNo = @ManufacturerPartNo)
          )
        ORDER BY
            CASE
                WHEN @GraingerOrderCode IS NOT NULL AND GraingerOrderCode = @GraingerOrderCode THEN 1
                WHEN @ManufacturerName IS NOT NULL AND ManufacturerPartNo = @ManufacturerPartNo AND ManufacturerName = @ManufacturerName THEN 2
                ELSE 3
            END,
            WeightDataID DESC
    `);

    const row = result.recordset[0];
    return row ? toCWeightLocalResearchMatch(row) : null;
}

export function toCWeightLocalResearchMatch(row: GraingerWeightDataRow): CWeightLocalResearchMatch | null {
    const itemWeightKg = positiveOrNull(row.ItemWeightKg);
    const dimWeightKg = positiveOrNull(row.DimWeightKg);
    const chargeableWeightKg = maxPositive(itemWeightKg, dimWeightKg);

    if (chargeableWeightKg === null) {
        return null;
    }

    return {
        decision: 'AUTO_ACCEPT',
        chargeableWeightKg,
        itemWeightKg,
        dimensionL: positiveOrNull(row.LengthCm),
        dimensionW: positiveOrNull(row.WidthCm),
        dimensionH: positiveOrNull(row.HeightCm),
        dimUnit: 'CM',
        source: 'local_exact_match',
        confidence: confidenceFor(row.MatchMethod),
        reason: reasonFor(row),
    };
}

function cleanText(value: string | null | undefined): string | null {
    const normalized = String(value ?? '').trim();
    return normalized.length > 0 ? normalized : null;
}

function positiveOrNull(value: number | string | null): number | null {
    const parsed = typeof value === 'string' ? Number(value) : value;
    return typeof parsed === 'number' && Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function maxPositive(left: number | null, right: number | null): number | null {
    if (left === null) return right;
    if (right === null) return left;
    return Math.max(left, right);
}

function confidenceFor(method: GraingerMatchMethod): number {
    if (method === 'grainger_order_code') return 0.97;
    if (method === 'manufacturer_part_no_brand') return 0.94;
    return 0.9;
}

function reasonFor(row: GraingerWeightDataRow): string {
    if (row.MatchMethod === 'grainger_order_code') {
        return `Resolved from local GraingerWeightData exact Grainger code match: ${row.GraingerOrderCode ?? ''}.`;
    }
    if (row.MatchMethod === 'manufacturer_part_no_brand') {
        return `Resolved from local GraingerWeightData exact manufacturer part and brand match: ${row.ManufacturerPartNo ?? ''} / ${row.ManufacturerName ?? ''}.`;
    }
    return `Resolved from local GraingerWeightData exact manufacturer part match: ${row.ManufacturerPartNo ?? ''}.`;
}
