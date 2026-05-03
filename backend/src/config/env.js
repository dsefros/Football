const fs = require('fs');
const path = require('path');

function loadDotEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf8');

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;

    const key = match[1];
    let value = match[2] || '';
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadDotEnv();

module.exports = {
  PORT: Number(process.env.PORT || 3000),
  DB_DRIVER: process.env.DB_DRIVER || 'memory',
  DB_PATH: process.env.DB_PATH || path.join(process.cwd(), 'data', 'football.sqlite'),
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '',
  TELEGRAM_BOT_USERNAME: process.env.TELEGRAM_BOT_USERNAME || 'FootballMvpBot',
  APP_BASE_URL: process.env.APP_BASE_URL || process.env.PUBLIC_BASE_URL || null,
  PUBLIC_BASE_URL: process.env.PUBLIC_BASE_URL || null,
  TELEGRAM_TRANSPORT_ENABLED: process.env.TELEGRAM_TRANSPORT_ENABLED !== 'false'
};
