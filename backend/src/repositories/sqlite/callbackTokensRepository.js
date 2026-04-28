class CallbackTokensRepository {
  constructor(db) { this.db = db.sqlite; }

  create(row) {
    this.db.prepare(`
      INSERT INTO telegram_callback_tokens (
        token, action, request_id, response_id, actor_user_id, payload_json, expires_at, created_at, used_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      row.token, row.action, row.request_id, row.response_id, row.actor_user_id,
      row.payload_json, row.expires_at, row.created_at, row.used_at
    );
    return this.get(row.token);
  }

  get(token) {
    return this.db.prepare('SELECT * FROM telegram_callback_tokens WHERE token = ?').get(token) || null;
  }

  markUsed(token) {
    this.db.prepare('UPDATE telegram_callback_tokens SET used_at = ? WHERE token = ?').run(new Date().toISOString(), token);
  }
}

module.exports = { CallbackTokensRepository };
