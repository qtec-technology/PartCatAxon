import { z } from 'zod';
import {
    zQueryBooleanLikeOptional,
    zQueryNonEmptyString,
    zQueryOptionalString,
} from '#src/dtos/common/zod-helpers.js';

export const searchFTSQuerySchema = z.object({
    keyword: zQueryNonEmptyString,
    brand: zQueryOptionalString,
    myItems: zQueryBooleanLikeOptional,
}).passthrough();

export const searchFTSBrandsQuerySchema = z.object({
    keyword: zQueryNonEmptyString,
}).passthrough();

export const searchFTSAutocompleteQuerySchema = z.object({
    keyword: zQueryNonEmptyString,
}).passthrough();

export const searchStandardQuerySchema = z.object({
    field: z.enum(['catalogNo', 'customerStock', 'itemCode', 'sapB1ItemNo']),
    keyword: zQueryNonEmptyString,
    brand: zQueryOptionalString,
    exactMatch: zQueryBooleanLikeOptional,
    myItems: zQueryBooleanLikeOptional,
}).passthrough();

export const searchPartNoQuerySchema = z.object({
    brand: zQueryNonEmptyString,
    q: zQueryNonEmptyString,
}).passthrough();
