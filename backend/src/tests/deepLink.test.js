const test = require('node:test');
const assert = require('node:assert/strict');
const { setup, minimalDraft, playerPatch } = require('./helpers');

test('deep link resolves request and contacts hidden/visible', () => {
  const { services, author, responder } = setup();
  const draft = services.requestsService.createDraft(minimalDraft(author.id, 'PLAYER_LOOKING_FOR_GAME'));
  services.requestsService.updateDraft(draft.id, playerPatch(), author.id);
  const req = services.requestsService.publish(draft.id, author.id);

  const byToken = services.requestsService.getByToken(req.share_token);
  assert.equal(byToken.id, req.id);

  const resp = services.responsesService.create(req.id, responder.id, {
    offered_event_datetime: '2026-05-01T11:00:00.000Z',
    offered_location_text: 'loc',
    offered_format: 'FIVE_A_SIDE',
    offered_payment_type: 'FREE',
    offered_districts_json: ['NEVSKY']
  });

  const before = services.responsesService.listByRequest(req.id, author.id)[0];
  assert.equal(before.request_author.display_name, 'Author User');
  assert.equal(before.request_author.telegram_username, null);
  assert.equal(before.response_author.telegram_username, null);

  const after = services.responsesService.accept(resp.id, author.id);
  assert.equal(after.request_author.telegram_username, 'author_u');
  assert.equal(after.response_author.telegram_username, 'resp_u');
});
