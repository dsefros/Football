const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { createServer } = require('../server');
const { buildApp } = require('../app');

function request(port, method, routePath) {
  return new Promise((resolve, reject) => {
    const req = http.request({ port, method, path: routePath }, (res) => {
      let data = '';
      res.on('data', (d) => { data += d; });
      res.on('end', () => resolve({ status: res.statusCode, body: data ? JSON.parse(data) : {} }));
    });
    req.on('error', reject);
    req.end();
  });
}

function createSqliteDbForTest(dbPath) {
  let DatabaseSync;
  ({ DatabaseSync } = require('node:sqlite'));
  const resolvedPath = path.resolve(dbPath);
  fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });

  const sqlite = new DatabaseSync(resolvedPath);
  sqlite.exec('PRAGMA foreign_keys = ON;');
  sqlite.exec('PRAGMA journal_mode = WAL;');

  return {
    driver: 'sqlite',
    path: resolvedPath,
    sqlite,
    close() { sqlite.close(); }
  };
}

test('GET /health returns process liveness payload', async () => {
  const app = buildApp();
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));

  const response = await request(server.address().port, 'GET', '/health');
  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.service, 'football-backend');
  assert.equal(response.body.storage, 'memory');
  assert.equal(typeof response.body.timestamp, 'string');

  await new Promise((resolve) => server.close(resolve));
  app.close();
});

test('GET /ready returns readiness in memory mode', async () => {
  const app = buildApp();
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));

  const response = await request(server.address().port, 'GET', '/ready');
  assert.equal(response.status, 200);
  assert.deepEqual(response.body.checks, { repositories: true, database: true });
  assert.equal(response.body.storage, 'memory');

  await new Promise((resolve) => server.close(resolve));
  app.close();
});

test('GET /ready returns readiness in sqlite mode', async (t) => {
  try {
    require('node:sqlite');
  } catch (_) {
    t.skip('node:sqlite is unavailable in this Node runtime');
    return;
  }

  const dbPath = path.join(process.cwd(), 'data', `test-ready-${Date.now()}.sqlite`);
  const db = createSqliteDbForTest(dbPath);
  const app = buildApp(db);
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));

  const response = await request(server.address().port, 'GET', '/ready');
  assert.equal(response.status, 200);
  assert.deepEqual(response.body.checks, { repositories: true, database: true });
  assert.equal(response.body.storage, 'sqlite');

  await new Promise((resolve) => server.close(resolve));
  app.close();

  for (const suffix of ['', '-wal', '-shm']) {
    fs.rmSync(`${dbPath}${suffix}`, { force: true });
  }
});

test('GET /ready returns 503 when sqlite connection is closed', async (t) => {
  try {
    require('node:sqlite');
  } catch (_) {
    t.skip('node:sqlite is unavailable in this Node runtime');
    return;
  }

  const dbPath = path.join(process.cwd(), 'data', `test-not-ready-${Date.now()}.sqlite`);
  const db = createSqliteDbForTest(dbPath);
  const app = buildApp(db);
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));

  app.close();

  const response = await request(server.address().port, 'GET', '/ready');
  assert.equal(response.status, 503);
  assert.equal(response.body.error.code, 'SERVICE_UNAVAILABLE');

  await new Promise((resolve) => server.close(resolve));

  for (const suffix of ['', '-wal', '-shm']) {
    fs.rmSync(`${dbPath}${suffix}`, { force: true });
  }
});
