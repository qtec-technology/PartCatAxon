import { getPool, sql } from '#src/config/database.js';
import { dbObjects } from '#src/config/db-objects.js';
import type { CWeightLocalResearchMatch } from '#src/services/cweight.service.js';

export interface GraingerCWeightLookupInput {
    supplierOrderCode?: string | null;
    manufacturerPartNo?: string | null;
    manufacturerName?: string | null;
}

type GraingerMatchMethod = 'grainger_order_code' | 'manufacturer_part_no_brand' | 'manufacturer_part_no';

export interface GraingerCWeightRow {
    GraingerNo: string | null;
    MfgPartNo: string | null;
    MfgName: string | null;
    SellPackWeightKg: number | string | null;
    VolumetricWeightKg: number | string | null;
    ChargeableWeightKg: number | string | null;
    SWeight: number | string | null;
    VWeight: number | string | null;
    CWeight: number | string | null;
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
    const table = dbObjects.tables.grainger.cweight;
    const request = pool.request();
    request.input('GraingerOrderCode', sql.NVarChar(50), supplierOrderCode);
    request.input('ManufacturerPartNo', sql.NVarChar(100), manufacturerPartNo);
    request.input('ManufacturerName', sql.NVarChar(150), manufacturerName);

    const result = await request.query<GraingerCWeightRow>(`
        SELECT TOP (1)
            [GRAINGER_NO] AS GraingerNo,
            [MFG_PART_NO] AS MfgPartNo,
            [MFG_NAME] AS MfgName,
            [Sell_Pack_Weight_kgs] AS SellPackWeightKg,
            [Volumetric_Weight_kgs] AS VolumetricWeightKg,
            [Chargeable_Weight_kgs] AS ChargeableWeightKg,
            [SWeight],
            [VWeight],
            [CWeight],
            CASE
                WHEN @GraingerOrderCode IS NOT NULL AND LTRIM(RTRIM([GRAINGER_NO])) = @GraingerOrderCode
                    THEN 'grainger_order_code'
                WHEN @ManufacturerName IS NOT NULL AND LTRIM(RTRIM([MFG_PART_NO])) = @ManufacturerPartNo AND LTRIM(RTRIM([MFG_NAME])) = @ManufacturerName
                    THEN 'manufacturer_part_no_brand'
                ELSE 'manufacturer_part_no'
            END AS MatchMethod
        FROM ${table}
        WHERE (
            (@GraingerOrderCode IS NOT NULL AND LTRIM(RTRIM([GRAINGER_NO])) = @GraingerOrderCode)
            OR (@ManufacturerPartNo IS NOT NULL AND LTRIM(RTRIM([MFG_PART_NO])) = @ManufacturerPartNo)
        )
        ORDER BY
            CASE
                WHEN @GraingerOrderCode IS NOT NULL AND LTRIM(RTRIM([GRAINGER_NO])) = @GraingerOrderCode THEN 1
                WHEN @ManufacturerName IS NOT NULL AND LTRIM(RTRIM([MFG_PART_NO])) = @ManufacturerPartNo AND LTRIM(RTRIM([MFG_NAME])) = @ManufacturerName THEN 2
                ELSE 3
            END
    `);

    const row = result.recordset[0];
    return row ? toCWeightLocalResearchMatch(row) : null;
}

export function toCWeightLocalResearchMatch(row: GraingerCWeightRow): CWeightLocalResearchMatch | null {
    const itemWeightKg = positiveOrNull(row.SWeight) ?? positiveOrNull(row.SellPackWeightKg);
    const dimWeightKg = positiveOrNull(row.VWeight) ?? positiveOrNull(row.VolumetricWeightKg);
    const chargeableWeightKg =
        positiveOrNull(row.ChargeableWeightKg) ?? positiveOrNull(row.CWeight) ?? maxPositive(itemWeightKg, dimWeightKg);

    if (chargeableWeightKg === null) {
        return null;
    }

    return {
        decision: 'AUTO_ACCEPT',
        chargeableWeightKg,
        itemWeightKg,
        dimensionL: null,
        dimensionW: null,
        dimensionH: null,
        dimUnit: null,
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

function reasonFor(row: GraingerCWeightRow): string {
    if (row.MatchMethod === 'grainger_order_code') {
        return `Resolved from local GRAINGER @GRAINGER_CWEIGHT exact Grainger code match: ${row.GraingerNo ?? ''}.`;
    }
    if (row.MatchMethod === 'manufacturer_part_no_brand') {
        return `Resolved from local GRAINGER @GRAINGER_CWEIGHT exact manufacturer part and brand match: ${row.MfgPartNo ?? ''} / ${row.MfgName ?? ''}.`;
    }
    return `Resolved from local GRAINGER @GRAINGER_CWEIGHT exact manufacturer part match: ${row.MfgPartNo ?? ''}.`;
}
