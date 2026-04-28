const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const { createServer } = require('../server');
const { buildApp } = require('../app');

function request(port, method, path, body) {
  return new Promise((resolve, reject) => {
    const req = http.request({ port, method, path, headers: { 'content-type': 'application/json' } }, (res) => {
      let data = '';
      res.on('data', (d) => { data += d; });
      res.on('end', () => resolve({ status: res.statusCode, body: data ? JSON.parse(data) : {} }));
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

test('server routes handle params/body/query', async () => {
  const app = buildApp();
  const server = createServer(app);
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;

  const u = await request(port, 'POST', '/users/telegram-upsert', { telegram_user_id: '11', telegram_username: 'u11', display_name: 'U11' });
  assert.equal(u.status, 200);
  const authorId = u.body.id;

  const draft = await request(port, 'POST', '/requests', { author_user_id: authorId, tracker_type: 'TEAM_LOOKING_FOR_PLAYERS', game_type: 'CASUAL' });
  assert.equal(draft.status, 200);

  const patch = await request(port, 'PATCH', `/requests/${draft.body.id}`, {
    actor_user_id: authorId,
    event_datetime: '2026-05-01T10:00:00.000Z',
    expires_at: '2026-05-05T10:00:00.000Z',
    location_mode: 'DISTRICTS',
    districts_json: ['NEVSKY'],
    location_text: 'x',
    formats_json: ['FIVE_A_SIDE'],
    players_needed_count: 2,
    accepted_players_count: 0,
    level: 'AMATEUR',
    payment_type: 'FREE',
    price_amount: 0
  });
  assert.equal(patch.status, 200);

  const pub = await request(port, 'POST', `/requests/${draft.body.id}/publish`, { actor_user_id: authorId });
  assert.equal(pub.status, 200);

  const active = await request(port, 'GET', `/requests/active?tracker_type=TEAM_LOOKING_FOR_PLAYERS`);
  assert.equal(active.status, 200);
  assert.equal(Array.isArray(active.body), true);

  await new Promise((r) => server.close(r));
});
