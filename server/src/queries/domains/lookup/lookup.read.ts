import { dbObjects } from '#src/config/db-objects.js';

type QueryConfig = {
    sqlText: string;
    params: Record<string, any>;
};

/** Escape LIKE wildcards to prevent SQL pattern injection. */
function escapeLikePattern(value: string): string {
    return value
        .replace(/\\/g, '\\\\')
        .replace(/%/g, '\\%')
        .replace(/_/g, '\\_')
        .replace(/\[/g, '\\[');
}

function buildAttachmentLookupSql(kind: 'ITEM' | 'TERM'): string {
    const parentIdParam = kind === 'ITEM' ? 'itemId' : 'termId';
    const normalizedCatIds = kind === 'ITEM' ? `'I', 'ITEM'` : `'T', 'TERM'`;

    return `
        SELECT AttachmentID,
               CatID COLLATE DATABASE_DEFAULT AS CatID,
               ParentID,
               Category COLLATE DATABASE_DEFAULT AS Category,
               Attachement COLLATE DATABASE_DEFAULT AS Attachement,
               Updatedby COLLATE DATABASE_DEFAULT AS Updatedby,
               UpdatedDate
        FROM ${dbObjects.tables.sap.attachment}
        WHERE CASE WHEN ISNUMERIC(ParentID) = 1 THEN CONVERT(INT, ParentID) END = @${parentIdParam}
          AND UPPER(LTRIM(RTRIM(CatID COLLATE DATABASE_DEFAULT))) IN (${normalizedCatIds})
        ORDER BY UpdatedDate DESC
    `;
}

export const BRANDS_SQL = `SELECT Code, U_Brand FROM ${dbObjects.tables.sap.brand} ORDER BY Code`;

export const ITEM_GROUPS_SQL = `
    SELECT ItemGroupCode, ItemGroupName
    FROM ${dbObjects.tables.qtec.itemGroup}
    ORDER BY ItemGroupCode
`;

export const UOMS_SQL = `SELECT Code, Name FROM ${dbObjects.tables.sap.uom} ORDER BY Name`;

export const CURRENCIES_SQL = `SELECT Code, Name, U_ExRate FROM ${dbObjects.tables.sap.currency} ORDER BY Code`;

export const ORDER_TERMS_SQL = `SELECT Code, Name FROM ${dbObjects.tables.sap.orderTerm} ORDER BY Code`;

export const LOCATIONS_SQL = `
    SELECT Code, Name, Priority, ZoneName, ZoneRate
    FROM ${dbObjects.tables.qtec.location}
    ORDER BY Priority
`;

export const PERMIT_TYPES_SQL = `
    SELECT Code, Name
    FROM ${dbObjects.tables.qtec.permitType}
    ORDER BY Name
`;

export const VENDORS_SQL = `SELECT CardCode, CardName, validFor FROM ${dbObjects.tables.qtec.vendor} ORDER BY CardName`;

export const VENDOR_BRAND_FORM_VENDORS_SQL = `
    SELECT CardCode, CardName
    FROM ${dbObjects.tables.qtec.vendorBrandFormVendor}
    ORDER BY CardCode, CardName
`;

export const FREIGHT_TYPES_SQL = `SELECT Code, Name, U_Rate FROM ${dbObjects.tables.sap.freight} ORDER BY Name`;

export const SALES_PERSONS_SQL = `SELECT SlpCode, SlpName, Active FROM ${dbObjects.tables.qtec.salesPerson} ORDER BY SlpName`;

export const COUNTRIES_SQL = `
    SELECT Code, Name
    FROM ${dbObjects.tables.sap.countryOrg}
    ORDER BY U_Priority, Name
`;

export const ITEM_CATEGORIES_SQL = `SELECT Code, Name FROM ${dbObjects.tables.sap.itemCategory} ORDER BY Code`;

export const ITEM_ATTACHMENTS_SQL = `
    ${buildAttachmentLookupSql('ITEM')}
`;

export const TERM_ATTACHMENTS_SQL = `
    ${buildAttachmentLookupSql('TERM')}
`;

export function buildSubLocationsQuery(module?: string, country?: string): QueryConfig {
    let sqlText = `SELECT Code, Module, Country, Name, Priority FROM ${dbObjects.tables.qtec.subLocation}`;
    const params: Record<string, any> = {};
    const conditions: string[] = [];

    if (module) {
        conditions.push(`Module = @module`);
        params.module = module;
    }

    if (country) {
        conditions.push(`Country = @country`);
        params.country = country;
    }

    if (conditions.length > 0) {
        sqlText += ` WHERE ${conditions.join(' AND ')}`;
    }

    sqlText += ` ORDER BY Priority`;

    return { sqlText, params };
}

export function buildContactsQuery(cardCode?: string): QueryConfig {
    let sqlText = `SELECT CntctCode, CardCode, Name, Active FROM ${dbObjects.tables.qtec.contact}`;
    const params: Record<string, any> = {};

    if (cardCode) {
        sqlText += ` WHERE CardCode = @cardCode`;
        params.cardCode = cardCode;
    }

    sqlText += ` ORDER BY Name`;
    return { sqlText, params };
}

export function buildBrandVendorQuery(brand?: string): QueryConfig {
    const normalizedBrand = (brand || '').trim();
    const params: Record<string, any> = {};
    const whereSql = normalizedBrand ? 'WHERE t.Brand = @brand' : '';

    if (normalizedBrand) {
        params.brand = normalizedBrand;
    }

    const sqlText = `
        SELECT
            t.Source,
            t.Brand,
            t.[Supplier Code],
            t.[Supplier Name],
            t.[Contact Person],
            t.E_Mail,
            t.Position,
            t.Tel1,
            t.Tel2,
            t.[Contact ID (SAP DEFAULT)],
            t.[Position (SAP)],
            t.[E_Mail (SAP DEFAULT)],
            t.[Tel1 (SAP)],
            t.[Tel2 (SAP)],
            t.[Vendor Brand 1],
            t.[Vendor Brand 2],
            t.[Vendor Brand 3],
            t.[Company Phone 1],
            t.[Company Phone 2],
            t.[Company Mobile],
            t.[Company E_Mail],
            t.Website,
            t.CntctCode,
            t.[LastUpdate (P-CAT/e-PRO)]
        FROM ${dbObjects.tables.qtec.brandVendor} AS t
        ${whereSql}
        ORDER BY t.Source DESC, t.Brand, t.[Supplier Name], t.[Contact Person]
    `;

    return { sqlText, params };
}

export function buildVendorBrandQuery(vendorCode?: string, supplierName?: string): QueryConfig {
    const normalizedVendorCode = (vendorCode || '').trim();
    const normalizedSupplierName = (supplierName || '').trim();
    const params: Record<string, any> = {};
    const whereClauses: string[] = [];

    if (normalizedVendorCode) {
        whereClauses.push('LTRIM(RTRIM(t.[Supplier Code])) = @vendorCode');
        params.vendorCode = normalizedVendorCode;
    } else if (normalizedSupplierName) {
        whereClauses.push(`t.[Supplier Name] LIKE @supplierName ESCAPE '\\'`);
        params.supplierName = `%${escapeLikePattern(normalizedSupplierName)}%`;
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const sqlText = `
        SELECT
            t.Source,
            t.[Supplier Code],
            t.[Supplier Name],
            t.Brand,
            t.[Contact Person],
            t.E_Mail,
            t.Position,
            t.Tel1,
            t.Tel2,
            t.[Contact ID (SAP DEFAULT)],
            t.[Position (SAP)],
            t.[E_Mail (SAP DEFAULT)],
            t.[Tel1 (SAP)],
            t.[Tel2 (SAP)],
            t.[Vendor Brand 1],
            t.[Vendor Brand 2],
            t.[Vendor Brand 3],
            t.[Company Phone 1],
            t.[Company Phone 2],
            t.[Company Mobile],
            t.[Company E_Mail],
            t.Website,
            t.CntctCode,
            t.[LastUpdate (P-CAT/e-PRO)]
        FROM ${dbObjects.tables.qtec.vendorBrand} AS t
        ${whereSql}
        ORDER BY t.Source DESC, t.[Supplier Name], t.Brand, t.[Contact Person]
    `;

    return { sqlText, params };
}

export function buildCategoryBrandsQuery(itemCategory?: string): QueryConfig {
    const normalizedCategory = (itemCategory || '').trim();
    const params: Record<string, any> = {};
    const whereCategory = normalizedCategory ? 'AND LTRIM(RTRIM(t.ItemCategory)) = @itemCategory' : '';

    if (normalizedCategory) {
        params.itemCategory = normalizedCategory;
    }

    const sqlText = `
        SELECT DISTINCT
            LTRIM(RTRIM(t.ItemCategory)) AS ItemCategory,
            LTRIM(RTRIM(t.U_Brand)) AS U_Brand
        FROM ${dbObjects.views.sap.poitmCategoryBrand} AS t
        WHERE NULLIF(LTRIM(RTRIM(t.ItemCategory)), '') IS NOT NULL
          AND NULLIF(LTRIM(RTRIM(t.U_Brand)), '') IS NOT NULL
          ${whereCategory}
        ORDER BY LTRIM(RTRIM(t.ItemCategory)), LTRIM(RTRIM(t.U_Brand))
    `;

    return { sqlText, params };
}
