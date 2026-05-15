import { getPool, sql } from '#src/config/database.js';
import { dbObjects } from '#src/config/db-objects.js';
import { extractHeaderCostSuggestions } from '#src/services/axon-payload.service.js';
import { mapDraftTermFreightFields } from '#src/services/bulk-cost-draft-term.mapper.js';
import type {
    BulkCostRunSummary,
    BulkCostRunStatus,
    LoadedBulkCostRun,
    SaveBulkCostRunInput,
    SavedBulkCostRun,
    AxonQueueItem,
    AxonQueueStatus,
} from '#src/types/bulk-cost.types.js';
import {
    buildCreateBulkCostRunSql,
    buildCreateDraftItemSql,
    buildCreateDraftTermSql,
} from '#src/queries/domains/bulk-cost/bulk-cost.write.js';

interface BulkCostRunInsertRow {
    RunID: number;
    Status: SavedBulkCostRun['status'];
    VendorCode: string | null;
    VendorName: string | null;
    ReferenceNo: string | null;
    Currency: string | null;
    ExchangeRate: number | null;
    OrderTerm: string | null;
    Location: string | null;
    ShipModeNo: number | null;
    TotalLines: number | null;
    TotalQty: number | null;
    TotalAmount: number | null;
    TotalWeight: number | null;
    CreatedBy: string | null;
    CreatedAt: Date | string;
    UpdatedBy: string | null;
    UpdatedAt: Date | string;
}

function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown>
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
    if (value instanceof Date) {
        return value.toISOString();
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
}

function json(value: unknown): string {
    return JSON.stringify(value ?? null);
}

function nullableJson(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    return JSON.stringify(value);
}

function finalResultFrom(lineResult: Record<string, unknown>): Record<string, unknown> {
    return asRecord(lineResult.finalResult);
}

function runSummary(data: SaveBulkCostRunInput) {
    const costs = data.costs;
    const preview = data.preview;

    return {
        referenceNo: text(costs.referenceNo),
        currency: text(costs.currency) || 'THB',
        exchangeRate: numberValue(costs.exchangeRate, 1),
        orderTerm: text(costs.orderTerm),
        location: text(costs.location),
        shipModeNo: intValue(costs.shipModeNo),
        contactPerson: text(costs.contactPerson),
        saleIncharge: text(costs.saleIncharge),
        remark: text(costs.remark),
        pkh: numberValue(costs.pkh, 0),
        soc: numberValue(costs.soc, 0),
        freight: numberValue(costs.freight, 0),
        customs: numberValue(costs.customs, 0),
        wireTT: numberValue(costs.wireTT, 0),
        totalLines: numberValue(preview.totalLines, data.lines.length),
        totalQty: numberValue(preview.totalQty, 0),
        totalAmount: numberValue(preview.totalAmount, 0),
        totalWeight: numberValue(preview.totalWeight, 0),
    };
}

function toSavedRun(row: BulkCostRunInsertRow, lineCount: number): SavedBulkCostRun {
    return {
        runId: Number(row.RunID),
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
        lineCount,
        createdBy: text(row.CreatedBy),
        createdAt: dateToIso(row.CreatedAt),
        updatedBy: text(row.UpdatedBy),
        updatedAt: dateToIso(row.UpdatedAt),
    };
}

export async function createBulkCostRun(
    data: SaveBulkCostRunInput,
    actorName: string,
): Promise<SavedBulkCostRun> {
    const pool = await getPool();
    const transaction = new sql.Transaction(pool);
    const summary = runSummary(data);
    const runTable = dbObjects.tables.qtec.bulkCostRun;
    const itemTable = dbObjects.tables.qtec.draftItem;
    const termTable = dbObjects.tables.qtec.draftTerm;

    await transaction.begin();

    try {
        const runRequest = new sql.Request(transaction);
        runRequest.input('Status', sql.NVarChar(20), data.status);
        runRequest.input('VendorCode', sql.NVarChar(30), data.supplierCode);
        runRequest.input('VendorName', sql.NVarChar(255), data.supplierName || '');
        runRequest.input('ReferenceNo', sql.NVarChar(100), summary.referenceNo);
        runRequest.input('Currency', sql.NVarChar(10), summary.currency);
        runRequest.input('ExchangeRate', sql.Decimal(19, 6), summary.exchangeRate);
        runRequest.input('OrderTerm', sql.NVarChar(40), summary.orderTerm);
        runRequest.input('Location', sql.NVarChar(80), summary.location);
        runRequest.input('ShipModeNo', sql.Int, summary.shipModeNo);
        runRequest.input('ContactPerson', sql.NVarChar(255), summary.contactPerson);
        runRequest.input('SaleIncharge', sql.NVarChar(255), summary.saleIncharge);
        runRequest.input('Remark', sql.NVarChar(1000), summary.remark);
        runRequest.input('U_PKH', sql.Decimal(19, 6), summary.pkh);
        runRequest.input('U_SOC', sql.Decimal(19, 6), summary.soc);
        runRequest.input('U_Freight', sql.Decimal(19, 6), summary.freight);
        runRequest.input('U_Customs', sql.Decimal(19, 6), summary.customs);
        runRequest.input('U_WireTT', sql.Decimal(19, 6), summary.wireTT);
        runRequest.input('TotalLines', sql.Int, summary.totalLines);
        runRequest.input('TotalQty', sql.Decimal(19, 6), summary.totalQty);
        runRequest.input('TotalAmount', sql.Decimal(19, 6), summary.totalAmount);
        runRequest.input('TotalWeight', sql.Decimal(19, 6), summary.totalWeight);
        runRequest.input('PreviewSnapshotJson', sql.NVarChar(sql.MAX), nullableJson(data.preview));
        runRequest.input('CreatedBy', sql.NVarChar(50), actorName);
        runRequest.input('UpdatedBy', sql.NVarChar(50), actorName);

        const runResult = await runRequest.query<BulkCostRunInsertRow>(
            buildCreateBulkCostRunSql(runTable),
        );
        const runRow = runResult.recordset[0];
        if (!runRow?.RunID) {
            throw new Error('Failed to create BulkCostRun');
        }

        for (let index = 0; index < data.lines.length; index++) {
            const line = data.lines[index];
            const latest = asRecord(line.latest);
            const result = asRecord(line.result);
            const finalResult = finalResultFrom(result);
            const freightFields = mapDraftTermFreightFields({ latest, finalResult });

            // ── Insert DraftItem ─────────────────────────────────────────────
            const itemRequest = new sql.Request(transaction);
            itemRequest.input('RunID', sql.BigInt, runRow.RunID);
            itemRequest.input('LineKey', sql.NVarChar(100), line.lineKey);
            itemRequest.input('LineNo', sql.Int, index + 1);
            itemRequest.input('DraftStatus', sql.NVarChar(20), 'DRAFT');
            itemRequest.input('MatchType', sql.NVarChar(20), latest.itemCode ? 'existing' : 'new_item');
            itemRequest.input('ItemIDHint', sql.Int, intValue(latest.itemCode ? latest.itemId : null));
            itemRequest.input('ItemGroupSuggestedByAI', sql.Bit, 0);
            itemRequest.input('QuoteQty', sql.Decimal(19, 6), numberValue(latest.qty, 0));
            itemRequest.input('QuoteAmount', sql.Decimal(19, 6), numberValue(latest.amount, 0));
            itemRequest.input('ItemGroup', sql.Int, intValue(latest.itemGroup) ?? 104);
            itemRequest.input('U_Brand', sql.NVarChar(50), text(latest.manufacturer));
            itemRequest.input('U_Calalogno', sql.NVarChar(100), text(latest.mfgPartNumber));
            itemRequest.input('ItemDescription', sql.NVarChar(100), text(latest.sapDescription));
            itemRequest.input('InvntryUom', sql.NVarChar(10), text(latest.uom));
            itemRequest.input('U_CountryOrg', sql.NVarChar(10), nullableText(latest.countryOfOrigin));
            itemRequest.input('BPStockItemNo', sql.NVarChar(50), nullableText(latest.supplierOrderCode));
            itemRequest.input('U_HScode', sql.NVarChar(20), nullableText(latest.hsCode));
            itemRequest.input('ItemCategory', sql.NVarChar(50), nullableText(latest.itemCategory));
            itemRequest.input('U_Permitreq', sql.NVarChar(1), nullableText(latest.importPermit));
            itemRequest.input('LeadTime', sql.NVarChar(5), nullableText(latest.deliveryLeadTime));
            itemRequest.input('Updatedby', sql.NVarChar(50), actorName);
            itemRequest.input('LatestSnapshotJson', sql.NVarChar(sql.MAX), json(line.latest));
            itemRequest.input('OriginSnapshotJson', sql.NVarChar(sql.MAX), nullableJson(line.origin));

            const itemResult = await itemRequest.query<{ DraftItemID: number }>(
                buildCreateDraftItemSql(itemTable),
            );
            const draftItemId = itemResult.recordset[0]?.DraftItemID;
            if (!draftItemId) {
                throw new Error(`Failed to create DraftItem for line ${line.lineKey}`);
            }

            // ── Insert DraftTerm ─────────────────────────────────────────────
            const termRequest = new sql.Request(transaction);
            termRequest.input('DraftItemID', sql.BigInt, draftItemId);
            termRequest.input('RunID', sql.BigInt, runRow.RunID);
            termRequest.input('LineKey', sql.NVarChar(100), line.lineKey);
            termRequest.input('DraftStatus', sql.NVarChar(20), 'DRAFT');
            termRequest.input('TermIDHint', sql.Int, intValue(latest.termId));
            termRequest.input('VendorCode', sql.NVarChar(15), text(latest.vendorCode || data.supplierCode));
            termRequest.input('VendorStockItemNo', sql.NVarChar(100), nullableText(latest.supplierOrderCode));
            termRequest.input('U_OrderTerm', sql.NVarChar(30), nullableText(latest.orderTerm));
            termRequest.input('U_TermLocation', sql.NVarChar(10), nullableText(latest.location));
            termRequest.input('U_ProdCost', sql.Decimal(19, 6), numberValue(latest.unitPrice, 0));
            termRequest.input('U_PurCurr', sql.NVarChar(10), text(latest.currency));
            termRequest.input('U_PurRate', sql.Decimal(19, 6), numberValue(data.costs.exchangeRate, 1));
            termRequest.input('U_PKH', sql.Decimal(19, 6), numberValue(finalResult.pkh, 0));
            termRequest.input('U_SOC', sql.Decimal(19, 6), numberValue(finalResult.soc, 0));
            termRequest.input('U_ShipModeNo', sql.Int, intValue(latest.shipModeNo) ?? -1);
            termRequest.input('U_DimUnitNo', sql.Int, intValue(latest.dimUnit) ?? 1);
            termRequest.input('U_Length', sql.Decimal(19, 6), numberValue(latest.length, 0));
            termRequest.input('U_Width', sql.Decimal(19, 6), numberValue(latest.width, 0));
            termRequest.input('U_Height', sql.Decimal(19, 6), numberValue(latest.height, 0));
            termRequest.input('U_Weight', sql.Decimal(19, 6), numberValue(latest.itemWeightPerEach, 0));
            termRequest.input('U_CWeight', sql.Decimal(19, 6), numberValue(latest.dimensionWeightPerEach, 0));
            termRequest.input('U_FreightRate', sql.Decimal(19, 6), numberValue(latest.freightRate, 0));
            termRequest.input('U_FR', sql.Decimal(19, 6), freightFields.uFr);
            termRequest.input('INS_Percent', sql.Decimal(19, 6), numberValue(latest.insPercent, 0));
            termRequest.input('U_ZoneRate', sql.Decimal(19, 6), numberValue(latest.zoneRate, 0));
            termRequest.input('U_DT_Percent', sql.Decimal(19, 6), numberValue(latest.importDutyPercent, 0));
            termRequest.input('U_ETPer', sql.Decimal(19, 6), numberValue(latest.etPercent, 0));
            termRequest.input('U_MiscTax', sql.Decimal(19, 6), numberValue(latest.miscTax, 0));
            termRequest.input('U_WTT', sql.Decimal(19, 6), numberValue(finalResult.ttFinal, 0));
            termRequest.input('U_CC', sql.Decimal(19, 6), numberValue(finalResult.ccFinal, 0));
            termRequest.input('U_ASP', sql.Decimal(19, 6), numberValue(latest.scc, 0));
            termRequest.input('U_STK_Percent', sql.Decimal(19, 6), numberValue(latest.stkPercent, 0));
            termRequest.input('U_MK_Percent', sql.Decimal(19, 6), numberValue(latest.markupPercent, 0));
            termRequest.input('U_SPK', sql.Decimal(19, 6), numberValue(latest.sspk, 0));
            termRequest.input('U_QOC', sql.Decimal(19, 6), numberValue(latest.qoc, 0));
            termRequest.input('BuyUnitMsr', sql.NVarChar(20), nullableText(latest.purchaseUOM));
            termRequest.input('NumInBuy', sql.Decimal(19, 6), numberValue(latest.stockConversion, 1));
            termRequest.input('SalUnitMsr', sql.NVarChar(20), nullableText(latest.saleUOM));
            termRequest.input('NumInSale', sql.Decimal(19, 6), numberValue(latest.saleConversion, 1));
            termRequest.input('U_MOQ', sql.NVarChar(50), nullableText(latest.moq));
            termRequest.input('LeadTime', sql.NVarChar(5), nullableText(latest.deliveryLeadTime));
            termRequest.input('Updatedby', sql.NVarChar(50), actorName);
            // calculated columns from CAL engine
            termRequest.input('U_OP', sql.Decimal(19, 6), numberValue(finalResult.op1Source, 0));
            termRequest.input('U_OP_THB', sql.Decimal(19, 6), numberValue(finalResult.op1, 0));
            termRequest.input('U_INS', sql.Decimal(19, 6), numberValue(finalResult.ins, 0));
            termRequest.input('U_CIF', sql.Decimal(19, 6), numberValue(finalResult.cifQTEC, 0));
            termRequest.input('U_DT', sql.Decimal(19, 6), numberValue(finalResult.dtQTEC, 0));
            termRequest.input('U_ET', sql.Decimal(19, 6), numberValue(finalResult.et, 0));
            termRequest.input('U_MT', sql.Decimal(19, 6), numberValue(finalResult.mt, 0));
            termRequest.input('U_ShipWeightCal', sql.Decimal(19, 6), numberValue(finalResult.shipWeightCal, 0));
            termRequest.input('U_FreightQTEC', sql.Decimal(19, 6), freightFields.uFreightQtec);
            termRequest.input('U_preQLC', sql.Decimal(19, 6), numberValue(finalResult.preQLC, 0));
            termRequest.input('U_STK', sql.Decimal(19, 6), numberValue(finalResult.stk, 0));
            termRequest.input('U_QLC', sql.Decimal(19, 6), numberValue(finalResult.qlc, 0));
            termRequest.input('U_MK_THB', sql.Decimal(19, 6), numberValue(finalResult.markup, 0));
            termRequest.input('U_SalesPrice', sql.Decimal(19, 6), numberValue(finalResult.roundUp, 0));

            await termRequest.query(buildCreateDraftTermSql(termTable));
        }

        await transaction.commit();
        return toSavedRun(runRow, data.lines.length);
    } catch (err) {
        await transaction.rollback();
        throw err;
    }
}

interface AxonQueueRow {
    QueueID: number;
    SourceFileId: string;
    SourceFileName: string | null;
    DocumentType: string | null;
    DocumentNo: string | null;
    DocumentDate: string | null;
    SupplierRawName: string;
    SupplierCodeHint: string | null;
    SupplierConfidence: number | null;
    Currency: string | null;
    PurchaseTerm: string | null;
    TermLocation: string | null;
    TotalLines: number;
    Status: string;
    ReceivedAt: Date | string;
    OpenedAt: Date | string | null;
    OpenedBy: string | null;
    RunID: number | null;
    RawPayloadJson: string | null;
}

function toQueueItem(row: AxonQueueRow): AxonQueueItem {
    return {
        queueId: Number(row.QueueID),
        sourceFileId: text(row.SourceFileId),
        sourceFileName: nullableText(row.SourceFileName),
        documentType: nullableText(row.DocumentType),
        documentNo: nullableText(row.DocumentNo),
        documentDate: row.DocumentDate ? String(row.DocumentDate) : null,
        supplierRawName: text(row.SupplierRawName),
        supplierCodeHint: nullableText(row.SupplierCodeHint),
        supplierConfidence: row.SupplierConfidence !== null ? Number(row.SupplierConfidence) : null,
        currency: nullableText(row.Currency),
        purchaseTerm: nullableText(row.PurchaseTerm),
        termLocation: nullableText(row.TermLocation),
        totalLines: numberValue(row.TotalLines, 0),
        status: row.Status as AxonQueueStatus,
        receivedAt: dateToIso(row.ReceivedAt),
        openedAt: row.OpenedAt ? dateToIso(row.OpenedAt) : null,
        openedBy: nullableText(row.OpenedBy),
        runId: row.RunID !== null ? Number(row.RunID) : null,
        headerCostSuggestions: extractHeaderCostSuggestions(row.RawPayloadJson),
    };
}

export async function listAxonQueueItems(): Promise<AxonQueueItem[]> {
    const pool = await getPool();
    const queueTable = dbObjects.tables.qtec.axonExtractionQueue;
    const result = await pool.request().query<AxonQueueRow>(`
        SELECT [QueueID], [SourceFileId], [SourceFileName], [DocumentType], [DocumentNo], [DocumentDate],
               [SupplierRawName], [SupplierCodeHint], [SupplierConfidence], [Currency], [PurchaseTerm],
               [TermLocation], [TotalLines], [Status], [ReceivedAt], [OpenedAt], [OpenedBy], [RunID],
               [RawPayloadJson]
        FROM ${queueTable}
        WHERE [Status] IN ('PENDING', 'OPENED')
        ORDER BY [ReceivedAt] DESC
    `);
    return result.recordset.map(toQueueItem);
}

interface BulkCostRunListRow {
    RunID: number;
    Status: string;
    VendorCode: string | null;
    VendorName: string | null;
    ReferenceNo: string | null;
    TotalLines: number | null;
    TotalQty: number | null;
    TotalAmount: number | null;
    Currency: string | null;
    SaleIncharge: string | null;
    UpdatedBy: string | null;
    UpdatedAt: Date | string;
    CreatedAt: Date | string;
}

function toRunSummary(row: BulkCostRunListRow): BulkCostRunSummary {
    return {
        runId: Number(row.RunID),
        status: row.Status as BulkCostRunStatus,
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

export async function listBulkCostRuns(filters: {
    status?: BulkCostRunStatus;
    search?: string;
    saleIncharge?: string;
    page?: number;
    pageSize?: number;
}): Promise<{ runs: BulkCostRunSummary[]; total: number }> {
    const pool = await getPool();
    const request = pool.request();
    const table = dbObjects.tables.qtec.bulkCostRun;
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
        const like = `%${filters.search}%`;
        request.input('Search', sql.NVarChar(200), like);
        conditions.push('([VendorName] LIKE @Search OR [VendorCode] LIKE @Search OR [ReferenceNo] LIKE @Search OR CAST([RunID] AS NVARCHAR) LIKE @Search)');
    }
    request.input('StartRow', sql.Int, offset + 1);
    request.input('EndRow', sql.Int, offset + pageSize);

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const queryText = `
        SELECT
            [RunID], [Status], [VendorCode], [VendorName], [ReferenceNo],
            [TotalLines], [TotalQty], [TotalAmount], [Currency],
            [SaleIncharge], [UpdatedBy], [UpdatedAt], [CreatedAt],
            [TotalCount]
        FROM (
            SELECT
                [RunID], [Status], [VendorCode], [VendorName], [ReferenceNo],
                [TotalLines], [TotalQty], [TotalAmount], [Currency],
                [SaleIncharge], [UpdatedBy], [UpdatedAt], [CreatedAt],
                COUNT(*) OVER() AS [TotalCount],
                ROW_NUMBER() OVER (ORDER BY [UpdatedAt] DESC, [RunID] DESC) AS [RowNum]
            FROM ${table}
            ${where}
        ) AS PagedRuns
        WHERE [RowNum] BETWEEN @StartRow AND @EndRow
        ORDER BY [RowNum]
    `;

    try {
        const result = await request.query<BulkCostRunListRow & { TotalCount: number }>(queryText);
        const total = result.recordset[0]?.TotalCount ?? 0;
        return { runs: result.recordset.map(toRunSummary), total };
    } catch (err) {
        throw err;
    }
}

export async function updateBulkCostRunStatus(
    runId: number,
    status: 'AWARDED' | 'LOST',
    actorName: string,
): Promise<void> {
    const pool = await getPool();
    const request = pool.request();
    const table = dbObjects.tables.qtec.bulkCostRun;

    request.input('RunID', sql.BigInt, runId);
    request.input('Status', sql.NVarChar(20), status);
    request.input('UpdatedBy', sql.NVarChar(50), actorName);

    const result = await request.query(`
        UPDATE ${table}
        SET [Status] = @Status, [UpdatedBy] = @UpdatedBy, [UpdatedAt] = GETDATE()
        WHERE [RunID] = @RunID AND [Status] = 'DRAFT'
    `);

    if (result.rowsAffected[0] === 0) {
        const checkResult = await pool.request()
            .input('RunID2', sql.BigInt, runId)
            .query<{ RunID: number }>(`SELECT [RunID] FROM ${table} WHERE [RunID] = @RunID2`);
        if (checkResult.recordset.length === 0) {
            const err = new Error(`BulkCostRun #${runId} not found`) as Error & { statusCode?: number };
            err.statusCode = 404;
            throw err;
        }
        const err = new Error(`BulkCostRun #${runId} is not in DRAFT status`) as Error & { statusCode?: number };
        err.statusCode = 409;
        throw err;
    }
}

interface BulkCostRunDetailRow {
    RunID: number;
    Status: string;
    VendorCode: string | null;
    VendorName: string | null;
    ReferenceNo: string | null;
    Currency: string | null;
    ExchangeRate: number | null;
    OrderTerm: string | null;
    Location: string | null;
    ShipModeNo: number | null;
    ContactPerson: string | null;
    SaleIncharge: string | null;
    Remark: string | null;
    U_PKH: number | null;
    U_SOC: number | null;
    U_Freight: number | null;
    U_Customs: number | null;
    U_WireTT: number | null;
    PreviewSnapshotJson: string | null;
}

interface DraftItemLineRow {
    LineNo: number;
    LineKey: string;
    LatestSnapshotJson: string | null;
    OriginSnapshotJson: string | null;
}

function parseJson(raw: string | null): Record<string, unknown> | null {
    if (!raw) return null;
    try { return JSON.parse(raw) as Record<string, unknown>; } catch { return null; }
}

export async function loadBulkCostRun(runId: number): Promise<LoadedBulkCostRun | null> {
    const pool = await getPool();
    const runTable = dbObjects.tables.qtec.bulkCostRun;
    const itemTable = dbObjects.tables.qtec.draftItem;

    const runRequest = pool.request().input('RunID', sql.BigInt, runId);
    const lineRequest = pool.request().input('RunIDL', sql.BigInt, runId);

    try {
        const [runResult, lineResult] = await Promise.all([
            runRequest.query<BulkCostRunDetailRow>(`
                SELECT [RunID], [Status], [VendorCode], [VendorName], [ReferenceNo],
                       [Currency], [ExchangeRate], [OrderTerm], [Location], [ShipModeNo],
                       [ContactPerson], [SaleIncharge], [Remark],
                       [U_PKH], [U_SOC], [U_Freight], [U_Customs], [U_WireTT],
                       [PreviewSnapshotJson]
                FROM ${runTable}
                WHERE [RunID] = @RunID
            `),
            lineRequest.query<DraftItemLineRow>(`
                SELECT [LineNo], [LineKey], [LatestSnapshotJson], [OriginSnapshotJson]
                FROM ${itemTable}
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
            currency: text(runRow.Currency) || 'THB',
            exchangeRate: numberValue(runRow.ExchangeRate, 1),
            referenceNo: text(runRow.ReferenceNo),
            remark: text(runRow.Remark),
            orderTerm: text(runRow.OrderTerm),
            location: text(runRow.Location),
            shipModeNo: runRow.ShipModeNo ?? 5,
            contactPerson: text(runRow.ContactPerson),
            saleIncharge: text(runRow.SaleIncharge),
        };

        return {
            runId: Number(runRow.RunID),
            status: runRow.Status as BulkCostRunStatus,
            vendorCode: text(runRow.VendorCode),
            vendorName: text(runRow.VendorName),
            referenceNo: text(runRow.ReferenceNo),
            inputSnapshot: { costs: costsSnapshot },
            previewSnapshot: parseJson(runRow.PreviewSnapshotJson),
            lines: lineResult.recordset.map((line) => ({
                lineNo: line.LineNo,
                lineKey: line.LineKey,
                latestSnapshot: parseJson(line.LatestSnapshotJson) ?? {},
                originSnapshot: parseJson(line.OriginSnapshotJson),
            })),
        };
    } catch (err) {
        throw err;
    }
}
