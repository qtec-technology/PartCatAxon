import { ItemData } from '../types/item_types';
import { PartItem, SearchType } from '../types/partcatalog_types';
import { requestJson } from './http';
import { clientLogger } from '../utils/logger';
import { readFileAsDataUrl } from '../utils/file';

export interface PaginatedResponse<T> {
    items: T[];
    meta: {
        page: number;
        pageSize: number;
        total: number;
        totalPages: number;
    };
}

export interface ItemSearchCriteria {
    keyword?: string;
    brand?: string;
    searchType?: SearchType;
    exactMatch?: boolean;
    myItems?: boolean;
}

interface ApiMeta {
    page?: number;
    pageSize?: number;
    total?: number;
    totalPages?: number;
}

export interface BrandLookupOption {
    Code?: string;
    Name?: string;
    U_Brand?: string;
}

export interface FtsAutocompleteOption {
    U_Brand?: string;
    U_Calalogno?: string;
    ItemDescription?: string;
    ItemCode?: string;
}

const STANDARD_FIELD_MAP: Record<Exclude<SearchType, 'FTS'>, string> = {
    CATNO: 'catalogNo',
    CUST: 'customerStock',
    ITEM: 'itemCode',
    SAP: 'sapB1ItemNo',
};

const toBool = (value: unknown): boolean => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value === 1;
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'y';
    }
    return false;
};

const normalizePartItem = (raw: PartItem): PartItem => ({
    ...raw,
    ItemID: Number(raw.ItemID),
    Active: toBool(raw.Active),
    MasterFG: toBool(raw.MasterFG),
    U_CustBPA: raw.U_CustBPA === undefined ? undefined : toBool(raw.U_CustBPA),
    U_VMI: raw.U_VMI === undefined ? undefined : toBool(raw.U_VMI),
    U_IsQTECSTock: raw.U_IsQTECSTock === undefined ? undefined : toBool(raw.U_IsQTECSTock),
});

const toStringOrEmpty = (value: unknown): string => {
    if (value === null || value === undefined) return '';
    return String(value);
};

const toTrimmedStringOrEmpty = (value: unknown): string => toStringOrEmpty(value).trim();
const toNullableTrimmedString = (value: unknown): string | null => {
    const text = toTrimmedStringOrEmpty(value);
    return text ? text : null;
};
const toSelectValueOrNullMarker = (value: unknown): string => toTrimmedStringOrEmpty(value) || '_Null';

const toYN = (value: boolean): 'Y' | 'N' => (value ? 'Y' : 'N');

export const mapFormToApiBody = (data: ItemData): Record<string, unknown> => {
    const parsedItemGroup = Number(data.itemGroup);

    return {
        ItemGroup: Number.isFinite(parsedItemGroup) ? parsedItemGroup : data.itemGroup,
        U_Brand: toTrimmedStringOrEmpty(data.mfrBrand),
        U_Calalogno: toTrimmedStringOrEmpty(data.mfrCatalogNo),
        ItemDescription: toStringOrEmpty(data.itemDescription),
        InvntryUom: toTrimmedStringOrEmpty(data.stockUOM),
        U_CountryOrg: toSelectValueOrNullMarker(data.countryOfOrigin),

        BPStockItemNo: toStringOrEmpty(data.customerStockCode),
        B1ItemNo: toNullableTrimmedString(data.b1ItemNo),
        U_ECCN: toStringOrEmpty(data.eccn),
        U_UNSPSC: toStringOrEmpty(data.unspsc),
        U_EpoCode: toStringOrEmpty(data.eProcurementCode),
        U_HScode: toStringOrEmpty(data.hsCode),
        U_Remark: toStringOrEmpty(data.remark),
        ItemCategory: toSelectValueOrNullMarker(data.itemCategory),
        SpecialRequirement: toStringOrEmpty(data.specialRequirement),
        GeneralSpec: toStringOrEmpty(data.generalSpec),
        GeneralSpecUrl: toStringOrEmpty(data.referenceUrl),

        LongDesc1: toStringOrEmpty(data.longDesc1),
        LongDesc2: toStringOrEmpty(data.longDesc2),
        LongDesc3: toStringOrEmpty(data.longDesc3),
        LongDesc4: toStringOrEmpty(data.longDesc4),

        U_Punchout: toYN(data.shelfLifeRequired),
        U_VMI: toYN(data.vmi),
        U_CustBPA: toYN(data.customerBPA),
        U_IsQTECSTock: toYN(data.isQTECStock),
        U_B1Item: toYN(data.b1Item),
        U_Serialreq: toYN(data.serialRequired),
        U_MSDS: toYN(data.sdsRequired),
        U_Certificate: toYN(data.certificateRequired),
        U_Ecommerce: toYN(data.eCommerce),
        U_DG_Required: toYN(data.dgRequired),
        U_Permitreq: toYN(data.permitRequired),
        U_PermitType: toStringOrEmpty(data.permitType),

        Active: Boolean(data.active),
        MasterFG: Boolean(data.masterFG),
    };
};

const mapItemToForm = (raw: Record<string, unknown>): ItemData => ({
    id: Number(raw.ItemID ?? raw.id ?? 0),
    itemGroup: toTrimmedStringOrEmpty(raw.ItemGroup),
    itemCategory: toTrimmedStringOrEmpty(raw.ItemCategory ?? raw.itemCategory),
    catalogNo: toStringOrEmpty(raw.ItemCode ?? raw.catalogNo),
    b1ItemNo: toStringOrEmpty(raw.B1ItemNo),
    mfrBrand: toTrimmedStringOrEmpty(raw.U_Brand ?? raw.mfrBrand),
    mfrCatalogNo: toStringOrEmpty(raw.U_Calalogno ?? raw.mfrCatalogNo),
    itemDescription: toStringOrEmpty(raw.ItemDescription),
    specialRequirement: toStringOrEmpty(raw.SpecialRequirement ?? raw.specialRequirement),
    customerStockCode: toStringOrEmpty(raw.BPStockItemNo ?? raw.customerStockCode),
    stockUOM: toTrimmedStringOrEmpty(raw.InvntryUom ?? raw.stockUOM),
    countryOfOrigin: toTrimmedStringOrEmpty(raw.U_CountryOrg ?? raw.countryOfOrigin),
    eccn: toStringOrEmpty(raw.U_ECCN ?? raw.eccn),
    unspsc: toStringOrEmpty(raw.U_UNSPSC ?? raw.unspsc),
    eProcurementCode: toStringOrEmpty(raw.U_EpoCode ?? raw.eProcurementCode),
    remark: toStringOrEmpty(raw.U_Remark ?? raw.remark),
    active: toBool(raw.Active),
    masterFG: toBool(raw.MasterFG),
    shelfLifeRequired: toBool(raw.U_Punchout ?? raw.shelfLifeRequired),
    punchOut: toBool(raw.U_Punchout ?? raw.punchOut),
    vmi: toBool(raw.U_VMI ?? raw.vmi),
    customerBPA: toBool(raw.U_CustBPA ?? raw.customerBPA),
    isQTECStock: toBool(raw.U_IsQTECSTock ?? raw.isQTECStock),
    serialRequired: toBool(raw.U_Serialreq ?? raw.serialRequired),
    sdsRequired: toBool(raw.U_MSDS ?? raw.sdsRequired),
    certificateRequired: toBool(raw.U_Certificate ?? raw.certificateRequired),
    eCommerce: toBool(raw.U_Ecommerce ?? raw.eCommerce),
    b1Item: toBool(raw.U_B1Item ?? raw.b1Item),
    dgRequired: toBool(raw.U_DG_Required ?? raw.dgRequired),
    permitRequired: toBool(raw.U_Permitreq ?? raw.permitRequired),
    permitType: toTrimmedStringOrEmpty(raw.U_PermitType ?? raw.permitType),
    hsCode: toStringOrEmpty(raw.U_HScode ?? raw.hsCode),
    longDesc1: toStringOrEmpty(raw.LongDesc1 ?? raw.longDesc1),
    longDesc2: toStringOrEmpty(raw.LongDesc2 ?? raw.longDesc2),
    longDesc3: toStringOrEmpty(raw.LongDesc3 ?? raw.longDesc3),
    longDesc4: toStringOrEmpty(raw.LongDesc4 ?? raw.longDesc4),
    generalSpec: toStringOrEmpty(raw.POITM_GeneralSpec ?? raw.GeneralSpec ?? raw.U_GeneralSpec ?? raw.SAPB1Desc ?? raw.generalSpec),
    referenceUrl: toStringOrEmpty(raw.POITM_GeneralSpecUrl ?? raw.GeneralSpecUrl ?? raw.U_ReferenceUrl ?? raw.referenceUrl),
    updatedBy: toStringOrEmpty(raw.Updatedby ?? raw.updatedBy),
    updatedDate: toStringOrEmpty(raw.UpdatedDate ?? raw.updatedDate),
    hasImage: toBool(raw.hasImage),
});

const buildQuery = (params: Record<string, string | number | boolean | undefined | null>) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
            query.set(key, String(value));
        }
    });
    return query.toString();
};

let brandCache: { data: BrandLookupOption[] | null; promise: Promise<BrandLookupOption[]> | null } = {
    data: null,
    promise: null,
};

export const itemApi = {
    getItems: async (
        page: number = 1,
        pageSize: number = 50,
        criteriaOrKeyword: ItemSearchCriteria | string = '',
        brandArg: string = ''
    ): Promise<PaginatedResponse<PartItem>> => {
        const criteria: ItemSearchCriteria = typeof criteriaOrKeyword === 'string'
            ? { keyword: criteriaOrKeyword, brand: brandArg, searchType: 'FTS', exactMatch: false }
            : criteriaOrKeyword;

        const keyword = (criteria.keyword || '').trim();
        const brand = (criteria.brand || '').trim();
        const searchType = criteria.searchType || 'FTS';
        const exactMatch = criteria.exactMatch === true;

        if (!keyword) {
            const query = buildQuery({
                page,
                pageSize,
                brand: brand || undefined,
                myItems: criteria.myItems ? true : undefined,
            });
            const payload = await requestJson<PartItem[]>(`/api/items?${query}`);
            const items = (payload.data || []).map(normalizePartItem);
            const meta = payload.meta as ApiMeta | undefined;

            return {
                items,
                meta: {
                    page: meta?.page ?? page,
                    pageSize: meta?.pageSize ?? pageSize,
                    total: meta?.total ?? items.length,
                    totalPages: meta?.totalPages ?? Math.max(1, Math.ceil((meta?.total ?? items.length) / pageSize)),
                },
            };
        }

        let resultItems: PartItem[] = [];

        if (searchType === 'FTS') {
            const query = buildQuery({
                keyword,
                brand: brand || undefined,
                myItems: criteria.myItems ? true : undefined,
                page,
                pageSize,
            });
            const payload = await requestJson<PartItem[]>(`/api/search/fts?${query}`);
            resultItems = (payload.data || []).map(normalizePartItem);
            const meta = payload.meta as ApiMeta | undefined;
            return {
                items: resultItems,
                meta: {
                    page: meta?.page ?? page,
                    pageSize: meta?.pageSize ?? pageSize,
                    total: meta?.total ?? resultItems.length,
                    totalPages: meta?.totalPages ?? Math.max(1, Math.ceil((meta?.total ?? resultItems.length) / pageSize)),
                },
            };
        } else {
            const field = STANDARD_FIELD_MAP[searchType];
            const query = buildQuery({
                field,
                keyword,
                brand: brand || undefined,
                exactMatch,
                myItems: criteria.myItems ? true : undefined,
                page,
                pageSize,
            });
            const payload = await requestJson<PartItem[]>(`/api/search/standard?${query}`);
            resultItems = (payload.data || []).map(normalizePartItem);
            const meta = payload.meta as ApiMeta | undefined;
            return {
                items: resultItems,
                meta: {
                    page: meta?.page ?? page,
                    pageSize: meta?.pageSize ?? pageSize,
                    total: meta?.total ?? resultItems.length,
                    totalPages: meta?.totalPages ?? Math.max(1, Math.ceil((meta?.total ?? resultItems.length) / pageSize)),
                },
            };
        }
    },

    getItemById: async (id: number | string): Promise<ItemData> => {
        const itemId = Number(id);
        if (Number.isNaN(itemId)) {
            throw new Error('Invalid ItemID');
        }
        const payload = await requestJson<Record<string, unknown>>(`/api/items/${itemId}`);
        return mapItemToForm(payload.data || {});
    },

    getItemImageUrl: (id: number | string, cacheKey?: string | number): string => {
        const itemId = Number(id);
        if (Number.isNaN(itemId)) {
            return '';
        }
        const query = buildQuery({ v: cacheKey });
        return `/api/items/${itemId}/image${query ? `?${query}` : ''}`;
    },

    getTermCount: async (id: number | string): Promise<number> => {
        const itemId = Number(id);
        if (Number.isNaN(itemId)) {
            throw new Error('Invalid ItemID');
        }
        const payload = await requestJson<{ count?: number | string }>(`/api/items/${itemId}/term-count`);
        const countValue = payload.data?.count;
        const parsed = Number(countValue ?? 0);
        return Number.isFinite(parsed) ? parsed : 0;
    },

    getItemUOM: async (id: number | string): Promise<string> => {
        const itemId = Number(id);
        if (Number.isNaN(itemId)) return 'EA';
        try {
            const payload = await requestJson<{ uom?: string | null }>(`/api/items/${itemId}/uom`);
            return payload.data?.uom || 'EA';
        } catch { return 'EA'; }
    },

    createItem: async (data: ItemData): Promise<number> => {
        const payload = await requestJson<{ ItemID?: number | string; ItemCode?: string }>('/api/items', {
            method: 'POST',
            body: mapFormToApiBody(data),
        });
        const itemId = Number(payload.data?.ItemID ?? 0);
        if (!Number.isFinite(itemId) || itemId <= 0) {
            throw new Error('Invalid ItemID in create response');
        }
        return itemId;
    },

    uploadItemImage: async (id: number | string, file: File): Promise<void> => {
        const itemId = Number(id);
        if (Number.isNaN(itemId) || itemId <= 0) {
            throw new Error('Invalid ItemID');
        }
        if (!(file instanceof File)) {
            throw new Error('Image file is required');
        }

        const contentBase64 = await readFileAsDataUrl(file);
        await requestJson<null>(`/api/items/${itemId}/image`, {
            method: 'POST',
            body: {
                fileName: file.name,
                mimeType: file.type,
                contentBase64,
            },
        });
    },

    updateItem: async (id: number | string, data: ItemData): Promise<void> => {
        const itemId = Number(id);
        if (Number.isNaN(itemId) || itemId <= 0) {
            throw new Error('Invalid ItemID');
        }
        await requestJson<null>(`/api/items/${itemId}`, {
            method: 'PUT',
            body: mapFormToApiBody(data),
        });
    },

    deleteItem: async (id: number | string, confirmText: string = 'DELETE'): Promise<void> => {
        const itemId = Number(id);
        if (Number.isNaN(itemId) || itemId <= 0) {
            throw new Error('Invalid ItemID');
        }

        await requestJson<null>(`/api/items/${itemId}`, {
            method: 'DELETE',
            body: {
                confirmText,
                confirmItemId: itemId,
            },
        });
    },

    checkDuplicate: async (catalogNo: string, brand: string): Promise<boolean> => {
        if (!catalogNo || !brand) return false;
        const query = buildQuery({ catalogNo, brand });
        const payload = await requestJson<{ isDuplicated: boolean }>(`/api/items/0/duplicate-check?${query}`);
        return payload.data?.isDuplicated === true;
    },

    getBrands: async (): Promise<BrandLookupOption[]> => {
        try {
            if (brandCache.data) return brandCache.data;
            if (brandCache.promise) return brandCache.promise;

            brandCache.promise = (async () => {
                const payload = await requestJson<BrandLookupOption[]>('/api/lookups/brands');
                const data = payload.data || [];
                brandCache.data = data;
                brandCache.promise = null;
                return data;
            })();

            return await brandCache.promise;
        } catch (error) {
            clientLogger.error('Failed to fetch brands', error);
            brandCache.promise = null;
            return [];
        }
    },

    getFTSAutocomplete: async (keyword: string): Promise<FtsAutocompleteOption[]> => {
        const q = keyword.trim();
        if (q.length < 2) return [];
        const query = buildQuery({ keyword: q });
        const payload = await requestJson<Record<string, unknown>[]>(`/api/search/fts/autocomplete?${query}`);
        const rows = payload.data || [];

        return rows.map((row) => ({
            U_Brand: String(row.U_Brand ?? row['MFG/Brand'] ?? '').trim(),
            U_Calalogno: String(row.U_Calalogno ?? row['Mfr Catalog No'] ?? '').trim(),
            ItemDescription: String(row.ItemDescription ?? row['Long Description'] ?? row['Item Description'] ?? '').trim(),
            ItemCode: String(row.ItemCode ?? row['Item Code'] ?? '').trim(),
        }));
    }
};
