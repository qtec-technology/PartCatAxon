// ─── Term Calculation — shared API contract ──────────────────────────────────
// Source: next-shell/src/types/term_form.types.ts
// These are the wire types sent to/from POST /api/terms/calculate

export interface TermCalculationPayload {
  U_ProdCost: number;
  U_PKH: number;
  U_SOC: number;
  U_PurRate: number;
  U_OrderTerm: string;
  U_ShipModeNo: number;
  U_DimUnitNo: number;
  U_Length: number;
  U_Width: number;
  U_Height: number;
  U_Weight: number;
  U_FreightRate: number;
  U_FR: number;
  INS_Percent: number;
  U_ZoneRate: number;
  U_DT_Percent: number;
  U_ETPer: number;
  U_MiscTax: number;
  U_WTT: number;
  U_CC: number;
  U_ASP: number;
  U_STK_Percent: number;
  U_SPK: number;
  U_QOC: number;
  U_MK_Percent: number;
  NumInBuy: number;
  NumInSale: number;
}

export interface TermCalculationResponse {
  U_OP: number;
  U_OP_SUM: number;
  U_OP_THB: number;
  U_DimWeight: number;
  U_ShipWeightCal: number;
  U_INS: number;
  U_FRZONE: number;
  U_FreightQTEC: number;
  U_CIF: number;
  U_CIFZONE: number;
  U_ZoneRate: number;
  U_DT: number;
  U_DT_FR: number;
  U_DT_FRZONE: number;
  U_ET: number;
  U_MT: number;
  U_preQLC: number;
  U_STK: number;
  U_QLC: number;
  U_QLC2: number;
  U_QLC3: number;
  U_TotalPrice: number;
  U_MK_THB: number;
  U_SalesPrice: number;
}
