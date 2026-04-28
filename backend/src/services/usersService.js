const crypto = require('crypto');
class UsersService {
  constructor(usersRepository) { this.usersRepository = usersRepository; }
  telegramUpsert(payload) { return this.usersRepository.upsertFromTelegram({ ...payload, id: payload.id || crypto.randomUUID() }); }
}
module.exports = { UsersService };
