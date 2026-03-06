import type { CreateItemDTO } from '#src/types/item.types.js';
import {
    asRecord,
    parseBooleanFlag,
    parseOptionalInt,
    parsePositiveInt,
    parseString,
} from '#src/dtos/common/request-parsers.js';

export interface ItemListQueryDTO {
    page: number;
    pageSize: number;
    brand: string;
    myItems: boolean;
}

export interface ItemIdParamDTO {
    itemId: number | null;
}

export interface ItemDuplicateCheckQueryDTO {
    catalogNo: string;
    brand: string;
}

export interface ItemImageUploadBodyDTO {
    fileName: string;
    mimeType: string;
    contentBase64: string;
}

export interface ItemDeleteBodyDTO {
    confirmText: string;
    confirmItemId: number | null;
}

export type CreateItemBodyDTO = CreateItemDTO & {
    fullDescription?: string;
};

export type UpdateItemBodyDTO = Partial<CreateItemDTO> & {
    fullDescription?: string;
};

export function toItemListQueryDTO(query: unknown): ItemListQueryDTO {
    const q = asRecord(query);
    return {
        page: parsePositiveInt(q.page, 1, 1),
        pageSize: parsePositiveInt(q.pageSize, 50, 1, 400),
        brand: parseString(q.brand, ''),
        myItems: parseBooleanFlag(q.myItems, false),
    };
}

export function toItemIdParamDTO(params: unknown): ItemIdParamDTO {
    const p = asRecord(params);
    return {
        itemId: parseOptionalInt(p.id),
    };
}

export function toItemDuplicateCheckQueryDTO(query: unknown): ItemDuplicateCheckQueryDTO {
    const q = asRecord(query);
    return {
        catalogNo: parseString(q.catalogNo, ''),
        brand: parseString(q.brand, ''),
    };
}

export function toItemImageUploadBodyDTO(body: unknown): ItemImageUploadBodyDTO {
    const b = asRecord(body);
    return {
        fileName: parseString(b.fileName, ''),
        mimeType: parseString(b.mimeType, ''),
        contentBase64: parseString(b.contentBase64, ''),
    };
}

export function toItemDeleteBodyDTO(body: unknown): ItemDeleteBodyDTO {
    const b = asRecord(body);
    return {
        confirmText: parseString(b.confirmText, ''),
        confirmItemId: parseOptionalInt(b.confirmItemId),
    };
}
