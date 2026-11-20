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
const dns = require('dns').promises;
const { queryOne, execute, oracledb } = require('../config/db');
const { HttpError, badRequest } = require('../middleware/errors');
const { mailConfigured, sendOtpEmail, smtpHint } = require('./mailer');

const TTL_MINUTES = 10;
const COOLDOWN_SECONDS = 60;
const MAX_PER_HOUR = 5;
const MAX_ATTEMPTS = 5;
// local@domain.tld: usual local-part characters, real-looking domain labels, letters-only TLD (2+)
const EMAIL_RE = /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/;
const NOW = 'CAST(SYSTIMESTAMP AS TIMESTAMP)'; // server-local, same as the column defaults

/**
 * How codes are delivered:
 *   'email' -> SMTP is configured: codes are emailed (the normal mode)
 *   'dev'   -> no SMTP but OTP_DEV_MODE=true: code printed in the API terminal only
 *   'off'   -> neither: sign-up codes cannot be sent
 * The code itself is never shown on the website.
 */
function otpDelivery() {
  if (mailConfigured()) return 'email';
  if (process.env.OTP_DEV_MODE === 'true' && process.env.NODE_ENV !== 'production') return 'dev';
  return 'off';
}

function normEmail(raw) {
  const email = String(raw ?? '').trim().toLowerCase();
  const local = email.split('@')[0] || '';
  if (!EMAIL_RE.test(email) || email.length > 120 || local.length > 64)
    throw badRequest('Enter a valid email address, like name@gmail.com.');
  return email;
}

/** The domain must publish mail servers (MX), so made-up addresses are refused. */
async function assertDomainAcceptsMail(email) {
  const domain = email.split('@')[1];
  try {
    const mx = await dns.resolveMx(domain);
    const real = mx.filter((r) => r.exchange && r.exchange !== '.'); // "0 ." = null MX: domain takes no mail
    if (!real.length) throw badRequest(`${domain} does not accept email. Check the address.`);
  } catch (err) {
    if (err instanceof HttpError) throw err;
    if (['ENOTFOUND', 'ENODATA', 'ENODOMAIN', 'ENONAME'].includes(err.code))
      throw badRequest(`${domain} does not accept email. Check the address.`);
    // DNS itself failed (offline, timeout): don't block sign-up for that
    console.warn(`[otp] MX lookup for ${domain} failed (${err.code}); allowing`);
  }
}

const hashCode = (email, code) =>
  crypto.createHmac('sha256', process.env.OTP_SECRET || process.env.JWT_SECRET).update(`${email}:${code}`).digest('hex');

async function issueOtp(rawEmail) {
  const email = normEmail(rawEmail);
  const delivery = otpDelivery();
  if (delivery === 'off')
    throw new HttpError(503, 'Sign-up emails are not set up on the server yet. Ask the administrator to add the SMTP settings.');
  await assertDomainAcceptsMail(email);

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

  if (delivery === 'dev') {
    console.log(`[otp] DEV MODE (no email sent): code for ${email} is ${code}`);
  } else {
    try {
      await sendOtpEmail(email, code, TTL_MINUTES);
    } catch (err) {
      console.error('[otp] email send failed:', err.message, smtpHint(err));
      await execute(`DELETE FROM email_otp WHERE otp_id = :id`, { id: otpId });
      throw new HttpError(502, 'Could not send the verification email right now. Check the address or try again in a minute.');
    }
  }
  return {
    email,
    expiresInMinutes: TTL_MINUTES,
    resendAfterSeconds: COOLDOWN_SECONDS,
    delivery,
    // only for the automated test in dev mode; the website never displays it
    ...(delivery === 'dev' ? { devCode: code } : {}),
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

module.exports = { issueOtp, checkOtp, consumeOtp, otpDelivery, TTL_MINUTES };
