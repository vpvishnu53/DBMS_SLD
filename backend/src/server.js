require('dotenv').config({ quiet: true });
const { initPool, closePool } = require('./config/db');
const { buildRegistry } = require('./resources');
const { createApp } = require('./app');
const { verifyMailer, smtpHint } = require('./lib/mailer');
const { otpDelivery } = require('./lib/otp');

async function main() {
  for (const k of ['DB_USER', 'DB_PASSWORD', 'DB_CONNECT_STRING', 'JWT_SECRET']) {
    if (!process.env[k]) throw new Error(`Missing env var ${k} (see backend/.env.example)`);
  }
  await initPool();
  const registry = await buildRegistry(); // introspects the Oracle data dictionary
  const app = createApp(registry);
  const port = Number(process.env.PORT || 5000);
  const server = app.listen(port, () => {
    console.log(`SLMS API listening on http://localhost:${port}/api  (${registry.resources.length} resources)`);
    const mode = otpDelivery();
    if (mode === 'email') {
      verifyMailer()
        .then(() => console.log(`Sign-up codes: emailed from ${process.env.SMTP_USER} via ${process.env.SMTP_HOST} (SMTP login OK)`))
        .catch((e) => console.error(`Sign-up codes: SMTP login FAILED - ${e.message}
  ${smtpHint(e)}`));
    } else if (mode === 'dev') {
      console.log('Sign-up codes: DEV mode (OTP_DEV_MODE=true) - codes are printed in this terminal, no email is sent');
    } else {
      console.warn('Sign-up codes: NOT SET UP - fill SMTP_USER / SMTP_PASS in backend/.env (see README), then restart');
    }
  });

  const shutdown = async (sig) => {
    console.log(`\n${sig} received, shutting down...`);
    server.close();
    await closePool().catch(() => {});
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('Failed to start API:', err.message);
  process.exit(1);
});
