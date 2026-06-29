CREATE TABLE centers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE admin_users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  center_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (center_id) REFERENCES centers(id)
);

CREATE TABLE admin_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  session_token TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES admin_users(id)
);

CREATE TABLE api_keys (
  api_key TEXT PRIMARY KEY,
  center_id TEXT NOT NULL,
  label TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  daily_limit INTEGER NOT NULL DEFAULT 1000,
  unlimited_until TEXT,
  last_used_at TEXT,
  rotated_to_api_key TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (center_id) REFERENCES centers(id),
  FOREIGN KEY (rotated_to_api_key) REFERENCES api_keys(api_key)
);

CREATE TABLE api_key_usage_daily (
  api_key TEXT NOT NULL,
  usage_date TEXT NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0,
  pull_count INTEGER NOT NULL DEFAULT 0,
  send_count INTEGER NOT NULL DEFAULT 0,
  ack_count INTEGER NOT NULL DEFAULT 0,
  heartbeat_count INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (api_key, usage_date),
  FOREIGN KEY (api_key) REFERENCES api_keys(api_key)
);

CREATE TABLE device_commands (
  id TEXT PRIMARY KEY,
  api_key TEXT NOT NULL,
  name TEXT NOT NULL,
  value TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  expires_at TEXT,
  pulled_at TEXT,
  acknowledged_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (api_key) REFERENCES api_keys(api_key)
);

CREATE TABLE device_state (
  api_key TEXT PRIMARY KEY,
  last_event_name TEXT,
  last_event_value TEXT,
  last_seen_at TEXT,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (api_key) REFERENCES api_keys(api_key)
);

CREATE TABLE device_events (
  id TEXT PRIMARY KEY,
  api_key TEXT NOT NULL,
  name TEXT NOT NULL,
  value TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (api_key) REFERENCES api_keys(api_key)
);

CREATE TABLE unlimited_requests (
  id TEXT PRIMARY KEY,
  api_key TEXT NOT NULL,
  requested_by_user_id TEXT NOT NULL,
  requested_until TEXT NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by_user_id TEXT,
  reviewed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (api_key) REFERENCES api_keys(api_key),
  FOREIGN KEY (requested_by_user_id) REFERENCES admin_users(id),
  FOREIGN KEY (reviewed_by_user_id) REFERENCES admin_users(id)
);

CREATE TABLE admin_audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  details_json TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES admin_users(id)
);

CREATE UNIQUE INDEX idx_admin_users_email ON admin_users(email);
CREATE UNIQUE INDEX idx_admin_sessions_token ON admin_sessions(session_token);
CREATE INDEX idx_api_keys_center_status ON api_keys(center_id, status);
CREATE INDEX idx_api_key_usage_daily_key_date ON api_key_usage_daily(api_key, usage_date);
CREATE INDEX idx_device_commands_key_status_created ON device_commands(api_key, status, created_at);
CREATE INDEX idx_device_events_key_created ON device_events(api_key, created_at);
CREATE INDEX idx_unlimited_requests_status_created ON unlimited_requests(status, created_at);

INSERT INTO centers (id, name, status, created_at, updated_at)
VALUES ('center_default', 'Default Center', 'active', '2026-06-28T00:00:00.000Z', '2026-06-28T00:00:00.000Z');

INSERT INTO admin_users (
  id,
  email,
  password_salt,
  password_hash,
  role,
  status,
  center_id,
  created_at,
  updated_at
) VALUES (
  'user_super_admin',
  'admin@velozz.com',
  'seed_salt_velozz',
  '98078c691690dca6d1b849a4a50b298c37d3d7c92ba3d9a4cff5a2ab9dac8685',
  'super_admin',
  'active',
  'center_default',
  '2026-06-28T00:00:00.000Z',
  '2026-06-28T00:00:00.000Z'
);

INSERT INTO api_keys (
  api_key,
  center_id,
  label,
  status,
  daily_limit,
  unlimited_until,
  last_used_at,
  rotated_to_api_key,
  created_at,
  updated_at
) VALUES (
  'velozzadminseed',
  'center_default',
  'Seeded Admin Key',
  'active',
  1000,
  NULL,
  NULL,
  NULL,
  '2026-06-28T00:00:00.000Z',
  '2026-06-28T00:00:00.000Z'
) ON CONFLICT(api_key) DO UPDATE SET
  center_id = excluded.center_id,
  label = excluded.label,
  status = excluded.status,
  daily_limit = excluded.daily_limit,
  unlimited_until = excluded.unlimited_until,
  last_used_at = excluded.last_used_at,
  rotated_to_api_key = excluded.rotated_to_api_key,
  updated_at = excluded.updated_at;
