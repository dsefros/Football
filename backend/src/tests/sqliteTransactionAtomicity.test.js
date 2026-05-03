const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

function freshBuildApp(dbPath) {
  process.env.DB_DRIVER = 'sqlite';
  process.env.DB_PATH = dbPath;
  for (const key of Object.keys(require.cache)) {
    if (key.includes('/src/config/env.js') || key.includes('/src/db/connection.js') || key.includes('/src/db/migrate.js') || key.includes('/src/app.js')) delete require.cache[key];
  }
  const { buildApp } = require('../app');
  return buildApp();
}

function setupApp() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'football-sqlite-tx-'));
  return freshBuildApp(path.join(root, 'football.sqlite'));
}

const futureIso = (days) => new Date(Date.now() + days * 24 * 3600 * 1000).toISOString();

test('sqlite rolls back response accept on mid-transition failure', () => {
  const app = setupApp();
  const { services } = app;
  const author = services.usersService.telegramUpsert({ telegram_user_id: '901', telegram_username: 'a901', display_name: 'A901' });
  const responder = services.usersService.telegramUpsert({ telegram_user_id: '902', telegram_username: 'r902', display_name: 'R902' });
  const d = services.requestsService.createDraft({ author_user_id: author.id, tracker_type: 'TEAM_LOOKING_FOR_PLAYERS', game_type: 'CASUAL' });
  services.requestsService.updateDraft(d.id, { event_datetime: futureIso(1), expires_at: futureIso(3), location_mode: 'DISTRICTS', districts_json: ['NEVSKY'], location_text: 'loc', formats_json: ['FIVE_A_SIDE'], players_needed_count: 2, level: 'AMATEUR', payment_type: 'FREE', price_amount: 0 }, author.id);
  const req = services.requestsService.publish(d.id, author.id);
  const response = services.responsesService.create(req.id, responder.id, { players_count: 1 });

  const original = services.responsesService.requestsRepository.updateAcceptedCount.bind(services.responsesService.requestsRepository);
  services.responsesService.requestsRepository.updateAcceptedCount = () => { throw new Error('boom_after_response_update'); };
  assert.throws(() => services.responsesService.accept(response.id, author.id), /boom_after_response_update/);
  services.responsesService.requestsRepository.updateAcceptedCount = original;

  assert.equal(services.responsesService.requireResponse(response.id).status, 'REQUESTED');
  assert.equal(services.requestsService.getById(req.id).accepted_players_count, 0);
  app.close();
});

test('sqlite rolls back expire flow on response-expire failure', () => {
  const app = setupApp();
  const { services } = app;
  const author = services.usersService.telegramUpsert({ telegram_user_id: '903', telegram_username: 'a903', display_name: 'A903' });
  const responder = services.usersService.telegramUpsert({ telegram_user_id: '904', telegram_username: 'r904', display_name: 'R904' });
  const d = services.requestsService.createDraft({ author_user_id: author.id, tracker_type: 'TEAM_LOOKING_FOR_PLAYERS', game_type: 'CASUAL' });
  services.requestsService.updateDraft(d.id, { event_datetime: futureIso(1), expires_at: futureIso(2), location_mode: 'DISTRICTS', districts_json: ['NEVSKY'], location_text: 'loc', formats_json: ['FIVE_A_SIDE'], players_needed_count: 2, level: 'AMATEUR', payment_type: 'FREE', price_amount: 0 }, author.id);
  const req = services.requestsService.publish(d.id, author.id);
  const resp = services.responsesService.create(req.id, responder.id, { players_count: 1 });

  app.db.sqlite.prepare('UPDATE requests SET expires_at = ? WHERE id = ?').run(new Date(Date.now() - 1000).toISOString(), req.id);
  const orig = services.responsesService.responsesRepository.updateStatus.bind(services.responsesService.responsesRepository);
  services.responsesService.responsesRepository.updateStatus = () => { throw new Error('boom_expire_response'); };
  assert.throws(() => services.expireRequestsService.run(), /boom_expire_response/);
  services.responsesService.responsesRepository.updateStatus = orig;

  assert.equal(services.requestsService.getById(req.id).status, 'HAS_RESPONSES');
  assert.equal(services.responsesService.requireResponse(resp.id).status, 'REQUESTED');
  app.close();
});
