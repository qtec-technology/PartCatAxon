export type UnknownRecord = Record<string, unknown>;

function firstValue(value: unknown): unknown {
    if (Array.isArray(value)) {
        return value.length > 0 ? value[0] : undefined;
    }
    return value;
}

export function asRecord(value: unknown): UnknownRecord {
    if (!value || typeof value !== 'object') {
        return {};
    }
    return value as UnknownRecord;
}

export function parseString(value: unknown, fallback = ''): string {
    const normalized = firstValue(value);
    if (typeof normalized === 'string') {
        return normalized;
    }
    if (typeof normalized === 'number' || typeof normalized === 'boolean') {
        return String(normalized);
    }
    return fallback;
}

export function parseNullableString(value: unknown): string | null {
    const parsed = parseString(value, '').trim();
    return parsed.length > 0 ? parsed : null;
}

export function parseBooleanFlag(value: unknown, fallback = false): boolean {
    const normalized = firstValue(value);
    if (typeof normalized === 'boolean') {
        return normalized;
    }
    if (typeof normalized === 'number') {
        return normalized !== 0;
    }
    if (typeof normalized === 'string') {
        const lower = normalized.trim().toLowerCase();
        if (lower === 'true' || lower === '1' || lower === 'yes' || lower === 'y') {
            return true;
        }
        if (lower === 'false' || lower === '0' || lower === 'no' || lower === 'n' || lower === '') {
            return false;
        }
    }
    return fallback;
}

export function parsePositiveInt(value: unknown, fallback: number, min = 1, max = Number.MAX_SAFE_INTEGER): number {
    const normalized = firstValue(value);
    const parsed = Number.parseInt(String(normalized ?? ''), 10);
    if (!Number.isFinite(parsed)) {
        return fallback;
    }
    return Math.min(max, Math.max(min, parsed));
}

export function parseOptionalInt(value: unknown): number | null {
    const normalized = firstValue(value);
    const parsed = Number.parseInt(String(normalized ?? ''), 10);
    return Number.isFinite(parsed) ? parsed : null;
}
