class CallbackTokensRepository {
  constructor(db) { this.s = db.state; }
  create(row) { this.s.callbackTokens.set(row.token, row); return row; }
  get(token) { return this.s.callbackTokens.get(token) || null; }
  markUsed(token) { const row = this.get(token); if (row) row.used_at = new Date().toISOString(); }
}
module.exports = { CallbackTokensRepository };
