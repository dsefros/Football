class UsersRepository {
  constructor(db) { this.db = db.sqlite; }

  upsertFromTelegram(payload) {
    const now = new Date().toISOString();
    const existing = this.db.prepare('SELECT id FROM users WHERE telegram_user_id = ?').get(payload.telegram_user_id);
    if (existing) {
      this.db.prepare(`
        UPDATE users
        SET telegram_username = ?, display_name = ?, first_name = ?, last_name = ?, language_code = ?, updated_at = ?
        WHERE id = ?
      `).run(payload.telegram_username || null, payload.display_name || null, payload.first_name || null, payload.last_name || null, payload.language_code || null, now, existing.id);
      return this.getById(existing.id);
    }

    this.db.prepare(`
      INSERT INTO users (id, telegram_user_id, telegram_username, display_name, first_name, last_name, language_code, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(payload.id, payload.telegram_user_id, payload.telegram_username || null, payload.display_name || null, payload.first_name || null, payload.last_name || null, payload.language_code || null, now, now);

    return this.getById(payload.id);
  }

  getById(id) {
    return this.db.prepare('SELECT * FROM users WHERE id = ?').get(id) || null;
  }
}

module.exports = { UsersRepository };
