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

// ─── การตั้งค่าการเชื่อมต่อ SQL Server (Connection Config) ───────────────
// เทียบเท่ากับ Connection String ใน Web.config หรือ App.config ของ .NET
const sqlConfig: sql.config = {
    server: env.DB_HOST,
    port: env.DB_PORT,
    database: env.DB_NAME_QTEC,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    options: {
        encrypt: false,                // Internal network — no TLS needed
        trustServerCertificate: true,  // Skip cert validation for dev
        enableArithAbort: true,
        // Legacy app stores/display SQL datetime as local business time.
        // Prevent driver from interpreting DATETIME as UTC (which shifts +7h in TH).
        useUTC: false,
    },
    pool: {
        max: 10,
        min: 2,
        idleTimeoutMillis: 30000,
    },
    requestTimeout: 30000,          // 30 seconds for large queries
};

// ─── Singleton Pool (ใช้ Connection Pool เดียวทั้งแอป) ───────────────────
let pool: sql.ConnectionPool | null = null;

/**
 * 🇹🇭 สร้างหรือดึง Connection Pool ที่มีอยู่แล้ว
 * (เหมือนกับการใช้ Singleton Pattern เพื่อไม่ให้เปิด Connection ซ้ำซ้อน)
 */
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

/**
 * 🇹🇭 ดึงข้อมูลหลายรายการ (SELECT * FROM ...)
 * @param sqlText - คำสั่ง SQL (เช่น "SELECT * FROM Users WHERE ID = @id")
 * @param params - พารามิเตอร์ (เช่น { id: 1 })
 * @returns Array ของข้อมูล (T[])
 */
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
    return result.recordset; // คืนค่าเป็น Array เสมอ (เหมือน .ToList() ใน .NET)
}

/**
 * 🇹🇭 ดึงข้อมูลรายการเดียว (SELECT TOP 1 ...)
 * @param sqlText - คำสั่ง SQL
 * @param params - พารามิเตอร์
 * @returns ข้อมูลตัวแรก (T) หรือ null ถ้าไม่พบ (เหมือน .FirstOrDefault() ใน .NET)
 */
export async function queryOne<T = any>(
    sqlText: string,
    params?: Record<string, any>
): Promise<T | null> {
    const rows = await query<T>(sqlText, params);
    return rows.length > 0 ? rows[0] : null;
}

/**
 * 🇹🇭 สั่งทำงาน SQL ที่ไม่มีการคืนค่า (INSERT, UPDATE, DELETE)
 * @param sqlText - คำสั่ง SQL
 * @param params - พารามิเตอร์
 * @returns จำนวน Rows ที่ได้รับผลกระทบ (RowsAffected)
 */
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

/**
 * 🇹🇭 เรียกใช้ Stored Procedure
 * @param spName - ชื่อ Stored Procedure
 * @param inputs - Input parameters
 * @param outputs - Output parameters (ถ้ามี)
 */
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

/**
 * 🇹🇭 ปิดการเชื่อมต่อ (ใช้เมื่อปิด Server)
 */
export async function closePool(): Promise<void> {
    if (pool) {
        await pool.close();
        pool = null;
        logger.info('Closed SQL Server connection pool');
    }
}

// Export sql types เพื่อให้ไฟล์อื่นเรียกใช้ Type ได้ง่าย (เช่น sql.Int, sql.NVarChar)
export { sql };
