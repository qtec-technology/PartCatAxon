import { closePool, query } from '../src/config/database.js';

type ColumnRow = {
    COLUMN_NAME: string;
};

const REQUIRED_COLUMNS = [
    'ItemID',
    'ItemCode',
    'ItemGroup',
    'B1ItemNo',
    'BPStockItemNo',
    'U_Calalogno',
    'U_Brand',
    'ItemDescription',
    'SAPB1Desc',
    'U_Punchout',
    'U_VMI',
    'U_CustBPA',
    'U_IsQTECSTock',
    'U_B1Item',
    'U_Serialreq',
    'U_MSDS',
    'U_Certificate',
    'U_Ecommerce',
    'U_Permitreq',
    'U_DG_Required',
    'U_HScode',
    'InvntryUom',
    'Updatedby',
    'UpdatedDate',
    'Active',
    'RowVer',
    'ItemCategory',
    'SpecialRequirement',
    'MasterFG',
    'GeneralSpec',
    'GeneralSpecUrl',
] as const;

const FORBIDDEN_COLUMNS = [
    'U_ShelfLife',
    'U_PunchOut',
] as const;

async function checkSchema() {
    try {
        console.log('Checking dbo.[@POITM] columns for Part Catalog Phase 1...');
        const rows = await query<ColumnRow>(`
            SELECT COLUMN_NAME
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = 'dbo'
              AND TABLE_NAME = '@POITM'
            ORDER BY ORDINAL_POSITION
        `);

        const columns = rows.map((row) => row.COLUMN_NAME);
        const columnSet = new Set(columns);

        console.log(`Columns found: ${columns.length}`);

        const missing = REQUIRED_COLUMNS.filter((column) => !columnSet.has(column));
        const forbidden = FORBIDDEN_COLUMNS.filter((column) => columnSet.has(column));

        if (missing.length > 0) {
            console.error(`Missing required columns: ${missing.join(', ')}`);
        }

        if (forbidden.length > 0) {
            console.error(`Legacy/incorrect columns still present in contract check: ${forbidden.join(', ')}`);
        }

        if (missing.length > 0 || forbidden.length > 0) {
            process.exitCode = 1;
            return;
        }

        console.log('Schema check passed. dbo.[@POITM] matches the Phase 1 item contract.');
    } catch (err) {
        console.error('Error checking item schema:', err);
        process.exitCode = 1;
    } finally {
        await closePool();
    }
}

void checkSchema();
