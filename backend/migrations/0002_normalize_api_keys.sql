PRAGMA defer_foreign_keys = on;

UPDATE api_key_usage_daily
SET api_key = 'velozz' || replace(
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
WHERE api_key LIKE 'velozz\_%' ESCAPE '\';

UPDATE device_commands
SET api_key = 'velozz' || replace(
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
WHERE api_key LIKE 'velozz\_%' ESCAPE '\';

UPDATE device_events
SET api_key = 'velozz' || replace(
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
WHERE api_key LIKE 'velozz\_%' ESCAPE '\';

UPDATE device_state
SET api_key = 'velozz' || replace(
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
WHERE api_key LIKE 'velozz\_%' ESCAPE '\';

UPDATE unlimited_requests
SET api_key = 'velozz' || replace(
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
WHERE api_key LIKE 'velozz\_%' ESCAPE '\';

UPDATE api_keys
SET rotated_to_api_key = 'velozz' || replace(
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
                              replace(replace(substr(rotated_to_api_key, 8), '_', ''), '0', 'g'),
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
WHERE rotated_to_api_key LIKE 'velozz\_%' ESCAPE '\';

UPDATE api_keys
SET api_key = 'velozz' || replace(
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
WHERE api_key LIKE 'velozz\_%' ESCAPE '\';

PRAGMA defer_foreign_keys = off;
