class RequestsRepository {
  constructor(db) { this.s = db.state; }
  create(payload) { const p = { ...payload, is_listed: !!payload.is_listed }; this.s.requests.set(p.id, p); this.s.requestsByToken.set(p.share_token, p.id); return p; }
  updateDraft(id, patch) { const req = this.getById(id); Object.assign(req, patch, { updated_at: new Date().toISOString() }); return req; }
  updateStatus(id, status, extra = {}) { const req = this.getById(id); Object.assign(req, extra, { status, updated_at: new Date().toISOString() }); return req; }
  updateAcceptedCount(id, accepted_players_count, status) { const req = this.getById(id); req.accepted_players_count = accepted_players_count; req.status = status; req.updated_at = new Date().toISOString(); return req; }
  getById(id) { return this.s.requests.get(id) || null; }
  getByToken(token) { return this.getById(this.s.requestsByToken.get(token)); }
  getActive(filters = {}) {
    return [...this.s.requests.values()].filter((r) => r.is_listed && ['PUBLISHED', 'HAS_RESPONSES', 'PARTIALLY_FILLED', 'FILLED'].includes(r.status) && r.expires_at > new Date().toISOString())
      .filter((r) => !filters.tracker_type || r.tracker_type === filters.tracker_type)
      .filter((r) => !filters.game_type || r.game_type === filters.game_type)
      .filter((r) => !filters.zone || r.zone === filters.zone)
      .filter((r) => !filters.level || r.level === filters.level)
      .filter((r) => !filters.district || (r.districts_json || []).includes(filters.district))
      .filter((r) => !filters.format || (r.formats_json || []).includes(filters.format));
  }
  getByAuthor(userId) { return [...this.s.requests.values()].filter((r) => r.author_user_id === userId); }
  all() { return [...this.s.requests.values()]; }
}
module.exports = { RequestsRepository };
