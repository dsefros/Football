const test = require('node:test');
const assert = require('node:assert/strict');
const { setup, minimalDraft, teamPatch } = require('./helpers');
const { location_mode, payment_type, zone } = require('../domain/enums');

test('create minimal draft, patch, publish', () => {
  const { services, author } = setup();
  const draft = services.requestsService.createDraft(minimalDraft(author.id));
  assert.equal(draft.status, 'DRAFT');
  const patched = services.requestsService.updateDraft(draft.id, teamPatch(), author.id);
  assert.equal(patched.players_needed_count, 3);
  const published = services.requestsService.publish(draft.id, author.id);
  assert.equal(published.status, 'PUBLISHED');
});

test('publish fails if required fields missing', () => {
  const { services, author } = setup();
  const draft = services.requestsService.createDraft(minimalDraft(author.id));
  assert.throws(() => services.requestsService.publish(draft.id, author.id), /Validation failed/);
});

test('location and payment validations', () => {
  const { services, author } = setup();
  const draft = services.requestsService.createDraft(minimalDraft(author.id));
  services.requestsService.updateDraft(draft.id, { ...teamPatch(), location_mode: location_mode.ALL, districts_json: ['ALL'], zone: null }, author.id);
  services.requestsService.publish(draft.id, author.id);

  const d2 = services.requestsService.createDraft(minimalDraft(author.id));
  services.requestsService.updateDraft(d2.id, { ...teamPatch(), location_mode: location_mode.ZONE, zone: zone.NORTH, districts_json: ['VYBORGSKY', 'KALININSKY', 'KRASNOGVARDEYSKY', 'KURORTNY', 'PRIMORSKY'], payment_type: payment_type.FIXED_PRICE, price_amount: 100 }, author.id);
  services.requestsService.publish(d2.id, author.id);

  const d3 = services.requestsService.createDraft(minimalDraft(author.id));
  services.requestsService.updateDraft(d3.id, { ...teamPatch(), payment_type: payment_type.FIELD_SHARE, payment_comment: 'split' }, author.id);
  services.requestsService.publish(d3.id, author.id);

  const d4 = services.requestsService.createDraft(minimalDraft(author.id));
  services.requestsService.updateDraft(d4.id, { ...teamPatch(), payment_type: payment_type.UNKNOWN, payment_comment: 'tbd' }, author.id);
  services.requestsService.publish(d4.id, author.id);
});

test('ZONE NORTH + invalid districts fails; missing zone fails', () => {
  const { services, author } = setup();
  const d1 = services.requestsService.createDraft(minimalDraft(author.id));
  services.requestsService.updateDraft(d1.id, { ...teamPatch(), location_mode: location_mode.ZONE, zone: zone.NORTH, districts_json: ['NEVSKY'] }, author.id);
  assert.throws(() => services.requestsService.publish(d1.id, author.id), (e) => e.code === 'VALIDATION_ERROR' && e.fields.some((f) => f.field === 'districts_json'));

  const d2 = services.requestsService.createDraft(minimalDraft(author.id));
  services.requestsService.updateDraft(d2.id, { ...teamPatch(), location_mode: location_mode.ZONE, zone: null, districts_json: ['VYBORGSKY'] }, author.id);
  assert.throws(() => services.requestsService.publish(d2.id, author.id), (e) => e.code === 'VALIDATION_ERROR' && e.fields.some((f) => f.field === 'zone'));
});

test('PATCH uses allowlist for draft fields', () => {
  const { services, author, responder } = setup();
  const draft = services.requestsService.createDraft(minimalDraft(author.id));
  const patched = services.requestsService.updateDraft(draft.id, {
    actor_user_id: author.id,
    status: 'PUBLISHED',
    author_user_id: responder.id,
    accepted_players_count: 999,
    location_text: 'ok-field'
  }, author.id);

  assert.equal(patched.status, 'DRAFT');
  assert.equal(patched.author_user_id, author.id);
  assert.equal(patched.accepted_players_count, 0);
  assert.equal(patched.location_text, 'ok-field');
});
