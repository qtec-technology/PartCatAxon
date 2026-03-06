import type { CalcInput } from '#src/services/calculation.service.js';

/**
 * Map raw request body → CalcInput with safe defaults.
 *
 * Uses ?? (nullish coalescing) instead of || for values where 0 is valid input:
 * - exchangeRate: 0 shouldn't become 1
 * - percentages: 0% is a valid value
 * - monetary values: 0 means "no cost"
 *
 * Uses || only for values where 0 is never valid (division denominators):
 * - shipModeNo: must be 1-6
 * - dimUnit: must be 1-2
 * - numInBuy/numInSale: cannot be 0 (division by zero)
 */
export function toCalcInput(data: Record<string, any>): CalcInput {
    return {
        // ─── Order Price (OP) ───────────────────────────────────────────
        productCost: Number(data.U_ProdCost) || 0,
        pkh: Number(data.U_PKH) || 0,
        soc: Number(data.U_SOC) || 0,
        exchangeRate: data.U_PurRate != null ? Number(data.U_PurRate) : 1,

        // ─── Freight to QTEC (FR) ───────────────────────────────────────
        orderTerm: String(data.U_OrderTerm ?? 'Exwork'),
        shipModeNo: Number(data.U_ShipModeNo) || 1,        // 0 not valid
        dimUnit: Number(data.U_DimUnitNo) || 1,          // 0 not valid
        length: Number(data.U_Length) || 0,
        width: Number(data.U_Width) || 0,
        height: Number(data.U_Height) || 0,
        itemWeight: Number(data.U_Weight) || 0,
        freightRate: Number(data.U_FreightRate) || 0,

        // ─── CIF / Duty / Tax ───────────────────────────────────────────
        freight: Number(data.U_FR) || 0,
        insPercent: Number(data.INS_Percent) || 0,
        zoneRate: Number(data.U_ZoneRate) || 0,
        dtPercent: Number(data.U_DT_Percent) || 0,
        etPercent: Number(data.U_ETPer) || 0,
        miscTax: Number(data.U_MiscTax) || 0,

        // ─── QLC ────────────────────────────────────────────────────────
        wtt: Number(data.U_WTT) || 0,
        cc: Number(data.U_CC) || 0,
        scc: Number(data.U_ASP) || 0,
        stkPercent: Number(data.U_STK_Percent) || 0,

        // ─── Sales Calculation ──────────────────────────────────────────
        sspk: Number(data.U_SPK) || 0,
        qoc: Number(data.U_QOC) || 0,
        markupPercent: Number(data.U_MK_Percent) || 0,

        // ─── UOM Conversion ─────────────────────────────────────────────
        numInBuy: Number(data.NumInBuy) || 1,            // 0 not valid (÷0)
        numInSale: Number(data.NumInSale) || 1,           // 0 not valid (÷0)
    };
}
