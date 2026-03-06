import { z } from 'zod';
import {
    zBodyNonEmptyString,
    zBodyNumber,
    zBodyOptionalBooleanLike,
    zBodyOptionalDate,
    zBodyOptionalInt,
    zBodyOptionalNumber,
    zBodyOptionalString,
    zBodyPositiveInt,
    zParamIdString,
    zQueryNonEmptyString,
    zQueryString,
} from '#src/dtos/common/zod-helpers.js';

export const termsQuerySchema = z.object({
    itemId: zQueryString.refine((value) => /^\d+$/.test(value), 'itemId must be numeric'),
}).passthrough();

export const cWeightQuerySchema = z.object({
    vendorStockItemNo: zQueryNonEmptyString,
}).passthrough();

export const termIdParamSchema = z.object({
    id: zParamIdString,
}).passthrough();

export const masterFGParamSchema = z.object({
    itemId: zParamIdString,
}).passthrough();

const termBodyShape = {
    ItemID: zBodyPositiveInt,
    VendorCode: zBodyNonEmptyString,
    VendorStockItemNo: zBodyOptionalString,
    U_OrderTerm: zBodyOptionalString,
    U_TermLocation: zBodyOptionalString,
    SubLocation: zBodyOptionalString,

    U_ProdCost: zBodyNumber,
    U_PurCurr: zBodyNonEmptyString,
    U_PurRate: zBodyNumber,
    U_PKH: zBodyOptionalNumber,
    U_SOC: zBodyOptionalNumber,

    U_ShipModeNo: zBodyOptionalInt,
    U_DimUnitNo: zBodyOptionalInt,
    U_Length: zBodyOptionalNumber,
    U_Width: zBodyOptionalNumber,
    U_Height: zBodyOptionalNumber,
    U_Weight: zBodyOptionalNumber,
    U_FreightType: zBodyOptionalString,
    U_FreightRate: zBodyOptionalNumber,

    INS_Percent: zBodyOptionalNumber,
    U_ZoneRate: zBodyOptionalNumber,
    U_DT_Percent: zBodyOptionalNumber,
    U_ETPer: zBodyOptionalNumber,
    U_MiscTax: zBodyOptionalNumber,

    BuyUnitMsr: zBodyOptionalString,
    NumInBuy: zBodyOptionalNumber,
    SalUnitMsr: zBodyOptionalString,
    NumInSale: zBodyOptionalNumber,

    U_MOQ: zBodyOptionalString,
    LeadTime: zBodyOptionalString,
    U_VendorBPA: zBodyOptionalString,
    CntctCode: zBodyOptionalInt,
    SlpCode: zBodyOptionalInt,
    SlpSprtCode: zBodyOptionalInt,
    U_ValidFrom: zBodyOptionalDate,
    U_ValidTo: zBodyOptionalDate,
    U_SalesTerm: zBodyOptionalString,
    U_Remark: zBodyOptionalString,
    SaleSubLocation: zBodyOptionalString,
    Active: zBodyOptionalBooleanLike,
    ContractNo: zBodyOptionalString,

    U_WTT: zBodyOptionalNumber,
    U_CC: zBodyOptionalNumber,
    U_ASP: zBodyOptionalNumber,  // Special Custom Clearance (DB: U_ASP)
    U_STK_Percent: zBodyOptionalNumber,
    U_SPK: zBodyOptionalNumber,  // Special Packing (DB: U_SPK)
    U_QOC: zBodyOptionalNumber,

    // Optional calculated/derived fields to keep contract explicit and strict-safe.
    U_OP: zBodyOptionalNumber,
    U_OP_SUM: zBodyOptionalNumber,
    U_Purconv: zBodyOptionalString,
    U_OP_THB: zBodyOptionalNumber,
    U_INS: zBodyOptionalNumber,
    U_FR: zBodyOptionalNumber,
    U_FRZONE: zBodyOptionalNumber,
    U_CIF: zBodyOptionalNumber,
    U_CIFZONE: zBodyOptionalNumber,
    U_DT: zBodyOptionalNumber,
    U_DT_FR: zBodyOptionalNumber,
    U_DT_FRZONE: zBodyOptionalNumber,
    U_ET: zBodyOptionalNumber,
    U_MT: zBodyOptionalNumber,
    U_DimWeight: zBodyOptionalNumber,
    U_ShipWeightCal: zBodyOptionalNumber,
    U_FreightQTEC: zBodyOptionalNumber,
    U_preQLC: zBodyOptionalNumber,
    U_STK: zBodyOptionalNumber,
    U_QLC: zBodyOptionalNumber,
    U_QLC2: zBodyOptionalNumber,
    U_QLC3: zBodyOptionalNumber,
    U_MK_Percent: zBodyOptionalNumber,
    U_MK_THB: zBodyOptionalNumber,
    U_SalesPrice: zBodyOptionalNumber,
    U_SaleWeight: zBodyOptionalNumber,
    U_SaleBox: zBodyOptionalString,
    U_CourCode: zBodyOptionalString,
    U_CourPrice: zBodyOptionalNumber,
    U_CWeight: zBodyOptionalNumber,
    U_DimUnit: zBodyOptionalString,
    U_ShipMode: zBodyOptionalString,
    CntctName: zBodyOptionalString,
    SlpName: zBodyOptionalString,
    SlpSprtName: zBodyOptionalString,
};

const createTermSchemaBase = z.object(termBodyShape).strict();

export const createTermBodySchema = createTermSchemaBase;
export const updateTermBodySchema = createTermSchemaBase
    .partial()
    .strict()
    .refine((value) => Object.keys(value).length > 0, {
        message: 'At least one field is required',
    });

export const termDeleteBodySchema = z.object({
    confirmText: zBodyNonEmptyString.refine(
        (value) => value.trim().toUpperCase() === 'DELETE',
        'confirmText must be DELETE'
    ),
    confirmTermId: zBodyPositiveInt,
}).strict();

const previewCalcShape = {
    U_ProdCost: zBodyOptionalNumber,
    U_PKH: zBodyOptionalNumber,
    U_SOC: zBodyOptionalNumber,
    U_PurRate: zBodyOptionalNumber,
    U_OrderTerm: zBodyOptionalString,
    U_ShipModeNo: zBodyOptionalInt,
    U_DimUnitNo: zBodyOptionalInt,
    U_Length: zBodyOptionalNumber,
    U_Width: zBodyOptionalNumber,
    U_Height: zBodyOptionalNumber,
    U_Weight: zBodyOptionalNumber,
    U_FreightRate: zBodyOptionalNumber,
    U_FR: zBodyOptionalNumber,
    INS_Percent: zBodyOptionalNumber,
    U_ZoneRate: zBodyOptionalNumber,
    U_DT_Percent: zBodyOptionalNumber,
    U_ETPer: zBodyOptionalNumber,
    U_MiscTax: zBodyOptionalNumber,
    U_WTT: zBodyOptionalNumber,
    U_CC: zBodyOptionalNumber,
    U_ASP: zBodyOptionalNumber,  // Special Custom Clearance (DB: U_ASP)
    U_STK_Percent: zBodyOptionalNumber,
    U_SPK: zBodyOptionalNumber,  // Special Packing (DB: U_SPK)
    U_QOC: zBodyOptionalNumber,
    U_MK_Percent: zBodyOptionalNumber,
    NumInBuy: zBodyOptionalNumber,
    NumInSale: zBodyOptionalNumber,
};

export const previewCalculationBodySchema = z.object(previewCalcShape).strict();
