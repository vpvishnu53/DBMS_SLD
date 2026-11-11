/**
 * /api/portal -- self-service for CIVILIAN and COMPANY accounts.
 * Every query is scoped to the caller's own id taken from the JWT, never from input.
 */
const express = require('express');
const { query, queryOne, execute, withTransaction, oracledb } = require('../config/db');
const { requireType } = require('../middleware/auth');
const { badRequest, notFound } = require('../middleware/errors');
const { describeTable } = require('../lib/schema');
const { coerceValue } = require('../lib/validate');

const router = express.Router();

/* ------------------------------ shared ------------------------------ */
router.get('/zones', async (_req, res) => {
  res.json(await query(`SELECT zone_id, zone_name, city_region, total_lights, faulty_lights FROM v_zone ORDER BY zone_name`));
});

router.get('/streetlights', async (req, res) => {
  const zone = Number(req.query.zone_id);
  if (!Number.isInteger(zone)) throw badRequest('zone_id is required.');
  res.json(await query(
    `SELECT pole_id, zone_name, lamp_type, current_status, latitude, longitude, open_complaints
       FROM v_streetlight WHERE zone_id = :z AND current_status <> 'DECOMMISSIONED' ORDER BY pole_id`,
    { z: zone }
  ));
});

/* ------------------------------ civilian ------------------------------ */
const civ = express.Router();
civ.use(requireType('CIVILIAN'));

civ.get('/profile', async (req, res) => {
  res.json(await queryOne(`SELECT * FROM v_civilian WHERE citizen_id = :id`, { id: req.user.citizenId }));
});

civ.get('/complaints', async (req, res) => {
  res.json(await query(
    `SELECT c.*, w.status AS work_order_status, w.resolution_notes, w.completion_timestamp
       FROM v_complaint c LEFT JOIN work_order w ON w.work_order_id = c.latest_work_order_id
      WHERE c.citizen_id = :id ORDER BY c.reported_timestamp DESC`,
    { id: req.user.citizenId }
  ));
});

civ.get('/complaint-options', async (_req, res) => {
  res.json({ categories: (await describeTable('COMPLAINT')).byName.issue_category.enum });
});

civ.post('/complaints', async (req, res) => {
  const t = await describeTable('COMPLAINT');
  const b = req.body || {};
  const category = coerceValue(t.byName.issue_category, b.issue_category);
  const description = coerceValue(t.byName.description, b.description);
  const pole = Number(b.pole_id);
  if (!category || !description || !Number.isInteger(pole)) throw badRequest('pole_id, issue_category and description are required.');
  if (description.length < 10) throw badRequest('Please describe the problem in at least 10 characters.');

  const out = await withTransaction(async (conn) => {
    const light = await queryOne(`SELECT current_status FROM streetlight WHERE pole_id = :p`, { p: pole }, conn);
    if (!light) throw notFound(`Streetlight ${pole} not found`);
    if (light.current_status === 'DECOMMISSIONED') throw badRequest('That streetlight has been decommissioned.');
    const dup = await queryOne(
      `SELECT complaint_id FROM complaint WHERE citizen_id = :c AND pole_id = :p AND ticket_status IN ('OPEN','ASSIGNED','IN_PROGRESS')`,
      { c: req.user.citizenId, p: pole }, conn
    );
    if (dup) throw badRequest(`You already have an open complaint (#${dup.complaint_id}) for this pole.`);
    const r = await conn.execute(
      `INSERT INTO complaint (issue_category, description, citizen_id, pole_id) VALUES (:cat, :d, :c, :p)
       RETURNING complaint_id INTO :id`,
      { cat: category, d: description, c: req.user.citizenId, p: pole, id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER } }
    );
    return r.outBinds.id[0];
  });
  res.status(201).json(await queryOne(`SELECT * FROM v_complaint WHERE complaint_id = :id`, { id: out }));
});

/* ------------------------------ company ------------------------------ */
const comp = express.Router();
comp.use(requireType('COMPANY'));

comp.get('/profile', async (req, res) => {
  res.json(await queryOne(`SELECT * FROM v_company WHERE license_no = :l`, { l: req.user.licenseNo }));
});

comp.get('/work-orders', async (req, res) => {
  res.json(await query(`SELECT * FROM v_work_order WHERE license_no = :l ORDER BY created_timestamp DESC`, { l: req.user.licenseNo }));
});

comp.get('/work-orders/:id/parts', async (req, res) => {
  const wo = await queryOne(`SELECT 1 AS ok FROM work_order WHERE work_order_id = :id AND license_no = :l`,
    { id: Number(req.params.id), l: req.user.licenseNo });
  if (!wo) throw notFound('Work order not found');
  res.json(await query(`SELECT * FROM v_work_order_part WHERE work_order_id = :id`, { id: Number(req.params.id) }));
});

/** Contractors may only move their own jobs forward: ASSIGNED -> IN_PROGRESS -> COMPLETED. */
const NEXT = { PENDING: ['IN_PROGRESS'], ASSIGNED: ['IN_PROGRESS'], IN_PROGRESS: ['COMPLETED'] };
comp.patch('/work-orders/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { status, resolution_notes: notes } = req.body || {};
  const wo = await queryOne(`SELECT status FROM work_order WHERE work_order_id = :id AND license_no = :l`, { id, l: req.user.licenseNo });
  if (!wo) throw notFound('Work order not found');
  if (status && !(NEXT[wo.status] || []).includes(status))
    throw badRequest(`Cannot move a ${wo.status} work order to ${status}.`);
  if (status === 'COMPLETED' && !(notes || '').trim()) throw badRequest('Resolution notes are required to complete a job.');
  await execute(
    `UPDATE work_order SET status = NVL(:s, status), resolution_notes = NVL(:n, resolution_notes)
      WHERE work_order_id = :id AND license_no = :l`,
    { s: status || null, n: notes ? String(notes).slice(0, 1000) : null, id, l: req.user.licenseNo }
  );
  res.json(await queryOne(`SELECT * FROM v_work_order WHERE work_order_id = :id`, { id }));
});

comp.get('/billing', async (req, res) => {
  res.json(await query(`SELECT * FROM v_billing WHERE license_no = :l ORDER BY billing_id DESC`, { l: req.user.licenseNo }));
});

router.use('/citizen', civ);
router.use('/company', comp);

module.exports = router;
