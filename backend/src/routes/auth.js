/**
 * /api/auth -- login against HOMEPAGE, civilian self-registration, profile.
 */
const express = require('express');
const bcrypt = require('bcryptjs');
const { query, queryOne, execute, withTransaction, oracledb } = require('../config/db');
const { sign, authenticate } = require('../middleware/auth');
const { HttpError, badRequest } = require('../middleware/errors');
const { describeTable } = require('../lib/schema');
const { coerceRow, coerceValue } = require('../lib/validate');

const router = express.Router();
const DUMMY_HASH = bcrypt.hashSync('timing-equaliser-not-a-real-password', 10);

const USER_SQL = `
  SELECT h.username, h.password, h.user_type, h.emp_id, h.citizen_id, h.license_no, h.is_active,
         v.display_name, v.employee_role
    FROM homepage h JOIN v_homepage v ON v.username = h.username
   WHERE h.username = :u`;

function toPrincipal(u) {
  return {
    username: u.username,
    userType: u.user_type,
    displayName: u.display_name,
    ...(u.emp_id ? { empId: u.emp_id, role: u.employee_role } : {}),
    ...(u.citizen_id ? { citizenId: u.citizen_id } : {}),
    ...(u.license_no ? { licenseNo: u.license_no } : {}),
  };
}

function checkPassword(pw) {
  if (typeof pw !== 'string' || pw.length < 8 || !/[A-Za-z]/.test(pw) || !/\d/.test(pw))
    throw badRequest('Password must be at least 8 characters and include a letter and a digit.');
}

router.post('/login', async (req, res) => {
  const username = String(req.body?.username || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  if (!username || !password) throw badRequest('Username and password are required.');

  const u = await queryOne(USER_SQL, { u: username });
  // same message + still run bcrypt on miss to avoid user-enumeration via timing
  const ok = await bcrypt.compare(password, u?.password || DUMMY_HASH);
  if (!u || !ok) throw new HttpError(401, 'Invalid username or password.');
  if (u.is_active !== 'Y') throw new HttpError(403, 'This account is disabled. Contact the administrator.');

  await execute(`UPDATE homepage SET last_login_at = SYSTIMESTAMP WHERE username = :u`, { u: username });
  const user = toPrincipal(u);
  res.json({ token: sign(user), user });
});

/** Civilian self-registration: CIVILIAN + email/phone + HOMEPAGE in one transaction. */
router.post('/register', async (req, res) => {
  const b = req.body || {};
  const username = String(b.username || '').trim().toLowerCase();
  checkPassword(b.password);

  const civ = await describeTable('CIVILIAN');
  const row = coerceRow(civ, b, {
    writable: ['first_name', 'middle_name', 'last_name', 'street', 'city', 'state', 'pincode'],
    creating: true,
  });
  const email = b.email ? coerceValue((await describeTable('CIVILIAN_EMAIL')).byName.email, b.email) : null;
  const phone = b.phone ? coerceValue((await describeTable('CIVILIAN_PHONE')).byName.phone_number, b.phone) : null;
  const hash = await bcrypt.hash(b.password, 10);

  const user = await withTransaction(async (conn) => {
    const cols = Object.keys(row);
    const r = await conn.execute(
      `INSERT INTO civilian (${cols.join(', ')}) VALUES (${cols.map((c) => `:${c}_v`).join(', ')})
       RETURNING citizen_id INTO :id`,
      { ...Object.fromEntries(cols.map((c) => [`${c}_v`, row[c]])), id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER } }
    );
    const id = r.outBinds.id[0];
    if (email) await conn.execute(`INSERT INTO civilian_email VALUES (:id, :e)`, { id, e: email });
    if (phone) await conn.execute(`INSERT INTO civilian_phone VALUES (:id, :p)`, { id, p: phone });
    await conn.execute(
      `INSERT INTO homepage (username, password, user_type, citizen_id) VALUES (:u, :p, 'CIVILIAN', :id)`,
      { u: username, p: hash, id }
    );
    return toPrincipal(await queryOne(USER_SQL, { u: username }, conn));
  });
  res.status(201).json({ token: sign(user), user });
});

router.get('/me', authenticate, async (req, res) => {
  const [profile] = await query(`SELECT * FROM v_homepage WHERE username = :u`, { u: req.user.username });
  res.json({ user: req.user, account: profile });
});

router.post('/change-password', authenticate, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  checkPassword(newPassword);
  const u = await queryOne(`SELECT password FROM homepage WHERE username = :u`, { u: req.user.username });
  if (!u || !(await bcrypt.compare(String(currentPassword || ''), u.password)))
    throw badRequest('Current password is incorrect.');
  await execute(`UPDATE homepage SET password = :p WHERE username = :u`, {
    p: await bcrypt.hash(newPassword, 10), u: req.user.username,
  });
  res.json({ ok: true });
});

module.exports = { router, checkPassword };
