const { buildApp } = require('../app');
const { tracker_type, game_type, location_mode, level, payment_type } = require('../domain/enums');

function setup(db) {
  const { services } = buildApp(db);
  const author = services.usersService.telegramUpsert({ telegram_user_id: '1', telegram_username: 'author_u', display_name: 'Author User', first_name: 'Author' });
  const responder = services.usersService.telegramUpsert({ telegram_user_id: '2', telegram_username: 'resp_u', display_name: 'Resp User', first_name: 'Resp' });
  return { services, author, responder };
}

function minimalDraft(authorId, tracker = tracker_type.TEAM_LOOKING_FOR_PLAYERS) {
  return { author_user_id: authorId, tracker_type: tracker, game_type: tracker === tracker_type.TEAM_LOOKING_FOR_PLAYERS ? game_type.CASUAL : game_type.UNKNOWN };
}

function teamPatch() {
  return {
    event_datetime: '2026-05-01T10:00:00.000Z',
    expires_at: '2026-05-05T10:00:00.000Z',
    location_mode: location_mode.DISTRICTS,
    districts_json: ['NEVSKY'],
    location_text: 'ул. Пример 1',
    formats_json: ['FIVE_A_SIDE'],
    players_needed_count: 3,
    accepted_players_count: 0,
    level: level.AMATEUR,
    payment_type: payment_type.FREE,
    price_amount: 0
  };
}

function playerPatch() {
  return {
    players_count: 2,
    event_datetime_from: '2026-05-01T10:00:00.000Z',
    event_datetime_to: '2026-05-02T10:00:00.000Z',
    expires_at: '2026-05-05T10:00:00.000Z',
    location_mode: location_mode.ALL,
    districts_json: ['ALL'],
    formats_json: ['FIVE_A_SIDE'],
    positions_json: ['UNIVERSAL'],
    level: level.AMATEUR,
    payment_type: payment_type.FREE,
    price_amount: 0
  };
}

module.exports = { setup, minimalDraft, teamPatch, playerPatch };
