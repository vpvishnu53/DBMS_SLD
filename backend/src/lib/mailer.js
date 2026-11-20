/**
 * Outgoing email (sign-up verification codes). Configure SMTP in backend/.env
 * (SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, MAIL_FROM).
 * Check the settings with:  npm run mail:test -- you@example.com
 */
const nodemailer = require('nodemailer');

const mailConfigured = () => !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

let transport;
function getTransport() {
  transport ||= nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 465),
    secure: (process.env.SMTP_SECURE || 'true') !== 'false', // true for 465, false for 587 (STARTTLS)
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  return transport;
}

async function sendOtpEmail(to, code, minutes) {
  const from = process.env.MAIL_FROM || `Lumina <${process.env.SMTP_USER}>`;
  await getTransport().sendMail({
    from,
    to,
    subject: `${code} is your Lumina verification code`,
    text: `Your Lumina verification code is ${code}.\n\nIt expires in ${minutes} minutes. If you did not try to create an account, ignore this email.`,
    html: `
      <div style="font-family:Segoe UI,Arial,sans-serif;background:#09090b;color:#f6f3f8;padding:28px;border-radius:12px;max-width:440px">
        <div style="font-size:18px;font-weight:800">Lumina <span style="color:#ff4fa3">·</span> Streetlight Management</div>
        <p style="color:#bdb6c7">Use this code to verify your email and finish creating your citizen account:</p>
        <div style="font-size:34px;font-weight:800;letter-spacing:8px;color:#ff4fa3;margin:18px 0">${code}</div>
        <p style="color:#847d90;font-size:13px">It expires in ${minutes} minutes. If you did not request this, you can ignore this email.</p>
      </div>`,
  });
}

/** Log in to the SMTP server without sending anything (throws on bad settings). */
const verifyMailer = () => getTransport().verify();

/** Turn common SMTP failures into a hint a person can act on. */
function smtpHint(err) {
  const m = `${err.code || ''} ${err.responseCode || ''} ${err.message || ''}`;
  if (/535|EAUTH|Username and Password not accepted|BadCredentials/i.test(m))
    return 'Login rejected. For Gmail you need 2-Step Verification ON and a 16-character App Password in SMTP_PASS (not your normal password).';
  if (/ETIMEDOUT|ECONNREFUSED|ENOTFOUND|ESOCKET|ECONNECTION/i.test(m))
    return 'Could not reach the SMTP server. Check SMTP_HOST/SMTP_PORT/SMTP_SECURE and your internet connection (465 = SECURE true, 587 = SECURE false).';
  return '';
}

module.exports = { mailConfigured, sendOtpEmail, verifyMailer, smtpHint };
