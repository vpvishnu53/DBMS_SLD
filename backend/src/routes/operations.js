/**
 * Workflow endpoints that go beyond plain CRUD. These call the PL/SQL
 * procedures / rely on triggers defined in database/02_logic.sql.
 * Mounted under /api before the generic resource routers.
 */
const express = require('express');
const { query, queryOne, execute, withTransaction, oracledb } = require('../config/db');
const { requireType, requireRole } = require('../middleware/auth');
const { badRequest, notFound } = require('../middleware/errors');

const router = express.Router();
router.use(requireType('EMPLOYEE'));

const OPS = ['ZONE_SUPERVISOR', 'ENGINEER', 'TECHNICIAN'];
const int = (v, name) => {
  const n = Number(v);
  if (!Number.isInteger(n)) throw badRequest(`${name} must be an integer.`);
  return n;
};

/* ---------- complaint -> work order (sp_complaint_to_work_order) ---------- */
router.post('/complaints/:id/work-order', requireRole('SUPPORT_AGENT', 'ZONE_SUPERVISOR', 'ENGINEER'), async (req, res) => {
  const b = req.body || {};
  const r = await execute(
    `BEGIN sp_complaint_to_work_order(:cid, :emp, :lic, :wt, :wo); END;`,
    {
      cid: int(req.params.id, 'complaint id'),
      emp: b.emp_id ? int(b.emp_id, 'emp_id') : null,
      lic: b.license_no || null,
      wt: b.work_type || 'REPAIR',
      wo: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
    }
  );
  const wo = await queryOne(`SELECT * FROM v_work_order WHERE work_order_id = :id`, { id: r.outBinds.wo });
  res.status(201).json(wo);
});

/* ---------- work order parts (M:N "uses"; trigger maintains stock) ---------- */
async function assertEditable(conn, woId) {
  const wo = await queryOne(`SELECT status FROM work_order WHERE work_order_id = :id`, { id: woId }, conn);
  if (!wo) throw notFound(`Work order ${woId} not found`);
  if (['COMPLETED', 'CANCELLED'].includes(wo.status))
    throw badRequest(`Work order is ${wo.status}; parts can no longer be changed.`);
}

router.get('/work-orders/:id/parts', async (req, res) => {
  res.json(await query(`SELECT * FROM v_work_order_part WHERE work_order_id = :id ORDER BY part_name`, { id: int(req.params.id, 'id') }));
});

router.post('/work-orders/:id/parts', requireRole(...OPS), async (req, res) => {
  const woId = int(req.params.id, 'id');
  const partId = int(req.body?.part_id, 'part_id');
  const qty = int(req.body?.quantity_used, 'quantity_used');
  await withTransaction(async (conn) => {
    await assertEditable(conn, woId);
    await conn.execute(`INSERT INTO work_order_part VALUES (:w, :p, :q)`, { w: woId, p: partId, q: qty });
  });
  res.status(201).json(await query(`SELECT * FROM v_work_order_part WHERE work_order_id = :id ORDER BY part_name`, { id: woId }));
});

router.put('/work-orders/:id/parts/:partId', requireRole(...OPS), async (req, res) => {
  const woId = int(req.params.id, 'id');
  await withTransaction(async (conn) => {
    await assertEditable(conn, woId);
    const r = await conn.execute(
      `UPDATE work_order_part SET quantity_used = :q WHERE work_order_id = :w AND part_id = :p`,
      { q: int(req.body?.quantity_used, 'quantity_used'), w: woId, p: int(req.params.partId, 'partId') }
    );
    if (!r.rowsAffected) throw notFound('Part not on this work order');
  });
  res.json(await query(`SELECT * FROM v_work_order_part WHERE work_order_id = :id ORDER BY part_name`, { id: woId }));
});

router.delete('/work-orders/:id/parts/:partId', requireRole(...OPS), async (req, res) => {
  const woId = int(req.params.id, 'id');
  await withTransaction(async (conn) => {
    await assertEditable(conn, woId);
    const r = await conn.execute(`DELETE FROM work_order_part WHERE work_order_id = :w AND part_id = :p`,
      { w: woId, p: int(req.params.partId, 'partId') });
    if (!r.rowsAffected) throw notFound('Part not on this work order');
  });
  res.json(await query(`SELECT * FROM v_work_order_part WHERE work_order_id = :id ORDER BY part_name`, { id: woId }));
});

/* ---------- streetlight drill-downs ---------- */
const DRILL = {
  'energy-logs': `SELECT * FROM v_energy_log WHERE pole_id = :id ORDER BY log_number DESC`,
  sensors: `SELECT * FROM v_sensor WHERE pole_id = :id ORDER BY sensor_id`,
  complaints: `SELECT * FROM v_complaint WHERE pole_id = :id ORDER BY reported_timestamp DESC`,
  'work-orders': `SELECT * FROM v_work_order WHERE pole_id = :id ORDER BY created_timestamp DESC`,
};
router.get('/streetlights/:id/:child', async (req, res, next) => {
  const sql = DRILL[req.params.child];
  if (!sql) return next();
  res.json(await query(sql, { id: int(req.params.id, 'id') }));
});

/* ---------- energy logs (weak entity; sp_record_energy allocates log_number) ---------- */
router.post('/energy-logs', requireRole(...OPS), async (req, res) => {
  const b = req.body || {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(b.reading_date || ''))) throw badRequest('reading_date must be YYYY-MM-DD.');
  const units = Number(b.units_consumed);
  if (!(units >= 0)) throw badRequest('units_consumed must be >= 0.');
  const tariff = b.tariff_inr === undefined || b.tariff_inr === '' ? 7.5 : Number(b.tariff_inr);
  if (!(tariff >= 0)) throw badRequest('tariff_inr must be >= 0.');
  const poleId = int(b.pole_id, 'pole_id');
  const r = await execute(
    `BEGIN sp_record_energy(:pole, TO_DATE(:d, 'YYYY-MM-DD'), :u, :t, :log); END;`,
    { pole: poleId, d: b.reading_date, u: units, t: tariff, log: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER } }
  );
  res.status(201).json(await queryOne(`SELECT * FROM v_energy_log WHERE pole_id = :p AND log_number = :l`, { p: poleId, l: r.outBinds.log }));
});

router.delete('/energy-logs/:poleId/:logNumber', requireRole(...OPS), async (req, res) => {
  const r = await execute(`DELETE FROM energy_log WHERE pole_id = :p AND log_number = :l`,
    { p: int(req.params.poleId, 'poleId'), l: int(req.params.logNumber, 'logNumber') });
  if (!r.rowsAffected) throw notFound('Energy log not found');
  res.json({ deleted: true });
});

module.exports = router;
