const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { createServer } = require('../server');
const { buildApp } = require('../app');

test('smoke script succeeds against running server', async () => {
  const app = buildApp();
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  const result = await new Promise((resolve) => {
    const child = spawn('node', ['scripts/smoke.js'], {
      cwd: process.cwd(),
      env: { ...process.env, BASE_URL: `http://localhost:${port}` }
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += String(chunk); });
    child.stderr.on('data', (chunk) => { stderr += String(chunk); });
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });

  assert.equal(result.code, 0, `smoke script failed: ${result.stderr}`);
  assert.match(result.stdout, /SMOKE PASS/);

  await new Promise((resolve) => server.close(resolve));
  app.close();
});
