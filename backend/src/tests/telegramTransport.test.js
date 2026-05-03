const test = require('node:test');
const assert = require('node:assert/strict');
const { buildApp } = require('../app');
const { TelegramApiClient } = require('../telegram/telegramApiClient');

function msgUpdate(text, id = 101) { return { message: { text, from: { id, username: `u${id}`, first_name: `U${id}` } } }; }
function cbUpdate(callbackData, id = 101) { return { callback_query: { id: `cb-${id}`, data: callbackData, from: { id, username: `u${id}`, first_name: `U${id}` }, message: { chat: { id }, message_id: 10 } } }; }

class MockTelegramApiClient {
  constructor() { this.enabled = true; this.calls = []; }
  async sendMessage(chatId, text, options = {}) { this.calls.push(['sendMessage', chatId, text, options]); return { ok: true, result: {} }; }
  async editMessageText(chatId, messageId, text, options = {}) { this.calls.push(['editMessageText', chatId, messageId, text, options]); return { ok: true, result: {} }; }
  async answerCallbackQuery(id, options = {}) { this.calls.push(['answerCallbackQuery', id, options]); return { ok: true, result: {} }; }
}

test('api client handles disabled and errors', async () => {
  const disabled = new TelegramApiClient({ botToken: '', enabled: true });
  const res = await disabled.sendMessage(1, 'x');
  assert.equal(res.disabled, true);

  const badHttp = new TelegramApiClient({ botToken: 't', fetchImpl: async () => ({ ok: false, status: 500, json: async () => ({ ok: false }) }) });
  await assert.rejects(() => badHttp.sendMessage(1, 'x'), /HTTP 500/);

  const badOk = new TelegramApiClient({ botToken: 't', fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ ok: false }) }) });
  await assert.rejects(() => badOk.sendMessage(1, 'x'), /ok=false/);
});

test('/start menu sends message with inline keyboard when transport enabled', async () => {
  const mock = new MockTelegramApiClient();
  const { router } = buildApp(undefined, { telegramApiClient: mock });
  const route = router.resolve('POST', '/telegram/webhook').route;
  const structured = route.handler({ body: msgUpdate('/start', 777) });
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(structured.type, 'menu');
  const send = mock.calls.find((c) => c[0] === 'sendMessage');
  assert.ok(send);
  assert.equal(send[1], 777);
  assert.ok(send[3].reply_markup.inline_keyboard.length >= 1);
});

test('callback flow answers callback and edits/sends message', async () => {
  const mock = new MockTelegramApiClient();
  const { router } = buildApp(undefined, { telegramApiClient: mock });
  const route = router.resolve('POST', '/telegram/webhook').route;
  const menu = route.handler({ body: msgUpdate('/start', 888) });
  const btn = menu.buttons.find((b) => b.text === 'Ищу игроков на сбор');
  route.handler({ body: cbUpdate(btn.callback_data, 888) });
  await new Promise((r) => setTimeout(r, 0));
  assert.ok(mock.calls.some((c) => c[0] === 'answerCallbackQuery'));
  assert.ok(mock.calls.some((c) => c[0] === 'sendMessage' || c[0] === 'editMessageText'));
});

test('deep link card sends Откликнуться button', async () => {
  const mock = new MockTelegramApiClient();
  const { services, router } = buildApp(undefined, { telegramApiClient: mock });
  const route = router.resolve('POST', '/telegram/webhook').route;

  const author = services.usersService.telegramUpsert({ telegram_user_id: '910', telegram_username: 'a910', display_name: 'A910' });
  const draft = services.requestsService.createDraft({ author_user_id: author.id, tracker_type: 'TEAM_LOOKING_FOR_PLAYERS', game_type: 'CASUAL' });
  services.requestsService.updateDraft(draft.id, { event_datetime: new Date(Date.now() + 3600000).toISOString(), expires_at: new Date(Date.now() + 86400000).toISOString(), location_mode: 'DISTRICTS', districts_json: ['NEVSKY'], location_text: 'NEVSKY', formats_json: ['FIVE_A_SIDE'], players_needed_count: 2, accepted_players_count: 0, level: 'AMATEUR', payment_type: 'FREE', price_amount: 0 }, author.id);
  const req = services.requestsService.publish(draft.id, author.id);

  route.handler({ body: msgUpdate(`/start r_${req.share_token}`, 911) });
  await new Promise((r) => setTimeout(r, 0));
  const send = mock.calls.find((c) => c[0] === 'sendMessage' && c[3]?.reply_markup);
  assert.ok(send);
  assert.equal(send[3].reply_markup.inline_keyboard[0][0].text, 'Откликнуться');
});

test('delivery errors are logged and structured response is preserved', async () => {
  const logger = { errors: [], error(...args) { this.errors.push(args.join(' ')); } };
  const failing = { enabled: true, async sendMessage() { throw new Error('boom'); }, async answerCallbackQuery() {}, async editMessageText() {} };
  const { router } = buildApp(undefined, { telegramApiClient: failing, logger });
  const route = router.resolve('POST', '/telegram/webhook').route;
  const structured = route.handler({ body: msgUpdate('/start', 912) });
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(structured.type, 'menu');
  assert.ok(logger.errors.some((e) => e.includes('Telegram transport delivery failed')));
});
