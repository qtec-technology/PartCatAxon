import { query, queryOne, execSP, sql } from '#src/config/database.js';
import { dbObjects } from '#src/config/db-objects.js';
import type { Item, CreateItemDTO, ItemDetail } from '#src/types/item.types.js';
import {
    buildHomeTopItemsQuery,
    buildHomeItemsPagedWithTotalQuery,
} from '#src/queries/pages/partcatalog-home.read.js';
import {
    GET_ITEM_PAGE_BY_ID_SQL,
    GET_ITEM_PAGE_TERM_COUNT_SQL,
} from '#src/queries/pages/item-page.read.js';
import {
    SP_GET_ITEM_DETAIL_BY_ITEM_ID,
    SP_GENERATE_CATALOG_NO,
    SP_CHECK_DUPLICATED_BY_CATALOG_NO,
    SP_GET_INVNTRY_UOM_BY_ITEM_ID,
} from '#src/queries/domains/item/item.sp.js';
import {
    buildCreateItemInsertSql,
    buildDeleteItemSql,
    buildUpdateItemSql,
} from '#src/queries/domains/item/item.write.js';

const TOP_ITEMS_LIMIT = 400;
const TOP_ITEMS_CACHE_TTL_MS = 60_000;
const DEFAULT_VAT_GROUP_PU = 'AP-07';
const DEFAULT_VAT_GROUP_SA = 'AR-07';
const DEFAULT_NULL_LOOKUP_VALUE = '_Null';
type ItemWithTotal = Item & { __total: number };

let topItemsCache: { items: Item[]; fetchedAt: number } | null = null;
let topItemsPromise: Promise<Item[]> | null = null;

// ใช้สำหรับล้างแคชรายการ Item ล่าสุดในหน่วยความจำ
function invalidateTopItemsCache(): void {
    topItemsCache = null;
    topItemsPromise = null;
}

// ใช้สำหรับคืนชื่อตารางเขียนข้อมูล Item ในฐาน SAP
function resolveWriteTableName(): string {
    return dbObjects.tables.sap.poitm;
}

// ใช้สำหรับคืนชื่อตาราง Term ในฐาน SAP เพื่อใช้ตรวจสอบก่อนลบ Item
function resolveTermTableName(): string {
    return dbObjects.tables.sap.pitm1;
}

// ใช้สำหรับคืนชื่อตาราง Attachment ในฐาน SAP สำหรับ cleanup ตอนลบ Item
function resolveAttachmentTableName(): string {
    return dbObjects.tables.sap.attachment;
}

// ใช้สำหรับแปลงค่าเป็นข้อความสำหรับบันทึก DB (กัน null/undefined)
function toDbText(value: unknown): string {
    if (value === null || value === undefined) return '';
    return String(value);
}

// ใช้สำหรับแปลงค่าเป็นข้อความแบบ nullable โดยค่าว่างจะเป็น null
function toDbNullableText(value: unknown): string | null {
    const text = toDbText(value).trim();
    return text.length > 0 ? text : null;
}

// ใช้สำหรับแปลงค่ารูปแบบต่าง ๆ ให้เป็น boolean สำหรับคอลัมน์ bit
function toDbBit(value: unknown, fallback: boolean): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value === 1;
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (['1', 'true', 'yes', 'y', 'on'].includes(normalized)) return true;
        if (['0', 'false', 'no', 'n', 'off'].includes(normalized)) return false;
    }
    return fallback;
}

// ใช้สำหรับตรวจว่าฟิลด์ถูกส่งมาใน payload จริงหรือไม่
function hasOwn(data: Partial<CreateItemDTO>, key: keyof CreateItemDTO): boolean {
    return Object.prototype.hasOwnProperty.call(data, key);
}

// ใช้สำหรับดึงรายการ Item ล่าสุดจากแคช หรือโหลดใหม่จาก DB เมื่อแคชหมดอายุ
async function getCachedTopItems(): Promise<Item[]> {
    const now = Date.now();
    if (topItemsCache && now - topItemsCache.fetchedAt < TOP_ITEMS_CACHE_TTL_MS) {
        return topItemsCache.items;
    }

    if (topItemsPromise) {
        return topItemsPromise;
    }

    topItemsPromise = (async () => {
        try {
            const items = await query<Item>(buildHomeTopItemsQuery(TOP_ITEMS_LIMIT));
            topItemsCache = { items, fetchedAt: Date.now() };
            return items;
        } finally {
            topItemsPromise = null;
        }
    })();

    return topItemsPromise;
}

/**
 * Get paginated items, ordered by UpdatedDate DESC.
 * Uses TOP(400) and in-memory pagination with short-lived cache.
 * Returns items for the requested page + total count (capped at 400).
 */
// ใช้สำหรับดึงรายการ Item แบบแบ่งหน้า พร้อมรองรับกรอง brand/myItems
export async function getItems(
    page: number = 1,
    pageSize: number = 50,
    brand?: string,
    myItems: boolean = false,
    updatedBy?: string
): Promise<{ items: Item[]; total: number }> {
    const cappedPageSize = Math.min(TOP_ITEMS_LIMIT, Math.max(1, pageSize));
    const normalizedBrand = (brand || '').trim();
    const normalizedUpdatedBy = (updatedBy || '').trim();
    const applyBrand = normalizedBrand && normalizedBrand !== '_Null' && normalizedBrand !== 'all';
    const applyMyItems = myItems && normalizedUpdatedBy.length > 0;

    if (myItems && !applyMyItems) {
        return { items: [], total: 0 };
    }

    // Search mode: when brand/myItems is selected, query the full dataset.
    if (applyBrand || applyMyItems) {
        const startRow = (page - 1) * cappedPageSize + 1;
        const endRow = page * cappedPageSize;
        const whereClauses: string[] = [];
        const params: Record<string, any> = { startRow, endRow };

        if (applyBrand) {
            whereClauses.push('t.U_Brand = @brand');
            params.brand = normalizedBrand;
        }
        if (applyMyItems) {
            whereClauses.push('t.Updatedby = @updatedBy');
            params.updatedBy = normalizedUpdatedBy;
        }

        const whereSql = whereClauses.length > 0
            ? `WHERE ${whereClauses.join(' AND ')}`
            : '';

        const rows = await query<ItemWithTotal>(buildHomeItemsPagedWithTotalQuery(whereSql), params);
        if (rows.length === 0) {
            return { items: [], total: 0 };
        }

        const total = Number(rows[0].__total ?? 0);
        const items = rows.map(({ __total, ...item }) => item as Item);
        return { items, total };
    }

    // Default mode: first load / reset => latest TOP 400 only.
    const allItems = await getCachedTopItems();
    const total = allItems.length;
    const startIndex = (page - 1) * cappedPageSize;
    const items = allItems.slice(startIndex, startIndex + cappedPageSize);
    return { items, total };
}

/**
 * Get a single item detail by ItemID.
 * Calls SP: SPIT_GetItemDetailByItemID
 */
// ใช้สำหรับดึงรายละเอียด Item ด้วย Stored Procedure ตาม ItemID
export async function getItemById(itemId: number): Promise<ItemDetail | null> {
    const result = await execSP<ItemDetail>(SP_GET_ITEM_DETAIL_BY_ITEM_ID, {
        ItemID: { type: sql.Int, value: itemId },
    });
    return result.recordset[0] || null;
}

/**
 * Get full item record by ItemID (for editing).
 */
// ใช้สำหรับดึงข้อมูล Item เต็มชุดสำหรับหน้าแก้ไข
export async function getFullItemById(itemId: number): Promise<Item | null> {
    return await queryOne<Item>(GET_ITEM_PAGE_BY_ID_SQL, { itemId });
}

/**
 * Create a new Item.
 */
// ใช้สำหรับสร้าง Item ใหม่ลงตาราง @POITM
export async function createItem(
    data: CreateItemDTO,
    updatedBy: string
): Promise<number> {
    const writeTableName = resolveWriteTableName();

    const itemGroup = Number(data.ItemGroup);
    if (!Number.isFinite(itemGroup)) {
        throw new Error('Invalid ItemGroup');
    }
    const vatGroupPu = toDbText(data.VatGroupPu).trim() || DEFAULT_VAT_GROUP_PU;
    const vatGourpSa = toDbText(data.VatGourpSa).trim() || DEFAULT_VAT_GROUP_SA;
    const countryOfOrigin = toDbText(data.U_CountryOrg).trim() || DEFAULT_NULL_LOOKUP_VALUE;
    const itemCategory = toDbText(data.ItemCategory).trim() || DEFAULT_NULL_LOOKUP_VALUE;

    const row = await queryOne<{ ItemID: number }>(buildCreateItemInsertSql(writeTableName), {
        ItemGroup: itemGroup,
        U_Brand: toDbText(data.U_Brand),
        U_Calalogno: toDbText(data.U_Calalogno),
        ItemDescription: toDbText(data.ItemDescription),
        InvntryUom: toDbText(data.InvntryUom),
        U_CountryOrg: countryOfOrigin,
        BPStockItemNo: toDbText(data.BPStockItemNo),
        SAPB1Desc: toDbText(data.SAPB1Desc),
        VatGroupPu: vatGroupPu,
        VatGourpSa: vatGourpSa,
        U_ECCN: toDbText(data.U_ECCN),
        U_UNSPSC: toDbText(data.U_UNSPSC),
        U_EpoCode: toDbText(data.U_EpoCode),
        U_HScode: toDbText(data.U_HScode),
        U_Remark: toDbText(data.U_Remark),
        LeadTime: toDbText(data.LeadTime),
        SaleSubLocation: toDbText(data.SaleSubLocation),
        ItemCategory: itemCategory,
        SpecialRequirement: toDbText(data.SpecialRequirement),
        GeneralSpec: toDbNullableText(data.GeneralSpec),
        GeneralSpecUrl: toDbNullableText(data.GeneralSpecUrl),
        LongDesc1: toDbText(data.LongDesc1),
        LongDesc2: toDbText(data.LongDesc2),
        LongDesc3: toDbText(data.LongDesc3),
        LongDesc4: toDbText(data.LongDesc4),
        U_Punchout: toDbText(data.U_Punchout),
        U_VMI: toDbText(data.U_VMI),
        U_CustBPA: toDbText(data.U_CustBPA),
        U_IsQTECSTock: toDbText(data.U_IsQTECSTock),
        U_B1Item: toDbText(data.U_B1Item),
        U_Serialreq: toDbText(data.U_Serialreq),
        U_MSDS: toDbText(data.U_MSDS),
        U_Certificate: toDbText(data.U_Certificate),
        U_Ecommerce: toDbText(data.U_Ecommerce),
        U_DG_Required: toDbText(data.U_DG_Required),
        U_Permitreq: toDbText(data.U_Permitreq),
        U_PermitType: toDbText(data.U_PermitType),
        Active: toDbBit(data.Active, true),
        MasterFG: toDbBit(data.MasterFG, false),
        Updatedby: toDbText(updatedBy || 'System'),
        UpdatedDate: new Date(),
    });

    if (!row?.ItemID) {
        throw new Error('Failed to create item');
    }

    invalidateTopItemsCache();
    return row.ItemID;
}

/**
 * Generate ItemCode via SP SPIT_GenCatalogNo.
 * Returns the generated code (e.g., PFG000001).
 */
// ใช้สำหรับเรียก SP เพื่อสร้างรหัส CatalogNo ของ Item
export async function generateCatalogNo(itemId: number): Promise<string> {
    const result = await execSP(
        SP_GENERATE_CATALOG_NO,
        { ItemID: { type: sql.Int, value: itemId } },
        { returnCatalogNo: { type: sql.NVarChar(20) } }
    );
    return result.output.returnCatalogNo;
}

/**
 * Check if CatalogNo + Brand is duplicated.
 * Calls SP: SPIT_CheckDuplicatedByCatalogNo
 */
// ใช้สำหรับตรวจซ้ำ CatalogNo + Brand ด้วย SP
export async function checkDuplicate(
    catalogNo: string,
    brand: string,
    itemId: number
): Promise<boolean> {
    const result = await execSP(
        SP_CHECK_DUPLICATED_BY_CATALOG_NO,
        {
            CatalogNo: { type: sql.NVarChar(150), value: catalogNo },
            Brand: { type: sql.NVarChar(255), value: brand },
            ItemID: { type: sql.Int, value: itemId },
        },
        {
            outIsDuplicated: { type: sql.NVarChar(5) },
        }
    );
    return result.output.outIsDuplicated === 'YES';
}

/**
 * Get Stock UOM by ItemID.
 * Calls SP: SPIT_GetInvntryUomByItemID
 */
// ใช้สำหรับดึงหน่วยสต็อกของ Item ด้วย SP
export async function getInvntryUom(itemId: number): Promise<string | null> {
    const result = await execSP(
        SP_GET_INVNTRY_UOM_BY_ITEM_ID,
        { ItemID: { type: sql.Int, value: itemId } },
        { outInvntryUom: { type: sql.NVarChar(20) } }
    );
    return result.output.outInvntryUom || null;
}

// ใช้สำหรับอัปเดต Item เฉพาะฟิลด์ที่ส่งมา
export async function updateItem(
    itemId: number,
    data: Partial<CreateItemDTO>,
    updatedBy: string
): Promise<void> {
    const writeTableName = resolveWriteTableName();
    const fieldsToUpdate: Record<string, unknown> = {};

    if (hasOwn(data, 'ItemGroup')) {
        const itemGroup = Number(data.ItemGroup);
        if (!Number.isFinite(itemGroup)) {
            throw new Error('Invalid ItemGroup');
        }
        fieldsToUpdate.ItemGroup = itemGroup;
    }
    if (hasOwn(data, 'U_Brand')) fieldsToUpdate.U_Brand = toDbText(data.U_Brand);
    if (hasOwn(data, 'U_Calalogno')) fieldsToUpdate.U_Calalogno = toDbText(data.U_Calalogno);
    if (hasOwn(data, 'ItemDescription')) fieldsToUpdate.ItemDescription = toDbText(data.ItemDescription);
    if (hasOwn(data, 'InvntryUom')) fieldsToUpdate.InvntryUom = toDbText(data.InvntryUom);
    if (hasOwn(data, 'U_CountryOrg')) {
        fieldsToUpdate.U_CountryOrg = toDbText(data.U_CountryOrg).trim() || DEFAULT_NULL_LOOKUP_VALUE;
    }
    if (hasOwn(data, 'BPStockItemNo')) fieldsToUpdate.BPStockItemNo = toDbText(data.BPStockItemNo);
    if (hasOwn(data, 'SAPB1Desc')) fieldsToUpdate.SAPB1Desc = toDbText(data.SAPB1Desc);
    if (hasOwn(data, 'VatGroupPu')) {
        fieldsToUpdate.VatGroupPu = toDbText(data.VatGroupPu).trim() || DEFAULT_VAT_GROUP_PU;
    }
    if (hasOwn(data, 'VatGourpSa')) {
        fieldsToUpdate.VatGourpSa = toDbText(data.VatGourpSa).trim() || DEFAULT_VAT_GROUP_SA;
    }
    if (hasOwn(data, 'U_ECCN')) fieldsToUpdate.U_ECCN = toDbText(data.U_ECCN);
    if (hasOwn(data, 'U_UNSPSC')) fieldsToUpdate.U_UNSPSC = toDbText(data.U_UNSPSC);
    if (hasOwn(data, 'U_EpoCode')) fieldsToUpdate.U_EpoCode = toDbText(data.U_EpoCode);
    if (hasOwn(data, 'U_HScode')) fieldsToUpdate.U_HScode = toDbText(data.U_HScode);
    if (hasOwn(data, 'U_Remark')) fieldsToUpdate.U_Remark = toDbText(data.U_Remark);
    if (hasOwn(data, 'LeadTime')) fieldsToUpdate.LeadTime = toDbText(data.LeadTime);
    if (hasOwn(data, 'SaleSubLocation')) fieldsToUpdate.SaleSubLocation = toDbText(data.SaleSubLocation);
    if (hasOwn(data, 'ItemCategory')) {
        fieldsToUpdate.ItemCategory = toDbText(data.ItemCategory).trim() || DEFAULT_NULL_LOOKUP_VALUE;
    }
    if (hasOwn(data, 'SpecialRequirement')) {
        fieldsToUpdate.SpecialRequirement = toDbText(data.SpecialRequirement);
    }
    if (hasOwn(data, 'GeneralSpec')) fieldsToUpdate.GeneralSpec = toDbNullableText(data.GeneralSpec);
    if (hasOwn(data, 'GeneralSpecUrl')) fieldsToUpdate.GeneralSpecUrl = toDbNullableText(data.GeneralSpecUrl);
    if (hasOwn(data, 'LongDesc1')) fieldsToUpdate.LongDesc1 = toDbText(data.LongDesc1);
    if (hasOwn(data, 'LongDesc2')) fieldsToUpdate.LongDesc2 = toDbText(data.LongDesc2);
    if (hasOwn(data, 'LongDesc3')) fieldsToUpdate.LongDesc3 = toDbText(data.LongDesc3);
    if (hasOwn(data, 'LongDesc4')) fieldsToUpdate.LongDesc4 = toDbText(data.LongDesc4);
    if (hasOwn(data, 'U_Punchout')) fieldsToUpdate.U_Punchout = toDbText(data.U_Punchout);
    if (hasOwn(data, 'U_VMI')) fieldsToUpdate.U_VMI = toDbText(data.U_VMI);
    if (hasOwn(data, 'U_CustBPA')) fieldsToUpdate.U_CustBPA = toDbText(data.U_CustBPA);
    if (hasOwn(data, 'U_IsQTECSTock')) fieldsToUpdate.U_IsQTECSTock = toDbText(data.U_IsQTECSTock);
    if (hasOwn(data, 'U_B1Item')) fieldsToUpdate.U_B1Item = toDbText(data.U_B1Item);
    if (hasOwn(data, 'U_Serialreq')) fieldsToUpdate.U_Serialreq = toDbText(data.U_Serialreq);
    if (hasOwn(data, 'U_MSDS')) fieldsToUpdate.U_MSDS = toDbText(data.U_MSDS);
    if (hasOwn(data, 'U_Certificate')) fieldsToUpdate.U_Certificate = toDbText(data.U_Certificate);
    if (hasOwn(data, 'U_Ecommerce')) fieldsToUpdate.U_Ecommerce = toDbText(data.U_Ecommerce);
    if (hasOwn(data, 'U_DG_Required')) fieldsToUpdate.U_DG_Required = toDbText(data.U_DG_Required);
    if (hasOwn(data, 'U_Permitreq')) fieldsToUpdate.U_Permitreq = toDbText(data.U_Permitreq);
    if (hasOwn(data, 'U_PermitType')) fieldsToUpdate.U_PermitType = toDbText(data.U_PermitType);
    if (hasOwn(data, 'Active')) fieldsToUpdate.Active = toDbBit(data.Active, true);
    if (hasOwn(data, 'MasterFG')) fieldsToUpdate.MasterFG = toDbBit(data.MasterFG, false);

    fieldsToUpdate.Updatedby = toDbText(updatedBy || 'System');
    fieldsToUpdate.UpdatedDate = new Date();

    const updateSql = buildUpdateItemSql(writeTableName, Object.keys(fieldsToUpdate));
    const result = await queryOne<{ RowsAffected: number }>(updateSql, {
        ItemID: itemId,
        ...fieldsToUpdate,
    });

    const rowsAffected = Number(result?.RowsAffected ?? 0);
    if (!Number.isFinite(rowsAffected) || rowsAffected <= 0) {
        throw new Error(`Failed to update item: ItemID ${itemId} was not found`);
    }

    invalidateTopItemsCache();
}

// ใช้สำหรับลบ Item พร้อม cleanup Attachment และตรวจเงื่อนไขใน transaction
export async function deleteItem(itemId: number): Promise<void> {
    if (!Number.isFinite(itemId) || itemId <= 0) {
        throw new Error('Invalid ItemID');
    }

    const itemTableName = resolveWriteTableName();
    const termTableName = resolveTermTableName();
    const attachmentTableName = resolveAttachmentTableName();

    const row = await queryOne<{
        ItemRowsAffected: number;
        AttachmentRowsAffected: number;
    }>(buildDeleteItemSql(itemTableName, termTableName, attachmentTableName), {
        ItemID: itemId,
    });

    const itemRowsAffected = Number(row?.ItemRowsAffected ?? 0);
    if (!Number.isFinite(itemRowsAffected) || itemRowsAffected !== 1) {
        throw new Error('Failed to delete item');
    }

    invalidateTopItemsCache();
}

/**
 * Get number of Terms for an Item.
 * Equivalent to SP: SPIT_GetNoOfTermsByItemID (not present in DB)
 */
// ใช้สำหรับนับจำนวน Term ที่ผูกกับ Item
export async function getNoOfTermsByItemId(itemId: number): Promise<number> {
    const row = await queryOne<{ cnt: number }>(GET_ITEM_PAGE_TERM_COUNT_SQL, { itemId });
    return row?.cnt ?? 0;
}
