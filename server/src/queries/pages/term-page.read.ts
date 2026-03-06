import { dbObjects } from '#src/config/db-objects.js';

// Columns used by Term page (form + calculation display)
export const TERM_PAGE_COLUMNS = `
  TermID, ItemID, VendorCode, VendorStockItemNo,
  U_OrderTerm, U_TermLocation, Name AS TermLocationName, SubLocation,
  U_ProdCost, U_PurCurr, U_PurRate, U_PKH, U_SOC,
  U_OP, U_OP_SUM, U_Purconv, U_OP_THB,
  U_INS, INS_Percent, U_ZoneRate, U_FR, U_FRZONE,
  U_CIF, U_CIFZONE, U_DT_Percent, U_DT_FR, U_DT_FRZONE, U_DT,
  U_MiscTax, U_ETPer, U_ET, U_MT,
  U_Length, U_Width, U_Height, U_DimWeight, U_Weight,
  U_FreightType, U_FreightRate, U_ShipWeightCal, U_FreightQTEC,
  U_QLC, U_DimUnitNo, U_DimUnit,
  U_ValidFrom, U_ValidTo, U_ShipModeNo, U_ShipMode,
  BuyUnitMsr, NumInBuy, SalUnitMsr, NumInSale,
  U_MOQ, LeadTime, U_VendorBPA,
  CntctCode, CntctName, SlpCode, SlpName, SlpSprtCode, SlpSprtName,
  Updatedby, UpdatedDate, U_SalesTerm, U_Remark,
  SaleSubLocation, Active,
  U_WTT, U_CC, U_ASP, U_STK_Percent, U_STK,
  U_preQLC, U_QLC2, U_QLC3, U_SPK, U_QOC,
  U_MK_Percent, U_MK_THB, U_SalesPrice,
  U_SaleWeight, U_SaleBox, U_CourCode, U_CourPrice,
  ContractNo, U_CWeight, LastAwardedSO,
  CardName, ItemCode, ItemDescription, U_CalalogNo, B1ItemNo
`;

export const GET_TERM_PAGE_BY_ID_SQL = `
    SELECT ${TERM_PAGE_COLUMNS}
    FROM ${dbObjects.views.qtec.pitm1}
    WHERE TermID = @termId
`;

export const GET_TERM_PAGE_ITEM_DETAIL_BY_TERM_ID_SQL = `
    SELECT p.*
    FROM ${dbObjects.tables.sap.poitm} p
    INNER JOIN ${dbObjects.tables.sap.pitm1} t ON t.ItemID = p.ItemID
    WHERE t.TermID = @termId
`;

export const GET_TERM_PAGE_MASTER_FG_BY_ITEM_ID_SQL = `
    SELECT MasterFG
    FROM ${dbObjects.views.sap.poitm}
    WHERE ItemID = @itemId
`;
