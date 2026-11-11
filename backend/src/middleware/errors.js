/**
 * Central error handling. Oracle errors are translated into meaningful
 * HTTP responses so the UI can show something better than "500".
 */
class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

const badRequest = (msg, details) => new HttpError(400, msg, details);
const notFound = (msg = 'Not found') => new HttpError(404, msg);
const forbidden = (msg = 'You do not have permission to do that') => new HttpError(403, msg);

/** Pull "SLMS.CONSTRAINT_NAME" out of an ORA message. */
function constraintOf(message) {
  const m = /\(([A-Z0-9_$#]+)\.([A-Z0-9_$#]+)\)/.exec(message || '');
  return m ? m[2] : undefined;
}

/** Human-friendly names for constraints users actually trip over. */
const CONSTRAINT_MESSAGES = {
  UQ_EMPLOYEE_AADHAR: 'An employee with this Aadhaar number already exists.',
  UQ_EMPLOYEE_EMAIL: 'That email is already used by another employee.',
  UQ_CIVILIAN_EMAIL: 'That email is already registered.',
  UQ_COMPANY_GST: 'A company with this GST number already exists.',
  PK_COMPANY: 'A company with this licence number already exists.',
  PK_HOMEPAGE: 'That username is taken.',
  UQ_HOMEPAGE_EMP: 'This employee already has a login.',
  UQ_HOMEPAGE_CIV: 'This citizen already has a login.',
  UQ_HOMEPAGE_COMP: 'This company already has a login.',
  UQ_BILLING_WO: 'This work order has already been billed.',
  UQ_BILLING_RECEIPT: 'Receipt number already used.',
  UQ_ZONE_NAME: 'A zone with this name already exists.',
  UQ_DEPARTMENT_NAME: 'A department with this name already exists.',
  UQ_SPARE_PARTS_NAME: 'A part with this name already exists.',
  PK_WORK_ORDER_PART: 'That part is already on this work order; edit its quantity instead.',
  CK_EMPLOYEE_AADHAR: 'Aadhaar must be 12 digits and cannot start with 0 or 1.',
  CK_COMPANY_GST: 'GST number format is invalid (e.g. 29AABCL4571K1Z3).',
  CK_HOMEPAGE_USERNAME: 'Username must be 3-40 chars: lowercase letters, digits, dot or underscore.',
  CK_WO_COMPLETION: 'Completion time cannot be before creation time.',
  CK_LIGHT_SERVICE: 'Last serviced date cannot be before installation date.',
  CK_EMPLOYEE_DATES: 'Date of joining must be after date of birth.',
};

function mapOracleError(err) {
  const code = err.errorNum;
  const c = constraintOf(err.message);
  const friendly = c && CONSTRAINT_MESSAGES[c];
  switch (code) {
    case 1: // unique
      return new HttpError(409, friendly || `Duplicate value (${c}).`, { constraint: c });
    case 1400: { // NOT NULL
      const col = /\."([A-Z0-9_]+)"\)/.exec(err.message);
      return badRequest(`${col ? col[1].toLowerCase() : 'A required field'} is required.`);
    }
    case 2290: // check
      return badRequest(friendly || `Value violates rule ${c}.`, { constraint: c });
    case 2291: // parent key not found
      return badRequest(`Referenced record does not exist (${c}).`, { constraint: c });
    case 2292: // child record found
      return new HttpError(409, 'This record is still referenced by other records and cannot be deleted.', { constraint: c });
    case 1438: case 12899:
      return badRequest('A value is too large for its field.');
    case 1840: case 1841: case 1843: case 1847: case 1858: case 1861:
      return badRequest('Invalid date/time value.');
    case 1722:
      return badRequest('Invalid number.');
    default:
      // ORA-20000..20999: our own RAISE_APPLICATION_ERROR business rules
      if (code >= 20000 && code <= 20999) {
        const msg = (err.message.split('\n')[0] || '').replace(/^ORA-\d+:\s*/, '');
        return badRequest(msg);
      }
      return null;
  }
}

function notFoundHandler(req, res) {
  res.status(404).json({ error: `No route for ${req.method} ${req.originalUrl}` });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, _next) {
  let e = err;
  if (!(e instanceof HttpError) && e && typeof e.errorNum === 'number') e = mapOracleError(e) || e;
  if (e && e.type === 'entity.parse.failed') e = badRequest('Malformed JSON body.');

  const status = e instanceof HttpError ? e.status : 500;
  if (status >= 500) console.error('[error]', err);
  res.status(status).json({
    error: status >= 500 ? 'Internal server error' : e.message,
    ...(e.details ? { details: e.details } : {}),
  });
}

module.exports = { HttpError, badRequest, notFound, forbidden, errorHandler, notFoundHandler };
