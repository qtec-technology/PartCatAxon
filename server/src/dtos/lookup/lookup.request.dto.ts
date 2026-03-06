import {
    asRecord,
    parseOptionalInt,
    parseString,
} from '#src/dtos/common/request-parsers.js';

export interface SubLocationsQueryDTO {
    module: string;
    country: string;
}

export interface ContactsQueryDTO {
    cardCode: string;
}

export interface BrandVendorQueryDTO {
    brand: string;
}

export interface VendorBrandQueryDTO {
    vendorCode: string;
    supplierName: string;
}

export interface CategoryBrandsQueryDTO {
    itemCategory: string;
}

export interface ItemAttachmentsQueryDTO {
    itemId: number | null;
}

export interface TermAttachmentsQueryDTO {
    termId: number | null;
}

export function toSubLocationsQueryDTO(query: unknown): SubLocationsQueryDTO {
    const q = asRecord(query);
    return {
        module: parseString(q.module, ''),
        country: parseString(q.country, ''),
    };
}

export function toContactsQueryDTO(query: unknown): ContactsQueryDTO {
    const q = asRecord(query);
    return {
        cardCode: parseString(q.cardCode, ''),
    };
}

export function toBrandVendorQueryDTO(query: unknown): BrandVendorQueryDTO {
    const q = asRecord(query);
    return {
        brand: parseString(q.brand, ''),
    };
}

export function toVendorBrandQueryDTO(query: unknown): VendorBrandQueryDTO {
    const q = asRecord(query);
    return {
        vendorCode: parseString(q.vendorCode, ''),
        supplierName: parseString(q.supplierName, ''),
    };
}

export function toCategoryBrandsQueryDTO(query: unknown): CategoryBrandsQueryDTO {
    const q = asRecord(query);
    return {
        itemCategory: parseString(q.itemCategory, ''),
    };
}

export function toItemAttachmentsQueryDTO(query: unknown): ItemAttachmentsQueryDTO {
    const q = asRecord(query);
    return {
        itemId: parseOptionalInt(q.itemId),
    };
}

export function toTermAttachmentsQueryDTO(query: unknown): TermAttachmentsQueryDTO {
    const q = asRecord(query);
    return {
        termId: parseOptionalInt(q.termId),
    };
}
