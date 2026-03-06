import { getPool, closePool } from './src/config/database.js';

async function main() {
  const pool = await getPool();

  // Check if SPIT_GetVendorEmailByTermID exists and its params
  console.log('=== SPIT_GetVendorEmailByTermID params ===');
  const r1 = await pool.request().query(`
        SELECT PARAMETER_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, PARAMETER_MODE
        FROM INFORMATION_SCHEMA.PARAMETERS
        WHERE SPECIFIC_NAME = 'SPIT_GetVendorEmailByTermID'
        ORDER BY ORDINAL_POSITION
    `);
  if (r1.recordset.length === 0) {
    console.log('SP NOT FOUND in current DB!');
    // Check SBOQTEC
    const r2 = await pool.request().query(`
            SELECT PARAMETER_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, PARAMETER_MODE
            FROM SBOQTEC.INFORMATION_SCHEMA.PARAMETERS
            WHERE SPECIFIC_NAME = 'SPIT_GetVendorEmailByTermID'
            ORDER BY ORDINAL_POSITION
        `);
    if (r2.recordset.length > 0) {
      console.log('Found in SBOQTEC:');
      r2.recordset.forEach(c => console.log(`  ${c.PARAMETER_NAME}: ${c.DATA_TYPE} ${c.PARAMETER_MODE}`));
    } else {
      console.log('Not found in SBOQTEC either!');
    }
  } else {
    r1.recordset.forEach(c => console.log(`  ${c.PARAMETER_NAME}: ${c.DATA_TYPE} ${c.PARAMETER_MODE}`));
  }

  await closePool();
}

main();
