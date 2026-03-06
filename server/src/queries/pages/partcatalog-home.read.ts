import { dbObjects } from '#src/config/db-objects.js';

// Home item grid columns
export const HOME_ITEM_GRID_COLUMNS_WITH_ALIAS = `
    t.ItemID, t.ItemCode, t.ItemGroup, t.B1ItemNo, t.BPStockItemNo,
    t.U_Calalogno, t.U_Brand, t.ItemDescription,
    t.InvntryUom, t.U_CountryOrg,
    t.Active, t.MasterFG, t.LastAwardedSO,
    t.U_CustBPA, t.U_VMI, t.U_IsQTECSTock,
    t.LongDesc1, t.LongDesc2, t.LongDesc3, t.LongDesc4,
    t.VatGroupPu, t.VatGourpSa,
    t.TariffDescription, t.TariffCode, t.CustomsDuty,
    t.Updatedby, t.UpdatedDate
`;

// Same columns without alias (for CTE projection)
export const HOME_ITEM_GRID_COLUMNS_NO_ALIAS = `
    ItemID, ItemCode, ItemGroup, B1ItemNo, BPStockItemNo,
    U_Calalogno, U_Brand, ItemDescription,
    InvntryUom, U_CountryOrg,
    Active, MasterFG, LastAwardedSO,
    U_CustBPA, U_VMI, U_IsQTECSTock,
    LongDesc1, LongDesc2, LongDesc3, LongDesc4,
    VatGroupPu, VatGourpSa,
    TariffDescription, TariffCode, CustomsDuty,
    Updatedby, UpdatedDate
`;

export const HOME_ITEM_ORDER_BY = `ORDER BY t.UpdatedDate DESC, t.ItemID DESC`;

export function buildHomeTopItemsQuery(topItemsLimit: number): string {
    return `
        SELECT TOP (${topItemsLimit})
        ${HOME_ITEM_GRID_COLUMNS_WITH_ALIAS}
        FROM ${dbObjects.views.sap.poitm} AS t
        ${HOME_ITEM_ORDER_BY}
    `;
}

export function buildHomeItemsPagedWithTotalQuery(whereSql: string): string {
    return `
        WITH filtered AS (
            SELECT
                ${HOME_ITEM_GRID_COLUMNS_WITH_ALIAS},
                ROW_NUMBER() OVER (${HOME_ITEM_ORDER_BY}) AS rn,
                COUNT(1) OVER() AS __total
            FROM ${dbObjects.views.sap.poitm} AS t
            ${whereSql}
        )
        SELECT
            ${HOME_ITEM_GRID_COLUMNS_NO_ALIAS},
            __total
        FROM filtered
        WHERE rn BETWEEN @startRow AND @endRow
        ORDER BY rn
    `;
}

export const HOME_TERM_GRID_COLUMNS = `
    TermID, ItemID,
    Active, LastAwardedSO, CardName,
    U_QLC, VendorStockItemNo, U_OrderTerm,
    U_TermLocation, Name AS TermLocationName,
    SubLocation, ContractNo, U_SalesTerm, SaleSubLocation,
    U_ProdCost, U_PurCurr, U_PurRate,
    BuyUnitMsr, SalUnitMsr,
    Updatedby, UpdatedDate,
    U_ValidFrom, U_ValidTo
`;

export const GET_HOME_TERMS_BY_ITEM_ID_SQL = `
    SELECT ${HOME_TERM_GRID_COLUMNS}
    FROM ${dbObjects.views.qtec.pitm1}
    WHERE ItemID = @itemId
    ORDER BY Active DESC, UpdatedDate DESC
`;
