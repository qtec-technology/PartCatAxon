import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const SERVER_ROOT_DIR = path.resolve(__dirname, '../..');

function isAbsoluteWindowsPath(value: string): boolean {
    return /^([a-zA-Z]:\\|\\\\)/.test(value);
}

function normalizeWindowsDirPath(input: string): string {
    const raw = String(input || '').trim();
    if (!raw) {
        throw new Error('Directory path must not be empty');
    }

    let normalized = raw.replace(/\//g, '\\');

    if (normalized.startsWith('\\')) {
        // UNC path: keep exactly two leading backslashes, collapse the rest.
        const withoutLeading = normalized.replace(/^\\+/, '');
        normalized = `\\\\${withoutLeading.replace(/\\+/g, '\\')}`;
    } else {
        // Local drive path: collapse repeated separators.
        normalized = normalized.replace(/\\+/g, '\\');
    }

    const cleaned = normalized.replace(/\\+$/, '');
    if (isAbsoluteWindowsPath(cleaned)) {
        return cleaned;
    }

    // Resolve relative paths from server root (e.g. "..\\picture").
    return path.resolve(SERVER_ROOT_DIR, cleaned.replace(/\\/g, path.sep));
}

function normalizeOptionalWindowsDirPath(input: string | undefined, fallback: string): string {
    const raw = String(input || '').trim();
    if (!raw) {
        return fallback;
    }

    return normalizeWindowsDirPath(raw);
}

function normalizeOptionalWindowsPath(input: string | undefined, fallback: string): string {
    const raw = String(input || '').trim() || fallback;
    return normalizeWindowsDirPath(raw);
}

function getRequiredEnv(name: string): string {
    const value = String(process.env[name] || '').trim();
    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
}

function parseNumberEnv(name: string, fallback: number): number {
    const rawValue = String(process.env[name] || '').trim();
    if (!rawValue) return fallback;

    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed)) {
        throw new Error(`Invalid numeric environment variable: ${name}`);
    }
    return parsed;
}

function parseBooleanEnv(name: string, fallback: boolean): boolean {
    const rawValue = String(process.env[name] || '').trim().toLowerCase();
    if (!rawValue) return fallback;

    if (['true', '1', 'yes', 'y', 'on'].includes(rawValue)) return true;
    if (['false', '0', 'no', 'n', 'off'].includes(rawValue)) return false;

    throw new Error(`Invalid boolean environment variable: ${name}`);
}

function parseListEnv(name: string, fallback: string[] = []): string[] {
    const rawValue = String(process.env[name] || '').trim();
    const source = rawValue || fallback.join(',');

    return source
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
}

function parseOriginsFromEnv(): string[] {
    const source =
        String(process.env.CORS_ALLOWED_ORIGINS || '').trim() ||
        String(process.env.CORS_ORIGIN || '').trim();

    const origins = source
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean);

    if (origins.length === 0) {
        throw new Error('Missing CORS_ALLOWED_ORIGINS (or CORS_ORIGIN) environment variable');
    }

    return origins;
}

const corsAllowedOrigins = parseOriginsFromEnv();

export const env = {
    NODE_ENV: process.env.NODE_ENV || 'development',
    PORT: parseNumberEnv('PORT', 3001),

    // Database (SQL Server Authentication)
    DB_HOST: getRequiredEnv('DB_HOST'),
    DB_PORT: parseNumberEnv('DB_PORT', 1433),
    DB_NAME_QTEC: getRequiredEnv('DB_NAME_QTEC'),
    DB_NAME_SAP: getRequiredEnv('DB_NAME_SAP'),
    DB_USER: getRequiredEnv('DB_USER'),
    DB_PASSWORD: getRequiredEnv('DB_PASSWORD'),
    DB_POOL_MAX: parseNumberEnv('DB_POOL_MAX', 30),
    DB_POOL_MIN: parseNumberEnv('DB_POOL_MIN', 2),
    DB_REQUEST_TIMEOUT_MS: parseNumberEnv('DB_REQUEST_TIMEOUT_MS', 30000),
    DB_ENCRYPT: parseBooleanEnv('DB_ENCRYPT', false),
    DB_TRUST_SERVER_CERTIFICATE: parseBooleanEnv('DB_TRUST_SERVER_CERTIFICATE', true),
    ITEM_IMAGE_DIR: normalizeWindowsDirPath(getRequiredEnv('ITEM_IMAGE_DIR')),
    ATTACHMENT_DIR: normalizeWindowsDirPath(getRequiredEnv('ATTACHMENT_DIR')),
    USER_PICTURE_DIR: normalizeOptionalWindowsDirPath(process.env.USER_PICTURE_DIR, ''),

    // Term page reference files (paths must be set in .env)
    REF_FILE_INCOTERMS_2020_PDF: normalizeWindowsDirPath(getRequiredEnv('REF_FILE_INCOTERMS_2020_PDF')),
    REF_FILE_INCOTERMS_CHART: normalizeWindowsDirPath(getRequiredEnv('REF_FILE_INCOTERMS_CHART')),
    REF_FILE_UOM_MANUAL: normalizeWindowsDirPath(getRequiredEnv('REF_FILE_UOM_MANUAL')),
    REF_FILE_STANDARD_CUSTOM_COST_TABLE: normalizeWindowsDirPath(getRequiredEnv('REF_FILE_STANDARD_CUSTOM_COST_TABLE')),
    REF_FILE_DOMESTIC_AGENT_PRICE_TABLE: normalizeWindowsDirPath(getRequiredEnv('REF_FILE_DOMESTIC_AGENT_PRICE_TABLE')),

    // CORS
    CORS_ALLOWED_ORIGINS: corsAllowedOrigins,
    CORS_ORIGIN: corsAllowedOrigins.join(','),

    // RFQ email defaults
    RFQ_MAILTO_CC: String(process.env.RFQ_MAILTO_CC || '').trim(),
    RFQ_MAILTO_SUBJECT: String(process.env.RFQ_MAILTO_SUBJECT || '').trim(),

    // Auth and deployment controls
    AUTH_ALLOW_DOMAIN_USERS: parseBooleanEnv('AUTH_ALLOW_DOMAIN_USERS', true),
    AUTH_MANAGER_GROUPS: parseListEnv('AUTH_MANAGER_GROUPS', ['PCAT-Manager']),
    AUTH_SUPERVISOR_GROUPS: parseListEnv('AUTH_SUPERVISOR_GROUPS', ['PCAT-SuperVisor']),
    AUTH_USER_GROUPS: parseListEnv('AUTH_USER_GROUPS', ['Part Catalog User', 'Domain Users']),
    AUTH_TRUST_PROXY_HEADERS: parseBooleanEnv('AUTH_TRUST_PROXY_HEADERS', true),
    AUTH_PROXY_USER_HEADER: String(process.env.AUTH_PROXY_USER_HEADER || 'x-forwarded-user').trim().toLowerCase(),
    AUTH_PROXY_EMAIL_HEADER: String(process.env.AUTH_PROXY_EMAIL_HEADER || 'x-forwarded-email').trim().toLowerCase(),
    AUTH_PROXY_NAME_HEADER: String(process.env.AUTH_PROXY_NAME_HEADER || 'x-forwarded-name').trim().toLowerCase(),
    AUTH_PROXY_GROUPS_HEADER: String(process.env.AUTH_PROXY_GROUPS_HEADER || 'x-forwarded-groups').trim().toLowerCase(),
    AUTH_PROXY_ROLES_HEADER: String(process.env.AUTH_PROXY_ROLES_HEADER || 'x-forwarded-roles').trim().toLowerCase(),
    SERVER_READ_ONLY: parseBooleanEnv('SERVER_READ_ONLY', false),

    get isDev() {
        return this.NODE_ENV === 'development';
    },
    get isProd() {
        return this.NODE_ENV === 'production';
    },
} as const;
