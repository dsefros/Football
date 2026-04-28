const { toDbBool, fromDbBool, toJson, fromJson } = require('./utils');

function mapRequest(row) {
  if (!row) return null;
  return {
    ...row,
    is_listed: fromDbBool(row.is_listed),
    districts_json: fromJson(row.districts_json, []),
    formats_json: fromJson(row.formats_json, []),
    positions_json: fromJson(row.positions_json, null),
    positions_needed_json: fromJson(row.positions_needed_json, null),
    expires_at: row.expires_at || null,
    location_mode: row.location_mode || null,
    level: row.level || null,
    payment_type: row.payment_type || null
  };
}

class RequestsRepository {
  constructor(db) { this.db = db.sqlite; }

  create(payload) {
    this.db.prepare(`
      INSERT INTO requests (
        id, public_slug, share_token, tracker_type, game_type, author_user_id, status, is_listed, source,
        players_count, players_needed_count, accepted_players_count, event_datetime, event_datetime_from,
        event_datetime_to, expires_at, location_mode, zone, districts_json, location_text, formats_json,
        positions_json, positions_needed_json, level, surface_type, payment_type, price_amount,
        price_currency, payment_comment, comment, created_at, updated_at, closed_at, cancelled_at, expired_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
    `).run(
      payload.id, payload.public_slug, payload.share_token, payload.tracker_type, payload.game_type, payload.author_user_id,
      payload.status, toDbBool(payload.is_listed), payload.source, payload.players_count, payload.players_needed_count,
      payload.accepted_players_count, payload.event_datetime, payload.event_datetime_from, payload.event_datetime_to,
      payload.expires_at || '', payload.location_mode || '', payload.zone, toJson(payload.districts_json || []), payload.location_text,
      toJson(payload.formats_json || []), toJson(payload.positions_json), toJson(payload.positions_needed_json), payload.level || '',
      payload.surface_type, payload.payment_type || '', payload.price_amount, payload.price_currency, payload.payment_comment,
      payload.comment, payload.created_at, payload.updated_at, payload.closed_at, payload.cancelled_at, payload.expired_at
    );
    return this.getById(payload.id);
  }

  updateDraft(id, patch) {
    const req = this.getById(id);
    const next = { ...req, ...patch, updated_at: new Date().toISOString() };
    this.write(next);
    return this.getById(id);
  }

  updateStatus(id, status, extra = {}) {
    const req = this.getById(id);
    const next = { ...req, ...extra, status, updated_at: new Date().toISOString() };
    this.write(next);
    return this.getById(id);
  }

  updateAcceptedCount(id, accepted_players_count, status) {
    const req = this.getById(id);
    const next = { ...req, accepted_players_count, status, updated_at: new Date().toISOString() };
    this.write(next);
    return this.getById(id);
  }

  write(next) {
    this.db.prepare(`
      UPDATE requests SET
        public_slug = ?, share_token = ?, tracker_type = ?, game_type = ?, author_user_id = ?, status = ?,
        is_listed = ?, source = ?, players_count = ?, players_needed_count = ?, accepted_players_count = ?,
        event_datetime = ?, event_datetime_from = ?, event_datetime_to = ?, expires_at = ?, location_mode = ?,
        zone = ?, districts_json = ?, location_text = ?, formats_json = ?, positions_json = ?, positions_needed_json = ?,
        level = ?, surface_type = ?, payment_type = ?, price_amount = ?, price_currency = ?, payment_comment = ?,
        comment = ?, created_at = ?, updated_at = ?, closed_at = ?, cancelled_at = ?, expired_at = ?
      WHERE id = ?
    `).run(
      next.public_slug, next.share_token, next.tracker_type, next.game_type, next.author_user_id, next.status,
      toDbBool(next.is_listed), next.source, next.players_count, next.players_needed_count, next.accepted_players_count,
      next.event_datetime, next.event_datetime_from, next.event_datetime_to, next.expires_at || '', next.location_mode || '',
      next.zone, toJson(next.districts_json || []), next.location_text, toJson(next.formats_json || []), toJson(next.positions_json),
      toJson(next.positions_needed_json), next.level || '', next.surface_type, next.payment_type || '', next.price_amount,
      next.price_currency, next.payment_comment, next.comment, next.created_at, next.updated_at, next.closed_at,
      next.cancelled_at, next.expired_at, next.id
    );
  }

  getById(id) { return mapRequest(this.db.prepare('SELECT * FROM requests WHERE id = ?').get(id)); }
  getByToken(token) { return mapRequest(this.db.prepare('SELECT * FROM requests WHERE share_token = ?').get(token)); }

  getActive(filters = {}) {
    const rows = this.db.prepare('SELECT * FROM requests WHERE is_listed = 1').all();
    return rows.map(mapRequest)
      .filter((r) => ['PUBLISHED', 'HAS_RESPONSES', 'PARTIALLY_FILLED', 'FILLED'].includes(r.status) && r.expires_at > new Date().toISOString())
      .filter((r) => !filters.tracker_type || r.tracker_type === filters.tracker_type)
      .filter((r) => !filters.game_type || r.game_type === filters.game_type)
      .filter((r) => !filters.zone || r.zone === filters.zone)
      .filter((r) => !filters.level || r.level === filters.level)
      .filter((r) => !filters.district || (r.districts_json || []).includes(filters.district))
      .filter((r) => !filters.format || (r.formats_json || []).includes(filters.format));
  }

  getByAuthor(userId) {
    return this.db.prepare('SELECT * FROM requests WHERE author_user_id = ? ORDER BY created_at DESC').all(userId).map(mapRequest);
  }

  all() {
    return this.db.prepare('SELECT * FROM requests').all().map(mapRequest);
  }
}

module.exports = { RequestsRepository };
