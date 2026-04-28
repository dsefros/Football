CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  telegram_user_id TEXT NOT NULL UNIQUE,
  telegram_username TEXT NULL,
  display_name TEXT NULL,
  first_name TEXT NULL,
  last_name TEXT NULL,
  language_code TEXT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS requests (
  id TEXT PRIMARY KEY,
  public_slug TEXT NOT NULL UNIQUE,
  share_token TEXT NOT NULL UNIQUE,
  tracker_type TEXT NOT NULL,
  game_type TEXT NULL,
  author_user_id TEXT NOT NULL,
  status TEXT NOT NULL,
  is_listed INTEGER NOT NULL DEFAULT 1,
  source TEXT NOT NULL DEFAULT 'BOT',
  players_count INTEGER NULL,
  players_needed_count INTEGER NULL,
  accepted_players_count INTEGER NOT NULL DEFAULT 0,
  event_datetime TEXT NULL,
  event_datetime_from TEXT NULL,
  event_datetime_to TEXT NULL,
  expires_at TEXT NOT NULL,
  location_mode TEXT NOT NULL,
  zone TEXT NULL,
  districts_json TEXT NOT NULL,
  location_text TEXT NULL,
  formats_json TEXT NOT NULL,
  positions_json TEXT NULL,
  positions_needed_json TEXT NULL,
  level TEXT NOT NULL,
  surface_type TEXT NULL,
  payment_type TEXT NOT NULL,
  price_amount INTEGER NULL,
  price_currency TEXT NOT NULL DEFAULT 'RUB',
  payment_comment TEXT NULL,
  comment TEXT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  closed_at TEXT NULL,
  cancelled_at TEXT NULL,
  expired_at TEXT NULL,
  FOREIGN KEY(author_user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);
CREATE INDEX IF NOT EXISTS idx_requests_tracker_type ON requests(tracker_type);
CREATE INDEX IF NOT EXISTS idx_requests_game_type ON requests(game_type);
CREATE INDEX IF NOT EXISTS idx_requests_expires_at ON requests(expires_at);
CREATE INDEX IF NOT EXISTS idx_requests_author_user_id ON requests(author_user_id);
CREATE INDEX IF NOT EXISTS idx_requests_listed_status ON requests(is_listed, status);

CREATE TABLE IF NOT EXISTS responses (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  status TEXT NOT NULL,
  players_count INTEGER NOT NULL DEFAULT 1,
  positions_json TEXT NULL,
  offered_event_datetime TEXT NULL,
  offered_location_text TEXT NULL,
  offered_location_mode TEXT NULL,
  offered_zone TEXT NULL,
  offered_districts_json TEXT NULL,
  offered_format TEXT NULL,
  offered_payment_type TEXT NULL,
  offered_price_amount INTEGER NULL,
  offered_payment_comment TEXT NULL,
  question_text TEXT NULL,
  comment TEXT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  accepted_at TEXT NULL,
  declined_at TEXT NULL,
  cancelled_at TEXT NULL,
  expired_at TEXT NULL,
  UNIQUE(request_id, user_id),
  FOREIGN KEY(request_id) REFERENCES requests(id),
  FOREIGN KEY(user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_responses_request_id ON responses(request_id);
CREATE INDEX IF NOT EXISTS idx_responses_user_id ON responses(user_id);
CREATE INDEX IF NOT EXISTS idx_responses_status ON responses(status);
CREATE INDEX IF NOT EXISTS idx_responses_request_status ON responses(request_id, status);

CREATE TABLE IF NOT EXISTS request_status_events (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL,
  old_status TEXT NULL,
  new_status TEXT NOT NULL,
  reason TEXT NULL,
  actor_user_id TEXT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(request_id) REFERENCES requests(id),
  FOREIGN KEY(actor_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS response_status_events (
  id TEXT PRIMARY KEY,
  response_id TEXT NOT NULL,
  old_status TEXT NULL,
  new_status TEXT NOT NULL,
  reason TEXT NULL,
  actor_user_id TEXT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(response_id) REFERENCES responses(id),
  FOREIGN KEY(actor_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS telegram_callback_tokens (
  token TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  request_id TEXT NULL,
  response_id TEXT NULL,
  actor_user_id TEXT NULL,
  payload_json TEXT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  used_at TEXT NULL,
  FOREIGN KEY(request_id) REFERENCES requests(id),
  FOREIGN KEY(response_id) REFERENCES responses(id),
  FOREIGN KEY(actor_user_id) REFERENCES users(id)
);
