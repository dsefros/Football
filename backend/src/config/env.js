const path = require('path');

module.exports = {
  PORT: Number(process.env.PORT || 3000),
  DB_DRIVER: process.env.DB_DRIVER || 'memory',
  DB_PATH: process.env.DB_PATH || path.join(process.cwd(), 'data', 'football.sqlite'),
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '',
  TELEGRAM_BOT_USERNAME: process.env.TELEGRAM_BOT_USERNAME || 'FootballMvpBot',
  APP_BASE_URL: process.env.APP_BASE_URL || null
};
