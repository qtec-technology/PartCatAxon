/**
 * SQL queries for Sandbox Finalize writes to PART_CATALOG_AIX mirror.
 * Uses the same column structure as the production item/term tables.
 * Trace metadata is embedded in the Updatedby field and server logs.
 *
 * GUARD: caller must verify target = PART_CATALOG_AIX before calling these.
 */

/** INSERT a sandbox item into AIX [@POITM] — same schema as QTEC [@POITM]. */
export function buildSandboxInsertItemSql(tablePoitm: string): string {
    return `
INSERT INTO ${tablePoitm} (
    ItemGroup, U_Brand, U_Calalogno, ItemDescription, InvntryUom, U_CountryOrg,
    BPStockItemNo, U_HScode, U_Remark, LeadTime, SaleSubLocation,
    ItemCategory, U_Permitreq, U_PermitType,
    Active, MasterFG, Updatedby, UpdatedDate
)
OUTPUT INSERTED.ItemID
VALUES (
    @ItemGroup, @U_Brand, @U_Calalogno, @ItemDescription, @InvntryUom, @U_CountryOrg,
    @BPStockItemNo, @U_HScode, @U_Remark, @LeadTime, @SaleSubLocation,
    @ItemCategory, @U_Permitreq, @U_PermitType,
    1, 0, @Updatedby, GETDATE()
);
`;
}

/** Find an existing sandbox finalize row for the same Run/Revision/Line trace. */
export function buildSandboxFindExistingFinalizeSql(tablePoitm: string, tablePitm1: string): string {
    return `
SELECT TOP 1
    item.ItemID,
    term.TermID
FROM ${tablePoitm} AS item
LEFT JOIN ${tablePitm1} AS term
    ON term.ItemID = item.ItemID
    AND term.Updatedby = item.Updatedby
WHERE item.U_Remark LIKE @TraceLike
ORDER BY item.UpdatedDate DESC, item.ItemID DESC;
`;
}

/** INSERT a sandbox term into AIX [@PITM1] — same schema as QTEC [@PITM1]. */
export function buildSandboxInsertTermSql(tablePitm1: string): string {
    return `
INSERT INTO ${tablePitm1} (
    ItemID,
    VendorCode, VendorStockItemNo,
    U_OrderTerm, U_TermLocation, SubLocation,
    U_ProdCost, U_PurCurr, U_PurRate,
    U_PKH, U_SOC,
    U_OP, U_OP_SUM, U_OP_THB,
    U_INS, INS_Percent,
    U_FR, U_FRZONE, U_ZoneRate,
    U_CIF, U_CIFZONE,
    U_DT_Percent, U_DT, U_DT_FR, U_DT_FRZONE,
    U_WTT, U_CC, U_ASP,
    U_STK_Percent, U_STK, U_preQLC,
    U_SPK, U_QOC,
    U_QLC, U_QLC2, U_QLC3,
    U_MK_Percent, U_MK_THB, U_SalesPrice,
    U_ValidFrom,
    BuyUnitMsr, NumInBuy, SalUnitMsr, NumInSale,
    U_MOQ, LeadTime,
    U_ShipModeNo,
    U_Weight, U_CWeight, U_DimUnitNo,
    U_Length, U_Width, U_Height,
    U_FreightType, U_FreightRate, U_ShipWeightCal,
    U_SalesTerm, SaleSubLocation,
    Active, Updatedby, UpdatedDate
)
OUTPUT INSERTED.TermID
VALUES (
    @ItemID,
    @VendorCode, @VendorStockItemNo,
    @U_OrderTerm, @U_TermLocation, @SubLocation,
    @U_ProdCost, @U_PurCurr, @U_PurRate,
    @U_PKH, @U_SOC,
    @U_OP, @U_OP_SUM, @U_OP_THB,
    @U_INS, @INS_Percent,
    @U_FR, @U_FRZONE, @U_ZoneRate,
    @U_CIF, @U_CIFZONE,
    @U_DT_Percent, @U_DT, @U_DT_FR, @U_DT_FRZONE,
    @U_WTT, @U_CC, @U_ASP,
    @U_STK_Percent, @U_STK, @U_preQLC,
    @U_SPK, @U_QOC,
    @U_QLC, @U_QLC2, @U_QLC3,
    @U_MK_Percent, @U_MK_THB, @U_SalesPrice,
    @U_ValidFrom,
    @BuyUnitMsr, @NumInBuy, @SalUnitMsr, @NumInSale,
    @U_MOQ, @LeadTime,
    @U_ShipModeNo,
    @U_Weight, @U_CWeight, @U_DimUnitNo,
    @U_Length, @U_Width, @U_Height,
    @U_FreightType, @U_FreightRate, @U_ShipWeightCal,
    @U_SalesTerm, @SaleSubLocation,
    1, @Updatedby, GETDATE()
);
`;
}
