class AppError extends Error {
  constructor(code, message, fields) {
    super(message);
    this.code = code;
    this.fields = fields;
  }
}

function asErrorBody(err) {
  return { error: { code: err.code || 'VALIDATION_ERROR', message: err.message, fields: err.fields || [] } };
}

function httpStatusFromCode(code) {
  if (code === 'NOT_FOUND') return 404;
  if (code === 'UNAUTHORIZED') return 401;
  if (code === 'FORBIDDEN' || code === 'CANNOT_RESPOND_TO_OWN_REQUEST' || code === 'CONTACTS_NOT_VISIBLE') return 403;
  if (code === 'INVALID_STATUS_TRANSITION' || code === 'VALIDATION_ERROR' || code === 'REQUEST_EXPIRED' || code === 'NO_AVAILABLE_SLOTS' || code === 'DUPLICATE_RESPONSE') return 400;
  if (code === 'SERVICE_UNAVAILABLE') return 503;
  return 400;
}

module.exports = { AppError, asErrorBody, httpStatusFromCode };
