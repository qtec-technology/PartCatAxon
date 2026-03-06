import { toSqlIdentifier } from '#src/utils/sql.js';
import { dbObjects } from '#src/config/db-objects.js';

type QueryConfig = {
    sqlText: string;
    params: Record<string, any>;
};

/** Whitelist of allowed SQL column names for standard search. */
const ALLOWED_SEARCH_COLUMNS = new Set([
    'U_Calalogno', 'BPStockItemNo', 'ItemCode', 'B1ItemNo',
]);

export const FTS_SEARCH_SQL = `EXEC ${dbObjects.qualifiedProcedures.searchItemByDescriptionFts} @pKeyword, @pBrand`;
export const FTS_BRANDS_SQL = `EXEC ${dbObjects.qualifiedProcedures.searchItemByDescriptionFtsGetBrand} @pKeyword`;
export const FTS_AUTOCOMPLETE_SQL = `EXEC ${dbObjects.qualifiedProcedures.searchItemByDescriptionFtsGetAutocomplete} @pKeyword`;

export const STANDARD_SEARCH_COLUMN_MAP: Record<string, string> = {
    catalogNo: 'U_Calalogno',
    customerStock: 'BPStockItemNo',
    itemCode: 'ItemCode',
    sapB1ItemNo: 'B1ItemNo',
};

export const STANDARD_SEARCH_BASE_SELECT_SQL = `
    SELECT
      t.ItemID, t.ItemCode, t.ItemGroup, t.B1ItemNo, t.BPStockItemNo,
      t.U_Calalogno, t.U_Brand, t.ItemDescription,
      t.InvntryUom, t.LongDesc1, t.LongDesc2, t.LongDesc3, t.LongDesc4,
      t.Updatedby, t.UpdatedDate, t.Active, t.MasterFG, t.LastAwardedSO,
      t.U_Punchout, t.U_VMI, t.U_CustBPA, t.U_IsQTECSTock
    FROM ${dbObjects.views.sap.poitm} AS t
`;

export const PART_NO_AUTOCOMPLETE_SQL = `
    SELECT TOP 20 U_Brand, U_Calalogno
    FROM ${dbObjects.views.sap.poitmPartNo}
    WHERE U_Brand = @brand
      AND U_Calalogno LIKE @pattern
    ORDER BY U_Calalogno
`;

export function escapeLikePattern(value: string): string {
    return value
        .replace(/\\/g, '\\\\')
        .replace(/%/g, '\\%')
        .replace(/_/g, '\\_')
        .replace(/\[/g, '\\[');
}

export function buildStandardSearchQuery(
    column: string,
    keyword: string,
    exactMatch: boolean,
    brand: string | null,
    updatedBy?: string
): QueryConfig {
    // Defense-in-depth: reject unknown columns even though caller should whitelist
    if (!ALLOWED_SEARCH_COLUMNS.has(column)) {
        throw new Error(`Disallowed search column: ${column}`);
    }
    const safeColumn = toSqlIdentifier(column);

    let sqlText = `${STANDARD_SEARCH_BASE_SELECT_SQL}\nWHERE `;
    const params: Record<string, any> = {};

    if (exactMatch) {
        sqlText += `t.${safeColumn} = @keyword`;
        params.keyword = keyword;
    } else {
        sqlText += `t.${safeColumn} LIKE @keyword ESCAPE '\\'`;
        params.keyword = `%${escapeLikePattern(keyword)}%`;
    }

    if (brand && brand !== '_Null') {
        sqlText += ' AND t.[U_Brand] = @brand';
        params.brand = brand;
    }

    if (updatedBy && updatedBy.trim().length > 0) {
        sqlText += ' AND t.[Updatedby] = @updatedBy';
        params.updatedBy = updatedBy.trim();
    }

    sqlText += ' ORDER BY t.UpdatedDate DESC';
    return { sqlText, params };
}
