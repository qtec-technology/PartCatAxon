import { getPool, sql } from '#src/config/database.js';
import { dbObjects } from '#src/config/db-objects.js';
import type { CWeightCandidate, CWeightLocalResearchMatch } from '#src/services/cweight.service.js';

export interface GraingerCWeightLookupInput {
    supplierOrderCode?: string | null;
    manufacturerPartNo?: string | null;
    manufacturerName?: string | null;
}

type GraingerMatchMethod =
    | 'grainger_order_code'
    | 'manufacturer_part_no_brand'
    | 'manufacturer_part_no'
    | 'manufacturer_part_no_ambiguous'
    | 'normalized_mfg_part_no_brand'
    | 'normalized_mfg_part_no'
    | 'normalized_mfg_part_no_ambiguous'
    | 'description_keyword';

export interface GraingerCWeightRow {
    GraingerNo: string | null;
    MfgPartNo: string | null;
    MfgName: string | null;
    ItemWeightKg: number | string | null;
    DimsWeightKg: number | string | null;
    ChargeableWeightKg: number | string | null;
    MatchMethod: GraingerMatchMethod;
    ShortDesc: string | null;
    GraingerWebLink: string | null;
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
    const table = dbObjects.tables.qtec.cweight;
    const request = pool.request();
    request.input('GraingerOrderCode', sql.NVarChar(50), supplierOrderCode);
    request.input('ManufacturerPartNo', sql.NVarChar(100), manufacturerPartNo);
    request.input('ManufacturerName', sql.NVarChar(150), manufacturerName);

    const result = await request.query<GraingerCWeightRow>(`
        WITH RankedMatches AS (
            SELECT
                [GRAINGER NO]              AS GraingerNo,
                [MFG PART NO]              AS MfgPartNo,
                [MFG NAME]                 AS MfgName,
                [Weight (kgs)]             AS ItemWeightKg,
                [Dims Weight (kg)]         AS DimsWeightKg,
                [Chargeable Weight (kg)]   AS ChargeableWeightKg,
                [SHORT DESC]               AS ShortDesc,
                [Grainger Web Link]        AS GraingerWebLink,
                CASE
                    WHEN @GraingerOrderCode IS NOT NULL
                         AND LTRIM(RTRIM([GRAINGER NO])) = @GraingerOrderCode
                        THEN 1
                    WHEN @ManufacturerName IS NOT NULL
                         AND LTRIM(RTRIM([MFG PART NO])) = @ManufacturerPartNo
                         AND LTRIM(RTRIM([MFG NAME]))    = @ManufacturerName
                        THEN 2
                    ELSE 3
                END AS MatchPriority,
                -- Count how many rows match MFG Part No alone (used for ambiguity check)
                SUM(CASE
                    WHEN @ManufacturerPartNo IS NOT NULL
                         AND LTRIM(RTRIM([MFG PART NO])) = @ManufacturerPartNo
                        THEN 1 ELSE 0
                END) OVER () AS MfgOnlyCount
            FROM ${table}
            WHERE
                (@GraingerOrderCode IS NOT NULL AND LTRIM(RTRIM([GRAINGER NO])) = @GraingerOrderCode)
                OR (@ManufacturerPartNo IS NOT NULL AND LTRIM(RTRIM([MFG PART NO])) = @ManufacturerPartNo)
        )
        SELECT TOP (1)
            GraingerNo,
            MfgPartNo,
            MfgName,
            ItemWeightKg,
            DimsWeightKg,
            ChargeableWeightKg,
            ShortDesc,
            GraingerWebLink,
            CASE
                WHEN MatchPriority = 1 THEN 'grainger_order_code'
                WHEN MatchPriority = 2 THEN 'manufacturer_part_no_brand'
                WHEN MfgOnlyCount = 1  THEN 'manufacturer_part_no'
                ELSE                       'manufacturer_part_no_ambiguous'
            END AS MatchMethod
        FROM RankedMatches
        ORDER BY MatchPriority
    `);

    const row = result.recordset[0];
    return row ? toCWeightLocalResearchMatch(row) : null;
}

export function toCWeightLocalResearchMatch(row: GraingerCWeightRow): CWeightLocalResearchMatch | null {
    const itemWeightKg = positiveOrNull(row.ItemWeightKg);
    const dimWeightKg = positiveOrNull(row.DimsWeightKg);
    const chargeableWeightKg =
        positiveOrNull(row.ChargeableWeightKg) ?? maxPositive(itemWeightKg, dimWeightKg);

    if (chargeableWeightKg === null) {
        return null;
    }

    const isAmbiguous = row.MatchMethod === 'manufacturer_part_no_ambiguous'
        || row.MatchMethod === 'normalized_mfg_part_no_ambiguous';
    const isExact = row.MatchMethod === 'grainger_order_code'
        || row.MatchMethod === 'manufacturer_part_no_brand'
        || row.MatchMethod === 'manufacturer_part_no';

    return {
        decision: isExact ? 'AUTO_ACCEPT' : 'REVIEW_SUGGESTION',
        chargeableWeightKg,
        itemWeightKg,
        dimensionalWeightKg: dimWeightKg,
        dimensionL: null,
        dimensionW: null,
        dimensionH: null,
        dimUnit: null,
        source: isExact ? 'local_exact_match' : 'local_semantic_match',
        confidence: confidenceFor(row.MatchMethod),
        reason: reasonFor(row),
        matchedGraingerNo: typeof row.GraingerNo === 'string' && row.GraingerNo.trim().length > 0
            ? row.GraingerNo.trim()
            : null,
        matchedMfgPartNo: typeof row.MfgPartNo === 'string' && row.MfgPartNo.trim().length > 0
            ? row.MfgPartNo.trim()
            : null,
        matchedBrand: typeof row.MfgName === 'string' && row.MfgName.trim().length > 0
            ? row.MfgName.trim()
            : null,
        evidence: buildEvidence(row),
    };
}

function buildEvidence(row: Pick<GraingerCWeightRow, 'ShortDesc' | 'GraingerWebLink'>): string | null {
    const parts: string[] = [];
    if (typeof row.ShortDesc === 'string' && row.ShortDesc.trim().length > 0) {
        parts.push(row.ShortDesc.trim());
    }
    if (typeof row.GraingerWebLink === 'string' && row.GraingerWebLink.trim().length > 0) {
        parts.push(row.GraingerWebLink.trim());
    }
    return parts.length > 0 ? parts.join(' | ') : null;
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
    switch (method) {
        case 'grainger_order_code': return 0.97;
        case 'manufacturer_part_no_brand': return 0.94;
        case 'manufacturer_part_no': return 0.90;
        case 'manufacturer_part_no_ambiguous': return 0.70;
        case 'normalized_mfg_part_no_brand': return 0.82;
        case 'normalized_mfg_part_no': return 0.75;
        case 'normalized_mfg_part_no_ambiguous': return 0.60;
        case 'description_keyword': return 0.55;
    }
}

function reasonFor(row: GraingerCWeightRow): string {
    switch (row.MatchMethod) {
        case 'grainger_order_code':
            return `Exact Grainger code match: ${row.GraingerNo ?? ''}.`;
        case 'manufacturer_part_no_brand':
            return `Exact MFG part + brand match: ${row.MfgPartNo ?? ''} / ${row.MfgName ?? ''}.`;
        case 'manufacturer_part_no':
            return `Exact MFG part match: ${row.MfgPartNo ?? ''}.`;
        case 'manufacturer_part_no_ambiguous':
            return `Ambiguous MFG part — multiple products share ${row.MfgPartNo ?? ''}; review required.`;
        case 'normalized_mfg_part_no_brand':
            return `Normalized MFG part + brand match: ${row.MfgPartNo ?? ''} / ${row.MfgName ?? ''}; review recommended.`;
        case 'normalized_mfg_part_no':
            return `Normalized MFG part match: ${row.MfgPartNo ?? ''}; review recommended.`;
        case 'normalized_mfg_part_no_ambiguous':
            return `Normalized MFG part is ambiguous for ${row.MfgPartNo ?? ''}; review required.`;
        case 'description_keyword':
            return `Description keyword match (GG: ${row.GraingerNo ?? ''}, MFG: ${row.MfgPartNo ?? ''}); review required.`;
    }
}

// ── Normalized MFG Part No lookup (step 3.5) ────────────────────────────────
// Strips dashes, spaces and dots before comparing so that e.g. "1875-208BL"
// matches a row stored as "1875208BL".  Always returns REVIEW_SUGGESTION.

export async function findGraingerCWeightNormalizedMatch(
    input: GraingerCWeightLookupInput,
): Promise<CWeightLocalResearchMatch | null> {
    const manufacturerPartNo = cleanText(input.manufacturerPartNo);
    if (manufacturerPartNo === null) return null;

    const normalizedPartNo = manufacturerPartNo.toUpperCase().replace(/[-\s.]/g, '');
    const manufacturerName = cleanText(input.manufacturerName);

    const pool = await getPool();
    const table = dbObjects.tables.qtec.cweight;
    const request = pool.request();
    request.input('NormalizedPartNo', sql.NVarChar(100), normalizedPartNo);
    request.input('ManufacturerName', sql.NVarChar(150), manufacturerName);

    const result = await request.query<GraingerCWeightRow>(`
        WITH NormalizedMatches AS (
            SELECT
                [GRAINGER NO]              AS GraingerNo,
                [MFG PART NO]              AS MfgPartNo,
                [MFG NAME]                 AS MfgName,
                [Weight (kgs)]             AS ItemWeightKg,
                [Dims Weight (kg)]         AS DimsWeightKg,
                [Chargeable Weight (kg)]   AS ChargeableWeightKg,
                [SHORT DESC]               AS ShortDesc,
                [Grainger Web Link]        AS GraingerWebLink,
                CASE
                    WHEN @ManufacturerName IS NOT NULL
                         AND UPPER(LTRIM(RTRIM([MFG NAME]))) = UPPER(@ManufacturerName)
                        THEN 1
                    ELSE 2
                END AS MatchPriority,
                SUM(1) OVER () AS TotalCount
            FROM ${table}
            WHERE
                UPPER(REPLACE(REPLACE(REPLACE(LTRIM(RTRIM([MFG PART NO])), '-', ''), ' ', ''), '.', ''))
                    = @NormalizedPartNo
        )
        SELECT TOP (1)
            GraingerNo, MfgPartNo, MfgName,
            ItemWeightKg, DimsWeightKg, ChargeableWeightKg,
            ShortDesc, GraingerWebLink,
            CASE
                WHEN MatchPriority = 1 THEN 'normalized_mfg_part_no_brand'
                WHEN TotalCount = 1    THEN 'normalized_mfg_part_no'
                ELSE                       'normalized_mfg_part_no_ambiguous'
            END AS MatchMethod
        FROM NormalizedMatches
        ORDER BY MatchPriority
    `);

    const row = result.recordset[0];
    return row ? toCWeightLocalResearchMatch(row) : null;
}

// ── Description keyword lookup (step 4) ─────────────────────────────────────
// Extracts up to 3 significant keywords from description and searches
// [SHORT DESC] with LIKE patterns.  Category1 narrows the search when present.
// Returns REVIEW_SUGGESTION (confidence 0.55) — never AUTO_ACCEPT.

export interface GraingerCWeightDescriptionInput {
    description: string;
    category1?: string | null;
    manufacturerName?: string | null;
}

export async function findGraingerCWeightByDescription(
    input: GraingerCWeightDescriptionInput,
): Promise<CWeightLocalResearchMatch | null> {
    const keywords = extractKeywords(input.description);
    if (keywords.length < 2) return null;

    const [kw0, kw1, kw2] = keywords;
    const category1 = cleanText(input.category1);

    const pool = await getPool();
    const table = dbObjects.tables.qtec.cweight;
    const request = pool.request();
    request.input('Category1', sql.NVarChar(100), category1);
    request.input('Pattern0', sql.NVarChar(200), `%${kw0}%`);
    request.input('Pattern1', sql.NVarChar(200), `%${kw1}%`);
    request.input('Pattern2', sql.NVarChar(200), kw2 != null ? `%${kw2}%` : null);

    const result = await request.query<GraingerCWeightRow>(`
        SELECT TOP (1)
            [GRAINGER NO]              AS GraingerNo,
            [MFG PART NO]              AS MfgPartNo,
            [MFG NAME]                 AS MfgName,
            [Weight (kgs)]             AS ItemWeightKg,
            [Dims Weight (kg)]         AS DimsWeightKg,
            [Chargeable Weight (kg)]   AS ChargeableWeightKg,
            [SHORT DESC]               AS ShortDesc,
            [Grainger Web Link]        AS GraingerWebLink,
            'description_keyword'      AS MatchMethod
        FROM ${table}
        WHERE
            (@Category1 IS NULL OR UPPER(LTRIM(RTRIM([CATEGORY 1]))) = UPPER(@Category1))
            AND [SHORT DESC] LIKE @Pattern0
            AND [SHORT DESC] LIKE @Pattern1
            AND (@Pattern2 IS NULL OR [SHORT DESC] LIKE @Pattern2)
        ORDER BY [Chargeable Weight (kg)] DESC
    `);

    const row = result.recordset[0];
    return row ? toCWeightLocalResearchMatch(row) : null;
}

export function extractKeywords(description: string): string[] {
    const stopWords = new Set([
        'the', 'and', 'for', 'with', 'each', 'per', 'in', 'of', 'a', 'an',
        'to', 'is', 'it', 'by', 'at', 'or', 'as', 'no', 'not',
    ]);
    return description
        .toUpperCase()
        .split(/[\s,;/()\-.]+/)
        .filter(w => w.length >= 3 && !stopWords.has(w.toLowerCase()))
        .slice(0, 3);
}

// ── Ambiguous candidates (step B) ────────────────────────────────────────────
// Returns up to 5 rows matching the given MFG Part No (exact) for user
// selection when the primary match is ambiguous or a semantic fallback.

export async function findGraingerCWeightCandidates(
    input: GraingerCWeightLookupInput,
): Promise<CWeightCandidate[]> {
    const manufacturerPartNo = cleanText(input.manufacturerPartNo);
    if (manufacturerPartNo === null) return [];

    const pool = await getPool();
    const table = dbObjects.tables.qtec.cweight;
    const request = pool.request();
    request.input('ManufacturerPartNo', sql.NVarChar(100), manufacturerPartNo);

    const result = await request.query<{
        GraingerNo: string | null;
        MfgPartNo: string | null;
        MfgName: string | null;
        ItemWeightKg: number | string | null;
        DimsWeightKg: number | string | null;
        ChargeableWeightKg: number | string | null;
        ShortDesc: string | null;
        GraingerWebLink: string | null;
    }>(`
        SELECT TOP (5)
            [GRAINGER NO]              AS GraingerNo,
            [MFG PART NO]              AS MfgPartNo,
            [MFG NAME]                 AS MfgName,
            [Weight (kgs)]             AS ItemWeightKg,
            [Dims Weight (kg)]         AS DimsWeightKg,
            [Chargeable Weight (kg)]   AS ChargeableWeightKg,
            [SHORT DESC]               AS ShortDesc,
            [Grainger Web Link]        AS GraingerWebLink
        FROM ${table}
        WHERE LTRIM(RTRIM([MFG PART NO])) = @ManufacturerPartNo
        ORDER BY [Chargeable Weight (kg)] DESC
    `);

    return result.recordset
        .map((row): CWeightCandidate | null => {
            const itemWeightKg = positiveOrNull(row.ItemWeightKg);
            const dimWeightKg = positiveOrNull(row.DimsWeightKg);
            const chargeableWeightKg = positiveOrNull(row.ChargeableWeightKg) ?? maxPositive(itemWeightKg, dimWeightKg);
            if (chargeableWeightKg === null) return null;
            return {
                chargeableWeightKg,
                itemWeightKg,
                matchedGraingerNo: typeof row.GraingerNo === 'string' && row.GraingerNo.trim() ? row.GraingerNo.trim() : null,
                matchedMfgPartNo: typeof row.MfgPartNo === 'string' && row.MfgPartNo.trim() ? row.MfgPartNo.trim() : null,
                matchedBrand: typeof row.MfgName === 'string' && row.MfgName.trim() ? row.MfgName.trim() : null,
                evidence: buildEvidence(row),
            };
        })
        .filter((c): c is CWeightCandidate => c !== null);
}
