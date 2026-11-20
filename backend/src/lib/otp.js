/**
 * Email one-time codes (table EMAIL_OTP) for citizen sign-up.
 *
 *  issueOtp(email)          -> creates a 6-digit code, emails it (or DEV mode)
 *  checkOtp(email, code)    -> validates the latest unused code; a wrong guess
 *                              is counted and committed even though sign-up fails
 *  consumeOtp(conn, otpId)  -> marks the code used inside the sign-up transaction
 *
 * Only an HMAC of the code is stored. Limits: 10-minute expiry, 60 s between
 * sends, 5 sends per hour per email, 5 wrong attempts per code.
 */
const crypto = require('crypto');
const { queryOne, execute, oracledb } = require('../config/db');
const { HttpError, badRequest } = require('../middleware/errors');
const { mailConfigured, sendOtpEmail } = require('./mailer');

const TTL_MINUTES = 10;
const COOLDOWN_SECONDS = 60;
const MAX_PER_HOUR = 5;
const MAX_ATTEMPTS = 5;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const NOW = 'CAST(SYSTIMESTAMP AS TIMESTAMP)'; // server-local, same as the column defaults

function normEmail(raw) {
  const email = String(raw ?? '').trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 120) throw badRequest('Enter a valid email address.');
  return email;
}

const hashCode = (email, code) =>
  crypto.createHmac('sha256', process.env.OTP_SECRET || process.env.JWT_SECRET).update(`${email}:${code}`).digest('hex');

async function issueOtp(rawEmail) {
  const email = normEmail(rawEmail);
  const devMode = !mailConfigured();
  if (devMode && process.env.NODE_ENV === 'production')
    throw new HttpError(503, 'Email delivery is not configured on the server.');

  const taken = await queryOne(`SELECT 1 AS x FROM civilian_email WHERE LOWER(email) = :e`, { e: email });
  if (taken) throw new HttpError(409, 'An account with this email already exists. Sign in instead.');

  const recent = await queryOne(
    `SELECT COUNT(*) AS last_hour,
            ROUND((SYSDATE - CAST(MAX(created_at) AS DATE)) * 86400) AS secs_since
       FROM email_otp
      WHERE email = :e AND created_at > ${NOW} - NUMTODSINTERVAL(1, 'HOUR')`,
    { e: email }
  );
  if (recent.secs_since != null && recent.secs_since < COOLDOWN_SECONDS)
    throw new HttpError(429, `Please wait ${COOLDOWN_SECONDS - recent.secs_since} s before requesting another code.`);
  if (recent.last_hour >= MAX_PER_HOUR)
    throw new HttpError(429, 'Too many codes requested for this email. Try again in an hour.');

  const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
  const r = await execute(
    `INSERT INTO email_otp (email, code_hash, expires_at)
     VALUES (:e, :h, ${NOW} + NUMTODSINTERVAL(:ttl, 'MINUTE'))
     RETURNING otp_id INTO :id`,
    { e: email, h: hashCode(email, code), ttl: TTL_MINUTES, id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER } }
  );
  const otpId = r.outBinds.id[0];

  if (devMode) {
    console.log(`[otp] DEV MODE (no SMTP configured): code for ${email} is ${code}`);
  } else {
    try {
      await sendOtpEmail(email, code, TTL_MINUTES);
    } catch (err) {
      console.error('[otp] email send failed:', err.message);
      await execute(`DELETE FROM email_otp WHERE otp_id = :id`, { id: otpId });
      throw new HttpError(502, 'Could not send the verification email. Check the address or try again later.');
    }
  }
  return {
    email,
    expiresInMinutes: TTL_MINUTES,
    resendAfterSeconds: COOLDOWN_SECONDS,
    delivery: devMode ? 'dev' : 'email',
    ...(devMode ? { devCode: code } : {}),
  };
}

async function checkOtp(rawEmail, rawCode) {
  const email = normEmail(rawEmail);
  const code = String(rawCode ?? '').trim();
  if (!/^\d{6}$/.test(code)) throw badRequest('Enter the 6-digit code sent to your email.');

  const row = await queryOne(
    `SELECT otp_id, code_hash, attempts,
            CASE WHEN expires_at < ${NOW} THEN 1 ELSE 0 END AS expired
       FROM email_otp
      WHERE otp_id = (SELECT MAX(otp_id) FROM email_otp WHERE email = :e AND consumed_at IS NULL)`,
    { e: email }
  );
  if (!row) throw badRequest('Request a verification code for this email first.');
  if (row.expired) throw badRequest('This code has expired. Request a new one.');
  if (row.attempts >= MAX_ATTEMPTS) throw badRequest('Too many wrong attempts. Request a new code.');

  const a = Buffer.from(row.code_hash, 'hex');
  const b = Buffer.from(hashCode(email, code), 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    await execute(`UPDATE email_otp SET attempts = attempts + 1 WHERE otp_id = :id`, { id: row.otp_id }); // autocommits
    const left = MAX_ATTEMPTS - row.attempts - 1;
    throw badRequest(left > 0 ? `Wrong code. ${left} attempt${left === 1 ? '' : 's'} left.` : 'Wrong code. Request a new one.');
  }
  return { email, otpId: row.otp_id };
}

async function consumeOtp(conn, otpId) {
  const r = await conn.execute(
    `UPDATE email_otp SET consumed_at = ${NOW} WHERE otp_id = :id AND consumed_at IS NULL`,
    { id: otpId }
  );
  if (!r.rowsAffected) throw badRequest('This code was already used. Request a new one.');
}

module.exports = { issueOtp, checkOtp, consumeOtp, TTL_MINUTES };
