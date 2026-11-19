/** Login (HOMEPAGE) credential rules shared by auth, users and the CRUD layer. */
const bcrypt = require('bcryptjs');
const { badRequest } = require('../middleware/errors');

const USERNAME_RE = /^[a-z0-9_.]{3,40}$/; // mirrors CK_HOMEPAGE_USERNAME

function checkUsername(raw) {
  const u = String(raw ?? '').trim().toLowerCase();
  if (!USERNAME_RE.test(u))
    throw badRequest('Username must be 3-40 characters: lowercase letters, digits, dot or underscore.');
  return u;
}

function checkPassword(pw) {
  if (typeof pw !== 'string' || pw.length < 8 || !/[A-Za-z]/.test(pw) || !/\d/.test(pw))
    throw badRequest('Password must be at least 8 characters and include a letter and a digit.');
  return pw;
}

const hashPassword = (pw) => bcrypt.hash(pw, 10);

module.exports = { checkUsername, checkPassword, hashPassword };
