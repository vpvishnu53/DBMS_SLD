/**
 * Oracle data-access layer.
 *
 * WHY THICK MODE: the local DB is Oracle XE 11.2. node-oracledb's pure-JS
 * "Thin" mode only speaks to Oracle 12.1+, so we load the OCI client
 * libraries that ship with XE itself (server\bin\oci.dll, 64-bit).
 * node-oracledb is pinned to 6.x: 26.x+ refuses 11.2 client libraries.
 *
 * DATES: every session uses ISO NLS formats and DATE/TIMESTAMP values are
 * fetched as strings. That avoids JS Date timezone shifts entirely:
 *   DATE      <-> 'YYYY-MM-DD'
 *   TIMESTAMP <-> 'YYYY-MM-DD"T"HH24:MI:SS'
 */
const oracledb = require('oracledb');

let pool;
let thickInitialised = false;

function initThick() {
  if (thickInitialised) return;
  const libDir = process.env.ORACLE_CLIENT_LIB_DIR;
  oracledb.initOracleClient(libDir ? { libDir } : undefined);
  thickInitialised = true;
}

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
oracledb.fetchAsString = [oracledb.DATE, oracledb.CLOB];
oracledb.autoCommit = false; // commit explicitly; see execute()/withTransaction()

const SESSION_SETUP = `BEGIN
  EXECUTE IMMEDIATE q'[ALTER SESSION SET NLS_DATE_FORMAT = 'YYYY-MM-DD']';
  EXECUTE IMMEDIATE q'[ALTER SESSION SET NLS_TIMESTAMP_FORMAT = 'YYYY-MM-DD"T"HH24:MI:SS']';
  EXECUTE IMMEDIATE q'[ALTER SESSION SET NLS_TIMESTAMP_TZ_FORMAT = 'YYYY-MM-DD"T"HH24:MI:SS TZH:TZM']';
  EXECUTE IMMEDIATE q'[ALTER SESSION SET NLS_NUMERIC_CHARACTERS = '.,']';
END;`;

async function initPool() {
  if (pool) return pool;
  initThick();
  pool = await oracledb.createPool({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    connectString: process.env.DB_CONNECT_STRING,
    poolMin: 1,
    poolMax: Number(process.env.DB_POOL_MAX || 8),
    poolIncrement: 1,
    poolTimeout: 60,
    // runs once per new physical session (not on every checkout)
    sessionCallback: (conn, _tag, cb) => conn.execute(SESSION_SETUP).then(() => cb(), cb),
  });
  return pool;
}

async function closePool() {
  if (pool) {
    await pool.close(5);
    pool = undefined;
  }
}

/** Oracle returns UPPERCASE column names; the API speaks lowercase snake_case. */
function lowerKeys(row) {
  const out = {};
  for (const k of Object.keys(row)) out[k.toLowerCase()] = row[k];
  return out;
}

async function withConnection(fn) {
  const conn = await (await initPool()).getConnection();
  try {
    return await fn(conn);
  } finally {
    await conn.close();
  }
}

/** Run fn(conn) inside one transaction; commit on success, roll back on any throw. */
async function withTransaction(fn) {
  return withConnection(async (conn) => {
    try {
      const result = await fn(conn);
      await conn.commit();
      return result;
    } catch (err) {
      await conn.rollback().catch(() => {});
      throw err;
    }
  });
}

/** SELECT helper -> array of lowercase-keyed rows. Pass `conn` to reuse a transaction. */
async function query(sql, binds = {}, conn) {
  const run = async (c) => {
    const r = await c.execute(sql, binds);
    return (r.rows || []).map(lowerKeys);
  };
  return conn ? run(conn) : withConnection(run);
}

async function queryOne(sql, binds = {}, conn) {
  const rows = await query(sql, binds, conn);
  return rows[0] || null;
}

/** DML/PLSQL helper. Auto-commits when not given a connection. */
async function execute(sql, binds = {}, conn) {
  if (conn) return conn.execute(sql, binds);
  return withConnection((c) => c.execute(sql, binds, { autoCommit: true }));
}

module.exports = {
  oracledb, initPool, closePool, query, queryOne, execute, withTransaction, withConnection, lowerKeys,
};
