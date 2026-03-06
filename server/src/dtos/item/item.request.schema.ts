import { z } from 'zod';
import {
    zBodyInt,
    zBodyNonEmptyString,
    zBodyPositiveInt,
    zBodyOptionalBooleanLike,
    zBodyOptionalString,
    zParamIdString,
    zQueryBooleanLikeOptional,
    zQueryNonEmptyString,
    zQueryOptionalIntString,
    zQueryOptionalString,
} from '#src/dtos/common/zod-helpers.js';

export const itemListQuerySchema = z.object({
    page: zQueryOptionalIntString,
    pageSize: zQueryOptionalIntString,
    brand: zQueryOptionalString,
    myItems: zQueryBooleanLikeOptional,
}).passthrough();

export const itemIdParamSchema = z.object({
    id: zParamIdString,
}).passthrough();

export const itemDuplicateCheckQuerySchema = z.object({
    catalogNo: zQueryNonEmptyString,
    brand: zQueryNonEmptyString,
}).passthrough();

const itemBodyShape = {
    ItemGroup: zBodyInt,
    U_Brand: zBodyNonEmptyString,
    U_Calalogno: zBodyNonEmptyString,
    ItemDescription: zBodyNonEmptyString,
    InvntryUom: zBodyNonEmptyString,
    U_CountryOrg: zBodyOptionalString,

    BPStockItemNo: zBodyOptionalString,
    B1ItemNo: zBodyOptionalString,
    SAPB1Desc: zBodyOptionalString,
    VatGroupPu: zBodyOptionalString,
    VatGourpSa: zBodyOptionalString,
    U_ECCN: zBodyOptionalString,
    U_UNSPSC: zBodyOptionalString,
    U_EpoCode: zBodyOptionalString,
    U_HScode: zBodyOptionalString,
    U_Remark: zBodyOptionalString,
    LeadTime: zBodyOptionalString,
    SaleSubLocation: zBodyOptionalString,
    ItemCategory: zBodyOptionalString,
    SpecialRequirement: zBodyOptionalString,
    GeneralSpec: zBodyOptionalString,
    GeneralSpecUrl: zBodyOptionalString,

    LongDesc1: zBodyOptionalString,
    LongDesc2: zBodyOptionalString,
    LongDesc3: zBodyOptionalString,
    LongDesc4: zBodyOptionalString,
    fullDescription: zBodyOptionalString,

    U_Punchout: zBodyOptionalString,
    U_VMI: zBodyOptionalString,
    U_CustBPA: zBodyOptionalString,
    U_IsQTECSTock: zBodyOptionalString,
    U_B1Item: zBodyOptionalString,
    U_Serialreq: zBodyOptionalString,
    U_MSDS: zBodyOptionalString,
    U_Certificate: zBodyOptionalString,
    U_Ecommerce: zBodyOptionalString,
    U_DG_Required: zBodyOptionalString,
    U_Permitreq: zBodyOptionalString,
    U_PermitType: zBodyOptionalString,

    Active: zBodyOptionalBooleanLike,
    MasterFG: zBodyOptionalBooleanLike,
};

const createItemSchemaBase = z.object(itemBodyShape).strict();

export const createItemBodySchema = createItemSchemaBase;
export const updateItemBodySchema = createItemSchemaBase
    .partial()
    .strict()
    .refine((value) => Object.keys(value).length > 0, {
        message: 'At least one field is required',
    });

export const itemImageUploadBodySchema = z.object({
    fileName: zBodyNonEmptyString,
    mimeType: zBodyOptionalString,
    contentBase64: zBodyNonEmptyString,
}).strict();

export const itemDeleteBodySchema = z.object({
    confirmText: zBodyNonEmptyString.refine(
        (value) => value.trim().toUpperCase() === 'DELETE',
        'confirmText must be DELETE'
    ),
    confirmItemId: zBodyPositiveInt,
}).strict();
