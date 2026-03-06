import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const SERVER_ROOT_DIR = path.resolve(__dirname, '../..');
const DEFAULT_ITEM_IMAGE_DIR = path.resolve(SERVER_ROOT_DIR, 'storage', 'item-images');

function isAbsoluteWindowsPath(value: string): boolean {
    return /^([a-zA-Z]:\\|\\\\)/.test(value);
}

function normalizeWindowsDirPath(input: string | undefined, fallback: string): string {
    const raw = (input || '').trim();
    if (!raw) {
        return fallback;
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
    ITEM_IMAGE_DIR: normalizeWindowsDirPath(process.env.ITEM_IMAGE_DIR, DEFAULT_ITEM_IMAGE_DIR),
    USER_PICTURE_DIR: normalizeWindowsDirPath(process.env.USER_PICTURE_DIR, ''),

    // CORS
    CORS_ALLOWED_ORIGINS: corsAllowedOrigins,
    CORS_ORIGIN: corsAllowedOrigins.join(','),

    // RFQ email defaults
    RFQ_MAILTO_CC: String(process.env.RFQ_MAILTO_CC || '').trim(),
    RFQ_MAILTO_SUBJECT: String(process.env.RFQ_MAILTO_SUBJECT || '').trim(),

    get isDev() {
        return this.NODE_ENV === 'development';
    },
    get isProd() {
        return this.NODE_ENV === 'production';
    },
} as const;
