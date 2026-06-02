/**
 * Sandbox Master Repository
 *
 * Writes Item and Term candidates to PART_CATALOG_AIX mirror tables.
 * GUARD: assertNotSapTarget() runs before every write — refuses if target matches
 * the production PartCatalog/SAP DB.
 *
 * This is a "Sandbox Finalize / Dry-run Master Write" — NOT a production
 * PartCatalog/SAP write.
 */

import { getPool, sql } from '#src/config/database.js';
import { dbObjects, SANDBOX_DB_PREFIX } from '#src/config/db-objects.js';
import { env } from '#src/config/env.js';
import { logger } from '#src/utils/logger.js';
import {
    buildSandboxFindExistingFinalizeSql,
    buildSandboxInsertItemSql,
    buildSandboxInsertTermSql,
} from '#src/queries/domains/bulk-cost/sandbox-finalize.write.js';

// ─── Guard ───────────────────────────────────────────────────────────────────

const ALLOWED_SANDBOX_DB = 'PART_CATALOG_AIX';

function assertNotSapTarget(): void {
    const sandbox = env.DB_NAME_SANDBOX.trim().toUpperCase();
    const sap = env.DB_NAME_SAP.trim().toUpperCase();
    const prefix = SANDBOX_DB_PREFIX.toUpperCase();
    if (sandbox !== ALLOWED_SANDBOX_DB) {
        throw new Error(
            `[SANDBOX GUARD] Refusing write: DB_NAME_SANDBOX must be "${ALLOWED_SANDBOX_DB}", got "${env.DB_NAME_SANDBOX}".`,
        );
    }
    if (sandbox === sap) {
        throw new Error(
            `[SANDBOX GUARD] Refusing write: DB_NAME_SANDBOX "${env.DB_NAME_SANDBOX}" matches PartCatalog/SAP production DB "${env.DB_NAME_SAP}". ` +
            `Set DB_NAME_SANDBOX to "${ALLOWED_SANDBOX_DB}".`,
        );
    }
    if (!prefix.startsWith(`[${ALLOWED_SANDBOX_DB}].[DBO]`)) {
        throw new Error(
            `[SANDBOX GUARD] Refusing write: sandbox object prefix is "${SANDBOX_DB_PREFIX}", expected "[${ALLOWED_SANDBOX_DB}].[dbo]".`,
        );
    }
    logger.info('[SANDBOX] Target confirmed', {
        sandboxDb: env.DB_NAME_SANDBOX,
        prefix: SANDBOX_DB_PREFIX,
    });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function text(value: unknown): string {
    if (value === null || value === undefined) return '';
    return String(value).trim();
}

function nullableText(value: unknown): string | null {
    const v = text(value);
    return v || null;
}

function numberValue(value: unknown, fallback = 0): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function intValue(value: unknown): number | null {
    const parsed = Number(value);
    return Number.isInteger(parsed) ? parsed : null;
}

function requiredText(value: unknown, fieldName: string): string {
    const v = text(value);
    if (!v) throw new Error(`[SANDBOX] Missing required field: ${fieldName}`);
    return v;
}

function requiredInt(value: unknown, fieldName: string): number {
    const parsed = intValue(value);
    if (parsed === null) throw new Error(`[SANDBOX] Invalid required integer field: ${fieldName}`);
    return parsed;
}

function todayDateOnly(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

// ─── Trace ───────────────────────────────────────────────────────────────────

export interface SandboxWriteTrace {
    runId: number;
    revisionGroupId?: number;
    revisionNo?: number;
    lineKey: string;
    writtenBy: string;
    writtenAt: string; // ISO datetime
}

// Encode trace into Updatedby field (truncated to 50 chars).
function encodeTraceUpdatedby(trace: SandboxWriteTrace): string {
    return `SBX|R${trace.runId}|V${trace.revisionNo ?? '-'}|${trace.writtenBy}`.slice(0, 50);
}

function encodeTraceRemarkPrefix(trace: SandboxWriteTrace): string {
    return `SBX-Finalize|RunID:${trace.runId}|RevGroup:${trace.revisionGroupId ?? '-'}|Rev:${trace.revisionNo ?? '-'}|Line:${trace.lineKey}|`;
}

function encodeTraceRemark(trace: SandboxWriteTrace): string {
    return `${encodeTraceRemarkPrefix(trace)}By:${trace.writtenBy}|At:${trace.writtenAt}`.slice(0, 200);
}

export interface ExistingSandboxFinalizeResult {
    sandboxItemId: number;
    sandboxTermId: number | null;
}

export async function findExistingSandboxFinalize(
    trace: SandboxWriteTrace,
): Promise<ExistingSandboxFinalizeResult | null> {
    assertNotSapTarget();

    const tablePoitm = dbObjects.tables.sandbox.poitm;
    const tablePitm1 = dbObjects.tables.sandbox.pitm1;
    const request = new sql.Request(await getPool());
    request.input('TraceLike', sql.NVarChar(200), `${encodeTraceRemarkPrefix(trace)}%`);

    const result = await request.query<{ ItemID: number; TermID: number | null }>(
        buildSandboxFindExistingFinalizeSql(tablePoitm, tablePitm1),
    );
    const row = result.recordset[0];
    if (!row?.ItemID) return null;

    return {
        sandboxItemId: Number(row.ItemID),
        sandboxTermId: row.TermID === null || row.TermID === undefined ? null : Number(row.TermID),
    };
}

// ─── Item INSERT ─────────────────────────────────────────────────────────────

export interface SandboxItemResult {
    sandboxItemId: number;
}

export async function insertSandboxItem(
    latest: Record<string, unknown>,
    trace: SandboxWriteTrace,
    transaction?: sql.Transaction,
): Promise<SandboxItemResult> {
    assertNotSapTarget();

    const tablePoitm = dbObjects.tables.sandbox.poitm;
    const updatedby = encodeTraceUpdatedby(trace);
    // Embed trace in U_Remark so it survives in the AIX row
    const remark = encodeTraceRemark(trace);

    const request = transaction ? new sql.Request(transaction) : new sql.Request(await getPool());
    request.input('ItemGroup', sql.Int, requiredInt(latest.itemGroup, 'Item Group'));
    request.input('U_Brand', sql.NVarChar(50), requiredText(latest.manufacturer, 'Mfr Brand'));
    request.input('U_Calalogno', sql.NVarChar(100), requiredText(latest.mfgPartNumber, 'Mfr Catalog No'));
    request.input('ItemDescription', sql.NVarChar(100), requiredText(latest.sapDescription, 'Item Description'));
    request.input('InvntryUom', sql.NVarChar(10), requiredText(latest.stockUOM || latest.uom, 'Stock UOM'));
    request.input('U_CountryOrg', sql.NVarChar(10), nullableText(latest.countryOfOrigin));
    request.input('BPStockItemNo', sql.NVarChar(50), nullableText(latest.supplierOrderCode));
    request.input('U_HScode', sql.NVarChar(20), nullableText(latest.hsCode));
    request.input('U_Remark', sql.NVarChar(200), remark);
    request.input('LeadTime', sql.NVarChar(5), nullableText(latest.deliveryLeadTime));
    request.input('SaleSubLocation', sql.NVarChar(50), nullableText(latest.salesSubLocation));
    request.input('ItemCategory', sql.NVarChar(50), nullableText(latest.itemCategory));
    request.input('U_Permitreq', sql.NVarChar(1), nullableText(latest.importPermit));
    request.input('U_PermitType', sql.NVarChar(50), nullableText(latest.permitType));
    request.input('Updatedby', sql.NVarChar(50), updatedby);

    const result = await request.query<{ ItemID: number }>(
        buildSandboxInsertItemSql(tablePoitm),
    );
    const itemId = result.recordset[0]?.ItemID;
    if (!itemId) throw new Error(`[SANDBOX] Failed to INSERT item for line ${trace.lineKey} into ${tablePoitm}`);

    logger.info('[SANDBOX] Item written to AIX mirror', {
        sandboxDb: env.DB_NAME_SANDBOX,
        itemId,
        lineKey: trace.lineKey,
        runId: trace.runId,
        writtenBy: trace.writtenBy,
    });

    return { sandboxItemId: Number(itemId) };
}

// ─── Term INSERT ─────────────────────────────────────────────────────────────

export interface SandboxTermResult {
    sandboxTermId: number;
}

export async function insertSandboxTerm(
    itemId: number,
    latest: Record<string, unknown>,
    finalResult: Record<string, unknown>,
    runCosts: Record<string, unknown>,
    trace: SandboxWriteTrace,
    transaction?: sql.Transaction,
): Promise<SandboxTermResult> {
    assertNotSapTarget();

    const tablePitm1 = dbObjects.tables.sandbox.pitm1;
    const updatedby = encodeTraceUpdatedby(trace);

    const request = transaction ? new sql.Request(transaction) : new sql.Request(await getPool());
    request.input('ItemID', sql.BigInt, itemId);
    request.input('VendorCode', sql.NVarChar(15), requiredText(latest.vendorCode || runCosts.supplierCode, 'Supplier / Vendor Code'));
    request.input('VendorStockItemNo', sql.NVarChar(100), nullableText(latest.supplierOrderCode));
    request.input('U_OrderTerm', sql.NVarChar(30), requiredText(latest.orderTerm, 'Purchase Term'));
    request.input('U_TermLocation', sql.NVarChar(10), requiredText(latest.location, 'Term Location'));
    request.input('SubLocation', sql.NVarChar(50), requiredText(latest.subLocation || runCosts.subLocation, 'Sub Location'));
    request.input('U_ProdCost', sql.Decimal(19, 6), numberValue(latest.unitPrice, 0));
    request.input('U_PurCurr', sql.NVarChar(10), requiredText(latest.currency, 'Currency'));
    request.input('U_PurRate', sql.Decimal(19, 6), numberValue(runCosts.exchangeRate, 1));
    request.input('U_PKH', sql.Decimal(19, 6), numberValue(finalResult.pkh, 0));
    request.input('U_SOC', sql.Decimal(19, 6), numberValue(finalResult.soc, 0));
    request.input('U_OP', sql.Decimal(19, 6), numberValue(finalResult.op1Source, 0));
    request.input('U_OP_SUM', sql.Decimal(19, 6), numberValue(finalResult.op1, 0));
    request.input('U_OP_THB', sql.Decimal(19, 6), numberValue(finalResult.op2, 0));
    request.input('U_INS', sql.Decimal(19, 6), numberValue(finalResult.ins, 0));
    request.input('INS_Percent', sql.Decimal(19, 6), numberValue(latest.insPercent, 0));
    request.input('U_FR', sql.Decimal(19, 6), numberValue(finalResult.frQTEC, 0));
    request.input('U_FRZONE', sql.Decimal(19, 6), numberValue(finalResult.frZoneCost, 0));
    request.input('U_ZoneRate', sql.Decimal(19, 6), numberValue(latest.zoneRate, 0));
    request.input('U_CIF', sql.Decimal(19, 6), numberValue(finalResult.cifQTEC, 0));
    request.input('U_CIFZONE', sql.Decimal(19, 6), numberValue(finalResult.cifZone, 0));
    request.input('U_DT_Percent', sql.Decimal(19, 6), numberValue(latest.importDutyPercent, 0));
    request.input('U_DT', sql.Decimal(19, 6), numberValue(finalResult.selectedDuty, 0));
    request.input('U_DT_FR', sql.Decimal(19, 6), numberValue(finalResult.dtQTEC, 0));
    request.input('U_DT_FRZONE', sql.Decimal(19, 6), numberValue(finalResult.dtZone, 0));
    request.input('U_WTT', sql.Decimal(19, 6), numberValue(finalResult.ttFinal, 0));
    request.input('U_CC', sql.Decimal(19, 6), numberValue(finalResult.ccFinal, 0));
    request.input('U_ASP', sql.Decimal(19, 6), numberValue(latest.scc, 0));
    request.input('U_STK_Percent', sql.Decimal(19, 6), numberValue(latest.stkPercent, 0));
    request.input('U_STK', sql.Decimal(19, 6), numberValue(finalResult.stk, 0));
    request.input('U_preQLC', sql.Decimal(19, 6), numberValue(finalResult.preQLC, 0));
    request.input('U_SPK', sql.Decimal(19, 6), numberValue(finalResult.spk, 0));
    request.input('U_QOC', sql.Decimal(19, 6), numberValue(finalResult.qocVal, 0));
    request.input('U_QLC', sql.Decimal(19, 6), numberValue(finalResult.qlc, 0));
    request.input('U_QLC2', sql.Decimal(19, 6), numberValue(finalResult.qlc2, 0));
    request.input('U_QLC3', sql.Decimal(19, 6), numberValue(finalResult.totalQLC, 0));
    request.input('U_MK_Percent', sql.Decimal(19, 6), numberValue(latest.markupPercent, 0));
    request.input('U_MK_THB', sql.Decimal(19, 6), numberValue(finalResult.markup, 0));
    request.input('U_SalesPrice', sql.Decimal(19, 6), numberValue(finalResult.roundUp, 0));
    request.input('U_ValidFrom', sql.Date, todayDateOnly());
    request.input('BuyUnitMsr', sql.NVarChar(20), requiredText(latest.purchaseUOM, 'Purchase UOM'));
    request.input('NumInBuy', sql.Decimal(19, 6), numberValue(latest.stockConversion, 1));
    request.input('SalUnitMsr', sql.NVarChar(20), requiredText(latest.saleUOM, 'Sales UOM'));
    request.input('NumInSale', sql.Decimal(19, 6), numberValue(latest.saleConversion, 1));
    request.input('U_MOQ', sql.NVarChar(50), nullableText(latest.moq));
    request.input('LeadTime', sql.NVarChar(5), nullableText(latest.deliveryLeadTime));
    request.input('U_ShipModeNo', sql.Int, requiredInt(latest.shipModeNo, 'Ship Mode'));
    request.input('U_Weight', sql.Decimal(19, 6), numberValue(latest.itemWeightPerEach, 0));
    request.input('U_CWeight', sql.Decimal(19, 6), numberValue(latest.dimensionWeightPerEach, 0));
    request.input('U_DimUnitNo', sql.Int, intValue(latest.dimUnit) ?? 1);
    request.input('U_Length', sql.Decimal(19, 6), numberValue(latest.length, 0));
    request.input('U_Width', sql.Decimal(19, 6), numberValue(latest.width, 0));
    request.input('U_Height', sql.Decimal(19, 6), numberValue(latest.height, 0));
    request.input('U_FreightType', sql.NVarChar(30), nullableText(latest.freightType));
    request.input('U_FreightRate', sql.Decimal(19, 6), numberValue(latest.freightRate, 0));
    request.input('U_ShipWeightCal', sql.Decimal(19, 6), numberValue(finalResult.shipWeightCal, 0));
    request.input('U_SalesTerm', sql.NVarChar(20), nullableText(latest.salesTerm));
    request.input('SaleSubLocation', sql.NVarChar(50), nullableText(latest.salesSubLocation));
    request.input('Updatedby', sql.NVarChar(50), updatedby);

    const result = await request.query<{ TermID: number }>(
        buildSandboxInsertTermSql(tablePitm1),
    );
    const termId = result.recordset[0]?.TermID;
    if (!termId) throw new Error(`[SANDBOX] Failed to INSERT term for line ${trace.lineKey} into ${tablePitm1}`);

    logger.info('[SANDBOX] Term written to AIX mirror', {
        sandboxDb: env.DB_NAME_SANDBOX,
        itemId,
        termId,
        lineKey: trace.lineKey,
        runId: trace.runId,
    });

    return { sandboxTermId: Number(termId) };
}
