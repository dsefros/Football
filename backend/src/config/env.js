const path = require('path');

module.exports = {
  PORT: Number(process.env.PORT || 3000),
  DB_PATH: process.env.DB_PATH || process.env.DATABASE_URL || path.join(process.cwd(), 'backend', 'football.sqlite'),
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '',
  TELEGRAM_BOT_USERNAME: process.env.TELEGRAM_BOT_USERNAME || 'FootballMvpBot',
  APP_BASE_URL: process.env.APP_BASE_URL || null
};
