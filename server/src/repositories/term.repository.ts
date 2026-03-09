import { query, queryOne, execSP, sql } from '#src/config/database.js';
import { dbObjects } from '#src/config/db-objects.js';
import type { Term, CreateTermDTO } from '#src/types/term.types.js';
import {
    GET_HOME_TERMS_BY_ITEM_ID_SQL,
} from '#src/queries/pages/partcatalog-home.read.js';
import {
    GET_TERM_PAGE_BY_ID_SQL,
    GET_TERM_PAGE_ITEM_DETAIL_BY_TERM_ID_SQL,
    GET_TERM_PAGE_MASTER_FG_BY_ITEM_ID_SQL,
} from '#src/queries/pages/term-page.read.js';
import {
    SP_GET_CARD_NAME_BY_CARD_CODE,
    SP_GET_CWEIGHT_BY_VENDOR_STOCK_ITEM_NO,
    SP_GET_VENDOR_EMAIL_BY_TERM_ID,
} from '#src/queries/domains/term/term.sp.js';
import {
    buildCreateTermSql,
    buildDeleteTermSql,
    buildUpdateTermSql,
    shipModeLabel,
    dimUnitLabel,
} from '#src/queries/domains/term/term.write.js';

// ใช้สำหรับคืนชื่อตารางเขียนข้อมูล Term ในฐาน SAP
function resolveTermWriteTableName(): string {
    return dbObjects.tables.sap.pitm1;
}

// ใช้สำหรับคืนชื่อตาราง Attachment ในฐาน SAP สำหรับ cleanup ตอนลบ Term
function resolveAttachmentTableName(): string {
    return dbObjects.tables.sap.attachment;
}

const TERM_TEXT_LABELS = {
    VendorCode: 'Vendor Code',
    VendorStockItemNo: 'Vendor Stock Item No',
    U_OrderTerm: 'Purchase Term',
    U_TermLocation: 'Term Location',
    SubLocation: 'Sub Location',
    U_PurCurr: 'Purchase Currency',
    U_FreightType: 'Freight Type',
    BuyUnitMsr: 'Purchase UOM',
    SalUnitMsr: 'Sales UOM',
    U_MOQ: 'MOQ/MOV',
    LeadTime: 'Lead Time',
    U_VendorBPA: 'Vendor BPA',
    U_SalesTerm: 'Sales Term',
    U_Remark: 'Remark',
    SaleSubLocation: 'Sales Sub Location',
    ContractNo: 'Contract No',
    U_DimUnit: 'Dimension Unit',
    U_ShipMode: 'Ship Mode',
    Updatedby: 'Updated By',
} as const;

function createBadRequestError(message: string): Error & { statusCode: number } {
    const err = new Error(message) as Error & { statusCode: number };
    err.statusCode = 400;
    return err;
}

function normalizeTermText(
    field: keyof typeof TERM_TEXT_LABELS,
    value: unknown,
    maxLength: number,
    strategy: 'reject' | 'truncate' = 'reject',
): string {
    const normalized = value === null || value === undefined ? '' : String(value).trim();
    if (normalized.length <= maxLength) {
        return normalized;
    }

    if (strategy === 'truncate') {
        return normalized.slice(0, maxLength);
    }

    throw createBadRequestError(`${TERM_TEXT_LABELS[field]} exceeds max length ${maxLength}`);
}

/**
 * Merge user input + calculated fields into a flat SQL params object.
 */
// ใช้สำหรับรวมข้อมูลจากฟอร์มและผลคำนวณให้เป็นพารามิเตอร์ SQL
function buildTermParams(
    data: CreateTermDTO | Partial<CreateTermDTO>,
    calculatedFields: Partial<Term>,
    updatedBy: string,
): Record<string, unknown> {
    const modeNo = Number(data.U_ShipModeNo ?? calculatedFields.U_ShipModeNo ?? -1);
    const unitNo = Number(data.U_DimUnitNo ?? calculatedFields.U_DimUnitNo ?? 1);

    return {
        // User-input fields
        VendorCode: normalizeTermText('VendorCode', data.VendorCode, 15),
        VendorStockItemNo: normalizeTermText('VendorStockItemNo', data.VendorStockItemNo, 100),
        U_OrderTerm: normalizeTermText('U_OrderTerm', data.U_OrderTerm, 30),
        U_TermLocation: normalizeTermText('U_TermLocation', data.U_TermLocation, 10),
        SubLocation: normalizeTermText('SubLocation', data.SubLocation, 50),
        U_ProdCost: data.U_ProdCost ?? 0,
        U_PurCurr: normalizeTermText('U_PurCurr', data.U_PurCurr, 10),
        U_PurRate: data.U_PurRate ?? 1,
        U_PKH: data.U_PKH ?? 0,
        U_SOC: data.U_SOC ?? 0,
        U_ShipModeNo: modeNo,
        U_ShipMode: normalizeTermText('U_ShipMode', shipModeLabel(modeNo), 10),
        U_DimUnitNo: unitNo,
        U_DimUnit: normalizeTermText('U_DimUnit', dimUnitLabel(unitNo), 5),
        U_Length: data.U_Length ?? 0,
        U_Width: data.U_Width ?? 0,
        U_Height: data.U_Height ?? 0,
        U_Weight: data.U_Weight ?? 0,
        U_FreightType: normalizeTermText('U_FreightType', data.U_FreightType, 30),
        U_FreightRate: data.U_FreightRate ?? 0,
        U_FR: data.U_FR ?? calculatedFields.U_FR ?? 0,
        INS_Percent: data.INS_Percent ?? 0,
        U_ZoneRate: data.U_ZoneRate ?? calculatedFields.U_ZoneRate ?? 0,
        U_DT_Percent: data.U_DT_Percent ?? 0,
        U_ETPer: data.U_ETPer ?? 0,
        U_MiscTax: data.U_MiscTax ?? 0,
        U_WTT: data.U_WTT ?? 0,
        U_CC: data.U_CC ?? 0,
        U_ASP: data.U_ASP ?? 0,
        U_STK_Percent: data.U_STK_Percent ?? 0,
        U_SPK: data.U_SPK ?? 0,
        U_QOC: data.U_QOC ?? 0,
        BuyUnitMsr: normalizeTermText('BuyUnitMsr', data.BuyUnitMsr, 20),
        NumInBuy: data.NumInBuy ?? 1,
        SalUnitMsr: normalizeTermText('SalUnitMsr', data.SalUnitMsr, 20),
        NumInSale: data.NumInSale ?? 1,
        U_MOQ: normalizeTermText('U_MOQ', data.U_MOQ, 50),
        LeadTime: normalizeTermText('LeadTime', data.LeadTime, 5),
        U_VendorBPA: normalizeTermText('U_VendorBPA', data.U_VendorBPA, 3),
        CntctCode: data.CntctCode ?? null,
        SlpCode: data.SlpCode ?? null,
        SlpSprtCode: data.SlpSprtCode ?? null,
        U_ValidFrom: data.U_ValidFrom ?? null,
        U_ValidTo: data.U_ValidTo ?? null,
        U_SalesTerm: normalizeTermText('U_SalesTerm', data.U_SalesTerm, 20),
        U_Remark: normalizeTermText('U_Remark', data.U_Remark, 254),
        SaleSubLocation: normalizeTermText('SaleSubLocation', data.SaleSubLocation, 50),
        Active: data.Active !== false,
        ContractNo: normalizeTermText('ContractNo', data.ContractNo, 50),

        // Server-calculated fields (from calculation engine)
        U_OP: calculatedFields.U_OP ?? 0,
        U_OP_THB: calculatedFields.U_OP_THB ?? 0,
        U_INS: calculatedFields.U_INS ?? 0,
        U_FRZONE: calculatedFields.U_FRZONE ?? 0,
        U_CIF: calculatedFields.U_CIF ?? 0,
        U_CIFZONE: calculatedFields.U_CIFZONE ?? 0,
        U_DT: calculatedFields.U_DT ?? 0,
        U_DT_FR: calculatedFields.U_DT_FR ?? 0,
        U_DT_FRZONE: calculatedFields.U_DT_FRZONE ?? 0,
        U_ET: calculatedFields.U_ET ?? 0,
        U_MT: calculatedFields.U_MT ?? 0,
        U_DimWeight: calculatedFields.U_DimWeight ?? 0,
        U_ShipWeightCal: calculatedFields.U_ShipWeightCal ?? 0,
        U_FreightQTEC: calculatedFields.U_FreightQTEC ?? 0,
        U_preQLC: calculatedFields.U_preQLC ?? 0,
        U_STK: calculatedFields.U_STK ?? 0,
        U_QLC: calculatedFields.U_QLC ?? 0,
        U_QLC2: calculatedFields.U_QLC2 ?? 0,
        U_QLC3: calculatedFields.U_QLC3 ?? 0,

        // Audit
        Updatedby: normalizeTermText('Updatedby', updatedBy, 50, 'truncate'),
        UpdatedDate: new Date(),
    };
}

/**
 * Get all terms for a given ItemID.
 */
// ใช้สำหรับดึง Term ทั้งหมดตาม ItemID
export async function getTermsByItemId(itemId: number): Promise<Term[]> {
    return await query<Term>(GET_HOME_TERMS_BY_ITEM_ID_SQL, { itemId });
}

/**
 * Get a single term by TermID.
 */
// ใช้สำหรับดึง Term เดียวตาม TermID
export async function getTermById(termId: number): Promise<Term | null> {
    return await queryOne<Term>(GET_TERM_PAGE_BY_ID_SQL, { termId });
}

/**
 * Create a new Term — INSERT into [@PITM1].
 */
// ใช้สำหรับสร้าง Term ใหม่ลงตาราง @PITM1
export async function createTerm(
    data: CreateTermDTO,
    calculatedFields: Partial<Term>,
    updatedBy: string
): Promise<number> {
    const targetTable = resolveTermWriteTableName();
    const params = {
        ItemID: data.ItemID,
        ...buildTermParams(data, calculatedFields, updatedBy),
    };

    const row = await queryOne<{ TermID: number }>(
        buildCreateTermSql(targetTable),
        params,
    );

    if (!row?.TermID) {
        throw new Error('Failed to create term — no TermID returned');
    }
    return row.TermID;
}

/**
 * Update an existing Term — UPDATE [@PITM1] WHERE TermID = @TermID.
 */
// ใช้สำหรับอัปเดต Term ตาม TermID
export async function updateTerm(
    termId: number,
    data: Partial<CreateTermDTO>,
    calculatedFields: Partial<Term>,
    updatedBy: string
): Promise<void> {
    const targetTable = resolveTermWriteTableName();
    const params = {
        TermID: termId,
        ...buildTermParams(data, calculatedFields, updatedBy),
    };

    const result = await queryOne<{ RowsAffected: number }>(
        buildUpdateTermSql(targetTable),
        params,
    );

    const rowsAffected = Number(result?.RowsAffected ?? 0);
    if (!Number.isFinite(rowsAffected) || rowsAffected !== 1) {
        throw new Error(`Failed to update term: TermID ${termId} was not found`);
    }
}

// ใช้สำหรับลบ Term และ Attachment ที่เกี่ยวข้องใน transaction
export async function deleteTerm(termId: number): Promise<void> {
    if (!Number.isFinite(termId) || termId <= 0) {
        throw new Error('Invalid TermID');
    }

    const termTableName = resolveTermWriteTableName();
    const attachmentTableName = resolveAttachmentTableName();

    const row = await queryOne<{
        TermRowsAffected: number;
        AttachmentRowsAffected: number;
    }>(buildDeleteTermSql(termTableName, attachmentTableName), {
        TermID: termId,
    });

    const termRowsAffected = Number(row?.TermRowsAffected ?? 0);
    if (!Number.isFinite(termRowsAffected) || termRowsAffected !== 1) {
        throw new Error('Failed to delete term');
    }
}


/**
 * Get Vendor CardName by CardCode.
 * Calls SP: SPIT_GetCardNameByCardCode
 */
// ใช้สำหรับดึงชื่อ Vendor ตามรหัส CardCode ด้วย SP
export async function getCardName(cardCode: string): Promise<string | null> {
    const result = await execSP(
        SP_GET_CARD_NAME_BY_CARD_CODE,
        { CardCode: { type: sql.NVarChar(15), value: cardCode } },
        { outCardName: { type: sql.NVarChar(100) } }
    );
    return result.output.outCardName || null;
}

/**
 * Get chargeable weight by VendorStockItemNo.
 * Calls SP: SPIT_GetCWeightByVendorStockItemNo
 */
// ใช้สำหรับดึงค่า chargeable weight จาก VendorStockItemNo ด้วย SP
export async function getCWeight(vendorStockItemNo: string): Promise<number> {
    const result = await execSP(
        SP_GET_CWEIGHT_BY_VENDOR_STOCK_ITEM_NO,
        { VendorStockItemNo: { type: sql.NVarChar(100), value: vendorStockItemNo } },
        { outCWeight: { type: sql.Numeric(19, 6) } }
    );
    return result.output.outCWeight ?? 0;
}

/**
 * Get Vendor Email payload by TermID.
 * Calls SP: SPIT_GetVendorEmailByTermID
 */
export interface VendorEmailResult {
    contactName: string | null;
    email: string | null;
    tel: string | null;
    mobile: string | null;
    catalogNo: string | null;
    itemDescription: string | null;
    brand: string | null;
    longDesc: string | null;
}

// ใช้สำหรับดึงข้อมูลอีเมล Vendor สำหรับส่ง RFQ ด้วย SP
export async function getVendorEmail(termId: number): Promise<VendorEmailResult> {
    const result = await execSP(
        SP_GET_VENDOR_EMAIL_BY_TERM_ID,
        { TermID: { type: sql.Int, value: termId } },
        {
            outCntctName: { type: sql.VarChar(100) },
            outE_MailL: { type: sql.NVarChar(100) },
            outTel1: { type: sql.NVarChar(20) },
            outCellolar: { type: sql.NVarChar(20) },
            outU_Calalogno: { type: sql.NVarChar(150) },
            outItemDescription: { type: sql.NVarChar(100) },
            outU_Brand: { type: sql.NVarChar(50) },
            outLongDesc: { type: sql.NVarChar(4000) },
        }
    );

    return {
        contactName: result.output.outCntctName || null,
        email: result.output.outE_MailL || null,
        tel: result.output.outTel1 || null,
        mobile: result.output.outCellolar || null,
        catalogNo: result.output.outU_Calalogno || null,
        itemDescription: result.output.outItemDescription || null,
        brand: result.output.outU_Brand || null,
        longDesc: result.output.outLongDesc || null,
    };
}


/**
 * Get Item Detail by TermID.
 * Equivalent to SP: SPIT_GetItemDetailByTermID (not present in DB).
 */
// ใช้สำหรับดึงรายละเอียด Item จาก TermID
export async function getItemDetailByTermId(termId: number): Promise<any | null> {
    return await queryOne(GET_TERM_PAGE_ITEM_DETAIL_BY_TERM_ID_SQL, { termId });
}

/**
 * Get MasterFG by ItemID.
 * Equivalent to SP: SPIT_GetMasterFGByItemID (not present in DB).
 */
// ใช้สำหรับดึงค่า MasterFG ตาม ItemID
export async function getMasterFGByItemId(itemId: number): Promise<string | null> {
    const row = await queryOne<{ MasterFG: string }>(GET_TERM_PAGE_MASTER_FG_BY_ITEM_ID_SQL, { itemId });
    return row?.MasterFG ?? null;
}
