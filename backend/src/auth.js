const { API_AUTH_MODE } = require('./config/env');
const { AppError } = require('./domain/errors');

function resolveAuth(headers = {}) {
  if (API_AUTH_MODE === 'disabled') return { actorUserId: null, mode: API_AUTH_MODE };
  const actorUserId = headers['x-actor-user-id'];
  return { actorUserId: actorUserId ? String(actorUserId) : null, mode: API_AUTH_MODE };
}

function requireActorId(auth) {
  if (!auth || !auth.actorUserId) throw new AppError('UNAUTHORIZED', 'Authentication required');
  return auth.actorUserId;
}

module.exports = { resolveAuth, requireActorId };
