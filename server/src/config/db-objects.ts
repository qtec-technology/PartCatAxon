import { env } from '#src/config/env.js';
import { toSqlIdentifier } from '#src/utils/sql.js';

const normalizeName = (value: string | undefined, fallback: string): string => {
    const normalized = String(value || '').trim();
    return normalized.length > 0 ? normalized : fallback;
};

const toQualifiedObject = (prefix: string, value: string | undefined, fallback: string): string =>
    `${prefix}.${toSqlIdentifier(normalizeName(value, fallback))}`;

export const QTEC_DB_PREFIX = `${toSqlIdentifier(env.DB_NAME_QTEC)}.[dbo]`;
export const SAP_DB_PREFIX = `${toSqlIdentifier(env.DB_NAME_SAP)}.[dbo]`;

const qtecObject = (envKey: string, fallback: string): string =>
    toQualifiedObject(QTEC_DB_PREFIX, process.env[envKey], fallback);

const sapObject = (envKey: string, fallback: string): string =>
    toQualifiedObject(SAP_DB_PREFIX, process.env[envKey], fallback);

const qtecProcedure = (envKey: string, fallback: string): string =>
    normalizeName(process.env[envKey], fallback);

const qualifiedQtecProcedure = (envKey: string, fallback: string): string =>
    `${QTEC_DB_PREFIX}.${toSqlIdentifier(qtecProcedure(envKey, fallback))}`;

export const dbObjects = {
    tables: {
        sap: {
            poitm: sapObject('DB_TABLE_POITM', '@POITM'),
            pitm1: sapObject('DB_TABLE_PITM1', '@PITM1'),
            attachment: sapObject('DB_TABLE_ATTACHMENT', '@tblAttachment'),
            brand: sapObject('DB_TABLE_BRAND', '@BRAND'),
            uom: sapObject('DB_TABLE_UOM', '@UOM'),
            currency: sapObject('DB_TABLE_CURRENCY', '@CURRENCY'),
            orderTerm: sapObject('DB_TABLE_ORDER_TERM', '@ORDERTERM'),
            freight: sapObject('DB_TABLE_FREIGHT', '@FREIGHT'),
            countryOrg: sapObject('DB_TABLE_COUNTRY_ORG', '@COUTRYORG'),
            itemCategory: sapObject('DB_TABLE_ITEM_CATEGORY', '@ITEMCATEGORY'),
        },
        qtec: {
            itemGroup: qtecObject('DB_TABLE_ITEM_GROUP', '@ITEMGROUP'),
            location: qtecObject('DB_TABLE_LOCATION', '@LOCATION'),
            permitType: qtecObject('DB_TABLE_PERMIT_TYPE', '@PERMITTYPE'),
            vendor: qtecObject('DB_TABLE_VENDOR', '@OCRD'),
            vendorBrandFormVendor: qtecObject('DB_TABLE_VENDOR_BRAND_FORM_VENDOR', '@OCRD_FOR_VENDOR_BRAND_FORM'),
            salesPerson: qtecObject('DB_TABLE_SALES_PERSON', '@OSLP'),
            subLocation: qtecObject('DB_TABLE_SUB_LOCATION', '@SUBLOCATION'),
            contact: qtecObject('DB_TABLE_CONTACT', '@OCPR'),
            brandVendor: qtecObject('DB_TABLE_BRAND_VENDOR', '@PITM1_BRAND_VENDOR'),
            vendorBrand: qtecObject('DB_TABLE_VENDOR_BRAND', '@PITM1_VENDOR_BRAND'),
        },
    },
    views: {
        sap: {
            poitm: sapObject('DB_VIEW_POITM', 'VWIT_@POITM'),
            poitmPartNo: sapObject('DB_VIEW_POITM_PARTNO', 'VWIT_@POITM_PARTNO'),
            poitmCategoryBrand: sapObject('DB_VIEW_POITM_CATEGORY_BRAND', 'VWIT_@POITM_CATEGORY_BRAND'),
        },
        qtec: {
            pitm1: qtecObject('DB_VIEW_PITM1', 'vw@PITM1'),
        },
    },
    procedures: {
        createAttachFile: qtecProcedure('DB_SP_CREATE_ATTACH_FILE', 'SPIT_CreateAttachFile'),
        deleteAttachFile: qtecProcedure('DB_SP_DELETE_ATTACH_FILE', 'SPIT_DeleteAttachFile'),
        searchItemByDescriptionFts: qtecProcedure('DB_SP_SEARCH_FTS', 'SPIT_SearchItemByDescriptionFTS'),
        searchItemByDescriptionFtsGetBrand: qtecProcedure('DB_SP_SEARCH_FTS_GET_BRAND', 'SPIT_SearchItemByDescriptionFTS_GetBrand'),
        searchItemByDescriptionFtsGetAutocomplete: qtecProcedure('DB_SP_SEARCH_FTS_GET_AUTOCOMPLETE', 'SPIT_SearchItemByDescriptionFTS_GetCL'),
        getItemDetailByItemId: qtecProcedure('DB_SP_GET_ITEM_DETAIL_BY_ITEM_ID', 'SPIT_GetItemDetailByItemID'),
        generateCatalogNo: qtecProcedure('DB_SP_GENERATE_CATALOG_NO', 'SPIT_GenCatalogNo'),
        checkDuplicatedByCatalogNo: qtecProcedure('DB_SP_CHECK_DUPLICATED_BY_CATALOG_NO', 'SPIT_CheckDuplicatedByCatalogNo'),
        getInvntryUomByItemId: qtecProcedure('DB_SP_GET_INVNTRY_UOM_BY_ITEM_ID', 'SPIT_GetInvntryUomByItemID'),
        getCardNameByCardCode: qtecProcedure('DB_SP_GET_CARD_NAME_BY_CARD_CODE', 'SPIT_GetCardNameByCardCode'),
        getCWeightByVendorStockItemNo: qtecProcedure('DB_SP_GET_CWEIGHT_BY_VENDOR_STOCK_ITEM_NO', 'SPIT_GetCWeightByVendorStockItemNo'),
        getVendorEmailByTermId: qtecProcedure('DB_SP_GET_VENDOR_EMAIL_BY_TERM_ID', 'SPIT_GetVendorEmailByTermID'),
    },
    qualifiedProcedures: {
        createAttachFile: qualifiedQtecProcedure('DB_SP_CREATE_ATTACH_FILE', 'SPIT_CreateAttachFile'),
        searchItemByDescriptionFts: qualifiedQtecProcedure('DB_SP_SEARCH_FTS', 'SPIT_SearchItemByDescriptionFTS'),
        searchItemByDescriptionFtsGetBrand: qualifiedQtecProcedure('DB_SP_SEARCH_FTS_GET_BRAND', 'SPIT_SearchItemByDescriptionFTS_GetBrand'),
        searchItemByDescriptionFtsGetAutocomplete: qualifiedQtecProcedure('DB_SP_SEARCH_FTS_GET_AUTOCOMPLETE', 'SPIT_SearchItemByDescriptionFTS_GetCL'),
        deleteAttachFile: qualifiedQtecProcedure('DB_SP_DELETE_ATTACH_FILE', 'SPIT_DeleteAttachFile'),
    },
} as const;
