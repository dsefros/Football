const { createDb } = require('./db/connection');
const { runMigrations, listMigrationFiles } = require('./db/migrate');
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
const { buildOperationalRoutes } = require('./routes/operationalRoutes');
const { createRouter } = require('./routes/router');

function hasCoreRepositories(repositories) {
  return Boolean(
    repositories.usersRepository
    && repositories.requestsRepository
    && repositories.responsesRepository
    && repositories.statusEventsRepository
    && repositories.callbackTokensRepository
    && typeof repositories.usersRepository.getById === 'function'
    && typeof repositories.requestsRepository.getById === 'function'
    && typeof repositories.responsesRepository.getById === 'function'
  );
}

function checkSqliteMigrations(db) {
  const migrationRows = db.sqlite.prepare('SELECT id FROM schema_migrations').all();
  const expected = listMigrationFiles();
  return migrationRows.length >= expected.length;
}

function buildApp(db = createDb()) {
  runMigrations(db);
  const Repositories = createRepositories(db);

  const repositories = {
    usersRepository: new Repositories.UsersRepository(db),
    requestsRepository: new Repositories.RequestsRepository(db),
    responsesRepository: new Repositories.ResponsesRepository(db),
    statusEventsRepository: new Repositories.StatusEventsRepository(db),
    callbackTokensRepository: new Repositories.CallbackTokensRepository(db)
  };

  const usersService = new UsersService(repositories.usersRepository);
  const requestsService = new RequestsService({ requestsRepository: repositories.requestsRepository, usersRepository: repositories.usersRepository, statusEventsRepository: repositories.statusEventsRepository, botUsername: TELEGRAM_BOT_USERNAME });
  const responsesService = new ResponsesService({ responsesRepository: repositories.responsesRepository, requestsRepository: repositories.requestsRepository, usersRepository: repositories.usersRepository, statusEventsRepository: repositories.statusEventsRepository, requestsService });
  const telegramCallbacksService = new TelegramCallbacksService(repositories.callbackTokensRepository);
  const expireRequestsService = new ExpireRequestsService(requestsService, responsesService);
  const botAdapter = new BotAdapter({ requestsService, responsesService, usersService, telegramCallbacksService, botUsername: TELEGRAM_BOT_USERNAME });

  function checkReadiness() {
    const repositoriesReady = hasCoreRepositories(repositories);
    if (db.driver === 'memory') {
      return { ok: repositoriesReady, checks: { repositories: repositoriesReady, database: true }, error: repositoriesReady ? null : 'Repositories are not initialized' };
    }

    let databaseReady = false;
    let migrationsReady = false;
    let error = null;
    try {
      const ping = db.sqlite.prepare('SELECT 1 AS ok').get();
      databaseReady = ping && ping.ok === 1;
      migrationsReady = checkSqliteMigrations(db);
    } catch (err) {
      error = err.message;
    }

    const database = databaseReady && migrationsReady;
    const ok = repositoriesReady && database;
    return {
      ok,
      checks: { repositories: repositoriesReady, database },
      error: error || (!migrationsReady ? 'Migrations are not applied' : null)
    };
  }

  const routes = [
    ...buildOperationalRoutes({ serviceName: 'football-backend', getStorageMode: () => db.driver, checkReadiness }),
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
      statusEventsRepository: repositories.statusEventsRepository
    },
    db,
    close() { db.close(); }
  };
}

module.exports = { buildApp };
