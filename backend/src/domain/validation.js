const { AppError } = require('./errors');
const { tracker_type, game_type, location_mode, zone, district, payment_type, zoneToDistricts } = require('./enums');

function ensure(cond, field, message, errors) { if (!cond) errors.push({ field, message }); }

function validateLocation(input, errors, prefix = '') {
  const districts = input.districts_json || [];
  if (input.location_mode === location_mode.ALL) {
    ensure(Array.isArray(districts) && districts.length === 1 && districts[0] === district.ALL, `${prefix}districts_json`, 'must equal ["ALL"]', errors);
    ensure(!input.zone, `${prefix}zone`, 'must be null for ALL mode', errors);
  } else if (input.location_mode === location_mode.ZONE) {
    ensure(!!input.zone && Object.values(zone).includes(input.zone), `${prefix}zone`, 'zone is required', errors);
    const expected = zoneToDistricts[input.zone] || [];
    const actual = Array.isArray(districts) ? [...new Set(districts)].sort() : [];
    const expectedSorted = [...expected].sort();
    ensure(JSON.stringify(actual) === JSON.stringify(expectedSorted), `${prefix}districts_json`, 'must match districts for selected zone', errors);
  } else if (input.location_mode === location_mode.DISTRICTS) {
    const valid = Array.isArray(districts) && districts.length >= 1 && districts.length <= 18 && districts.every((d) => Object.values(district).includes(d) && d !== district.ALL);
    ensure(valid, `${prefix}districts_json`, 'contains invalid districts', errors);
  } else {
    errors.push({ field: `${prefix}location_mode`, message: 'invalid location_mode' });
  }
}

function validatePayment(input, errors, typeField = 'payment_type', amountField = 'price_amount', commentField = 'payment_comment') {
  if (input[typeField] === payment_type.FREE) ensure(input[amountField] == null || input[amountField] === 0, amountField, 'must be 0 or null for FREE', errors);
  if (input[typeField] === payment_type.FIXED_PRICE) ensure(input[amountField] != null && input[amountField] >= 0, amountField, 'required and must be >= 0', errors);
  if ([payment_type.FIELD_SHARE, payment_type.UNKNOWN].includes(input[typeField])) ensure(!!input[commentField], commentField, 'required', errors);
}

function validateRequestDraft(payload) {
  const errors = [];
  ensure(!!payload.author_user_id, 'author_user_id', 'required', errors);
  ensure(!!payload.expires_at, 'expires_at', 'required', errors);
  ensure(payload.status === 'DRAFT', 'status', 'must be DRAFT at creation', errors);

  if (payload.tracker_type === tracker_type.PLAYER_LOOKING_FOR_GAME) {
    ensure([null, game_type.UNKNOWN].includes(payload.game_type), 'game_type', 'must be null or UNKNOWN', errors);
    ensure(payload.players_count >= 1 && payload.players_count <= 5, 'players_count', 'must be 1..5', errors);
    ensure(!!payload.event_datetime_from, 'event_datetime_from', 'required', errors);
    ensure(!payload.event_datetime_to || payload.event_datetime_to > payload.event_datetime_from, 'event_datetime_to', 'must be > from', errors);
    ensure(Array.isArray(payload.formats_json) && payload.formats_json.length > 0, 'formats_json', 'must not be empty', errors);
    ensure(Array.isArray(payload.positions_json) && payload.positions_json.length > 0, 'positions_json', 'must not be empty', errors);
    ensure(!!payload.level, 'level', 'required', errors);
    ensure(!!payload.payment_type, 'payment_type', 'required', errors);
    validateLocation(payload, errors);
    validatePayment(payload, errors);
  }

  if (payload.tracker_type === tracker_type.TEAM_LOOKING_FOR_PLAYERS) {
    ensure(payload.game_type === game_type.CASUAL, 'game_type', 'must be CASUAL', errors);
    ensure(!!payload.event_datetime, 'event_datetime', 'required', errors);
    ensure(!!payload.location_text, 'location_text', 'required', errors);
    ensure(Array.isArray(payload.formats_json) && payload.formats_json.length > 0, 'formats_json', 'must not be empty', errors);
    ensure(payload.players_needed_count >= 1 && payload.players_needed_count <= 30, 'players_needed_count', 'must be 1..30', errors);
    ensure(payload.accepted_players_count >= 0 && payload.accepted_players_count <= payload.players_needed_count, 'accepted_players_count', 'must be between 0 and needed', errors);
    ensure(!!payload.level, 'level', 'required', errors);
    ensure(!!payload.payment_type, 'payment_type', 'required', errors);
    validateLocation(payload, errors);
    validatePayment(payload, errors);
  }

  if (errors.length) throw new AppError('VALIDATION_ERROR', 'Validation failed', errors);
}

function validateResponseCreate(request, payload, availableSlots) {
  const errors = [];
  if (request.tracker_type === tracker_type.TEAM_LOOKING_FOR_PLAYERS) {
    ensure(request.game_type === game_type.CASUAL, 'game_type', 'only CASUAL supported', errors);
    ensure(payload.players_count >= 1 && payload.players_count <= 5, 'players_count', 'must be 1..5', errors);
    if (payload.players_count > availableSlots) {
      throw new AppError('NO_AVAILABLE_SLOTS', `No available slots`, [{ field: 'players_count', message: `available_slots=${availableSlots}` }]);
    }
  }
  if (request.tracker_type === tracker_type.PLAYER_LOOKING_FOR_GAME) {
    ensure(!!payload.offered_event_datetime, 'offered_event_datetime', 'required', errors);
    ensure(!!payload.offered_location_text, 'offered_location_text', 'required', errors);
    ensure(!!payload.offered_format, 'offered_format', 'required', errors);
    ensure(!!payload.offered_payment_type, 'offered_payment_type', 'required', errors);
    ensure(Array.isArray(payload.offered_districts_json) && payload.offered_districts_json.length > 0, 'offered_districts_json', 'required', errors);
    validatePayment(payload, errors, 'offered_payment_type', 'offered_price_amount', 'offered_payment_comment');
  }
  if (errors.length) throw new AppError('VALIDATION_ERROR', 'Validation failed', errors);
}

module.exports = { validateRequestDraft, validateResponseCreate, validateLocation, validatePayment };
