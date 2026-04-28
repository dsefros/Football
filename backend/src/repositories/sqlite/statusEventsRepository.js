class StatusEventsRepository {
  constructor(db) { this.db = db.sqlite; }

  addRequestEvent(e) {
    this.db.prepare(`
      INSERT INTO request_status_events (id, request_id, old_status, new_status, reason, actor_user_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(e.id, e.request_id, e.old_status, e.new_status, e.reason, e.actor_user_id, e.created_at);
  }

  addResponseEvent(e) {
    this.db.prepare(`
      INSERT INTO response_status_events (id, response_id, old_status, new_status, reason, actor_user_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(e.id, e.response_id, e.old_status, e.new_status, e.reason, e.actor_user_id, e.created_at);
  }

  listRequestEvents(requestId) {
    return this.db.prepare('SELECT * FROM request_status_events WHERE request_id = ? ORDER BY created_at ASC').all(requestId);
  }

  listResponseEvents(responseId) {
    return this.db.prepare('SELECT * FROM response_status_events WHERE response_id = ? ORDER BY created_at ASC').all(responseId);
  }
}

module.exports = { StatusEventsRepository };
