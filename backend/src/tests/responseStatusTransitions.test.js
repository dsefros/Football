const test = require('node:test');
const assert = require('node:assert/strict');
const { setup, minimalDraft, teamPatch } = require('./helpers');

function published(services, author) {
  const draft = services.requestsService.createDraft(minimalDraft(author.id));
  services.requestsService.updateDraft(draft.id, teamPatch(), author.id);
  return services.requestsService.publish(draft.id, author.id);
}

test('deny duplicate active response and self response', () => {
  const { services, author, responder } = setup();
  const req = published(services, author);
  services.responsesService.create(req.id, responder.id, { players_count: 1 });
  assert.throws(() => services.responsesService.create(req.id, responder.id, { players_count: 1 }), /Duplicate active response/);
  assert.throws(() => services.responsesService.create(req.id, author.id, { players_count: 1 }), /Cannot respond to own request/);
});

test('cannot respond to inactive requests', () => {
  const { services, author, responder } = setup();
  const req = published(services, author);
  services.requestsService.cancel(req.id, author.id);
  assert.throws(() => services.responsesService.create(req.id, responder.id, { players_count: 1 }), /Request not active/);
});

test('NO_AVAILABLE_SLOTS and accepted count bounds', () => {
  const { services, author, responder } = setup();
  const req = published(services, author);
  assert.throws(() => services.responsesService.create(req.id, responder.id, { players_count: 5 }), /No available slots/);

  const r = services.responsesService.create(req.id, responder.id, { players_count: 3 });
  services.responsesService.accept(r.id, author.id);
  const state = services.requestsService.getById(req.id);
  assert.equal(state.accepted_players_count, 3);

  services.responsesService.cancelByUser(r.id, responder.id);
  const reopened = services.requestsService.getById(req.id);
  assert.equal(reopened.accepted_players_count, 0);
});


test('cannot respond to CLOSED and EXPIRED requests', () => {
  const { services, author, responder } = setup();
  const d = services.requestsService.createDraft({ author_user_id: author.id, tracker_type: 'PLAYER_LOOKING_FOR_GAME', game_type: 'UNKNOWN' });
  services.requestsService.updateDraft(d.id, {
    players_count: 1,
    event_datetime_from: '2026-05-01T10:00:00.000Z',
    event_datetime_to: '2026-05-02T10:00:00.000Z',
    expires_at: '2026-05-05T10:00:00.000Z',
    location_mode: 'ALL',
    districts_json: ['ALL'],
    formats_json: ['FIVE_A_SIDE'],
    positions_json: ['UNIVERSAL'],
    level: 'AMATEUR',
    payment_type: 'FREE',
    price_amount: 0
  }, author.id);
  const req1 = services.requestsService.publish(d.id, author.id);
  const r1 = services.responsesService.create(req1.id, responder.id, { offered_event_datetime: '2026-05-01T11:00:00.000Z', offered_location_text: 'loc', offered_format: 'FIVE_A_SIDE', offered_payment_type: 'FREE', offered_districts_json: ['NEVSKY'] });
  services.responsesService.accept(r1.id, author.id);
  assert.throws(() => services.responsesService.create(req1.id, responder.id, { players_count: 1 }), /Request not active/);

  const req2 = published(services, author);
  services.requestsService.requestsRepository.getById(req2.id).expires_at = '2020-01-01T00:00:00.000Z';
  services.expireRequestsService.run();
  assert.throws(() => services.responsesService.create(req2.id, responder.id, { players_count: 1 }), /Request not active/);
});


test('accept second response does not mutate when no slots', () => {
  const { services, author, responder } = setup();
  const responder2 = services.usersService.telegramUpsert({ telegram_user_id: '22', telegram_username: 'r22', display_name: 'R22' });
  const draft = services.requestsService.createDraft(minimalDraft(author.id));
  services.requestsService.updateDraft(draft.id, { ...teamPatch(), players_needed_count: 1 }, author.id);
  const req = services.requestsService.publish(draft.id, author.id);

  const r1 = services.responsesService.create(req.id, responder.id, { players_count: 1 });
  const r2 = services.responsesService.create(req.id, responder2.id, { players_count: 1 });
  services.responsesService.accept(r1.id, author.id);

  assert.throws(() => services.responsesService.accept(r2.id, author.id), /No available slots/);
  assert.equal(services.responsesService.requireResponse(r2.id).status, 'REQUESTED');
  assert.equal(services.requestsService.getById(req.id).accepted_players_count, 1);
});
