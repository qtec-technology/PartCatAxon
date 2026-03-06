import { BrandVendorItem } from '../types/partcatalog_types';
import { requestJson } from './http';

const asText = (value: unknown): string => {
    if (value === null || value === undefined) return '';
    return String(value).trim();
};

const isRealLookupOption = (value: unknown, label: unknown): boolean => {
    const normalizedValue = asText(value);
    const normalizedLabel = asText(label);
    if (!normalizedValue || !normalizedLabel) return false;
    return true;
};

export interface LookupOption {
    value: string;
    label: string;
}

export interface CategoryBrandOption {
    ItemCategory: string;
    U_Brand: string;
}

export interface VendorBrandVendorOption {
    CardCode: string;
    CardName: string;
}

export interface CurrencyLookupOption {
    code: string;
    name: string;
    exRate: number;
}

export interface OrderTermLookupOption {
    code: string;
    name: string;
}

export interface LocationLookupOption {
    code: string;
    name: string;
    priority: number;
    zoneName: string;
    zoneRate: number;
}

export interface SubLocationLookupOption {
    code: string;
    name: string;
    module: string;
    country: string;
    priority: number;
}

export interface VendorLookupOption {
    cardCode: string;
    cardName: string;
}

export interface ContactLookupOption {
    cntctCode: string;
    cardCode: string;
    name: string;
    active: string;
}

export interface FreightTypeLookupOption {
    code: string;
    name: string;
    rate: number;
}

export interface SalesPersonLookupOption {
    slpCode: string;
    slpName: string;
    active: string;
}

interface ItemFormLookupsApiPayload {
    brands?: Array<{ Code?: string | number; U_Brand?: string; Name?: string }>;
    itemGroups?: Array<{ ItemGroupCode?: string | number; ItemGroupName?: string }>;
    uoms?: Array<{ Code?: string | number; Name?: string }>;
    countries?: Array<{ Code?: string | number; Name?: string }>;
    permitTypes?: Array<{ Code?: string | number; Name?: string }>;
    itemCategories?: Array<{ Code?: string | number; Name?: string }>;
}

export interface ItemFormLookups {
    brands: LookupOption[];
    itemGroups: LookupOption[];
    uoms: LookupOption[];
    countries: LookupOption[];
    permitTypes: LookupOption[];
    itemCategories: LookupOption[];
}

interface TermFormLookupsApiPayload {
    vendors?: Array<{ CardCode?: string; CardName?: string }>;
    orderTerms?: Array<{ Code?: string; Name?: string }>;
    locations?: Array<{ Code?: string; Name?: string; Priority?: number; ZoneName?: string | null; ZoneRate?: number | null }>;
    subLocations?: Array<{ Code?: string | number; Name?: string; Module?: string; Country?: string; Priority?: number }>;
    currencies?: Array<{ Code?: string; Name?: string; U_ExRate?: string | number }>;
    freightTypes?: Array<{ Code?: string; Name?: string; U_Rate?: string | number }>;
    salesPersons?: Array<{ SlpCode?: string | number; SlpName?: string; Active?: string }>;
    uoms?: Array<{ Code?: string | number; Name?: string }>;
}

interface TermCriticalLookupsApiPayload {
    locations?: Array<{ Code?: string; Name?: string; Priority?: number; ZoneName?: string | null; ZoneRate?: number | null }>;
    currencies?: Array<{ Code?: string; Name?: string; U_ExRate?: string | number }>;
    freightTypes?: Array<{ Code?: string; Name?: string; U_Rate?: string | number }>;
}

export interface TermFormLookups {
    vendors: VendorLookupOption[];
    orderTerms: string[];
    locations: LocationLookupOption[];
    subLocations: string[];
    currencies: CurrencyLookupOption[];
    freightTypes: FreightTypeLookupOption[];
    salesPersons: string[];
    uoms: LookupOption[];
}

export interface TermCriticalLookups {
    locations: LocationLookupOption[];
    currencies: CurrencyLookupOption[];
    freightTypes: FreightTypeLookupOption[];
}

let itemFormLookupsCache: {
    data: ItemFormLookups | null;
    promise: Promise<ItemFormLookups> | null;
} = {
    data: null,
    promise: null,
};

let termFormLookupsCache: {
    data: TermFormLookups | null;
    promise: Promise<TermFormLookups> | null;
} = {
    data: null,
    promise: null,
};

let itemCategoriesCache: {
    data: LookupOption[] | null;
    promise: Promise<LookupOption[]> | null;
} = {
    data: null,
    promise: null,
};

const CATEGORY_BRANDS_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const categoryBrandsByCategoryCache = new Map<string, { value: CategoryBrandOption[]; at: number }>();
const categoryBrandsByCategoryPromise = new Map<string, Promise<CategoryBrandOption[]>>();

const dedupeLookupOptionsByValue = (options: LookupOption[]): LookupOption[] => {
    const byValue = new Map<string, LookupOption>();
    for (const option of options) {
        const value = asText(option.value);
        const label = asText(option.label);
        if (!value || !label) continue;
        if (!byValue.has(value)) {
            byValue.set(value, { value, label });
        }
    }
    return Array.from(byValue.values());
};

const uniqueTextList = (values: string[]): string[] => {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const value of values) {
        const text = asText(value);
        if (!text || seen.has(text)) continue;
        seen.add(text);
        result.push(text);
    }
    return result;
};

const mapBrandVendorRecord = (raw: Record<string, unknown>): BrandVendorItem => ({
    Source: asText(raw.Source),
    Brand: asText(raw.Brand),
    SupplierCode: asText(raw.SupplierCode ?? raw['Supplier Code']),
    SupplierName: asText(raw.SupplierName ?? raw['Supplier Name']),
    ContactPerson: asText(raw.ContactPerson ?? raw['Contact Person']),
    Email: asText(raw.Email ?? raw['E_Mail']),
    Position: asText(raw.Position),
    Tel1: asText(raw.Tel1),
    Tel2: asText(raw.Tel2),
    ContactID: asText(raw.ContactID ?? raw['Contact ID (SAP DEFAULT)']),
    PositionSAP: asText(raw.PositionSAP ?? raw['Position (SAP)']),
    EmailSAP: asText(raw.EmailSAP ?? raw['E_Mail (SAP DEFAULT)']),
    Tel1SAP: asText(raw.Tel1SAP ?? raw['Tel1 (SAP)']),
    Tel2SAP: asText(raw.Tel2SAP ?? raw['Tel2 (SAP)']),
    VendorBrand1: asText(raw.VendorBrand1 ?? raw['Vendor Brand 1']),
    VendorBrand2: asText(raw.VendorBrand2 ?? raw['Vendor Brand 2']),
    VendorBrand3: asText(raw.VendorBrand3 ?? raw['Vendor Brand 3']),
    CompanyPhone1: asText(raw.CompanyPhone1 ?? raw['Company Phone 1']),
    CompanyPhone2: asText(raw.CompanyPhone2 ?? raw['Company Phone 2']),
    CompanyMobile: asText(raw.CompanyMobile ?? raw['Company Mobile']),
    CompanyEmail: asText(raw.CompanyEmail ?? raw['Company E_Mail']),
    Website: asText(raw.Website),
    CntctCode: asText(raw.CntctCode),
    LastUpdate: asText(raw.LastUpdate ?? raw['LastUpdate (P-CAT/e-PRO)']),
});

export const lookupApi = {
    getItemFormLookups: async (): Promise<ItemFormLookups> => {
        if (itemFormLookupsCache.data) return itemFormLookupsCache.data;
        if (itemFormLookupsCache.promise) return itemFormLookupsCache.promise;

        itemFormLookupsCache.promise = (async () => {
            const payload = await requestJson<ItemFormLookupsApiPayload>('/api/lookups/item-form');
            const data = payload.data || {};

            const brands = dedupeLookupOptionsByValue(
                (data.brands || [])
                    .map((row) => ({
                        value: asText(row.Code ?? row.U_Brand ?? row.Name),
                        label: asText(row.U_Brand ?? row.Name ?? row.Code),
                    }))
                    .filter((row) => row.value !== '' && row.label !== '')
            ).sort((a, b) => a.label.localeCompare(b.label));

            const itemGroups = (data.itemGroups || [])
                .map((row) => ({
                    value: asText(row.ItemGroupCode),
                    label: asText(row.ItemGroupName),
                }))
                .filter((row) => isRealLookupOption(row.value, row.label));

            const uoms = (data.uoms || [])
                .map((row) => ({
                    value: asText(row.Code),
                    label: asText(row.Name),
                }))
                .filter((row) => isRealLookupOption(row.value, row.label));

            const countries = (data.countries || [])
                .map((row) => ({
                    value: asText(row.Code),
                    label: asText(row.Name),
                }))
                .filter((row) => isRealLookupOption(row.value, row.label));

            const permitTypes = (data.permitTypes || [])
                .map((row) => ({
                    value: asText(row.Code),
                    label: asText(row.Name),
                }))
                .filter((row) => isRealLookupOption(row.value, row.label));

            const itemCategories = (data.itemCategories || [])
                .map((row) => ({
                    value: asText(row.Code),
                    label: asText(row.Name),
                }))
                .filter((row) => isRealLookupOption(row.value, row.label));

            const normalized: ItemFormLookups = {
                brands,
                itemGroups,
                uoms,
                countries,
                permitTypes,
                itemCategories,
            };

            itemFormLookupsCache.data = normalized;
            itemFormLookupsCache.promise = null;
            return normalized;
        })().catch((error) => {
            itemFormLookupsCache.promise = null;
            throw error;
        });

        return itemFormLookupsCache.promise;
    },

    getTermFormLookups: async (options?: { signal?: AbortSignal }): Promise<TermFormLookups> => {
        if (termFormLookupsCache.data) return termFormLookupsCache.data;
        if (termFormLookupsCache.promise) return termFormLookupsCache.promise;

        termFormLookupsCache.promise = (async () => {
            const payload = await requestJson<TermFormLookupsApiPayload>('/api/lookups/term-form', {
                signal: options?.signal,
            });
            const data = payload.data || {};

            const vendors = (data.vendors || [])
                .map((row) => ({
                    cardCode: asText(row.CardCode),
                    cardName: asText(row.CardName),
                }))
                .filter((row) => row.cardCode !== '');

            const orderTerms = uniqueTextList((data.orderTerms || []).map((row) => asText(row.Name)));
            const locationsByName = new Map<string, LocationLookupOption>();
            for (const row of data.locations || []) {
                const name = asText(row.Name);
                if (!name || locationsByName.has(name)) continue;
                locationsByName.set(name, {
                    code: asText(row.Code),
                    name,
                    priority: Number(row.Priority ?? 0),
                    zoneName: asText(row.ZoneName ?? ''),
                    zoneRate: Number(row.ZoneRate ?? 0),
                });
            }
            const locations = Array.from(locationsByName.values())
                .sort((a, b) => (a.priority - b.priority) || a.name.localeCompare(b.name));
            const subLocations = uniqueTextList((data.subLocations || []).map((row) => asText(row.Name)));

            const currencies = (data.currencies || [])
                .map((row) => ({
                    code: asText(row.Code),
                    name: asText(row.Name),
                    exRate: Number(row.U_ExRate ?? 0),
                }))
                .filter((row) => row.code !== '');

            const freightTypes = (data.freightTypes || [])
                .map((row) => ({
                    code: asText(row.Code),
                    name: asText(row.Name),
                    rate: Number(row.U_Rate ?? 0),
                }))
                .filter((row) => row.code !== '');

            const salesPersons = uniqueTextList((data.salesPersons || []).map((row) => asText(row.SlpName)));

            const uoms = (data.uoms || [])
                .map((row) => ({
                    value: asText(row.Code),
                    label: asText(row.Name),
                }))
                .filter((row) => row.value !== '' && row.label !== '');

            const normalized: TermFormLookups = {
                vendors,
                orderTerms,
                locations,
                subLocations,
                currencies,
                freightTypes,
                salesPersons,
                uoms,
            };

            termFormLookupsCache.data = normalized;
            termFormLookupsCache.promise = null;
            return normalized;
        })().catch((error) => {
            termFormLookupsCache.promise = null;
            throw error;
        });

        return termFormLookupsCache.promise;
    },

    getTermCriticalLookups: async (options?: { signal?: AbortSignal }): Promise<TermCriticalLookups> => {
        const payload = await requestJson<TermCriticalLookupsApiPayload>('/api/lookups/term-critical', {
            signal: options?.signal,
        });
        const data = payload.data || {};

        const locationsByName = new Map<string, LocationLookupOption>();
        for (const row of data.locations || []) {
            const name = asText(row.Name);
            if (!name || locationsByName.has(name)) continue;
            locationsByName.set(name, {
                code: asText(row.Code),
                name,
                priority: Number(row.Priority ?? 0),
                zoneName: asText(row.ZoneName ?? ''),
                zoneRate: Number(row.ZoneRate ?? 0),
            });
        }
        const locations = Array.from(locationsByName.values())
            .sort((a, b) => (a.priority - b.priority) || a.name.localeCompare(b.name));

        const currencies = (data.currencies || [])
            .map((row) => ({
                code: asText(row.Code),
                name: asText(row.Name),
                exRate: Number(row.U_ExRate ?? 0),
            }))
            .filter((row) => row.code !== '');

        const freightTypes = (data.freightTypes || [])
            .map((row) => ({
                code: asText(row.Code),
                name: asText(row.Name),
                rate: Number(row.U_Rate ?? 0),
            }))
            .filter((row) => row.code !== '');

        return {
            locations,
            currencies,
            freightTypes,
        };
    },

    getItemGroups: async (): Promise<LookupOption[]> => {
        const payload = await requestJson<{ ItemGroupCode: string | number; ItemGroupName: string }[]>('/api/lookups/item-groups');
        return (payload.data || [])
            .map(row => ({
                value: asText(row.ItemGroupCode),
                label: asText(row.ItemGroupName),
            }))
            .filter(row => isRealLookupOption(row.value, row.label));
    },

    getUoms: async (): Promise<LookupOption[]> => {
        const payload = await requestJson<{ Code: string; Name: string }[]>('/api/lookups/uom');
        return (payload.data || [])
            .map(row => ({
                value: asText(row.Code),
                label: asText(row.Name),
            }))
            .filter(row => isRealLookupOption(row.value, row.label));
    },

    getCurrencies: async (): Promise<CurrencyLookupOption[]> => {
        const payload = await requestJson<Array<{ Code?: string; Name?: string; U_ExRate?: string | number }>>('/api/lookups/currencies');
        return (payload.data || [])
            .map((row) => ({
                code: asText(row.Code),
                name: asText(row.Name),
                exRate: Number(row.U_ExRate ?? 0),
            }))
            .filter((row) => row.code !== '');
    },

    getOrderTerms: async (): Promise<OrderTermLookupOption[]> => {
        const payload = await requestJson<Array<{ Code?: string; Name?: string }>>('/api/lookups/order-terms');
        return (payload.data || [])
            .map((row) => ({
                code: asText(row.Code),
                name: asText(row.Name),
            }))
            .filter((row) => row.code !== '');
    },

    getLocations: async (): Promise<LocationLookupOption[]> => {
        const payload = await requestJson<Array<{ Code?: string; Name?: string; Priority?: number; ZoneName?: string | null; ZoneRate?: number | null }>>('/api/lookups/locations');
        return (payload.data || [])
            .map((row) => ({
                code: asText(row.Code),
                name: asText(row.Name),
                priority: Number(row.Priority ?? 0),
                zoneName: asText(row.ZoneName ?? ''),
                zoneRate: Number(row.ZoneRate ?? 0),
            }))
            .filter((row) => row.code !== '');
    },

    getSubLocations: async (module?: string, country?: string, options?: { signal?: AbortSignal }): Promise<SubLocationLookupOption[]> => {
        const queryParams = new URLSearchParams();
        if (module) queryParams.set('module', module);
        if (country) queryParams.set('country', country);
        const query = queryParams.toString();
        const payload = await requestJson<Array<{ Code?: string | number; Name?: string; Module?: string; Country?: string; Priority?: number }>>(`/api/lookups/sub-locations${query ? `?${query}` : ''}`, {
            signal: options?.signal,
        });
        return (payload.data || [])
            .map((row) => ({
                code: asText(row.Code),
                name: asText(row.Name),
                module: asText(row.Module),
                country: asText(row.Country),
                priority: Number(row.Priority ?? 0),
            }))
            .filter((row) => row.code !== '');
    },

    getCountries: async (): Promise<LookupOption[]> => {
        const payload = await requestJson<{ Code: string; Name: string }[]>('/api/lookups/countries');
        return (payload.data || [])
            .map(row => ({
                value: asText(row.Code),
                label: asText(row.Name),
            }))
            .filter(row => isRealLookupOption(row.value, row.label));
    },

    getPermitTypes: async (): Promise<LookupOption[]> => {
        const payload = await requestJson<{ Code: string; Name: string }[]>('/api/lookups/permit-types');
        return (payload.data || [])
            .map(row => ({
                value: asText(row.Code),
                label: asText(row.Name),
            }))
            .filter(row => isRealLookupOption(row.value, row.label));
    },

    getItemCategories: async (): Promise<LookupOption[]> => {
        if (itemCategoriesCache.data) return itemCategoriesCache.data;
        if (itemCategoriesCache.promise) return itemCategoriesCache.promise;

        itemCategoriesCache.promise = (async () => {
            const payload = await requestJson<{ Code: string; Name: string }[]>('/api/lookups/item-categories');
            const normalized = (payload.data || [])
                .map(row => ({
                    value: asText(row.Code),
                    label: asText(row.Name),
                }))
                .filter(row => isRealLookupOption(row.value, row.label));

            itemCategoriesCache.data = normalized;
            itemCategoriesCache.promise = null;
            return normalized;
        })().catch((error) => {
            itemCategoriesCache.promise = null;
            throw error;
        });

        return itemCategoriesCache.promise;
    },

    getCategoryBrands: async (itemCategory?: string): Promise<CategoryBrandOption[]> => {
        const normalizedCategory = asText(itemCategory);
        const cacheKey = normalizedCategory || '__ALL__';
        const cached = categoryBrandsByCategoryCache.get(cacheKey);
        if (cached && Date.now() - cached.at <= CATEGORY_BRANDS_CACHE_TTL_MS) {
            return cached.value;
        }

        const inFlight = categoryBrandsByCategoryPromise.get(cacheKey);
        if (inFlight) return inFlight;

        const promise = (async () => {
            const query = normalizedCategory ? `?itemCategory=${encodeURIComponent(normalizedCategory)}` : '';
            const payload = await requestJson<Record<string, unknown>[]>(`/api/lookups/category-brand${query}`);
            const normalized = (payload.data || [])
                .map((row) => ({
                    ItemCategory: asText(row.ItemCategory),
                    U_Brand: asText(row.U_Brand),
                }))
                .filter((row) => row.ItemCategory !== '' && row.U_Brand !== '');

            categoryBrandsByCategoryCache.set(cacheKey, { value: normalized, at: Date.now() });
            return normalized;
        })();

        categoryBrandsByCategoryPromise.set(cacheKey, promise);

        try {
            return await promise;
        } finally {
            categoryBrandsByCategoryPromise.delete(cacheKey);
        }
    },

    getItemAttachments: async (itemId: number): Promise<Record<string, unknown>[]> => {
        const payload = await requestJson<Record<string, unknown>[]>(`/api/lookups/item-attachments?itemId=${itemId}`);
        return payload.data || [];
    },

    getTermAttachments: async (termId: number): Promise<Record<string, unknown>[]> => {
        const payload = await requestJson<Record<string, unknown>[]>(`/api/lookups/term-attachments?termId=${termId}`);
        return payload.data || [];
    },

    getBrandVendor: async (brand?: string): Promise<BrandVendorItem[]> => {
        const query = brand ? `?brand=${encodeURIComponent(brand)}` : '';
        const payload = await requestJson<Record<string, unknown>[]>(`/api/lookups/brand-vendor${query}`);
        return (payload.data || []).map(mapBrandVendorRecord);
    },

    getVendorBrandVendors: async (): Promise<VendorBrandVendorOption[]> => {
        const payload = await requestJson<Record<string, unknown>[]>('/api/lookups/vendor-brand/vendors');
        return (payload.data || [])
            .map((row) => ({
                CardCode: asText(row.CardCode),
                CardName: asText(row.CardName),
            }))
            .filter((row) => row.CardCode !== '' && row.CardName !== '');
    },

    getTermVendors: async (): Promise<VendorLookupOption[]> => {
        const payload = await requestJson<Array<{ CardCode?: string; CardName?: string }>>('/api/lookups/vendors');
        return (payload.data || [])
            .map((row) => ({
                cardCode: asText(row.CardCode),
                cardName: asText(row.CardName),
            }))
            .filter((row) => row.cardCode !== '');
    },

    getContacts: async (cardCode?: string, options?: { signal?: AbortSignal }): Promise<ContactLookupOption[]> => {
        const query = cardCode ? `?cardCode=${encodeURIComponent(cardCode)}` : '';
        const payload = await requestJson<Array<{ CntctCode?: string | number; CardCode?: string; Name?: string; Active?: string }>>(`/api/lookups/contacts${query}`, {
            signal: options?.signal,
        });
        return (payload.data || [])
            .map((row) => ({
                cntctCode: asText(row.CntctCode),
                cardCode: asText(row.CardCode),
                name: asText(row.Name),
                active: asText(row.Active),
            }))
            .filter((row) => row.name !== '');
    },

    getFreightTypes: async (): Promise<FreightTypeLookupOption[]> => {
        const payload = await requestJson<Array<{ Code?: string; Name?: string; U_Rate?: string | number }>>('/api/lookups/freight-types');
        return (payload.data || [])
            .map((row) => ({
                code: asText(row.Code),
                name: asText(row.Name),
                rate: Number(row.U_Rate ?? 0),
            }))
            .filter((row) => row.code !== '');
    },

    getSalesPersons: async (): Promise<SalesPersonLookupOption[]> => {
        const payload = await requestJson<Array<{ SlpCode?: string | number; SlpName?: string; Active?: string }>>('/api/lookups/sales-persons');
        return (payload.data || [])
            .map((row) => ({
                slpCode: asText(row.SlpCode),
                slpName: asText(row.SlpName),
                active: asText(row.Active),
            }))
            .filter((row) => row.slpName !== '');
    },

    getVendorBrand: async (params?: { vendorCode?: string; supplierName?: string }): Promise<BrandVendorItem[]> => {
        const queryParams = new URLSearchParams();
        if (params?.vendorCode) queryParams.set('vendorCode', params.vendorCode);
        if (params?.supplierName) queryParams.set('supplierName', params.supplierName);
        const query = queryParams.toString();
        const payload = await requestJson<Record<string, unknown>[]>(`/api/lookups/vendor-brand${query ? `?${query}` : ''}`);
        return (payload.data || []).map(mapBrandVendorRecord);
    },
};

