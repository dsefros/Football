const memory = {
  UsersRepository: require('./memory/usersRepository').UsersRepository,
  RequestsRepository: require('./memory/requestsRepository').RequestsRepository,
  ResponsesRepository: require('./memory/responsesRepository').ResponsesRepository,
  CallbackTokensRepository: require('./memory/callbackTokensRepository').CallbackTokensRepository,
  StatusEventsRepository: require('./memory/statusEventsRepository').StatusEventsRepository
};

const sqlite = {
  UsersRepository: require('./sqlite/usersRepository').UsersRepository,
  RequestsRepository: require('./sqlite/requestsRepository').RequestsRepository,
  ResponsesRepository: require('./sqlite/responsesRepository').ResponsesRepository,
  CallbackTokensRepository: require('./sqlite/callbackTokensRepository').CallbackTokensRepository,
  StatusEventsRepository: require('./sqlite/statusEventsRepository').StatusEventsRepository
};

function createRepositories(db) {
  if (db.driver === 'sqlite') return sqlite;
  return memory;
}

module.exports = { createRepositories };
