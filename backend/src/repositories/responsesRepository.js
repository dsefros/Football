class ResponsesRepository {
  constructor(db) { this.s = db.state; }
  create(payload) { this.s.responses.set(payload.id, payload); this.s.responsesByRequestUser.set(`${payload.request_id}:${payload.user_id}`, payload.id); return payload; }
  getById(id) { return this.s.responses.get(id) || null; }
  getByRequestAndUser(requestId, userId) { return this.getById(this.s.responsesByRequestUser.get(`${requestId}:${userId}`)); }
  listByRequest(requestId) { return [...this.s.responses.values()].filter((r) => r.request_id === requestId); }
  updateStatus(id, status, extra = {}) { const r = this.getById(id); Object.assign(r, extra, { status, updated_at: new Date().toISOString() }); return r; }
}
module.exports = { ResponsesRepository };
