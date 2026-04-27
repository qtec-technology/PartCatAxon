import sql from 'mssql';
import { env } from '#src/config/env.js';
import { toSqlIdentifier } from '#src/utils/sql.js';
import { logger } from '#src/utils/logger.js';

function resolveStoredProcedureName(spName: string): string {
    const trimmedSpName = String(spName || '').trim();
    if (!trimmedSpName) {
        throw new Error('Stored procedure name is required');
    }

    // Already schema/database-qualified (e.g. dbo.SP, [DB].[dbo].[SP]).
    if (trimmedSpName.includes('.')) {
        return trimmedSpName;
    }

    const spDatabase = String(env.DB_NAME_QTEC || '').trim();
    if (!spDatabase) {
        return trimmedSpName;
    }

    return `${toSqlIdentifier(spDatabase)}.[dbo].${toSqlIdentifier(trimmedSpName)}`;
}

const sqlConfig: sql.config = {
    server: env.DB_HOST,
    port: env.DB_PORT,
    database: env.DB_NAME_QTEC,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    options: {
        encrypt: env.DB_ENCRYPT,
        trustServerCertificate: env.DB_TRUST_SERVER_CERTIFICATE,
        enableArithAbort: true,
        // Legacy app stores SQL datetime values in local business time.
        // Prevent the driver from interpreting DATETIME as UTC.
        useUTC: false,
    },
    pool: {
        max: env.DB_POOL_MAX,
        min: env.DB_POOL_MIN,
        idleTimeoutMillis: 30000,
    },
    requestTimeout: env.DB_REQUEST_TIMEOUT_MS,
};

let pool: sql.ConnectionPool | null = null;

export async function getPool(): Promise<sql.ConnectionPool> {
    if (pool && pool.connected) {
        return pool;
    }

    try {
        pool = await new sql.ConnectionPool(sqlConfig).connect();
        logger.info('Connected to SQL Server', {
            host: env.DB_HOST,
            database: env.DB_NAME_QTEC,
        });
        return pool;
    } catch (err) {
        logger.error('Failed to connect to SQL Server', err instanceof Error ? err : undefined);
        throw err;
    }
}

export async function query<T = any>(
    sqlText: string,
    params?: Record<string, any>
): Promise<T[]> {
    const p = await getPool();
    const request = p.request();

    if (params) {
        for (const [key, value] of Object.entries(params)) {
            request.input(key, value);
        }
    }

    const result = await request.query<T>(sqlText);
    return result.recordset ?? [];
}

export async function queryOne<T = any>(
    sqlText: string,
    params?: Record<string, any>
): Promise<T | null> {
    const rows = await query<T>(sqlText, params);
    return rows.length > 0 ? rows[0] : null;
}

export async function execute(
    sqlText: string,
    params?: Record<string, any>
): Promise<number> {
    const p = await getPool();
    const request = p.request();

    if (params) {
        for (const [key, value] of Object.entries(params)) {
            request.input(key, value);
        }
    }

    const result = await request.query(sqlText);
    return result.rowsAffected[0];
}

export async function execSP<T = any>(
    spName: string,
    inputs?: Record<string, { type: any; value: any }>,
    outputs?: Record<string, { type: any }>
): Promise<sql.IProcedureResult<T>> {
    const p = await getPool();
    const request = p.request();

    if (inputs) {
        for (const [key, { type, value }] of Object.entries(inputs)) {
            request.input(key, type, value);
        }
    }

    if (outputs) {
        for (const [key, { type }] of Object.entries(outputs)) {
            request.output(key, type);
        }
    }

    return request.execute<T>(resolveStoredProcedureName(spName));
}

export async function closePool(): Promise<void> {
    if (pool) {
        await pool.close();
        pool = null;
        logger.info('Closed SQL Server connection pool');
    }
}

export { sql };
