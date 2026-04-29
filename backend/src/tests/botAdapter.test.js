const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { buildApp } = require('../app');

function msgUpdate(text, id = 101) {
  return { message: { text, from: { id, username: `u${id}`, first_name: `U${id}` } } };
}

function cbUpdate(callbackData, id = 101) {
  return { callback_query: { data: callbackData, from: { id, username: `u${id}`, first_name: `U${id}` } } };
}

function setupSqliteTestEnv() {
  const prevDriver = process.env.DB_DRIVER;
  const prevPath = process.env.DB_PATH;
  const filePath = path.resolve(__dirname, `../../data/test-bot-${Date.now()}-${Math.random().toString(16).slice(2)}.sqlite`);
  process.env.DB_DRIVER = 'sqlite';
  process.env.DB_PATH = filePath;
  delete require.cache[require.resolve('../app')];
  delete require.cache[require.resolve('../db/connection')];
  const { buildApp: sqliteBuildApp } = require('../app');
  return { sqliteBuildApp, filePath, prevDriver, prevPath };
}

function cleanupSqliteTestEnv({ filePath, prevDriver, prevPath }) {
  if (prevDriver == null) delete process.env.DB_DRIVER;
  else process.env.DB_DRIVER = prevDriver;
  if (prevPath == null) delete process.env.DB_PATH;
  else process.env.DB_PATH = prevPath;

  for (const p of [filePath, `${filePath}-wal`, `${filePath}-shm`]) {
    try { fs.rmSync(p, { force: true }); } catch (_) { /* noop */ }
  }
  delete require.cache[require.resolve('../app')];
  delete require.cache[require.resolve('../db/connection')];
}

test('/start returns menu with tokenized buttons', () => {
  const { router } = buildApp();
  const route = router.resolve('POST', '/telegram/webhook').route;
  const res = route.handler({ body: msgUpdate('/start') });
  assert.equal(res.text, 'Выберите действие');
  assert.equal(res.buttons.length, 4);
  for (const b of res.buttons) assert.match(b.callback_data, /^t_/);
});

test('click create_team_request does not fail actor mismatch', () => {
  const { router } = buildApp();
  const route = router.resolve('POST', '/telegram/webhook').route;
  const menu = route.handler({ body: msgUpdate('/start', 111) });
  const btn = menu.buttons.find((b) => b.text === 'Ищу игроков на сбор');
  const res = route.handler({ body: cbUpdate(btn.callback_data, 111) });
  assert.equal(res.type, 'ask');
  assert.equal(res.text, 'Сколько игроков нужно?');
});

test('callback token actor works in sqlite mode and mismatch is rejected', () => {
  const setup = setupSqliteTestEnv();
  try {
    const { router, close } = setup.sqliteBuildApp();
    const route = router.resolve('POST', '/telegram/webhook').route;
    const menu1 = route.handler({ body: msgUpdate('/start', 311) });
    const btn1 = menu1.buttons.find((b) => b.text === 'Ищу игроков на сбор');
    const ok = route.handler({ body: cbUpdate(btn1.callback_data, 311) });
    assert.equal(ok.type, 'ask');

    const menu2 = route.handler({ body: msgUpdate('/start', 311) });
    const btn2 = menu2.buttons.find((b) => b.text === 'Ищу игроков на сбор');
    assert.throws(
      () => route.handler({ body: cbUpdate(btn2.callback_data, 999) }),
      (err) => err && err.code === 'FORBIDDEN' && /actor mismatch/i.test(err.message)
    );
    close();
  } finally {
    cleanupSqliteTestEnv(setup);
  }
});

test('player creation flow confirms and publishes', () => {
  const { router } = buildApp();
  const route = router.resolve('POST', '/telegram/webhook').route;
  const menu = route.handler({ body: msgUpdate('/start', 321) });
  const createBtn = menu.buttons.find((b) => b.text === 'Ищу где поиграть');
  route.handler({ body: cbUpdate(createBtn.callback_data, 321) });
  route.handler({ body: msgUpdate('2', 321) });
  const confirm = route.handler({ body: msgUpdate('later today', 321) });
  const confirmBtn = confirm.buttons.find((b) => b.text === 'Подтвердить');
  const published = route.handler({ body: cbUpdate(confirmBtn.callback_data, 321) });
  assert.equal(published.type, 'published');
  assert.match(published.text, /r_/);
});

test('team creation confirm publishes a request', () => {
  const { router } = buildApp();
  const route = router.resolve('POST', '/telegram/webhook').route;
  const menu = route.handler({ body: msgUpdate('/start', 121) });
  const createBtn = menu.buttons.find((b) => b.text === 'Ищу игроков на сбор');
  route.handler({ body: cbUpdate(createBtn.callback_data, 121) });
  route.handler({ body: msgUpdate('3', 121) });
  route.handler({ body: msgUpdate('когда угодно', 121) });
  const confirm = route.handler({ body: msgUpdate('NEVSKY', 121) });
  const confirmBtn = confirm.buttons.find((b) => b.text === 'Подтвердить');
  const published = route.handler({ body: cbUpdate(confirmBtn.callback_data, 121) });
  assert.equal(published.type, 'published');
  assert.match(published.text, /r_/);
});

test('clicking cancel clears state', () => {
  const { router } = buildApp();
  const route = router.resolve('POST', '/telegram/webhook').route;
  const menu = route.handler({ body: msgUpdate('/start', 131) });
  const createBtn = menu.buttons.find((b) => b.text === 'Ищу где поиграть');
  route.handler({ body: cbUpdate(createBtn.callback_data, 131) });
  route.handler({ body: msgUpdate('2', 131) });
  const confirm = route.handler({ body: msgUpdate('tomorrow', 131) });
  const cancelBtn = confirm.buttons.find((b) => b.text === 'Отмена');
  const cancelled = route.handler({ body: cbUpdate(cancelBtn.callback_data, 131) });
  assert.equal(cancelled.type, 'cancelled');
  const noop = route.handler({ body: msgUpdate('1', 131) });
  assert.equal(noop.type, 'noop');
});

test('/start r_bad returns safe_error', () => {
  const { router } = buildApp();
  const route = router.resolve('POST', '/telegram/webhook').route;
  const res = route.handler({ body: msgUpdate('/start r_bad', 141) });
  assert.equal(res.type, 'safe_error');
});

test('duplicate response returns already responded message', () => {
  const { services, router } = buildApp();
  const route = router.resolve('POST', '/telegram/webhook').route;

  const author = services.usersService.telegramUpsert({ telegram_user_id: '201', telegram_username: 'a201', display_name: 'a201' });
  const responder = { tg: 202 };

  const draft = services.requestsService.createDraft({ author_user_id: author.id, tracker_type: 'TEAM_LOOKING_FOR_PLAYERS', game_type: 'CASUAL' });
  services.requestsService.updateDraft(draft.id, {
    event_datetime: new Date(Date.now() + 3600000).toISOString(),
    expires_at: new Date(Date.now() + 86400000).toISOString(),
    location_mode: 'DISTRICTS',
    districts_json: ['NEVSKY'],
    location_text: 'x',
    formats_json: ['FIVE_A_SIDE'],
    players_needed_count: 2,
    accepted_players_count: 0,
    level: 'AMATEUR',
    payment_type: 'FREE',
    price_amount: 0
  }, author.id);
  const req = services.requestsService.publish(draft.id, author.id);

  const start = route.handler({ body: msgUpdate(`/start r_${req.share_token}`, responder.tg) });
  const cb = start.buttons[0].callback_data;
  const first = route.handler({ body: cbUpdate(cb, responder.tg) });
  assert.equal(first.text, 'Отклик отправлен');

  const start2 = route.handler({ body: msgUpdate(`/start r_${req.share_token}`, responder.tg) });
  const second = route.handler({ body: cbUpdate(start2.buttons[0].callback_data, responder.tg) });
  assert.equal(second.text, 'Вы уже откликнулись');
});
