import {
    asRecord,
    parseBooleanFlag,
    parseNullableString,
    parsePositiveInt,
    parseString,
} from '#src/dtos/common/request-parsers.js';

export type StandardSearchFieldDTO =
    | 'catalogNo'
    | 'customerStock'
    | 'itemCode'
    | 'sapB1ItemNo';

export interface SearchFTSQueryDTO {
    keyword: string;
    brand: string;
    myItems: boolean;
    page: number;
    pageSize: number;
}

export interface SearchFTSBrandsQueryDTO {
    keyword: string;
}

export interface SearchFTSAutocompleteQueryDTO {
    keyword: string;
}

export interface SearchStandardQueryDTO {
    field: string;
    keyword: string;
    brand: string | null;
    exactMatch: boolean;
    myItems: boolean;
    page: number;
    pageSize: number;
}

export interface SearchPartNoQueryDTO {
    brand: string;
    q: string;
}

export function toSearchFTSQueryDTO(query: unknown): SearchFTSQueryDTO {
    const q = asRecord(query);
    return {
        keyword: parseString(q.keyword, ''),
        brand: parseString(q.brand, '_Null'),
        myItems: parseBooleanFlag(q.myItems, false),
        page: parsePositiveInt(q.page, 1, 1),
        pageSize: parsePositiveInt(q.pageSize, 50, 1, 400),
    };
}

export function toSearchFTSBrandsQueryDTO(query: unknown): SearchFTSBrandsQueryDTO {
    const q = asRecord(query);
    return {
        keyword: parseString(q.keyword, ''),
    };
}

export function toSearchFTSAutocompleteQueryDTO(query: unknown): SearchFTSAutocompleteQueryDTO {
    const q = asRecord(query);
    return {
        keyword: parseString(q.keyword, ''),
    };
}

export function toSearchStandardQueryDTO(query: unknown): SearchStandardQueryDTO {
    const q = asRecord(query);
    return {
        field: parseString(q.field, ''),
        keyword: parseString(q.keyword, ''),
        brand: parseNullableString(q.brand),
        exactMatch: parseBooleanFlag(q.exactMatch, false),
        myItems: parseBooleanFlag(q.myItems, false),
        page: parsePositiveInt(q.page, 1, 1),
        pageSize: parsePositiveInt(q.pageSize, 50, 1, 400),
    };
}

export function toSearchPartNoQueryDTO(query: unknown): SearchPartNoQueryDTO {
    const q = asRecord(query);
    return {
        brand: parseString(q.brand, ''),
        q: parseString(q.q, ''),
    };
}
