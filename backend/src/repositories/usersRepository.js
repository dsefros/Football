class UsersRepository {
  constructor(db) { this.s = db.state; }
  upsertFromTelegram(payload) {
    const now = new Date().toISOString();
    const existingId = this.s.usersByTelegram.get(payload.telegram_user_id);
    if (existingId) {
      const user = this.s.users.get(existingId);
      Object.assign(user, payload, { updated_at: now });
      return user;
    }
    const user = { ...payload, created_at: now, updated_at: now };
    this.s.users.set(payload.id, user);
    this.s.usersByTelegram.set(payload.telegram_user_id, payload.id);
    return user;
  }
  getById(id) { return this.s.users.get(id) || null; }
}
module.exports = { UsersRepository };
