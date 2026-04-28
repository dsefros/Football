const test = require('node:test');
const assert = require('node:assert/strict');
const { setup, minimalDraft, teamPatch, playerPatch } = require('./helpers');

function publishedTeam(services, author) {
  const draft = services.requestsService.createDraft(minimalDraft(author.id));
  services.requestsService.updateDraft(draft.id, teamPatch(), author.id);
  return services.requestsService.publish(draft.id, author.id);
}

test('status events for publish, has_responses, filled, reopen, close, cancel', () => {
  const { services, author, responder } = setup();
  const req = publishedTeam(services, author);
  const r = services.responsesService.create(req.id, responder.id, { players_count: 3 });
  services.responsesService.accept(r.id, author.id);
  services.responsesService.cancelByUser(r.id, responder.id);
  const responder2 = services.usersService.telegramUpsert({ telegram_user_id: '3', telegram_username: 'resp2', display_name: 'Resp2' });
  const r2 = services.responsesService.create(req.id, responder2.id, { players_count: 3 });
  services.responsesService.accept(r2.id, author.id);
  services.requestsService.close(req.id, author.id);

  const events = services.statusEventsRepository.listRequestEvents(req.id).map((e) => e.new_status);
  assert.deepEqual(events, ['PUBLISHED', 'HAS_RESPONSES', 'FILLED', 'HAS_RESPONSES', 'FILLED', 'CLOSED']);
});

test('expire request also expires requested responses and logs events', () => {
  const { services, author, responder } = setup();
  const draft = services.requestsService.createDraft(minimalDraft(author.id));
  services.requestsService.updateDraft(draft.id, teamPatch(), author.id);
  const req = services.requestsService.publish(draft.id, author.id);
  services.requestsService.requestsRepository.getById(req.id).expires_at = '2020-01-01T00:00:00.000Z';
  const response = services.responsesService.create(req.id, responder.id, { players_count: 1 });
  const out = services.expireRequestsService.run();
  assert.equal(out.length, 1);
  assert.equal(services.requestsService.getById(req.id).status, 'EXPIRED');
  assert.equal(services.responsesService.requireResponse(response.id).status, 'EXPIRED');
  assert.ok(services.statusEventsRepository.listRequestEvents(req.id).some((e) => e.new_status === 'EXPIRED'));
  assert.ok(services.statusEventsRepository.listResponseEvents(response.id).some((e) => e.new_status === 'EXPIRED'));
});

test('player request accept closes request', () => {
  const { services, author, responder } = setup();
  const draft = services.requestsService.createDraft(minimalDraft(author.id, 'PLAYER_LOOKING_FOR_GAME'));
  services.requestsService.updateDraft(draft.id, playerPatch(), author.id);
  const req = services.requestsService.publish(draft.id, author.id);
  const response = services.responsesService.create(req.id, responder.id, {
    offered_event_datetime: '2026-05-01T11:00:00.000Z',
    offered_location_text: 'loc',
    offered_format: 'FIVE_A_SIDE',
    offered_payment_type: 'FREE',
    offered_districts_json: ['NEVSKY']
  });
  services.responsesService.accept(response.id, author.id);
  assert.equal(services.requestsService.getById(req.id).status, 'CLOSED');
});
