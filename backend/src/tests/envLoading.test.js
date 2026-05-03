const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const envPath = path.join(process.cwd(), '.env');

function clearEnvModule() { delete require.cache[require.resolve('../config/env')]; }

test('loads values from .env', () => {
  fs.writeFileSync(envPath, 'PORT=3010\nDB_DRIVER=sqlite\nPUBLIC_BASE_URL=https://example.test\n');
  delete process.env.PORT;
  delete process.env.DB_DRIVER;
  delete process.env.PUBLIC_BASE_URL;
  clearEnvModule();
  const env = require('../config/env');
  assert.equal(env.PORT, 3010);
  assert.equal(env.DB_DRIVER, 'sqlite');
  assert.equal(env.PUBLIC_BASE_URL, 'https://example.test');
  fs.unlinkSync(envPath);
});

test('process.env has priority over .env', () => {
  fs.writeFileSync(envPath, 'PORT=3010\nDB_DRIVER=sqlite\n');
  process.env.PORT = '3999';
  process.env.DB_DRIVER = 'memory';
  clearEnvModule();
  const env = require('../config/env');
  assert.equal(env.PORT, 3999);
  assert.equal(env.DB_DRIVER, 'memory');
  fs.unlinkSync(envPath);
});
