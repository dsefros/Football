const test = require('node:test');
const assert = require('node:assert/strict');
const { setup } = require('./helpers');

test('callback token validates expiry, single-use, actor and payload parsing', () => {
  const { services, author, responder } = setup();
  assert.throws(() => services.telegramCallbacksService.resolveToken('t_missing'), /not found/);

  const expired = services.telegramCallbacksService.createToken({ action: 'accept', ttlSec: -1 });
  assert.throws(() => services.telegramCallbacksService.resolveToken(expired), /expired/);

  const actorBound = services.telegramCallbacksService.createToken({ action: 'accept', actor_user_id: String(author.telegram_user_id), payload: { a: 1 } });
  assert.throws(() => services.telegramCallbacksService.resolveToken(actorBound), /actor mismatch/);
  assert.throws(() => services.telegramCallbacksService.resolveToken(actorBound, String(responder.telegram_user_id)), /actor mismatch/);

  const ok = services.telegramCallbacksService.resolveToken(actorBound, String(author.telegram_user_id));
  assert.deepEqual(ok.payload, { a: 1 });
  assert.throws(() => services.telegramCallbacksService.resolveToken(actorBound, String(author.telegram_user_id)), /already used/);

  const unbound = services.telegramCallbacksService.createToken({ action: 'decline' });
  const unboundResolved = services.telegramCallbacksService.resolveToken(unbound);
  assert.equal(unboundResolved.action, 'decline');
});
