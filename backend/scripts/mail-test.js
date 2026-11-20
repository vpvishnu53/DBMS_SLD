// Check the SMTP settings in backend/.env.
//   npm run mail:test                    -> just log in to the SMTP server
//   npm run mail:test -- you@gmail.com   -> log in and send a sample code email
require('dotenv').config({ quiet: true, path: require('path').join(__dirname, '..', '.env') });
const { mailConfigured, verifyMailer, sendOtpEmail, smtpHint } = require('../src/lib/mailer');

(async () => {
  if (!mailConfigured()) {
    console.error('SMTP is not set up: fill SMTP_HOST, SMTP_USER and SMTP_PASS in backend/.env (see README).');
    process.exit(1);
  }
  const to = process.argv[2];
  try {
    await verifyMailer();
    console.log(`SMTP login OK (${process.env.SMTP_USER} via ${process.env.SMTP_HOST}:${process.env.SMTP_PORT || 465}).`);
    if (to) {
      await sendOtpEmail(to, '123456', 10);
      console.log(`Sample code email sent to ${to}. Check the inbox (and spam).`);
    }
  } catch (err) {
    console.error('SMTP check failed:', err.message);
    const hint = smtpHint(err);
    if (hint) console.error('Hint:', hint);
    process.exit(1);
  }
})();
