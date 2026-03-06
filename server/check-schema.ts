
import { query, closePool } from './src/config/database.js';

async function checkSchema() {
    try {
        console.log('🔍 Checking [SBOQTEC].[dbo].[@POITM] columns...');
        const result = await query('SELECT TOP 1 * FROM [SBOQTEC].[dbo].[@POITM]');
        if (result.length > 0) {
            const columns = Object.keys(result[0]);
            console.log('✅ Columns found:', columns.join(', '));

            const checks = ['CustomsDuty', 'TariffCode', 'TariffDescription'];
            checks.forEach(col => {
                if (columns.includes(col)) {
                    console.log(`✅ ${col} exists`);
                } else {
                    console.log(`❌ ${col} DOES NOT EXIST`);
                }
            });
        } else {
            console.log('⚠️ View is empty, cannot verify columns from data.');
        }
    } catch (err) {
        console.error('❌ Error querying view:', err);
    } finally {
        await closePool();
    }
}

checkSchema();
