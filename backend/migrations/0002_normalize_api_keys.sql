PRAGMA foreign_keys = OFF;

BEGIN TRANSACTION;

CREATE TEMP TABLE api_key_renames (
  old_key TEXT PRIMARY KEY,
  new_key TEXT NOT NULL UNIQUE
);

INSERT INTO api_key_renames (old_key, new_key)
SELECT
  api_key,
  replace(
    replace(
      replace(
        replace(
          replace(
            replace(
              replace(
                replace(
                  replace(
                    replace(
                      replace(
                        replace(
                          replace(
                            replace(
                              replace(
                                replace(replace(substr(api_key, 8), '_', ''), '0', 'g'),
                              '1', 'h'),
                            '2', 'i'),
                          '3', 'j'),
                        '4', 'k'),
                      '5', 'l'),
                    '6', 'm'),
                  '7', 'n'),
                '8', 'o'),
              '9', 'p'),
            'a', 'q'),
          'b', 'r'),
        'c', 's'),
      'd', 't'),
    'e', 'u'),
  'f', 'v')
FROM api_keys
WHERE api_key LIKE 'velozz\_%' ESCAPE '\';

UPDATE api_key_usage_daily
SET api_key = (
  SELECT new_key
  FROM api_key_renames
  WHERE old_key = api_key_usage_daily.api_key
)
WHERE EXISTS (
  SELECT 1
  FROM api_key_renames
  WHERE old_key = api_key_usage_daily.api_key
);

UPDATE device_commands
SET api_key = (
  SELECT new_key
  FROM api_key_renames
  WHERE old_key = device_commands.api_key
)
WHERE EXISTS (
  SELECT 1
  FROM api_key_renames
  WHERE old_key = device_commands.api_key
);

UPDATE device_events
SET api_key = (
  SELECT new_key
  FROM api_key_renames
  WHERE old_key = device_events.api_key
)
WHERE EXISTS (
  SELECT 1
  FROM api_key_renames
  WHERE old_key = device_events.api_key
);

UPDATE device_state
SET api_key = (
  SELECT new_key
  FROM api_key_renames
  WHERE old_key = device_state.api_key
)
WHERE EXISTS (
  SELECT 1
  FROM api_key_renames
  WHERE old_key = device_state.api_key
);

UPDATE unlimited_requests
SET api_key = (
  SELECT new_key
  FROM api_key_renames
  WHERE old_key = unlimited_requests.api_key
)
WHERE EXISTS (
  SELECT 1
  FROM api_key_renames
  WHERE old_key = unlimited_requests.api_key
);

UPDATE api_keys
SET rotated_to_api_key = (
  SELECT new_key
  FROM api_key_renames
  WHERE old_key = api_keys.rotated_to_api_key
)
WHERE EXISTS (
  SELECT 1
  FROM api_key_renames
  WHERE old_key = api_keys.rotated_to_api_key
);

UPDATE api_keys
SET api_key = (
  SELECT new_key
  FROM api_key_renames
  WHERE old_key = api_keys.api_key
)
WHERE EXISTS (
  SELECT 1
  FROM api_key_renames
  WHERE old_key = api_keys.api_key
);

DROP TABLE api_key_renames;

COMMIT;

PRAGMA foreign_keys = ON;
