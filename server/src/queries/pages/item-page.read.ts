import { dbObjects } from '#src/config/db-objects.js';

export const GET_ITEM_PAGE_BY_ID_SQL = `
    SELECT
        t.ItemID, t.ItemCode, t.ItemGroup, t.B1ItemNo, t.BPStockItemNo,
        t.U_Calalogno, t.U_Brand, t.ItemDescription, t.SAPB1Desc,
        t.VatGroupPu, t.VatGourpSa, t.U_CountryOrg, t.U_ECCN, t.U_UNSPSC,
        t.U_Punchout, t.U_VMI, t.U_CustBPA, t.U_IsQTECSTock, t.U_B1Item,
        t.U_Serialreq, t.U_MSDS, t.U_Certificate, t.U_Ecommerce,
        t.U_Permitreq, t.U_PermitType, t.U_DG_Required, t.U_HScode,
        t.InvntryUom, t.LongDesc1, t.LongDesc2, t.LongDesc3, t.LongDesc4,
        t.U_EpoCode, t.LeadTime, t.U_Remark, t.Updatedby, t.UpdatedDate,
        t.SaleSubLocation, t.Active, t.RowVer, t.ItemCategory,
        t.SpecialRequirement, t.MasterFG, t.LastAwardedSO,
        t.TariffCode, t.TariffDescription, t.CustomsDuty,
        p.GeneralSpec AS POITM_GeneralSpec,
        p.GeneralSpecUrl AS POITM_GeneralSpecUrl
    FROM ${dbObjects.views.sap.poitm} AS t
    LEFT JOIN ${dbObjects.tables.sap.poitm} AS p
        ON p.ItemID = t.ItemID
    WHERE t.ItemID = @itemId
`;

export const GET_ITEM_PAGE_TERM_COUNT_SQL = `
    SELECT COUNT(*) AS cnt
    FROM ${dbObjects.tables.sap.pitm1}
    WHERE ItemID = @itemId
`;
