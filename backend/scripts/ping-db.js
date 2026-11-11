// Quick connectivity check: `npm run db:ping`
require('dotenv').config({ quiet: true });
const { initPool, query, closePool } = require('../src/config/db');

(async () => {
  try {
    await initPool();
    const rows = await query(
      `SELECT user AS who, (SELECT banner FROM v$version WHERE ROWNUM = 1) AS banner FROM dual`
    );
    console.log('OK ->', rows[0]);
  } catch (e) {
    console.error('DB ping failed:', e.message);
    process.exitCode = 1;
  } finally {
    await closePool();
  }
})();
