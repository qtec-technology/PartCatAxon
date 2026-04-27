import { Request, Response, NextFunction } from 'express';
import * as searchRepo from '#src/repositories/search.repository.js';
import {
    toSearchFTSAutocompleteQueryDTO,
    toSearchFTSBrandsQueryDTO,
    toSearchFTSQueryDTO,
    toSearchPartNoQueryDTO,
    toSearchStandardQueryDTO,
} from '#src/dtos/search/search.request.dto.js';
import type {
    SearchFTSAutocompleteResponseDTO,
    SearchFTSBrandsResponseDTO,
    SearchFTSResponseDTO,
    SearchPartNoResponseDTO,
    SearchStandardResponseDTO,
} from '#src/dtos/search/search.response.dto.js';
import { sanitizeSearchInput } from '#src/utils/sanitize.js';
import { success, error } from '#src/utils/response.js';

// ─── Search Controller ──────────────────────────────────────────────────────

/** GET /api/search/fts?keyword=X — Full-Text Search */
export async function searchFTS(req: Request, res: Response, next: NextFunction) {
    try {
        const { keyword: rawKeyword, brand, myItems, page, pageSize } = toSearchFTSQueryDTO(req.query);
        const keyword = sanitizeSearchInput(rawKeyword);
        const username = (req.authUser?.username || '').trim();

        if (!keyword || keyword.length < 2) {
            res.status(400).json(error('Keyword must be at least 2 characters'));
            return;
        }

        const { items, total } = await searchRepo.searchFTSPaged(keyword, brand, page, pageSize, myItems ? username : undefined);
        const results: SearchFTSResponseDTO = items;
        res.json(success(results, undefined, {
            page,
            pageSize,
            total,
            totalPages: Math.max(1, Math.ceil(total / pageSize)),
        }));
    } catch (err) {
        next(err);
    }
}

/** GET /api/search/fts/brands?keyword=X — FTS Brand filter */
export async function searchFTSBrands(req: Request, res: Response, next: NextFunction) {
    try {
        const { keyword: rawKeyword } = toSearchFTSBrandsQueryDTO(req.query);
        const keyword = sanitizeSearchInput(rawKeyword);
        if (!keyword) {
            res.status(400).json(error('Keyword is required'));
            return;
        }

        const brands: SearchFTSBrandsResponseDTO = await searchRepo.searchFTSBrands(keyword);
        res.json(success(brands));
    } catch (err) {
        next(err);
    }
}

/** GET /api/search/fts/autocomplete?keyword=X — FTS Autocomplete */
export async function searchFTSAutocomplete(req: Request, res: Response, next: NextFunction) {
    try {
        const { keyword: rawKeyword } = toSearchFTSAutocompleteQueryDTO(req.query);
        const keyword = sanitizeSearchInput(rawKeyword);
        if (!keyword) {
            res.status(400).json(error('Keyword is required'));
            return;
        }

        const suggestions: SearchFTSAutocompleteResponseDTO = await searchRepo.searchFTSAutocomplete(keyword);
        res.json(success(suggestions));
    } catch (err) {
        next(err);
    }
}

/** GET /api/search/standard?field=X&keyword=X&brand=X&exactMatch=true */
export async function searchStandard(req: Request, res: Response, next: NextFunction) {
    try {
        const { field, keyword, brand, exactMatch, myItems, page, pageSize } = toSearchStandardQueryDTO(req.query);
        const updatedBy = myItems ? (req.authUser?.username || '').trim() : undefined;

        if (!field || !keyword) {
            res.status(400).json(error('field and keyword are required'));
            return;
        }

        if (myItems && !updatedBy) {
            res.json(success([], undefined, { total: 0 }));
            return;
        }

        const { items, total } = await searchRepo.searchStandard(field, keyword, brand, exactMatch, updatedBy, page, pageSize);
        const results: SearchStandardResponseDTO = items;
        res.json(success(results, undefined, {
            page,
            pageSize,
            total,
            totalPages: Math.max(1, Math.ceil(total / pageSize)),
        }));
    } catch (err) {
        next(err);
    }
}

/** GET /api/search/partno?brand=X&q=X — Part No autocomplete */
export async function searchPartNo(req: Request, res: Response, next: NextFunction) {
    try {
        const { brand, q } = toSearchPartNoQueryDTO(req.query);

        if (!brand || !q) {
            res.status(400).json(error('brand and q are required'));
            return;
        }

        const results: SearchPartNoResponseDTO = await searchRepo.searchPartNoAutocomplete(brand, q);
        res.json(success(results));
    } catch (err) {
        next(err);
    }
}
