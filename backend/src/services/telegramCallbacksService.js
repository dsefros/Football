const crypto = require('crypto');
const { AppError } = require('../domain/errors');

class TelegramCallbacksService {
  constructor(repo) { this.repo = repo; }

  createToken({ action, request_id = null, response_id = null, actor_user_id = null, payload = null, ttlSec = 900 }) {
    const token = crypto.randomBytes(5).toString('base64url');
    const now = new Date();
    this.repo.create({
      token,
      action,
      request_id,
      response_id,
      actor_user_id,
      payload_json: payload ? JSON.stringify(payload) : null,
      expires_at: new Date(now.getTime() + ttlSec * 1000).toISOString(),
      created_at: now.toISOString(),
      used_at: null
    });
    return `t_${token}`;
  }

  resolveToken(callbackData, actorUserId = null) {
    const token = (callbackData || '').replace(/^t_/, '');
    if (!token) throw new AppError('NOT_FOUND', 'Callback token not found');
    const row = this.repo.get(token);
    if (!row) throw new AppError('NOT_FOUND', 'Callback token not found');
    if (row.used_at) throw new AppError('FORBIDDEN', 'Callback token already used');
    if (row.expires_at < new Date().toISOString()) throw new AppError('FORBIDDEN', 'Callback token expired');
    if (row.actor_user_id && (!actorUserId || row.actor_user_id !== actorUserId)) throw new AppError('FORBIDDEN', 'Callback token actor mismatch');
    this.repo.markUsed(token);
    return { ...row, payload: row.payload_json ? JSON.parse(row.payload_json) : null };
  }
}
module.exports = { TelegramCallbacksService };
