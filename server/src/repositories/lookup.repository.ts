import { query } from '#src/config/database.js';
import type {
    BrandOption, ItemGroupOption, UOMOption, CurrencyOption,
    OrderTermOption, LocationOption, SubLocationOption,
    PermitTypeOption, VendorOption, VendorBrandFormVendorOption, ContactOption,
    FreightOption, SalesPersonOption, CountryOption,
    ItemCategoryOption, CategoryBrandOption, AttachmentRecord,
} from '#src/types/lookup.types.js';
import {
    BRANDS_SQL,
    ITEM_GROUPS_SQL,
    UOMS_SQL,
    CURRENCIES_SQL,
    ORDER_TERMS_SQL,
    LOCATIONS_SQL,
    PERMIT_TYPES_SQL,
    VENDORS_SQL,
    VENDOR_BRAND_FORM_VENDORS_SQL,
    FREIGHT_TYPES_SQL,
    SALES_PERSONS_SQL,
    COUNTRIES_SQL,
    ITEM_CATEGORIES_SQL,
    ITEM_ATTACHMENTS_SQL,
    TERM_ATTACHMENTS_SQL,
    buildSubLocationsQuery,
    buildContactsQuery,
    buildBrandVendorQuery,
    buildVendorBrandQuery,
    buildCategoryBrandsQuery,
} from '#src/queries/domains/lookup/lookup.read.js';

// ─── Lookup Repository ──────────────────────────────────────────────────────
// Each function corresponds to a dropdown/ComboBox in the legacy MS Access forms.

/** Brands — from SAP lookup table */
// In-memory cache for lookup/report endpoints.
// Refresh windows are aligned with sync jobs: 00:45 and 12:45 local time.
type CacheEntry<T> = {
    value: T;
    expiresAt: number;
};

const dailyLookupCache = new Map<string, CacheEntry<unknown>>();

type LookupQueryOptions = {
    realtime?: boolean;
};

// ใช้สำหรับคำนวณเวลา expire ของแคชรอบถัดไป (00:45/12:45)
function getNextDailyInvalidationMs(now: Date = new Date()): number {
    const refreshAt0045 = new Date(now);
    refreshAt0045.setHours(0, 45, 0, 0);

    const refreshAt1245 = new Date(now);
    refreshAt1245.setHours(12, 45, 0, 0);

    if (now.getTime() < refreshAt0045.getTime()) {
        return refreshAt0045.getTime();
    }
    if (now.getTime() < refreshAt1245.getTime()) {
        return refreshAt1245.getTime();
    }

    refreshAt0045.setDate(refreshAt0045.getDate() + 1);
    return refreshAt0045.getTime();
}

// ใช้สำหรับห่อการเรียก DB ด้วยแคชรายวัน เพื่อลดการ query ซ้ำ
async function withDailyCache<T>(key: string, loader: () => Promise<T>): Promise<T> {
    const nowMs = Date.now();

    for (const [cachedKey, entry] of dailyLookupCache) {
        if (nowMs >= entry.expiresAt) {
            dailyLookupCache.delete(cachedKey);
        }
    }

    const cached = dailyLookupCache.get(key) as CacheEntry<T> | undefined;
    if (cached && nowMs < cached.expiresAt) {
        return cached.value;
    }

    const value = await loader();
    dailyLookupCache.set(key, {
        value,
        expiresAt: getNextDailyInvalidationMs(new Date(nowMs)),
    });
    return value;
}

// ใช้สำหรับดึงรายการ Brand สำหรับ lookup
export async function getBrands(): Promise<BrandOption[]> {
    return withDailyCache('lookups:brands', async () => {
        const result = await query<BrandOption>(BRANDS_SQL);
        return result;
    });
}

/** Item Groups — from configured lookup table */
// ใช้สำหรับดึงรายการ Item Group สำหรับ dropdown
export async function getItemGroups(): Promise<ItemGroupOption[]> {
    return withDailyCache('lookups:item-groups', async () => {
        const result = await query<ItemGroupOption>(ITEM_GROUPS_SQL);
        return result;
    });
}

/** UOM — from SAP lookup table */
// ใช้สำหรับดึงรายการหน่วย UOM
export async function getUOMs(): Promise<UOMOption[]> {
    return withDailyCache('lookups:uoms', async () => {
        const result = await query<UOMOption>(UOMS_SQL);
        return result;
    });
}

/** Currencies — from SAP lookup table */
// ใช้สำหรับดึงรายการสกุลเงิน
export async function getCurrencies(options?: LookupQueryOptions): Promise<CurrencyOption[]> {
    if (options?.realtime) {
        const result = await query<CurrencyOption>(CURRENCIES_SQL);
        return result;
    }

    return withDailyCache('lookups:currencies', async () => {
        const result = await query<CurrencyOption>(CURRENCIES_SQL);
        return result;
    });
}

/** Order Terms — from SAP lookup table */
// ใช้สำหรับดึงรายการเงื่อนไขการสั่งซื้อ
export async function getOrderTerms(): Promise<OrderTermOption[]> {
    return withDailyCache('lookups:order-terms', async () => {
        const result = await query<OrderTermOption>(ORDER_TERMS_SQL);
        return result;
    });
}

/** Locations — from [@LOCATION] (Local DB) */
// ใช้สำหรับดึงรายการ Location
export async function getLocations(options?: LookupQueryOptions): Promise<LocationOption[]> {
    if (options?.realtime) {
        const result = await query<LocationOption>(LOCATIONS_SQL);
        return result;
    }

    return withDailyCache('lookups:locations', async () => {
        const result = await query<LocationOption>(LOCATIONS_SQL);
        return result;
    });
}

/** Sub Locations — from [@SUBLOCATION] filtered by Module and Country */
// ใช้สำหรับดึงรายการ Sub Location ตามเงื่อนไข module/country
export async function getSubLocations(
    module?: string,
    country?: string
): Promise<SubLocationOption[]> {
    const { sqlText, params } = buildSubLocationsQuery(module, country);

    const cacheKey = `lookups:sub-locations:${module || '__ALL__'}:${country || '__ALL__'}`;
    return withDailyCache(cacheKey, async () => {
        const result = await query<SubLocationOption>(sqlText, params);
        return result;
    });
}

/** Permit Types — from [@PERMITTYPE] (Local DB) */
// ใช้สำหรับดึงรายการประเภทใบอนุญาต
export async function getPermitTypes(): Promise<PermitTypeOption[]> {
    return withDailyCache('lookups:permit-types', async () => {
        const result = await query<PermitTypeOption>(PERMIT_TYPES_SQL);
        return result;
    });
}

/** Vendors — from QTEC view */
// ใช้สำหรับดึงรายการ Vendor
export async function getVendors(): Promise<VendorOption[]> {
    return withDailyCache('lookups:vendors', async () => {
        const result = await query<VendorOption>(VENDORS_SQL);
        return result;
    });
}

/** Vendors for Vendor→Brand form — from QTEC table */
// ใช้สำหรับดึง Vendor สำหรับหน้าจับคู่ Vendor-Brand
export async function getVendorsForVendorBrandForm(): Promise<VendorBrandFormVendorOption[]> {
    return withDailyCache('lookups:vendor-brand:vendors', async () => {
        const result = await query<VendorBrandFormVendorOption>(VENDOR_BRAND_FORM_VENDORS_SQL);
        return result;
    });
}

/** Contact Persons by vendor — from [@OCPR] view  */
// ใช้สำหรับดึงรายชื่อผู้ติดต่อของ Vendor
export async function getContacts(cardCode?: string): Promise<ContactOption[]> {
    const { sqlText, params } = buildContactsQuery(cardCode);

    const cacheKey = `lookups:contacts:${cardCode || '__ALL__'}`;
    return withDailyCache(cacheKey, async () => {
        const result = await query<ContactOption>(sqlText, params);
        return result;
    });
}

/** Freight Types — from SAP lookup table */
// ใช้สำหรับดึงรายการประเภทค่าขนส่ง
export async function getFreightTypes(options?: LookupQueryOptions): Promise<FreightOption[]> {
    if (options?.realtime) {
        const result = await query<FreightOption>(FREIGHT_TYPES_SQL);
        return result;
    }

    return withDailyCache('lookups:freight-types', async () => {
        const result = await query<FreightOption>(FREIGHT_TYPES_SQL);
        return result;
    });
}

/** Sales Persons — from [@OSLP] view */
// ใช้สำหรับดึงรายการ Sales Person
export async function getSalesPersons(): Promise<SalesPersonOption[]> {
    return withDailyCache('lookups:sales-persons', async () => {
        const result = await query<SalesPersonOption>(SALES_PERSONS_SQL);
        return result;
    });
}

/** Countries — from SAP lookup table */
// ใช้สำหรับดึงรายการประเทศ
export async function getCountries(): Promise<CountryOption[]> {
    return withDailyCache('lookups:countries', async () => {
        const result = await query<CountryOption>(COUNTRIES_SQL);
        return result;
    });
}

/** Brand→Vendor search cache */
// ใช้สำหรับค้นหาความสัมพันธ์ Brand -> Vendor
export async function getBrandVendor(brand?: string): Promise<any[]> {
    const normalizedBrand = (brand || '').trim();
    const cacheKey = `lookups:brand-vendor:${normalizedBrand || '__ALL__'}`;
    return withDailyCache(cacheKey, async () => {
        const { sqlText, params } = buildBrandVendorQuery(normalizedBrand);
        return await query(sqlText, params);
    });
}

/** Vendor→Brand search cache */
// ใช้สำหรับค้นหาความสัมพันธ์ Vendor -> Brand
export async function getVendorBrand(vendorCode?: string, supplierName?: string): Promise<any[]> {
    const normalizedVendorCode = (vendorCode || '').trim();
    const normalizedSupplierName = (supplierName || '').trim();
    const cacheKey = `lookups:vendor-brand:${normalizedVendorCode || '__ALL__'}:${normalizedSupplierName || '__NONE__'}`;
    return withDailyCache(cacheKey, async () => {
        const { sqlText, params } = buildVendorBrandQuery(normalizedVendorCode, normalizedSupplierName);
        return await query(sqlText, params);
    });
}

/** Item Categories — from SAP lookup table */
// ใช้สำหรับดึงรายการหมวดหมู่สินค้า
export async function getItemCategories(): Promise<ItemCategoryOption[]> {
    return withDailyCache('lookups:item-categories', async () => {
        const result = await query<ItemCategoryOption>(ITEM_CATEGORIES_SQL);
        return result;
    });
}

/** Category→Brand map — from SAP view */
// ใช้สำหรับดึงรายการ Brand ตามหมวดหมู่สินค้า
export async function getCategoryBrands(itemCategory?: string): Promise<CategoryBrandOption[]> {
    const normalizedCategory = (itemCategory || '').trim();
    const cacheKey = `lookups:category-brand:${normalizedCategory || '__ALL__'}`;
    return withDailyCache(cacheKey, async () => {
        const { sqlText, params } = buildCategoryBrandsQuery(normalizedCategory);
        return await query<CategoryBrandOption>(sqlText, params);
    });
}

/** Item Attachments — from QTEC attachment table */
// ใช้สำหรับดึงรายการไฟล์แนบของ Item
export async function getItemAttachments(itemId: number): Promise<AttachmentRecord[]> {
    const result = await query<AttachmentRecord>(ITEM_ATTACHMENTS_SQL, { itemId });
    return result;
}

/** Term Attachments — from QTEC attachment table */
// ใช้สำหรับดึงรายการไฟล์แนบของ Term
export async function getTermAttachments(termId: number): Promise<AttachmentRecord[]> {
    const result = await query<AttachmentRecord>(TERM_ATTACHMENTS_SQL, { termId });
    return result;
}
