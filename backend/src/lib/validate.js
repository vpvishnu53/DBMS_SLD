/**
 * Input coercion/validation driven by introspected column metadata.
 * Produces values that bind cleanly given the session NLS formats
 * set in config/db.js ('YYYY-MM-DD' / 'YYYY-MM-DD"T"HH24:MI:SS').
 */
const { badRequest } = require('../middleware/errors');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TS_RE = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})(:\d{2})?/;

function coerceValue(col, raw) {
  if (raw === undefined) return undefined;
  if (raw === null || raw === '') return null;

  switch (col.type) {
    case 'number': {
      const n = typeof raw === 'number' ? raw : Number(String(raw).trim());
      if (!Number.isFinite(n)) throw badRequest(`${col.name} must be a number.`);
      if (col.min !== undefined && (col.exclusiveMin ? n <= col.min : n < col.min))
        throw badRequest(`${col.name} must be ${col.exclusiveMin ? '>' : '>='} ${col.min}.`);
      if (col.max !== undefined && n > col.max) throw badRequest(`${col.name} must be <= ${col.max}.`);
      return n;
    }
    case 'date': {
      const s = String(raw).trim().slice(0, 10);
      if (!DATE_RE.test(s) || Number.isNaN(Date.parse(s))) throw badRequest(`${col.name} must be a date (YYYY-MM-DD).`);
      return s;
    }
    case 'timestamp': {
      const m = TS_RE.exec(String(raw).trim());
      if (!m) throw badRequest(`${col.name} must be a date-time (YYYY-MM-DDTHH:MM).`);
      return `${m[1]}T${m[2]}${m[3] || ':00'}`;
    }
    default: {
      const s = String(raw).trim();
      if (col.enum && !col.enum.includes(s))
        throw badRequest(`${col.name} must be one of: ${col.enum.join(', ')}.`);
      if (col.maxLength && Buffer.byteLength(s, 'utf8') > col.maxLength)
        throw badRequest(`${col.name} must be at most ${col.maxLength} characters.`);
      return s;
    }
  }
}

/**
 * Build a {column: value} map from a request body.
 * @param {object} table   describeTable() result
 * @param {object} body    request body
 * @param {object} opts    { writable: string[], creating: boolean }
 */
function coerceRow(table, body, { writable, creating }) {
  const out = {};
  for (const name of writable) {
    const col = table.byName[name];
    const v = coerceValue(col, body[name]);
    if (v !== undefined) out[name] = v;
  }
  if (creating) {
    const missing = writable.filter((n) => table.byName[n].required && (out[n] === undefined || out[n] === null));
    if (missing.length) throw badRequest(`Missing required field(s): ${missing.join(', ')}.`, { missing });
  } else {
    const nulled = Object.keys(out).filter((n) => out[n] === null && !table.byName[n].nullable);
    if (nulled.length) throw badRequest(`Field(s) cannot be empty: ${nulled.join(', ')}.`);
  }
  return out;
}

function parsePaging(q) {
  const page = Math.max(1, parseInt(q.page, 10) || 1);
  const pageSize = Math.min(500, Math.max(1, parseInt(q.pageSize, 10) || 25));
  return { page, pageSize, minRow: (page - 1) * pageSize, maxRow: page * pageSize };
}

module.exports = { coerceValue, coerceRow, parsePaging };
