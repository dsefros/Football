const { toJson, fromJson } = require('./utils');

function mapResponse(row) {
  if (!row) return null;
  return {
    ...row,
    positions_json: fromJson(row.positions_json, null),
    offered_districts_json: fromJson(row.offered_districts_json, null)
  };
}

class ResponsesRepository {
  constructor(db) { this.db = db.sqlite; }

  create(payload) {
    this.db.prepare(`
      INSERT INTO responses (
        id, request_id, user_id, status, players_count, positions_json, offered_event_datetime,
        offered_location_text, offered_location_mode, offered_zone, offered_districts_json,
        offered_format, offered_payment_type, offered_price_amount, offered_payment_comment,
        question_text, comment, created_at, updated_at, accepted_at, declined_at, cancelled_at, expired_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      payload.id, payload.request_id, payload.user_id, payload.status, payload.players_count,
      toJson(payload.positions_json), payload.offered_event_datetime, payload.offered_location_text,
      payload.offered_location_mode, payload.offered_zone, toJson(payload.offered_districts_json),
      payload.offered_format, payload.offered_payment_type, payload.offered_price_amount,
      payload.offered_payment_comment, payload.question_text, payload.comment, payload.created_at,
      payload.updated_at, payload.accepted_at, payload.declined_at, payload.cancelled_at, payload.expired_at
    );
    return this.getById(payload.id);
  }

  getById(id) { return mapResponse(this.db.prepare('SELECT * FROM responses WHERE id = ?').get(id)); }

  getByRequestAndUser(requestId, userId) {
    return mapResponse(this.db.prepare('SELECT * FROM responses WHERE request_id = ? AND user_id = ?').get(requestId, userId));
  }

  listByRequest(requestId) {
    return this.db.prepare('SELECT * FROM responses WHERE request_id = ? ORDER BY created_at ASC').all(requestId).map(mapResponse);
  }

  updateStatus(id, status, extra = {}) {
    const row = this.getById(id);
    const next = { ...row, ...extra, status, updated_at: new Date().toISOString() };
    this.db.prepare(`
      UPDATE responses SET
        request_id = ?, user_id = ?, status = ?, players_count = ?, positions_json = ?,
        offered_event_datetime = ?, offered_location_text = ?, offered_location_mode = ?, offered_zone = ?,
        offered_districts_json = ?, offered_format = ?, offered_payment_type = ?, offered_price_amount = ?,
        offered_payment_comment = ?, question_text = ?, comment = ?, created_at = ?, updated_at = ?,
        accepted_at = ?, declined_at = ?, cancelled_at = ?, expired_at = ?
      WHERE id = ?
    `).run(
      next.request_id, next.user_id, next.status, next.players_count, toJson(next.positions_json),
      next.offered_event_datetime, next.offered_location_text, next.offered_location_mode, next.offered_zone,
      toJson(next.offered_districts_json), next.offered_format, next.offered_payment_type, next.offered_price_amount,
      next.offered_payment_comment, next.question_text, next.comment, next.created_at, next.updated_at,
      next.accepted_at, next.declined_at, next.cancelled_at, next.expired_at, next.id
    );
    return this.getById(id);
  }
}

module.exports = { ResponsesRepository };
