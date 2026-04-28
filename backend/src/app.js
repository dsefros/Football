const { createDb } = require('./db/connection');
const { runMigrations } = require('./db/migrate');
const { TELEGRAM_BOT_USERNAME } = require('./config/env');
const { createRepositories } = require('./repositories');
const { UsersService } = require('./services/usersService');
const { RequestsService } = require('./services/requestsService');
const { ResponsesService } = require('./services/responsesService');
const { TelegramCallbacksService } = require('./services/telegramCallbacksService');
const { ExpireRequestsService } = require('./services/expireRequestsService');
const { BotAdapter } = require('./telegram/botAdapter');
const { buildUsersRoutes } = require('./routes/usersRoutes');
const { buildRequestsRoutes } = require('./routes/requestsRoutes');
const { buildResponsesRoutes } = require('./routes/responsesRoutes');
const { buildJobsRoutes } = require('./routes/jobsRoutes');
const { buildTelegramRoutes } = require('./routes/telegramRoutes');
const { createRouter } = require('./routes/router');

function buildApp(db = createDb()) {
  runMigrations(db);
  const Repositories = createRepositories(db);

  const usersRepository = new Repositories.UsersRepository(db);
  const requestsRepository = new Repositories.RequestsRepository(db);
  const responsesRepository = new Repositories.ResponsesRepository(db);
  const statusEventsRepository = new Repositories.StatusEventsRepository(db);
  const callbackTokensRepository = new Repositories.CallbackTokensRepository(db);

  const usersService = new UsersService(usersRepository);
  const requestsService = new RequestsService({ requestsRepository, usersRepository, statusEventsRepository, botUsername: TELEGRAM_BOT_USERNAME });
  const responsesService = new ResponsesService({ responsesRepository, requestsRepository, usersRepository, statusEventsRepository, requestsService });
  const telegramCallbacksService = new TelegramCallbacksService(callbackTokensRepository);
  const expireRequestsService = new ExpireRequestsService(requestsService, responsesService);
  const botAdapter = new BotAdapter({ requestsService, telegramCallbacksService });

  const routes = [
    ...buildTelegramRoutes({ botAdapter }),
    ...buildUsersRoutes({ usersService, requestsService }),
    ...buildRequestsRoutes({ requestsService, responsesService }),
    ...buildResponsesRoutes({ responsesService }),
    ...buildJobsRoutes({ expireRequestsService })
  ];

  const router = createRouter(routes);

  return {
    router,
    services: {
      usersService,
      requestsService,
      responsesService,
      telegramCallbacksService,
      expireRequestsService,
      statusEventsRepository
    },
    db,
    close() { db.close(); }
  };
}

module.exports = { buildApp };
