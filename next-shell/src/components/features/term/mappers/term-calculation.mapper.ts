import type {
    TermCalcResults,
    TermCalculationPayload,
    TermCalculationResponse,
    TermFormData,
    TermStageStatus,
} from '../../../../types/term_form.types';

export const toNumber = (value: unknown, fallback = 0): number => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

export function buildTermCalculationPayload(formData: TermFormData): TermCalculationPayload {
    const orderTerm = String(formData.purchaseTerm || '').trim();
    const shipModeNo = toNumber(formData.shipMode, 1);

    return {
        U_ProdCost: toNumber(formData.prodCost, 0),
        U_PKH: toNumber(formData.pkh, 0),
        U_SOC: toNumber(formData.soc, 0),
        U_PurRate: toNumber(formData.exRate, 1),
        U_OrderTerm: orderTerm,
        U_ShipModeNo: shipModeNo,
        U_DimUnitNo: toNumber(formData.dimUnit, 1),
        U_Length: toNumber(formData.length, 0),
        U_Width: toNumber(formData.width, 0),
        U_Height: toNumber(formData.height, 0),
        U_Weight: toNumber(formData.weight, 0),
        U_FreightRate: toNumber(formData.freightRate, 0),
        U_FR: toNumber(formData.fr, 0),
        INS_Percent: toNumber(formData.insPercent, 0),
        U_ZoneRate: toNumber(formData.zoneRate, 0),
        U_DT_Percent: toNumber(formData.dutyPercent, 0),
        U_ETPer: toNumber(formData.excisePercent, 0),
        U_MiscTax: toNumber(formData.miscTax, 0),
        U_WTT: toNumber(formData.wireTT, 0),
        U_CC: toNumber(formData.customClear, 0),
        U_ASP: toNumber(formData.scc, 0),
        U_STK_Percent: toNumber(formData.stockFeePercent, 0),
        U_SPK: toNumber(formData.spk, 0),
        U_QOC: toNumber(formData.qoc, 0),
        U_MK_Percent: toNumber(formData.markup, 0),
        NumInBuy: toNumber(formData.numInBuy, 1),
        NumInSale: toNumber(formData.numInSale, 1),
    };
}

export function mapCalculationResponseToUi(calculated: TermCalculationResponse): TermCalcResults {
    const cif = toNumber(calculated?.U_CIF, 0);
    const cifZone = toNumber(calculated?.U_CIFZONE, 0);
    const totalPrice = toNumber(calculated?.U_QLC3, toNumber(calculated?.U_TotalPrice, 0));

    return {
        OP1: toNumber(calculated?.U_OP, 0),
        OP1_THB: toNumber(calculated?.U_OP_SUM, 0),
        OP2_THB: toNumber(calculated?.U_OP_THB, 0),
        DIM_WEIGHT: toNumber(calculated?.U_DimWeight, 0),
        SHP_WEIGHT: toNumber(calculated?.U_ShipWeightCal, 0),
        INS: toNumber(calculated?.U_INS, 0),
        FR_QTEC: toNumber(calculated?.U_FreightQTEC, 0),
        FR_ZONE: toNumber(calculated?.U_FRZONE, 0),
        CIF: cif,
        CIF_ZONE: cifZone,
        DT: toNumber(calculated?.U_DT, 0),
        DT_FR: toNumber(calculated?.U_DT_FR, 0),
        DT_ZONE: toNumber(calculated?.U_DT_FRZONE, 0),
        ET: toNumber(calculated?.U_ET, 0),
        MT: toNumber(calculated?.U_MT, 0),
        PRE_QLC: toNumber(calculated?.U_preQLC, 0),
        STK: toNumber(calculated?.U_STK, 0),
        QLC: toNumber(calculated?.U_QLC, 0),
        QLC2: toNumber(calculated?.U_QLC2, 0),
        QLC3: totalPrice,
        TOTAL_PRICE: totalPrice,
        MK_THB: toNumber(calculated?.U_MK_THB, 0),
        SALES_PRICE: toNumber(calculated?.U_SalesPrice, 0),
    };
}

export function mapStoredTermRecordToUiCalcResults(raw: Record<string, unknown>): TermCalcResults {
    const cif = toNumber(raw?.U_CIF, 0);
    const cifZone = toNumber(raw?.U_CIFZONE, 0);
    const totalPrice = toNumber(raw?.U_QLC3, toNumber(raw?.U_TotalPrice, 0));

    return {
        OP1: toNumber(raw?.U_OP, 0),
        OP1_THB: toNumber(raw?.U_OP_SUM, toNumber(raw?.U_OP_THB, 0)),
        OP2_THB: toNumber(raw?.U_OP_THB, 0),
        DIM_WEIGHT: toNumber(raw?.U_DimWeight, 0),
        SHP_WEIGHT: toNumber(raw?.U_ShipWeightCal, 0),
        INS: toNumber(raw?.U_INS, 0),
        FR_QTEC: toNumber(raw?.U_FreightQTEC, 0),
        FR_ZONE: toNumber(raw?.U_FRZONE, 0),
        CIF: cif,
        CIF_ZONE: cifZone,
        DT: toNumber(raw?.U_DT, 0),
        DT_FR: toNumber(raw?.U_DT_FR, 0),
        DT_ZONE: toNumber(raw?.U_DT_FRZONE, 0),
        ET: toNumber(raw?.U_ET, 0),
        MT: toNumber(raw?.U_MT, 0),
        PRE_QLC: toNumber(raw?.U_preQLC, 0),
        STK: toNumber(raw?.U_STK, 0),
        QLC: toNumber(raw?.U_QLC, 0),
        QLC2: toNumber(raw?.U_QLC2, 0),
        QLC3: totalPrice,
        TOTAL_PRICE: totalPrice,
        MK_THB: toNumber(raw?.U_MK_THB, 0),
        SALES_PRICE: toNumber(raw?.U_SalesPrice, 0),
    };
}

export function deriveStageStatusFromUiResults(
    results: TermCalcResults,
    formData: Pick<TermFormData, 'currency' | 'excisePercent' | 'purchaseUOM' | 'salesUOM'>
): TermStageStatus {
    const normalizedCurrency = String(formData.currency || '').toUpperCase();
    const purchaseUom = String(formData.purchaseUOM || '').trim();
    const salesUom = String(formData.salesUOM || '').trim();

    return {
        OP1: toNumber(results.OP1, 0) > 0,
        FR: toNumber(results.FR_QTEC, 0) > 0 || toNumber(results.FR_ZONE, 0) > 0,
        INS: toNumber(results.INS, 0) > 0,
        CIF: toNumber(results.CIF, 0) > 0 || toNumber(results.CIF_ZONE, 0) > 0,
        DT: normalizedCurrency === 'THB' || toNumber(results.DT, 0) > 0,
        ET: normalizedCurrency === 'THB' || toNumber(formData.excisePercent, 0) === 0 || toNumber(results.ET, 0) > 0,
        MT: normalizedCurrency === 'THB' || toNumber(results.MT, 0) >= 0,
        TERM: true,
        UOM: purchaseUom.length > 0 && salesUom.length > 0,
        QLC: toNumber(results.QLC, 0) > 0,
    };
}

export function deriveTermStageStatus(
    calculated: TermCalculationResponse,
    payload: TermCalculationPayload,
    currency: string,
    uom: Pick<TermFormData, 'purchaseUOM' | 'salesUOM'>
): TermStageStatus {
    const cif = toNumber(calculated?.U_CIF, 0);
    const cifZone = toNumber(calculated?.U_CIFZONE, 0);
    const normalizedCurrency = String(currency || '').toUpperCase();
    const purchaseUom = String(uom.purchaseUOM || '').trim();
    const salesUom = String(uom.salesUOM || '').trim();

    return {
        OP1: toNumber(calculated?.U_OP, 0) > 0,
        FR: toNumber(calculated?.U_FreightQTEC, 0) > 0 || toNumber(calculated?.U_FRZONE, 0) > 0,
        INS: toNumber(calculated?.U_INS, 0) > 0,
        CIF: cif > 0 || cifZone > 0,
        DT: normalizedCurrency === 'THB' || toNumber(calculated?.U_DT, 0) > 0,
        ET: normalizedCurrency === 'THB' || payload.U_ETPer === 0 || toNumber(calculated?.U_ET, 0) > 0,
        MT: normalizedCurrency === 'THB' || toNumber(calculated?.U_MT, 0) >= 0,
        TERM: true,
        UOM: purchaseUom.length > 0 && salesUom.length > 0,
        QLC: toNumber(calculated?.U_QLC, 0) > 0,
    };
}
