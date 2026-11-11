/**
 * JWT authentication + role-based authorisation.
 *
 * Principal shape (also the JWT payload):
 *   { username, userType: 'EMPLOYEE'|'CIVILIAN'|'COMPANY',
 *     empId?, citizenId?, licenseNo?, role?  (employee job role) }
 */
const jwt = require('jsonwebtoken');
const { HttpError, forbidden } = require('./errors');

function sign(principal) {
  return jwt.sign(principal, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '8h' });
}

function authenticate(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next(new HttpError(401, 'Authentication required'));
  try {
    const { iat, exp, ...principal } = jwt.verify(token, process.env.JWT_SECRET);
    req.user = principal;
    next();
  } catch {
    next(new HttpError(401, 'Session expired or invalid, please sign in again'));
  }
}

/** Allow only these user types (EMPLOYEE / CIVILIAN / COMPANY). */
const requireType = (...types) => (req, _res, next) =>
  types.includes(req.user?.userType) ? next() : next(forbidden());

/** Employee with one of these job roles. ADMIN is always allowed. */
function canWrite(user, roles) {
  if (!user || user.userType !== 'EMPLOYEE') return false;
  return user.role === 'ADMIN' || (roles || []).includes(user.role);
}
const requireRole = (...roles) => (req, _res, next) => (canWrite(req.user, roles) ? next() : next(forbidden()));

module.exports = { sign, authenticate, requireType, requireRole, canWrite };
