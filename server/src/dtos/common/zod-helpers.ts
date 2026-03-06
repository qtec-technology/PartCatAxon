import { z } from 'zod';

function firstValue(value: unknown): unknown {
    if (Array.isArray(value)) {
        return value.length > 0 ? value[0] : undefined;
    }
    return value;
}

const booleanLikeValues = new Set(['true', 'false', '1', '0', 'yes', 'no', 'y', 'n']);

export const zQueryString = z.preprocess(firstValue, z.string().trim());
export const zQueryNonEmptyString = z.preprocess(
    firstValue,
    z.string().trim().min(1, 'Required')
);
export const zQueryOptionalString = z.preprocess(firstValue, z.string().trim().optional());
export const zQueryOptionalIntString = z.preprocess(
    firstValue,
    z.string().trim().regex(/^\d+$/, 'Must be a numeric value').optional()
);
export const zQueryBooleanLikeOptional = z.preprocess(
    firstValue,
    z.union([
        z.boolean(),
        z.string().trim().toLowerCase().refine(
            (value) => booleanLikeValues.has(value),
            'Must be boolean-like'
        ),
    ]).optional()
);

export const zParamIdString = z.preprocess(
    firstValue,
    z.string().trim().regex(/^\d+$/, 'Must be a numeric id')
);

export const zBodyObject = z.object({}).passthrough();

function parseNumberLike(value: unknown): unknown {
    const normalized = firstValue(value);
    if (typeof normalized === 'string') {
        const trimmed = normalized.trim();
        if (trimmed.length === 0) {
            return undefined;
        }
        const parsed = Number(trimmed);
        return Number.isFinite(parsed) ? parsed : normalized;
    }
    return normalized;
}

export const zBodyString = z.preprocess(firstValue, z.string().trim());
export const zBodyNonEmptyString = z.preprocess(firstValue, z.string().trim().min(1, 'Required'));
export const zBodyOptionalString = z.preprocess((value) => {
    const normalized = firstValue(value);
    if (normalized === null || normalized === undefined) return undefined;
    if (typeof normalized === 'string' && normalized.trim().length === 0) return undefined;
    return normalized;
}, z.string().trim().optional());

export const zBodyNumber = z.preprocess(parseNumberLike, z.number().finite());
export const zBodyOptionalNumber = z.preprocess((value) => {
    const normalized = parseNumberLike(value);
    if (normalized === null || normalized === undefined) return undefined;
    return normalized;
}, z.number().finite().optional());

export const zBodyInt = z.preprocess(parseNumberLike, z.number().int());
export const zBodyPositiveInt = z.preprocess(parseNumberLike, z.number().int().positive());
export const zBodyOptionalInt = z.preprocess((value) => {
    const normalized = parseNumberLike(value);
    if (normalized === null || normalized === undefined) return undefined;
    return normalized;
}, z.number().int().optional());

export const zBodyOptionalPositiveInt = z.preprocess((value) => {
    const normalized = parseNumberLike(value);
    if (normalized === null || normalized === undefined) return undefined;
    return normalized;
}, z.number().int().positive().optional());

export const zBodyOptionalBooleanLike = z.preprocess(
    firstValue,
    z.union([
        z.boolean(),
        z.string().trim().toLowerCase().refine(
            (value) => booleanLikeValues.has(value),
            'Must be boolean-like'
        ),
    ]).optional()
);

export const zBodyOptionalDate = z.preprocess((value) => {
    const normalized = firstValue(value);
    if (normalized === null || normalized === undefined || normalized === '') {
        return undefined;
    }
    if (normalized instanceof Date) {
        return normalized;
    }
    if (typeof normalized === 'string' || typeof normalized === 'number') {
        const date = new Date(normalized);
        return Number.isNaN(date.getTime()) ? normalized : date;
    }
    return normalized;
}, z.date().optional());
