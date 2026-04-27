import { query } from '#src/config/database.js';
import type { FTSResult, AutoCompleteItem } from '#src/types/search.types.js';
import type { Item } from '#src/types/item.types.js';
import {
    FTS_SEARCH_SQL,
    FTS_BRANDS_SQL,
    FTS_AUTOCOMPLETE_SQL,
    STANDARD_SEARCH_COLUMN_MAP,
    PART_NO_AUTOCOMPLETE_SQL,
    buildStandardSearchQuery,
} from '#src/queries/domains/search/search.read.js';

type SearchCacheEntry<T> = {
    value: T;
    expiresAt: number;
};

export type SearchPage<T> = {
    items: T[];
    total: number;
};

const ftsSearchCache = new Map<string, SearchCacheEntry<unknown>>();
const FTS_CACHE_MAX_ENTRIES = 2000;

// ใช้สำหรับคำนวณเวลา refresh แคช FTS รอบถัดไป (00:45/12:45)
function getNextFtsCacheRefreshMs(now: Date = new Date()): number {
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

// ใช้สำหรับล้างรายการแคช FTS ที่หมดอายุแล้ว
function cleanupExpiredFtsCache(nowMs: number): void {
    for (const [key, entry] of ftsSearchCache) {
        if (nowMs >= entry.expiresAt) {
            ftsSearchCache.delete(key);
        }
    }
}

// ใช้สำหรับห่อการค้นหา FTS ด้วยแคชเพื่อลด query ซ้ำ
async function withFtsCache<T>(key: string, loader: () => Promise<T>): Promise<T> {
    const nowMs = Date.now();
    cleanupExpiredFtsCache(nowMs);

    const hit = ftsSearchCache.get(key) as SearchCacheEntry<T> | undefined;
    if (hit && nowMs < hit.expiresAt) {
        return hit.value;
    }

    const value = await loader();

    if (ftsSearchCache.size >= FTS_CACHE_MAX_ENTRIES) {
        // Safety bound for memory growth.
        ftsSearchCache.clear();
    }

    ftsSearchCache.set(key, {
        value,
        expiresAt: getNextFtsCacheRefreshMs(new Date(nowMs)),
    });

    return value;
}

// ใช้สำหรับค้นหาแบบ Full-Text Search ตามคำค้นและแบรนด์
export async function searchFTS(keyword: string, brand: string = '_Null'): Promise<FTSResult[]> {
    const normalizedBrand = brand && brand.trim().length > 0 ? brand.trim() : '_Null';
    const normalizedKeyword = keyword.trim();
    const cacheKey = `fts:${normalizedKeyword.toLowerCase()}|${normalizedBrand.toLowerCase()}`;

    return withFtsCache(cacheKey, async () => {
        return await query<FTSResult>(FTS_SEARCH_SQL, {
            pKeyword: normalizedKeyword,
            pBrand: normalizedBrand,
        });
    });
}

export async function searchFTSPaged(
    keyword: string,
    brand: string = '_Null',
    page: number = 1,
    pageSize: number = 50,
    updatedBy?: string
): Promise<SearchPage<FTSResult>> {
    const rawResults = await searchFTS(keyword, brand);
    const normalizedUpdatedBy = String(updatedBy || '').trim().toLowerCase();
    const filtered = normalizedUpdatedBy
        ? rawResults.filter((row) => String(row.Updatedby || '').trim().toLowerCase() === normalizedUpdatedBy)
        : rawResults;
    const safePageSize = Math.min(400, Math.max(1, Math.floor(pageSize)));
    const totalPages = Math.max(1, Math.ceil(filtered.length / safePageSize));
    const safePage = Math.max(1, Math.min(Math.floor(page), totalPages));
    const start = (safePage - 1) * safePageSize;

    return {
        items: filtered.slice(start, start + safePageSize),
        total: filtered.length,
    };
}

/**
 * Get Brand list from FTS results.
 */
// ใช้สำหรับดึงรายการแบรนด์จากผล FTS
export async function searchFTSBrands(keyword: string): Promise<string[]> {
    const normalizedKeyword = keyword.trim();
    const cacheKey = `fts-brands:${normalizedKeyword.toLowerCase()}`;

    return withFtsCache(cacheKey, async () => {
        const result = await query<{ U_Brand?: string; Brand?: string }>(FTS_BRANDS_SQL, {
            pKeyword: normalizedKeyword,
        });

        return result
            .map((r) => r.U_Brand || r.Brand || '')
            .filter((brandName) => brandName.length > 0);
    });
}

/**
 * Autocomplete suggestions from FTS.
 */
// ใช้สำหรับดึงคำแนะนำอัตโนมัติจาก FTS
export async function searchFTSAutocomplete(keyword: string): Promise<AutoCompleteItem[]> {
    const normalizedKeyword = keyword.trim();
    const cacheKey = `fts-autocomplete:${normalizedKeyword.toLowerCase()}`;

    return withFtsCache(cacheKey, async () => {
        return await query<AutoCompleteItem>(FTS_AUTOCOMPLETE_SQL, {
            pKeyword: normalizedKeyword,
        });
    });
}

/**
 * Standard search by field (Catalog No, Item Code, etc.)
 */
// ใช้สำหรับค้นหาแบบมาตรฐานตาม field ที่กำหนด
export async function searchStandard(
    field: string,
    keyword: string,
    brand: string | null,
    exactMatch: boolean,
    updatedBy: string | undefined,
    page: number = 1,
    pageSize: number = 50
): Promise<SearchPage<Item>> {
    const column = STANDARD_SEARCH_COLUMN_MAP[field];
    if (!column) {
        throw new Error(`Invalid search field: ${field}`);
    }

    type PagedSearchRow = Item & { __TotalRows?: number | string };
    const { sqlText, params } = buildStandardSearchQuery(column, keyword, exactMatch, brand, updatedBy, page, pageSize);
    const rows = await query<PagedSearchRow>(sqlText, params);
    const total = rows.length > 0 ? Number(rows[0].__TotalRows || 0) : 0;
    const items = rows.map(({ __TotalRows: _totalRows, ...item }) => item as Item);

    return {
        items,
        total: Number.isFinite(total) ? total : 0,
    };
}

/**
 * Search items by PartNo for autocomplete (in Add New Item form).
 */
// ใช้สำหรับค้นหา Part No แบบ autocomplete ตามแบรนด์
export async function searchPartNoAutocomplete(
    brand: string,
    partialCatalogNo: string
): Promise<{ U_Brand: string; U_Calalogno: string }[]> {
    return await query<{ U_Brand: string; U_Calalogno: string }>(PART_NO_AUTOCOMPLETE_SQL, {
        brand,
        pattern: `%${partialCatalogNo}%`,
    });
}
