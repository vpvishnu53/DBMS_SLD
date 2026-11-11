/**
 * Data-dictionary introspection.
 *
 * The database is the single source of truth for column types, nullability,
 * enum values (CHECK ... IN (...)), numeric ranges and foreign keys. We read
 * that once at boot so the API validates input exactly like Oracle will, and
 * so the frontend can render forms from /api/meta without duplicating rules.
 */
const { query } = require('../config/db');

function mapType(dataType) {
  if (dataType === 'NUMBER' || dataType === 'FLOAT') return 'number';
  if (dataType === 'DATE') return 'date';
  if (dataType.startsWith('TIMESTAMP')) return 'timestamp';
  return 'string';
}

/** Parse the CHECK conditions we care about into column rules. */
function parseCheck(cond, rules) {
  if (!cond) return;
  const c = cond.replace(/\s+/g, ' ').trim();

  let m = /^"?([A-Za-z0-9_]+)"? IN \((.*)\)$/i.exec(c);
  if (m) {
    const values = [...m[2].matchAll(/'([^']*)'/g)].map((x) => x[1]);
    if (values.length) (rules[m[1].toLowerCase()] ||= {}).enum = values;
    return;
  }
  m = /^"?([A-Za-z0-9_]+)"? BETWEEN (-?[\d.]+) AND (-?[\d.]+)$/i.exec(c);
  if (m) {
    Object.assign((rules[m[1].toLowerCase()] ||= {}), { min: Number(m[2]), max: Number(m[3]) });
    return;
  }
  m = /^"?([A-Za-z0-9_]+)"? (>=|>) (-?[\d.]+)$/i.exec(c);
  if (m) {
    const r = (rules[m[1].toLowerCase()] ||= {});
    r.min = Number(m[3]);
    if (m[2] === '>') r.exclusiveMin = true;
  }
}

const cache = new Map();

async function describeTable(table) {
  const key = table.toUpperCase();
  if (cache.has(key)) return cache.get(key);

  const [cols, checks, fks] = await Promise.all([
    // data_default is a LONG (unusable in expressions); default_length is its NUMBER twin
    query(
      `SELECT column_name, data_type, data_length, data_precision, data_scale, nullable,
              NVL(default_length, 0) AS has_default
         FROM user_tab_columns WHERE table_name = :t ORDER BY column_id`,
      { t: key }
    ),
    query(
      `SELECT search_condition FROM user_constraints WHERE table_name = :t AND constraint_type = 'C'`,
      { t: key }
    ),
    query(
      `SELECT a.column_name, pk.table_name AS r_table, b.column_name AS r_column
         FROM user_constraints c
         JOIN user_cons_columns a  ON a.constraint_name = c.constraint_name
         JOIN user_constraints pk  ON pk.constraint_name = c.r_constraint_name
         JOIN user_cons_columns b  ON b.constraint_name = pk.constraint_name AND b.position = a.position
        WHERE c.constraint_type = 'R' AND c.table_name = :t`,
      { t: key }
    ),
  ]);

  if (!cols.length) throw new Error(`Table/view ${key} not found in schema`);

  const rules = {};
  for (const ch of checks) parseCheck(ch.search_condition, rules);

  const refs = {};
  for (const fk of fks) refs[fk.column_name.toLowerCase()] = { table: fk.r_table, column: fk.r_column.toLowerCase() };

  const columns = cols.map((c) => {
    const name = c.column_name.toLowerCase();
    const type = mapType(c.data_type);
    return {
      name,
      type,
      dbType: c.data_type,
      required: c.nullable === 'N' && !Number(c.has_default),
      nullable: c.nullable === 'Y',
      hasDefault: !!Number(c.has_default),
      ...(type === 'string' ? { maxLength: c.data_length } : {}),
      ...(type === 'number' && c.data_scale ? { scale: c.data_scale } : {}),
      ...(rules[name] || {}),
      ...(refs[name] ? { references: refs[name] } : {}),
    };
  });

  const desc = { name: key, columns, byName: Object.fromEntries(columns.map((c) => [c.name, c])) };
  cache.set(key, desc);
  return desc;
}

module.exports = { describeTable };
