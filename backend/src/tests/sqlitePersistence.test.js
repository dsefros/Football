const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

function freshBuildApp({ driver, dbPath }) {
  process.env.DB_DRIVER = driver;
  process.env.DB_PATH = dbPath;

  for (const key of Object.keys(require.cache)) {
    if (key.includes('/src/config/env.js') || key.includes('/src/db/connection.js') || key.includes('/src/db/migrate.js') || key.includes('/src/app.js')) {
      delete require.cache[key];
    }
  }

  const { buildApp } = require('../app');
  return buildApp();
}

function setupSqlitePath() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'football-sqlite-test-'));
  return { root, dbPath: path.join(root, 'football.sqlite') };
}

test('sqlite migrations are idempotent', () => {
  const { dbPath } = setupSqlitePath();
  const app1 = freshBuildApp({ driver: 'sqlite', dbPath });
  const app2 = freshBuildApp({ driver: 'sqlite', dbPath });

  const count = app2.db.sqlite.prepare('SELECT COUNT(*) AS c FROM schema_migrations').get().c;
  assert.ok(count >= 1);

  app1.close();
  app2.close();
});

test('sqlite persists request/response lifecycle across restart', () => {
  const { dbPath } = setupSqlitePath();

  const app1 = freshBuildApp({ driver: 'sqlite', dbPath });
  const { services } = app1;

  const author = services.usersService.telegramUpsert({ telegram_user_id: '101', telegram_username: 'author101', display_name: 'Author 101' });
  const responder = services.usersService.telegramUpsert({ telegram_user_id: '202', telegram_username: 'responder202', display_name: 'Responder 202' });

  const draft = services.requestsService.createDraft({ author_user_id: author.id, tracker_type: 'TEAM_LOOKING_FOR_PLAYERS', game_type: 'CASUAL' });
  const patched = services.requestsService.updateDraft(draft.id, {
    event_datetime: '2026-05-01T10:00:00.000Z',
    expires_at: '2026-05-05T10:00:00.000Z',
    location_mode: 'DISTRICTS',
    districts_json: ['NEVSKY', 'TSENTRALNY'],
    location_text: 'Court A',
    formats_json: ['FIVE_A_SIDE'],
    positions_needed_json: ['UNIVERSAL'],
    players_needed_count: 2,
    accepted_players_count: 0,
    level: 'AMATEUR',
    payment_type: 'FREE',
    price_amount: 0
  }, author.id);
  assert.deepEqual(patched.districts_json, ['NEVSKY', 'TSENTRALNY']);

  const published = services.requestsService.publish(draft.id, author.id);
  const response = services.responsesService.create(draft.id, responder.id, {
    players_count: 1,
    positions_json: ['UNIVERSAL'],
    offered_districts_json: ['NEVSKY']
  });
  services.responsesService.accept(response.id, author.id);

  const callback = services.telegramCallbacksService.createToken({ action: 'accept_response', request_id: draft.id, response_id: response.id, actor_user_id: author.id, payload: { test: true } });
  assert.ok(callback.startsWith('t_'));

  const requestEventsBefore = services.statusEventsRepository.listRequestEvents(draft.id);
  const responseEventsBefore = services.statusEventsRepository.listResponseEvents(response.id);
  assert.ok(requestEventsBefore.length >= 2);
  assert.ok(responseEventsBefore.length >= 2);

  app1.close();

  const app2 = freshBuildApp({ driver: 'sqlite', dbPath });
  const s2 = app2.services;

  const persistedAuthor = s2.usersService.telegramUpsert({ telegram_user_id: '101', telegram_username: 'author101', display_name: 'Author 101' });
  const persistedResponder = s2.usersService.telegramUpsert({ telegram_user_id: '202', telegram_username: 'responder202', display_name: 'Responder 202' });
  const persistedRequest = s2.requestsService.getById(draft.id);
  const persistedResponse = s2.responsesService.requireResponse(response.id);
  const active = s2.requestsService.getActive({ tracker_type: 'TEAM_LOOKING_FOR_PLAYERS' });
  const activeByDistrict = s2.requestsService.getActive({ tracker_type: 'TEAM_LOOKING_FOR_PLAYERS', district: 'NEVSKY', format: 'FIVE_A_SIDE' });

  assert.ok(persistedAuthor);
  assert.ok(persistedResponder);
  assert.equal(persistedRequest.status, 'PARTIALLY_FILLED');
  assert.equal(persistedRequest.accepted_players_count, 1);
  assert.deepEqual(persistedRequest.districts_json, ['NEVSKY', 'TSENTRALNY']);
  assert.equal(persistedResponse.status, 'ACCEPTED');
  assert.deepEqual(persistedResponse.positions_json, ['UNIVERSAL']);
  assert.equal(active.some((r) => r.id === draft.id), true);
  assert.equal(activeByDistrict.some((r) => r.id === draft.id), true);

  const requestEventsAfter = s2.statusEventsRepository.listRequestEvents(draft.id);
  const responseEventsAfter = s2.statusEventsRepository.listResponseEvents(response.id);
  assert.equal(requestEventsAfter.length, requestEventsBefore.length);
  assert.equal(responseEventsAfter.length, responseEventsBefore.length);

  const resolved = s2.telegramCallbacksService.resolveToken(callback, author.id);
  assert.deepEqual(resolved.payload, { test: true });

  app2.close();
});
