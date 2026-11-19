/**
 * /api/users -- HOMEPAGE account administration (ADMIN only).
 *
 * Every employee, civilian and company owns exactly one login (1:1, total
 * participation), so logins are created together with their owner (POST
 * /api/employees etc.) and removed when the owner is deleted. Here an admin
 * can only list them, enable/disable them and reset passwords.
 * Password hashes never leave the server.
 */
const express = require('express');
const { query, queryOne, execute } = require('../config/db');
const { requireRole } = require('../middleware/auth');
const { badRequest, notFound } = require('../middleware/errors');
const { paginate, stripRn } = require('../lib/crud');
const { parsePaging } = require('../lib/validate');
const { checkPassword, hashPassword } = require('../lib/password');

const router = express.Router();
router.use(requireRole()); // ADMIN only

router.get('/', async (req, res) => {
  const { page, pageSize, minRow, maxRow } = parsePaging(req.query);
  const binds = {};
  const where = [];
  if (req.query.user_type) { where.push('user_type = :t'); binds.t = String(req.query.user_type); }
  if (req.query.q) { where.push('(UPPER(username) LIKE :q OR UPPER(display_name) LIKE :q)'); binds.q = `%${String(req.query.q).toUpperCase()}%`; }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [rows, c] = await Promise.all([
    query(paginate(`SELECT * FROM v_homepage ${clause} ORDER BY user_type, username`), { ...binds, min_row: minRow, max_row: maxRow }),
    queryOne(`SELECT COUNT(*) AS total FROM v_homepage ${clause}`, binds),
  ]);
  res.json({ data: stripRn(rows), page, pageSize, total: c.total });
});

router.patch('/:username', async (req, res) => {
  const b = req.body || {};
  const sets = [];
  const binds = { u: req.params.username };
  if (b.is_active !== undefined) {
    if (!['Y', 'N'].includes(b.is_active)) throw badRequest('is_active must be Y or N.');
    if (req.params.username === req.user.username && b.is_active === 'N') throw badRequest('You cannot disable your own account.');
    sets.push('is_active = :a'); binds.a = b.is_active;
  }
  if (b.password) { checkPassword(b.password); sets.push('password = :p'); binds.p = await hashPassword(b.password); }
  if (!sets.length) throw badRequest('Nothing to update.');
  const r = await execute(`UPDATE homepage SET ${sets.join(', ')} WHERE username = :u`, binds);
  if (!r.rowsAffected) throw notFound('User not found');
  res.json(await queryOne(`SELECT * FROM v_homepage WHERE username = :u`, { u: req.params.username }));
});

module.exports = router;
