/**
 * Generic, metadata-driven CRUD resource for Oracle tables.
 *
 *   reads  -> from the resource's VIEW (joins + derived attributes)
 *   writes -> to the base TABLE (only whitelisted, introspected columns)
 *
 * Security: identifiers are never taken from user input except after an
 * exact match against the dictionary-derived whitelist; every value is a
 * bind variable.
 */
const express = require('express');
const { query, queryOne, withTransaction, oracledb } = require('../config/db');
const { describeTable } = require('./schema');
const { coerceRow, coerceValue, parsePaging } = require('./validate');
const { badRequest, notFound, forbidden } = require('../middleware/errors');
const { requireType, canWrite } = require('../middleware/auth');

/** 11g has no OFFSET/FETCH: classic ROWNUM pagination. */
function paginate(innerSql) {
  return `SELECT * FROM (SELECT q_.*, ROWNUM AS rn_ FROM (${innerSql}) q_ WHERE ROWNUM <= :max_row) WHERE rn_ > :min_row`;
}
const stripRn = (rows) => rows.map(({ rn_, ...r }) => r);

class Resource {
  /**
   * @param {object} def
   *  path, table, view, pk, autoPk, label (SQL expr over view cols),
   *  search: string[], sort: string, order: 'asc'|'desc',
   *  multi: { key: { table, fk, col } }, readOnly, writeRoles: string[],
   *  exclude: string[] (never writable), title
   */
  constructor(def) {
    this.def = { autoPk: true, order: 'asc', search: [], multi: {}, writeRoles: [], exclude: [], ...def };
  }

  async init() {
    const d = this.def;
    this.table = d.table ? await describeTable(d.table) : null;
    this.view = await describeTable(d.view || d.table);
    this.pkCol = (this.table || this.view).byName[d.pk];
    if (d.pk && !this.pkCol) throw new Error(`${d.path}: pk ${d.pk} not found`);
    this.writable = this.table
      ? this.table.columns
          .map((c) => c.name)
          .filter((n) => !(d.autoPk && n === d.pk) && !d.exclude.includes(n))
      : [];
    this.multi = {};
    for (const [key, m] of Object.entries(d.multi)) {
      this.multi[key] = { ...m, colMeta: (await describeTable(m.table)).byName[m.col] };
    }
    return this;
  }

  pkValue(raw) {
    const v = coerceValue(this.pkCol, raw);
    if (v === null || v === undefined) throw badRequest('Invalid id.');
    return v;
  }

  /* ------------------------------ reads ------------------------------ */

  /** Build WHERE from ?q= and exact-match filters on any view column. */
  buildWhere(q, extra = {}) {
    const where = [];
    const binds = {};
    let i = 0;
    const filters = { ...q, ...extra };
    for (const [key, raw] of Object.entries(filters)) {
      const col = this.view.byName[key];
      if (!col || raw === undefined || raw === '') continue;
      const values = String(raw).split(',').filter(Boolean);
      const names = values.map((v) => {
        const b = `f${i++}`;
        binds[b] = coerceValue({ ...col, enum: undefined, min: undefined, max: undefined }, v);
        return `:${b}`;
      });
      where.push(names.length === 1 ? `${col.name} = ${names[0]}` : `${col.name} IN (${names.join(', ')})`);
    }
    if (q.q && this.def.search.length) {
      binds.q = `%${String(q.q).toUpperCase().slice(0, 100)}%`;
      where.push(`(${this.def.search.map((c) => `UPPER(TO_CHAR(${c})) LIKE :q`).join(' OR ')})`);
    }
    return { clause: where.length ? `WHERE ${where.join(' AND ')}` : '', binds };
  }

  orderBy(q) {
    const sort = this.view.byName[q.sort] ? q.sort : this.def.sort || this.def.pk;
    const order = (q.order || this.def.order).toLowerCase() === 'desc' ? 'DESC' : 'ASC';
    const tie = this.def.pk && sort !== this.def.pk ? `, ${this.def.pk}` : '';
    return `ORDER BY ${sort} ${order} NULLS LAST${tie}`;
  }

  async list(q = {}, scope = {}) {
    const viewName = this.view.name;
    const { clause, binds } = this.buildWhere(q, scope);
    const { page, pageSize, minRow, maxRow } = parsePaging(q);
    const [rows, count] = await Promise.all([
      query(paginate(`SELECT * FROM ${viewName} ${clause} ${this.orderBy(q)}`), { ...binds, min_row: minRow, max_row: maxRow }),
      queryOne(`SELECT COUNT(*) AS total FROM ${viewName} ${clause}`, binds),
    ]);
    return { data: stripRn(rows), page, pageSize, total: count.total };
  }

  async get(id, conn) {
    const pk = this.pkValue(id);
    const row = await queryOne(`SELECT * FROM ${this.view.name} WHERE ${this.def.pk} = :id`, { id: pk }, conn);
    if (!row) throw notFound(`${this.def.title || this.def.path} ${id} not found`);
    for (const [key, m] of Object.entries(this.multi)) {
      const vals = await query(`SELECT ${m.col} AS v FROM ${m.table} WHERE ${m.fk} = :id ORDER BY ${m.col}`, { id: pk }, conn);
      row[key] = vals.map((x) => x.v);
    }
    return row;
  }

  async lookup() {
    const label = this.def.label || this.def.pk;
    return query(
      `SELECT ${this.def.pk} AS value, ${label} AS label FROM ${this.view.name} ORDER BY ${this.def.sort || this.def.pk}`
    );
  }

  /* ------------------------------ writes ----------------------------- */

  async replaceMulti(conn, pk, body) {
    for (const [key, m] of Object.entries(this.multi)) {
      if (body[key] === undefined) continue;
      const list = Array.isArray(body[key]) ? body[key] : String(body[key]).split(',');
      const values = [...new Set(list.map((v) => coerceValue(m.colMeta, v)).filter(Boolean))];
      await conn.execute(`DELETE FROM ${m.table} WHERE ${m.fk} = :id`, { id: pk });
      if (values.length) {
        await conn.executeMany(
          `INSERT INTO ${m.table} (${m.fk}, ${m.col}) VALUES (:id, :v)`,
          values.map((v) => ({ id: pk, v }))
        );
      }
    }
  }

  async create(body) {
    const row = coerceRow(this.table, body, { writable: this.writable, creating: true });
    if (!this.def.autoPk && (row[this.def.pk] === undefined || row[this.def.pk] === null))
      throw badRequest(`${this.def.pk} is required.`);
    const cols = Object.keys(row);
    const binds = Object.fromEntries(cols.map((c) => [`v_${c}`, row[c]]));
    binds.out_pk = { dir: oracledb.BIND_OUT, type: this.pkCol.type === 'number' ? oracledb.NUMBER : oracledb.STRING, maxSize: 200 };
    return withTransaction(async (conn) => {
      const r = await conn.execute(
        `INSERT INTO ${this.table.name} (${cols.join(', ')}) VALUES (${cols.map((c) => `:v_${c}`).join(', ')})
         RETURNING ${this.def.pk} INTO :out_pk`,
        binds
      );
      const pk = r.outBinds.out_pk[0];
      await this.replaceMulti(conn, pk, body);
      return this.get(pk, conn);
    });
  }

  async update(id, body) {
    const pk = this.pkValue(id);
    const writable = this.writable.filter((c) => c !== this.def.pk);
    const row = coerceRow(this.table, body, { writable, creating: false });
    const cols = Object.keys(row);
    const hasMulti = Object.keys(this.multi).some((k) => body[k] !== undefined);
    if (!cols.length && !hasMulti) throw badRequest('Nothing to update.');
    return withTransaction(async (conn) => {
      if (cols.length) {
        const r = await conn.execute(
          `UPDATE ${this.table.name} SET ${cols.map((c) => `${c} = :v_${c}`).join(', ')} WHERE ${this.def.pk} = :id`,
          { ...Object.fromEntries(cols.map((c) => [`v_${c}`, row[c]])), id: pk }
        );
        if (!r.rowsAffected) throw notFound();
      } else {
        await this.get(pk, conn); // 404 check
      }
      await this.replaceMulti(conn, pk, body);
      return this.get(pk, conn);
    });
  }

  async remove(id) {
    const pk = this.pkValue(id);
    return withTransaction(async (conn) => {
      const r = await conn.execute(`DELETE FROM ${this.table.name} WHERE ${this.def.pk} = :id`, { id: pk });
      if (!r.rowsAffected) throw notFound();
      return { deleted: pk };
    });
  }

  /* ------------------------------ meta ------------------------------- */

  meta(user, registry) {
    const resOf = (ref) => (ref ? registry.byTable[ref.table] : undefined);
    const fields = (this.table ? this.table.columns : [])
      .filter((c) => this.writable.includes(c.name) || c.name === this.def.pk)
      .map((c) => ({
        ...c,
        ...(c.references ? { references: { ...c.references, resource: resOf(c.references) } } : {}),
        pk: c.name === this.def.pk,
        generated: c.name === this.def.pk && this.def.autoPk,
      }));
    return {
      path: this.def.path,
      title: this.def.title,
      pk: this.def.pk,
      autoPk: this.def.autoPk,
      readOnly: !!this.def.readOnly,
      canWrite: !this.def.readOnly && canWrite(user, this.def.writeRoles),
      search: this.def.search,
      fields,
      columns: this.view.columns.map((c) => ({ name: c.name, type: c.type })),
      multi: Object.fromEntries(Object.entries(this.multi).map(([k, m]) => [k, { type: m.colMeta.type, maxLength: m.colMeta.maxLength }])),
    };
  }

  /* ------------------------------ router ----------------------------- */

  router() {
    const r = express.Router();
    const write = (req, _res, next) =>
      !this.def.readOnly && canWrite(req.user, this.def.writeRoles) ? next() : next(forbidden());

    r.use(requireType('EMPLOYEE'));
    r.get('/', async (req, res) => res.json(await this.list(req.query)));
    r.get('/:id', async (req, res) => res.json(await this.get(req.params.id)));
    if (!this.def.readOnly) {
      r.post('/', write, async (req, res) => res.status(201).json(await this.create(req.body || {})));
      r.put('/:id', write, async (req, res) => res.json(await this.update(req.params.id, req.body || {})));
      r.patch('/:id', write, async (req, res) => res.json(await this.update(req.params.id, req.body || {})));
      r.delete('/:id', write, async (req, res) => res.json(await this.remove(req.params.id)));
    }
    return r;
  }
}

module.exports = { Resource, paginate, stripRn };
