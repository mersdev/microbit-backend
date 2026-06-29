DELETE FROM api_key_usage_daily;
DELETE FROM device_commands;
DELETE FROM device_events;
DELETE FROM device_state;
DELETE FROM unlimited_requests;
DELETE FROM api_keys;

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
  'velozzqtminsuut',
  'center_default',
  'Seeded Admin Key',
  'active',
  1000,
  NULL,
  NULL,
  NULL,
  '2026-06-29T00:00:00.000Z',
  '2026-06-29T00:00:00.000Z'
);
