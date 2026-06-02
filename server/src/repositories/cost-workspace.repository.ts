import { getPool, sql } from '#src/config/database.js';
import { dbObjects } from '#src/config/db-objects.js';
import {
    buildInsertCwLineSql,
    buildInsertCwRunSql,
    buildInsertCwSnapshotSql,
    buildSetCwRunRevisionGroupSql,
} from '#src/queries/domains/cost-workspace/cost-workspace.write.js';
import { mapDraftTermFreightFields } from '#src/services/bulk-cost-draft-term.mapper.js';
import type {
    BulkCostRunStatus,
    SaveBulkCostRunInput,
} from '#src/types/bulk-cost.types.js';

// ---------------------------------------------------------------------------
// Row shapes returned from DB
// ---------------------------------------------------------------------------

interface CwRunInsertRow {
    RunID: number;
    RevisionGroupID: number | null;
    RevisionNo: number;
    RevisionSourceRunID: number | null;
    Status: string;
    VendorCode: string;
    VendorName: string;
    ReferenceNo: string;
    Currency: string;
    ExchangeRate: number;
    OrderTerm: string;
    Location: string;
    ShipModeNo: number | null;
    TotalLines: number;
    TotalQty: number;
    TotalAmount: number;
    TotalWeight: number;
    CreatedBy: string;
    CreatedAt: Date;
    UpdatedBy: string;
    UpdatedAt: Date;
}

interface CwRunListRow {
    RunID: number;
    RevisionGroupID: number | null;
    RevisionNo: number;
    RevisionSourceRunID: number | null;
    Status: string;
    VendorCode: string;
    VendorName: string;
    ReferenceNo: string;
    TotalLines: number;
    TotalQty: number;
    TotalAmount: number;
    Currency: string;
    SaleIncharge: string;
    UpdatedBy: string;
    UpdatedAt: Date;
    CreatedAt: Date;
    LegacyRunID: number | null;
    TotalCount: number;
}

interface CwRunDetailRow {
    RunID: number;
    RevisionGroupID: number | null;
    RevisionNo: number;
    RevisionSourceRunID: number | null;
    Status: string;
    VendorCode: string;
    VendorName: string;
    ReferenceNo: string;
    Currency: string;
    ExchangeRate: number;
    OrderTerm: string;
    Location: string;
    ShipModeNo: number | null;
    ContactPerson: string;
    SaleIncharge: string;
    Remark: string;
    U_PKH: number | null;
    U_SOC: number | null;
    U_Freight: number | null;
    U_Customs: number | null;
    U_WireTT: number | null;
    DraftJson: string | null;
    LegacyRunID: number | null;
}

interface CwLineRow {
    LineNo: number;
    LineKey: string;
    LatestSnapshotJson: string | null;
    OriginSnapshotJson: string | null;
    SubLocation: string | null;
}

// ---------------------------------------------------------------------------
// Public output types
// ---------------------------------------------------------------------------

export interface SavedCwRun {
    cwRunId: number;
    legacyRunId: number | null;
    revisionGroupId: number;
    revisionNo: number;
    revisionSourceRunId: number | null;
    status: string;
    supplierCode: string;
    supplierName: string;
    referenceNo: string;
    currency: string;
    exchangeRate: number;
    orderTerm: string;
    location: string;
    shipModeNo: number | null;
    totalLines: number;
    totalQty: number;
    totalAmount: number;
    totalWeight: number;
    createdBy: string;
    createdAt: string;
    updatedBy: string;
    updatedAt: string;
}

export interface CwRunSummary {
    cwRunId: number;
    legacyRunId: number | null;
    revisionGroupId: number;
    revisionNo: number;
    revisionSourceRunId: number | null;
    status: string;
    vendorCode: string;
    vendorName: string;
    referenceNo: string;
    totalLines: number;
    totalQty: number;
    totalAmount: number;
    currency: string;
    saleIncharge: string;
    updatedBy: string;
    updatedAt: string;
    createdAt: string;
}

export interface LoadedCwRun {
    cwRunId: number;
    legacyRunId: number | null;
    revisionGroupId: number;
    revisionNo: number;
    revisionSourceRunId: number | null;
    status: string;
    vendorCode: string;
    vendorName: string;
    referenceNo: string;
    inputSnapshot: {
        costs: {
            pkh: number;
            soc: number;
            freight: number;
            customs: number;
            wireTT: number;
            currency: string;
            exchangeRate: number;
            referenceNo: string;
            remark: string;
            orderTerm: string;
            location: string;
            subLocation: string;
            shipModeNo: number;
            contactPerson: string;
            saleIncharge: string;
        };
    };
    draftSnapshot: Record<string, unknown> | null;
    lines: Array<{
        lineNo: number;
        lineKey: string;
        latestSnapshot: Record<string, unknown>;
        originSnapshot: Record<string, unknown> | null;
    }>;
}

// ---------------------------------------------------------------------------
// Private helpers (mirrors bulk-cost.repository.ts helpers)
// ---------------------------------------------------------------------------

function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
}

function text(value: unknown): string {
    if (value === null || value === undefined) return '';
    return String(value).trim();
}

function nullableText(value: unknown): string | null {
    const normalized = text(value);
    return normalized ? normalized : null;
}

function numberValue(value: unknown, fallback = 0): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function divideValue(value: unknown, divisor: unknown): number {
    const numerator = numberValue(value, 0);
    const denominator = numberValue(divisor, 0);
    if (denominator === 0) return 0;
    return Math.round((numerator / denominator) * 1000000) / 1000000;
}

function nullableNumber(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function intValue(value: unknown): number | null {
    const parsed = Number(value);
    return Number.isInteger(parsed) ? parsed : null;
}

function dateToIso(value: Date | string): string {
    if (value instanceof Date) return value.toISOString();
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
}

function todayDateOnly(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function nullableJson(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    return JSON.stringify(value);
}

function parseJson(raw: string | null): Record<string, unknown> | null {
    if (!raw) return null;
    try {
        return JSON.parse(raw) as Record<string, unknown>;
    } catch {
        return null;
    }
}

function finalResultFrom(result: Record<string, unknown>): Record<string, unknown> {
    return asRecord(result.finalResult);
}

interface RevisionContext {
    revisionGroupId: number | null;
    revisionNo: number;
    revisionSourceRunId: number | null;
}

async function resolveRevisionContext(
    transaction: sql.Transaction,
    runTable: string,
    sourceRunId: number | undefined,
): Promise<RevisionContext> {
    if (!sourceRunId) {
        return { revisionGroupId: null, revisionNo: 1, revisionSourceRunId: null };
    }

    const sourceRequest = new sql.Request(transaction);
    sourceRequest.input('SourceRunID', sql.BigInt, sourceRunId);
    const sourceResult = await sourceRequest.query<{ RunID: number; RevisionGroupID: number | null }>(
        `SELECT [RunID], [RevisionGroupID] FROM ${runTable} WHERE [RunID] = @SourceRunID`,
    );
    const source = sourceResult.recordset[0];
    if (!source) {
        const err = new Error(`Source CostWorkspaceRun #${sourceRunId} not found`) as Error & {
            statusCode?: number;
        };
        err.statusCode = 404;
        throw err;
    }

    const revisionGroupId = Number(source.RevisionGroupID ?? source.RunID);
    const revisionRequest = new sql.Request(transaction);
    revisionRequest.input('RevisionGroupID', sql.BigInt, revisionGroupId);
    const revisionResult = await revisionRequest.query<{ MaxRevisionNo: number | null }>(
        `SELECT MAX(COALESCE([RevisionNo], 1)) AS [MaxRevisionNo]
         FROM ${runTable}
         WHERE COALESCE([RevisionGroupID], [RunID]) = @RevisionGroupID`,
    );

    return {
        revisionGroupId,
        revisionNo: numberValue(revisionResult.recordset[0]?.MaxRevisionNo, 1) + 1,
        revisionSourceRunId: sourceRunId,
    };
}

function toSavedCwRun(row: CwRunInsertRow, lineCount: number): SavedCwRun {
    const cwRunId = Number(row.RunID);
    return {
        cwRunId,
        legacyRunId: null,
        revisionGroupId: Number(row.RevisionGroupID ?? cwRunId),
        revisionNo: numberValue(row.RevisionNo, 1),
        revisionSourceRunId: row.RevisionSourceRunID === null ? null : Number(row.RevisionSourceRunID),
        status: row.Status,
        supplierCode: text(row.VendorCode),
        supplierName: text(row.VendorName),
        referenceNo: text(row.ReferenceNo),
        currency: text(row.Currency),
        exchangeRate: numberValue(row.ExchangeRate, 1),
        orderTerm: text(row.OrderTerm),
        location: text(row.Location),
        shipModeNo: row.ShipModeNo === null ? null : Number(row.ShipModeNo),
        totalLines: numberValue(row.TotalLines, lineCount),
        totalQty: numberValue(row.TotalQty, 0),
        totalAmount: numberValue(row.TotalAmount, 0),
        totalWeight: numberValue(row.TotalWeight, 0),
        createdBy: text(row.CreatedBy),
        createdAt: dateToIso(row.CreatedAt),
        updatedBy: text(row.UpdatedBy),
        updatedAt: dateToIso(row.UpdatedAt),
    };
}

function toRunSummary(row: CwRunListRow): CwRunSummary {
    const cwRunId = Number(row.RunID);
    return {
        cwRunId,
        legacyRunId: row.LegacyRunID === null ? null : Number(row.LegacyRunID),
        revisionGroupId: Number(row.RevisionGroupID ?? cwRunId),
        revisionNo: numberValue(row.RevisionNo, 1),
        revisionSourceRunId: row.RevisionSourceRunID === null ? null : Number(row.RevisionSourceRunID),
        status: row.Status,
        vendorCode: text(row.VendorCode),
        vendorName: text(row.VendorName),
        referenceNo: text(row.ReferenceNo),
        totalLines: numberValue(row.TotalLines, 0),
        totalQty: numberValue(row.TotalQty, 0),
        totalAmount: numberValue(row.TotalAmount, 0),
        currency: text(row.Currency) || 'THB',
        saleIncharge: text(row.SaleIncharge),
        updatedBy: text(row.UpdatedBy),
        updatedAt: dateToIso(row.UpdatedAt),
        createdAt: dateToIso(row.CreatedAt),
    };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Insert a new CostWorkspaceRun + its lines into the new schema tables.
 * `legacyRunId` links back to the old BulkCostRun for dual-write traceability.
 */
export async function createCwRun(
    data: SaveBulkCostRunInput,
    legacyRunId: number | null,
    actorName: string,
): Promise<SavedCwRun> {
    const pool = await getPool();
    const transaction = new sql.Transaction(pool);
    const runTable = dbObjects.tables.qtec.costWorkspaceRun;
    const lineTable = dbObjects.tables.qtec.costWorkspaceLine;
    const costs = data.costs;
    const preview = data.preview;

    await transaction.begin();

    try {
        const revision = await resolveRevisionContext(transaction, runTable, data.sourceRunId);
        const runRequest = new sql.Request(transaction);
        runRequest.input('SourceType', sql.NVarChar(20), 'MANUAL');
        runRequest.input('CalcMode', sql.NVarChar(20), 'STANDARD');
        runRequest.input('RevisionGroupID', sql.BigInt, revision.revisionGroupId);
        runRequest.input('RevisionNo', sql.Int, revision.revisionNo);
        runRequest.input('RevisionSourceRunID', sql.BigInt, revision.revisionSourceRunId);
        runRequest.input('Status', sql.NVarChar(20), data.status);
        runRequest.input('VendorCode', sql.NVarChar(30), data.supplierCode);
        runRequest.input('VendorName', sql.NVarChar(255), data.supplierName ?? '');
        runRequest.input('ReferenceNo', sql.NVarChar(100), text(costs.referenceNo));
        runRequest.input('Currency', sql.NVarChar(10), text(costs.currency) || 'THB');
        runRequest.input('ExchangeRate', sql.Decimal(19, 6), numberValue(costs.exchangeRate, 1));
        runRequest.input('OrderTerm', sql.NVarChar(40), text(costs.orderTerm));
        runRequest.input('Location', sql.NVarChar(80), text(costs.location));
        runRequest.input('ShipModeNo', sql.Int, intValue(costs.shipModeNo));
        runRequest.input('ContactPerson', sql.NVarChar(255), text(costs.contactPerson));
        runRequest.input('SaleIncharge', sql.NVarChar(255), text(costs.saleIncharge));
        runRequest.input('Remark', sql.NVarChar(1000), text(costs.remark));
        runRequest.input('DefaultINS', sql.Decimal(19, 6), nullableNumber(costs.defaultInsPercent));
        runRequest.input('DefaultDuty', sql.Decimal(19, 6), nullableNumber(costs.defaultDutyPercent));
        runRequest.input('DefaultSTK', sql.Decimal(19, 6), nullableNumber(costs.defaultStkPercent));
        runRequest.input('DefaultSPK', sql.Decimal(19, 6), nullableNumber(costs.defaultSpk));
        runRequest.input('DefaultQOC', sql.Decimal(19, 6), nullableNumber(costs.defaultQoc));
        runRequest.input('DefaultMarkup', sql.Decimal(19, 6), nullableNumber(costs.defaultMarkupPercent));
        runRequest.input('U_PKH', sql.Decimal(19, 6), numberValue(costs.pkh, 0));
        runRequest.input('U_SOC', sql.Decimal(19, 6), numberValue(costs.soc, 0));
        runRequest.input('U_Freight', sql.Decimal(19, 6), numberValue(costs.freight, 0));
        runRequest.input('U_Customs', sql.Decimal(19, 6), numberValue(costs.customs, 0));
        runRequest.input('U_WireTT', sql.Decimal(19, 6), numberValue(costs.wireTT, 0));
        runRequest.input('TotalLines', sql.Int, numberValue(preview.totalLines, data.lines.length));
        runRequest.input('TotalQty', sql.Decimal(19, 6), numberValue(preview.totalQty, 0));
        runRequest.input('TotalAmount', sql.Decimal(19, 6), numberValue(preview.totalAmount, 0));
        runRequest.input('TotalWeight', sql.Decimal(19, 6), numberValue(preview.totalWeight, 0));
        runRequest.input('DraftJson', sql.NVarChar(sql.MAX), nullableJson(preview));
        runRequest.input('LegacyRunID', sql.BigInt, legacyRunId);
        runRequest.input('CreatedBy', sql.NVarChar(50), actorName);
        runRequest.input('UpdatedBy', sql.NVarChar(50), actorName);

        const runResult = await runRequest.query<CwRunInsertRow>(buildInsertCwRunSql(runTable));
        const runRow = runResult.recordset[0];
        if (!runRow?.RunID) throw new Error('Failed to create CostWorkspaceRun');

        if (runRow.RevisionGroupID === null) {
            const revGroupRequest = new sql.Request(transaction);
            revGroupRequest.input('RunID', sql.BigInt, runRow.RunID);
            await revGroupRequest.query(buildSetCwRunRevisionGroupSql(runTable));
            runRow.RevisionGroupID = runRow.RunID;
        }

        for (let index = 0; index < data.lines.length; index += 1) {
            const line = data.lines[index];
            const latest = asRecord(line.latest);
            const result = asRecord(line.result);
            const finalResult = finalResultFrom(result);
            const freightFields = mapDraftTermFreightFields({ latest, finalResult });

            const lineRequest = new sql.Request(transaction);
            lineRequest.input('RunID', sql.BigInt, runRow.RunID);
            lineRequest.input('LineKey', sql.NVarChar(100), line.lineKey);
            lineRequest.input('LineNo', sql.Int, index + 1);
            lineRequest.input('DraftStatus', sql.NVarChar(20), 'DRAFT');
            lineRequest.input('MatchType', sql.NVarChar(20), latest.itemCode ? 'existing' : 'new_item');
            lineRequest.input('ItemIDHint', sql.Int, intValue(latest.itemCode ? latest.itemId : null));
            lineRequest.input('ItemCode', sql.NVarChar(20), nullableText(latest.itemCode));
            lineRequest.input('ItemGroup', sql.Int, intValue(latest.itemGroup) ?? 104);
            lineRequest.input('ItemCategory', sql.NVarChar(50), nullableText(latest.itemCategory));
            lineRequest.input('U_Brand', sql.NVarChar(50), text(latest.manufacturer));
            lineRequest.input('U_Calalogno', sql.NVarChar(100), text(latest.mfgPartNumber));
            lineRequest.input('ItemDescription', sql.NVarChar(100), text(latest.sapDescription));
            lineRequest.input('InvntryUom', sql.NVarChar(10), text(latest.uom));
            lineRequest.input('U_CountryOrg', sql.NVarChar(10), nullableText(latest.countryOfOrigin));
            lineRequest.input('BPStockItemNo', sql.NVarChar(50), nullableText(latest.supplierOrderCode));
            lineRequest.input('U_HScode', sql.NVarChar(20), nullableText(latest.hsCode));
            lineRequest.input('U_Permitreq', sql.NVarChar(1), nullableText(latest.importPermit));
            lineRequest.input('CustomerStockCode', sql.NVarChar(50), nullableText(latest.customerStockCode));
            lineRequest.input('TermIDHint', sql.Int, intValue(latest.termId));
            lineRequest.input('VendorCode', sql.NVarChar(15), text(latest.vendorCode || data.supplierCode));
            lineRequest.input('QuoteQty', sql.Decimal(19, 6), numberValue(latest.qty, 0));
            lineRequest.input('QuoteAmount', sql.Decimal(19, 6), numberValue(latest.amount, 0));
            lineRequest.input('U_ProdCost', sql.Decimal(19, 6), numberValue(latest.unitPrice, 0));
            lineRequest.input('U_PurCurr', sql.NVarChar(10), text(latest.currency));
            lineRequest.input('U_PurRate', sql.Decimal(19, 6), numberValue(data.costs.exchangeRate, 1));
            lineRequest.input('U_OrderTerm', sql.NVarChar(30), nullableText(latest.orderTerm));
            lineRequest.input('U_TermLocation', sql.NVarChar(10), nullableText(latest.location));
            lineRequest.input('SubLocation', sql.NVarChar(50), nullableText(latest.subLocation ?? data.costs.subLocation));
            lineRequest.input('U_ShipModeNo', sql.Int, intValue(latest.shipModeNo) ?? -1);
            lineRequest.input('U_ValidFrom', sql.Date, todayDateOnly());
            lineRequest.input('U_DimUnitNo', sql.Int, intValue(latest.dimUnit) ?? 1);
            lineRequest.input('U_Length', sql.Decimal(19, 6), numberValue(latest.length, 0));
            lineRequest.input('U_Width', sql.Decimal(19, 6), numberValue(latest.width, 0));
            lineRequest.input('U_Height', sql.Decimal(19, 6), numberValue(latest.height, 0));
            lineRequest.input('U_Weight', sql.Decimal(19, 6), numberValue(latest.itemWeightPerEach, 0));
            lineRequest.input('U_CWeight', sql.Decimal(19, 6), numberValue(latest.dimensionWeightPerEach, 0));
            lineRequest.input('U_FreightRate', sql.Decimal(19, 6), numberValue(latest.freightRate, 0));
            lineRequest.input('U_FR', sql.Decimal(19, 6), freightFields.uFr);
            lineRequest.input('INS_Percent', sql.Decimal(19, 6), numberValue(latest.insPercent, 0));
            lineRequest.input('U_ZoneRate', sql.Decimal(19, 6), numberValue(latest.zoneRate, 0));
            lineRequest.input('U_DT_Percent', sql.Decimal(19, 6), numberValue(latest.importDutyPercent, 0));
            lineRequest.input('U_ETPer', sql.Decimal(19, 6), numberValue(latest.etPercent, 0));
            lineRequest.input('U_MiscTax', sql.Decimal(19, 6), numberValue(latest.miscTax, 0));
            lineRequest.input('U_ASP', sql.Decimal(19, 6), numberValue(latest.scc, 0));
            lineRequest.input('U_STK_Percent', sql.Decimal(19, 6), numberValue(latest.stkPercent, 0));
            lineRequest.input('U_MK_Percent', sql.Decimal(19, 6), numberValue(latest.markupPercent, 0));
            lineRequest.input('U_SPK', sql.Decimal(19, 6), numberValue(finalResult.spk, 0));
            lineRequest.input('U_QOC', sql.Decimal(19, 6), numberValue(finalResult.qocVal, 0));
            lineRequest.input('U_WTT', sql.Decimal(19, 6), numberValue(finalResult.ttFinal, 0));
            lineRequest.input('U_CC', sql.Decimal(19, 6), numberValue(finalResult.ccFinal, 0));
            lineRequest.input('BuyUnitMsr', sql.NVarChar(20), nullableText(latest.purchaseUOM));
            lineRequest.input('NumInBuy', sql.Decimal(19, 6), numberValue(latest.stockConversion, 1));
            lineRequest.input('SalUnitMsr', sql.NVarChar(20), nullableText(latest.saleUOM));
            lineRequest.input('NumInSale', sql.Decimal(19, 6), numberValue(latest.saleConversion, 1));
            lineRequest.input('MOQ', sql.NVarChar(50), nullableText(latest.moq));
            lineRequest.input('DeliveryLeadTime', sql.NVarChar(5), nullableText(latest.deliveryLeadTime));
            lineRequest.input('U_SalesTerm', sql.NVarChar(20), nullableText(latest.salesTerm));
            lineRequest.input('SaleSubLocation', sql.NVarChar(50), nullableText(latest.salesSubLocation));
            lineRequest.input('U_OP', sql.Decimal(19, 6), numberValue(finalResult.op1Source, 0));
            lineRequest.input('U_OP_SUM', sql.Decimal(19, 6), numberValue(finalResult.op1, 0));
            lineRequest.input('U_OP_THB', sql.Decimal(19, 6), numberValue(finalResult.op2, 0));
            lineRequest.input('U_INS', sql.Decimal(19, 6), numberValue(finalResult.ins, 0));
            lineRequest.input('U_FRZONE', sql.Decimal(19, 6), numberValue(finalResult.frZoneCost, 0));
            lineRequest.input('U_CIF', sql.Decimal(19, 6), numberValue(finalResult.cifQTEC, 0));
            lineRequest.input('U_CIFZONE', sql.Decimal(19, 6), numberValue(finalResult.cifZone, 0));
            lineRequest.input('U_DT', sql.Decimal(19, 6), numberValue(finalResult.selectedDuty, 0));
            lineRequest.input('U_DT_FR', sql.Decimal(19, 6), numberValue(finalResult.dtQTEC, 0));
            lineRequest.input('U_DT_FRZONE', sql.Decimal(19, 6), numberValue(finalResult.dtZone, 0));
            lineRequest.input('U_ET', sql.Decimal(19, 6), numberValue(finalResult.et, 0));
            lineRequest.input('U_MT', sql.Decimal(19, 6), numberValue(finalResult.mt, 0));
            lineRequest.input('U_DimWeight', sql.Decimal(19, 6), numberValue(finalResult.dimWeight, numberValue(latest.dimensionWeightPerEach, 0)));
            lineRequest.input('U_ShipWeightCal', sql.Decimal(19, 6), numberValue(finalResult.shipWeightCal, 0));
            lineRequest.input('U_FreightQTEC', sql.Decimal(19, 6), freightFields.uFreightQtec);
            lineRequest.input('U_preQLC', sql.Decimal(19, 6), numberValue(finalResult.preQLC, 0));
            lineRequest.input('U_STK', sql.Decimal(19, 6), numberValue(finalResult.stk, 0));
            lineRequest.input('U_QLC', sql.Decimal(19, 6), numberValue(finalResult.qlc, 0));
            lineRequest.input('U_QLC2', sql.Decimal(19, 6), numberValue(finalResult.qlc2, divideValue(finalResult.qlc, latest.stockConversion)));
            lineRequest.input('U_QLC3', sql.Decimal(19, 6), numberValue(finalResult.totalQLC, 0));
            lineRequest.input('U_MK_THB', sql.Decimal(19, 6), numberValue(finalResult.markup, 0));
            lineRequest.input('U_SalesPrice', sql.Decimal(19, 6), numberValue(finalResult.roundUp, 0));
            lineRequest.input('WeightRatioPerEach', sql.Decimal(19, 6), numberValue(result.weightRatioPerEach, 0));
            lineRequest.input('ValueRatioPerEach', sql.Decimal(19, 6), numberValue(result.valueRatioPerEach, 0));
            lineRequest.input('AllocPKH', sql.Decimal(19, 6), numberValue(result.pkhPerEach, 0));
            lineRequest.input('AllocSOC', sql.Decimal(19, 6), numberValue(result.socPerEach, 0));
            lineRequest.input('AllocFreight', sql.Decimal(19, 6), numberValue(result.freightPerEach, 0));
            lineRequest.input('AllocWireTT', sql.Decimal(19, 6), numberValue(result.wireTTPerEach, 0));
            lineRequest.input('AllocCC', sql.Decimal(19, 6), numberValue(result.ccPerEach, 0));
            lineRequest.input('LatestSnapshotJson', sql.NVarChar(sql.MAX), nullableJson(line.latest));
            lineRequest.input('OriginSnapshotJson', sql.NVarChar(sql.MAX), nullableJson(line.origin));
            lineRequest.input('UpdatedBy', sql.NVarChar(50), actorName);

            await lineRequest.query(buildInsertCwLineSql(lineTable));
        }

        await transaction.commit();
        const saved = toSavedCwRun(runRow, data.lines.length);
        saved.legacyRunId = legacyRunId;
        return saved;
    } catch (err) {
        try {
            await transaction.rollback();
        } catch {
            // Preserve original error; ignore secondary rollback failure.
        }
        throw err;
    }
}

export async function listCwRuns(filters: {
    status?: BulkCostRunStatus;
    search?: string;
    saleIncharge?: string;
    page?: number;
    pageSize?: number;
}): Promise<{ runs: CwRunSummary[]; total: number }> {
    const pool = await getPool();
    const request = pool.request();
    const table = dbObjects.tables.qtec.costWorkspaceRun;
    const page = Math.max(1, filters.page ?? 1);
    const pageSize = Math.min(400, Math.max(1, filters.pageSize ?? 400));
    const offset = (page - 1) * pageSize;
    const conditions: string[] = [];

    if (filters.status) {
        request.input('Status', sql.NVarChar(20), filters.status);
        conditions.push('[Status] = @Status');
    }
    if (filters.saleIncharge) {
        request.input('SaleIncharge', sql.NVarChar(255), filters.saleIncharge);
        conditions.push('[SaleIncharge] = @SaleIncharge');
    }
    if (filters.search) {
        request.input('Search', sql.NVarChar(200), `%${filters.search}%`);
        conditions.push(
            '([VendorName] LIKE @Search OR [VendorCode] LIKE @Search OR [ReferenceNo] LIKE @Search OR CAST([RunID] AS NVARCHAR) LIKE @Search)',
        );
    }

    request.input('StartRow', sql.Int, offset + 1);
    request.input('EndRow', sql.Int, offset + pageSize);
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await request.query<CwRunListRow>(`
        SELECT
            [RunID], [Status], [VendorCode], [VendorName], [ReferenceNo],
            [RevisionGroupID], [RevisionNo], [RevisionSourceRunID],
            [TotalLines], [TotalQty], [TotalAmount], [Currency],
            [SaleIncharge], [UpdatedBy], [UpdatedAt], [CreatedAt],
            [LegacyRunID], [TotalCount]
        FROM (
            SELECT
                [RunID], [Status], [VendorCode], [VendorName], [ReferenceNo],
                [RevisionGroupID], [RevisionNo], [RevisionSourceRunID],
                [TotalLines], [TotalQty], [TotalAmount], [Currency],
                [SaleIncharge], [UpdatedBy], [UpdatedAt], [CreatedAt],
                [LegacyRunID],
                COUNT(*) OVER() AS [TotalCount],
                ROW_NUMBER() OVER (ORDER BY [UpdatedAt] DESC, [RunID] DESC) AS [RowNum]
            FROM ${table}
            ${where}
        ) AS PagedRuns
        WHERE [RowNum] BETWEEN @StartRow AND @EndRow
        ORDER BY [RowNum]
    `);

    return {
        runs: result.recordset.map(toRunSummary),
        total: result.recordset[0]?.TotalCount ?? 0,
    };
}

export async function loadCwRun(cwRunId: number): Promise<LoadedCwRun | null> {
    const pool = await getPool();
    const runTable = dbObjects.tables.qtec.costWorkspaceRun;
    const lineTable = dbObjects.tables.qtec.costWorkspaceLine;
    const runRequest = pool.request().input('RunID', sql.BigInt, cwRunId);
    const lineRequest = pool.request().input('RunIDL', sql.BigInt, cwRunId);

    const [runResult, lineResult] = await Promise.all([
        runRequest.query<CwRunDetailRow>(`
            SELECT [RunID], [RevisionGroupID], [RevisionNo], [RevisionSourceRunID],
                   [Status], [VendorCode], [VendorName], [ReferenceNo],
                   [Currency], [ExchangeRate], [OrderTerm], [Location], [ShipModeNo],
                   [ContactPerson], [SaleIncharge], [Remark],
                   [U_PKH], [U_SOC], [U_Freight], [U_Customs], [U_WireTT],
                   [DraftJson], [LegacyRunID]
            FROM ${runTable}
            WHERE [RunID] = @RunID
        `),
        lineRequest.query<CwLineRow>(`
            SELECT [LineNo], [LineKey], [LatestSnapshotJson], [OriginSnapshotJson], [SubLocation]
            FROM ${lineTable}
            WHERE [RunID] = @RunIDL
            ORDER BY [LineNo]
        `),
    ]);

    const runRow = runResult.recordset[0];
    if (!runRow) return null;

    const costsSnapshot = {
        pkh: numberValue(runRow.U_PKH, 0),
        soc: numberValue(runRow.U_SOC, 0),
        freight: numberValue(runRow.U_Freight, 0),
        customs: numberValue(runRow.U_Customs, 0),
        wireTT: numberValue(runRow.U_WireTT, 0),
        currency: text(runRow.Currency),
        exchangeRate: numberValue(runRow.ExchangeRate, 1),
        referenceNo: text(runRow.ReferenceNo),
        remark: text(runRow.Remark),
        orderTerm: text(runRow.OrderTerm),
        location: text(runRow.Location),
        subLocation: text(lineResult.recordset.find((l) => text(l.SubLocation))?.SubLocation),
        shipModeNo: runRow.ShipModeNo ?? -1,
        contactPerson: text(runRow.ContactPerson),
        saleIncharge: text(runRow.SaleIncharge),
    };

    return {
        cwRunId: Number(runRow.RunID),
        legacyRunId: runRow.LegacyRunID === null ? null : Number(runRow.LegacyRunID),
        revisionGroupId: Number(runRow.RevisionGroupID ?? runRow.RunID),
        revisionNo: numberValue(runRow.RevisionNo, 1),
        revisionSourceRunId: runRow.RevisionSourceRunID === null ? null : Number(runRow.RevisionSourceRunID),
        status: runRow.Status,
        vendorCode: text(runRow.VendorCode),
        vendorName: text(runRow.VendorName),
        referenceNo: text(runRow.ReferenceNo),
        inputSnapshot: { costs: costsSnapshot },
        draftSnapshot: parseJson(runRow.DraftJson),
        lines: lineResult.recordset.map((line) => {
            const latestSnapshot = parseJson(line.LatestSnapshotJson) ?? {};
            if (!text(latestSnapshot.subLocation) && text(line.SubLocation)) {
                latestSnapshot.subLocation = text(line.SubLocation);
            }
            return {
                lineNo: line.LineNo,
                lineKey: line.LineKey,
                latestSnapshot,
                originSnapshot: parseJson(line.OriginSnapshotJson),
            };
        }),
    };
}

export async function updateCwRunStatus(
    cwRunId: number,
    status: 'AWARDED' | 'LOST',
    actorName: string,
): Promise<void> {
    const pool = await getPool();
    const table = dbObjects.tables.qtec.costWorkspaceRun;
    const request = pool.request();
    request.input('RunID', sql.BigInt, cwRunId);
    request.input('Status', sql.NVarChar(20), status);
    request.input('UpdatedBy', sql.NVarChar(50), actorName);

    const result = await request.query(`
        UPDATE ${table}
        SET [Status] = @Status, [UpdatedBy] = @UpdatedBy, [UpdatedAt] = GETDATE()
        WHERE [RunID] = @RunID AND [Status] = 'DRAFT'
    `);

    if (result.rowsAffected[0] !== 0) return;

    const checkResult = await pool
        .request()
        .input('RunID2', sql.BigInt, cwRunId)
        .query<{ RunID: number }>(`SELECT [RunID] FROM ${table} WHERE [RunID] = @RunID2`);

    if (checkResult.recordset.length === 0) {
        const err = new Error(`CostWorkspaceRun #${cwRunId} not found`) as Error & { statusCode?: number };
        err.statusCode = 404;
        throw err;
    }

    const err = new Error(`CostWorkspaceRun #${cwRunId} is not in DRAFT status`) as Error & {
        statusCode?: number;
    };
    err.statusCode = 409;
    throw err;
}

/**
 * Save a revision snapshot for a run.
 * Called alongside createCwRun when SourceType = 'REVISION'.
 */
export async function createCwSnapshot(
    cwRunId: number,
    revisionNo: number,
    snapshotType: 'REVISION' | 'FINAL',
    runJson: unknown,
    linesJson: unknown,
    actorName: string,
): Promise<number> {
    const pool = await getPool();
    const table = dbObjects.tables.qtec.costWorkspaceSnapshot;
    const request = pool.request();
    request.input('RunID', sql.BigInt, cwRunId);
    request.input('SnapshotType', sql.NVarChar(20), snapshotType);
    request.input('RevisionNo', sql.Int, revisionNo);
    request.input('RunSnapshotJson', sql.NVarChar(sql.MAX), nullableJson(runJson));
    request.input('LinesSnapshotJson', sql.NVarChar(sql.MAX), nullableJson(linesJson));
    request.input('CreatedBy', sql.NVarChar(50), actorName);

    const result = await request.query<{ SnapshotID: number }>(buildInsertCwSnapshotSql(table));
    const snapshotId = result.recordset[0]?.SnapshotID;
    if (!snapshotId) throw new Error('Failed to create CostWorkspaceSnapshot');
    return Number(snapshotId);
}
