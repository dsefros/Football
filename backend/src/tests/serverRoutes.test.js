const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const { createServer } = require('../server');
const { buildApp } = require('../app');

function request(port, method, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ port, method, path, headers: { 'content-type': 'application/json', ...headers } }, (res) => {
      let data = '';
      res.on('data', (d) => { data += d; });
      res.on('end', () => resolve({ status: res.statusCode, body: data ? JSON.parse(data) : {} }));
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

const futureIso = (days) => new Date(Date.now() + days * 24 * 3600 * 1000).toISOString();

test('server routes enforce auth and handle params/body/query', async () => {
  const app = buildApp();
  const server = createServer(app);
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;

  const u = await request(port, 'POST', '/users/telegram-upsert', { telegram_user_id: '11', telegram_username: 'u11', display_name: 'U11' });
  const u2 = await request(port, 'POST', '/users/telegram-upsert', { telegram_user_id: '12', telegram_username: 'u12', display_name: 'U12' });
  const authorId = u.body.id;

  const unauth = await request(port, 'POST', '/requests', { author_user_id: u2.body.id, tracker_type: 'TEAM_LOOKING_FOR_PLAYERS', game_type: 'CASUAL' });
  assert.equal(unauth.status, 401);

  const draft = await request(port, 'POST', '/requests', { author_user_id: u2.body.id, tracker_type: 'TEAM_LOOKING_FOR_PLAYERS', game_type: 'CASUAL' }, { 'x-actor-user-id': authorId });
  assert.equal(draft.status, 200);
  assert.equal(draft.body.author_user_id, authorId);

  const patch = await request(port, 'PATCH', `/requests/${draft.body.id}`, {
    actor_user_id: u2.body.id,
    event_datetime: futureIso(1),
    expires_at: futureIso(4),
    location_mode: 'DISTRICTS', districts_json: ['NEVSKY'], location_text: 'x', formats_json: ['FIVE_A_SIDE'], players_needed_count: 2, accepted_players_count: 0, level: 'AMATEUR', payment_type: 'FREE', price_amount: 0
  }, { 'x-actor-user-id': authorId });
  assert.equal(patch.status, 200);

  const wrongActor = await request(port, 'GET', `/users/${authorId}/requests`, null, { 'x-actor-user-id': u2.body.id });
  assert.equal(wrongActor.status, 403);

  const pub = await request(port, 'POST', `/requests/${draft.body.id}/publish`, {}, { 'x-actor-user-id': authorId });
  assert.equal(pub.status, 200);
  await new Promise((r) => server.close(r));
});
