/**
 * Outgoing email (verification codes). Configure SMTP in backend/.env.
 * Without SMTP settings the API runs in DEV mode: codes are printed to the
 * API console and returned to the sign-up page so the flow can be demoed offline.
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

module.exports = { mailConfigured, sendOtpEmail };
