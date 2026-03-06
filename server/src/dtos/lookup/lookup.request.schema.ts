import { z } from 'zod';
import {
    zQueryOptionalIntString,
    zQueryOptionalString,
} from '#src/dtos/common/zod-helpers.js';

export const subLocationsQuerySchema = z.object({
    module: zQueryOptionalString,
    country: zQueryOptionalString,
}).passthrough();

export const contactsQuerySchema = z.object({
    cardCode: zQueryOptionalString,
}).passthrough();

export const brandVendorQuerySchema = z.object({
    brand: zQueryOptionalString,
}).passthrough();

export const vendorBrandQuerySchema = z.object({
    vendorCode: zQueryOptionalString,
    supplierName: zQueryOptionalString,
}).passthrough();

export const categoryBrandsQuerySchema = z.object({
    itemCategory: zQueryOptionalString,
}).passthrough();

export const itemAttachmentsQuerySchema = z.object({
    itemId: zQueryOptionalIntString,
}).passthrough();

export const termAttachmentsQuerySchema = z.object({
    termId: zQueryOptionalIntString,
}).passthrough();
