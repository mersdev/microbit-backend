import type {
  AdminUserRow,
  ApiKeyRow,
  AuditLogRow,
  DeviceCommandRow,
  DeviceEventRow,
  DeviceStateRow,
  SessionRow,
  UnlimitedRequestRow,
  UsageRow,
  UsageKind,
  UserRole,
} from "./types.ts";

const asIso = (value: string | null | undefined) => value ?? null;

const toUser = (row: Record<string, unknown> | null): AdminUserRow | null =>
  row
    ? {
        id: String(row.id),
        email: String(row.email),
        passwordSalt: String(row.password_salt),
        passwordHash: String(row.password_hash),
        role: row.role as AdminUserRow["role"],
        status: row.status as AdminUserRow["status"],
        centerId: row.center_id ? String(row.center_id) : null,
        createdAt: String(row.created_at),
        updatedAt: String(row.updated_at),
      }
    : null;

const toSession = (row: Record<string, unknown> | null): SessionRow | null =>
  row
    ? {
        id: String(row.id),
        userId: String(row.user_id),
        sessionToken: String(row.session_token),
        expiresAt: String(row.expires_at),
        createdAt: String(row.created_at),
      }
    : null;

const toApiKey = (row: Record<string, unknown> | null): ApiKeyRow | null =>
  row
    ? {
        apiKey: String(row.api_key),
        centerId: String(row.center_id),
        label: row.label ? String(row.label) : null,
        status: row.status as ApiKeyRow["status"],
        dailyLimit: Number(row.daily_limit),
        unlimitedUntil: asIso(row.unlimited_until as string | null),
        lastUsedAt: asIso(row.last_used_at as string | null),
        rotatedToApiKey: row.rotated_to_api_key
          ? String(row.rotated_to_api_key)
          : null,
        createdAt: String(row.created_at),
        updatedAt: String(row.updated_at),
      }
    : null;

const toUsage = (row: Record<string, unknown> | null): UsageRow | null =>
  row
    ? {
        apiKey: String(row.api_key),
        usageDate: String(row.usage_date),
        requestCount: Number(row.request_count),
        pullCount: Number(row.pull_count),
        sendCount: Number(row.send_count),
        ackCount: Number(row.ack_count),
        heartbeatCount: Number(row.heartbeat_count),
        updatedAt: String(row.updated_at),
      }
    : null;

const toCommand = (row: Record<string, unknown> | null): DeviceCommandRow | null =>
  row
    ? {
        id: String(row.id),
        apiKey: String(row.api_key),
        name: String(row.name),
        value: String(row.value),
        status: row.status as DeviceCommandRow["status"],
        expiresAt: asIso(row.expires_at as string | null),
        pulledAt: asIso(row.pulled_at as string | null),
        acknowledgedAt: asIso(row.acknowledged_at as string | null),
        createdAt: String(row.created_at),
        updatedAt: String(row.updated_at),
      }
    : null;

const toState = (row: Record<string, unknown> | null): DeviceStateRow | null =>
  row
    ? {
        apiKey: String(row.api_key),
        lastEventName: row.last_event_name ? String(row.last_event_name) : null,
        lastEventValue: row.last_event_value ? String(row.last_event_value) : null,
        lastSeenAt: asIso(row.last_seen_at as string | null),
        updatedAt: String(row.updated_at),
      }
    : null;

const toEvent = (row: Record<string, unknown> | null): DeviceEventRow | null =>
  row
    ? {
        id: String(row.id),
        apiKey: String(row.api_key),
        name: String(row.name),
        value: String(row.value),
        createdAt: String(row.created_at),
      }
    : null;

const toUnlimited = (
  row: Record<string, unknown> | null,
): UnlimitedRequestRow | null =>
  row
    ? {
        id: String(row.id),
        apiKey: String(row.api_key),
        requestedByUserId: String(row.requested_by_user_id),
        requestedUntil: String(row.requested_until),
        reason: row.reason ? String(row.reason) : null,
        status: row.status as UnlimitedRequestRow["status"],
        reviewedByUserId: row.reviewed_by_user_id
          ? String(row.reviewed_by_user_id)
          : null,
        reviewedAt: asIso(row.reviewed_at as string | null),
        createdAt: String(row.created_at),
        updatedAt: String(row.updated_at),
      }
    : null;

const toAudit = (row: Record<string, unknown> | null): AuditLogRow | null =>
  row
    ? {
        id: String(row.id),
        userId: String(row.user_id),
        action: String(row.action),
        targetType: String(row.target_type),
        targetId: String(row.target_id),
        detailsJson: row.details_json ? String(row.details_json) : null,
        createdAt: String(row.created_at),
      }
    : null;

const allRows = async <T>(
  stmt: D1PreparedStatement,
  mapper: (row: Record<string, unknown> | null) => T | null,
): Promise<T[]> => {
  const result = await stmt.all<Record<string, unknown>>();
  return result.results
    .map((row) => mapper(row))
    .filter((row): row is T => row !== null);
};

export const findUserByEmail = async (db: D1Database, email: string) =>
  toUser(
    await db
      .prepare("SELECT * FROM admin_users WHERE email = ? LIMIT 1")
      .bind(email)
      .first<Record<string, unknown>>(),
  );

export const findUserById = async (db: D1Database, userId: string) =>
  toUser(
    await db
      .prepare("SELECT * FROM admin_users WHERE id = ? LIMIT 1")
      .bind(userId)
      .first<Record<string, unknown>>(),
  );

export const createSession = async (
  db: D1Database,
  session: SessionRow,
) => {
  await db
    .prepare(
      "INSERT INTO admin_sessions (id, user_id, session_token, expires_at, created_at) VALUES (?, ?, ?, ?, ?)",
    )
    .bind(
      session.id,
      session.userId,
      session.sessionToken,
      session.expiresAt,
      session.createdAt,
    )
    .run();
};

export const findSessionByToken = async (db: D1Database, token: string) =>
  toSession(
    await db
      .prepare("SELECT * FROM admin_sessions WHERE session_token = ? LIMIT 1")
      .bind(token)
      .first<Record<string, unknown>>(),
  );

export const deleteSessionByToken = async (db: D1Database, token: string) => {
  await db
    .prepare("DELETE FROM admin_sessions WHERE session_token = ?")
    .bind(token)
    .run();
};

export const listApiKeys = async (
  db: D1Database,
  centerId?: string | null,
) => {
  if (centerId) {
    return allRows(
      db
        .prepare(
          "SELECT * FROM api_keys WHERE center_id = ? ORDER BY created_at DESC",
        )
        .bind(centerId),
      toApiKey,
    );
  }
  return allRows(
    db.prepare("SELECT * FROM api_keys ORDER BY created_at DESC"),
    toApiKey,
  );
};

export const findApiKey = async (db: D1Database, apiKey: string) =>
  toApiKey(
    await db
      .prepare("SELECT * FROM api_keys WHERE api_key = ? LIMIT 1")
      .bind(apiKey)
      .first<Record<string, unknown>>(),
  );

export const createApiKey = async (db: D1Database, row: ApiKeyRow) => {
  await db
    .prepare(
      "INSERT INTO api_keys (api_key, center_id, label, status, daily_limit, unlimited_until, last_used_at, rotated_to_api_key, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(
      row.apiKey,
      row.centerId,
      row.label,
      row.status,
      row.dailyLimit,
      row.unlimitedUntil,
      row.lastUsedAt,
      row.rotatedToApiKey,
      row.createdAt,
      row.updatedAt,
    )
    .run();
};

export const updateApiKeyStatus = async (
  db: D1Database,
  apiKey: string,
  status: ApiKeyRow["status"],
  updatedAt: string,
) => {
  await db
    .prepare(
      "UPDATE api_keys SET status = ?, updated_at = ? WHERE api_key = ?",
    )
    .bind(status, updatedAt, apiKey)
    .run();
};

export const setApiKeyRotation = async (
  db: D1Database,
  apiKey: string,
  rotatedToApiKey: string,
  updatedAt: string,
) => {
  await db
    .prepare(
      "UPDATE api_keys SET status = 'rotated', rotated_to_api_key = ?, updated_at = ? WHERE api_key = ?",
    )
    .bind(rotatedToApiKey, updatedAt, apiKey)
    .run();
};

export const setApiKeyUnlimitedUntil = async (
  db: D1Database,
  apiKey: string,
  unlimitedUntil: string | null,
  updatedAt: string,
) => {
  await db
    .prepare(
      "UPDATE api_keys SET unlimited_until = ?, updated_at = ? WHERE api_key = ?",
    )
    .bind(unlimitedUntil, updatedAt, apiKey)
    .run();
};

export const touchApiKeyLastUsedAt = async (
  db: D1Database,
  apiKey: string,
  lastUsedAt: string,
) => {
  await db
    .prepare(
      "UPDATE api_keys SET last_used_at = ?, updated_at = ? WHERE api_key = ?",
    )
    .bind(lastUsedAt, lastUsedAt, apiKey)
    .run();
};

export const findUsageForDate = async (
  db: D1Database,
  apiKey: string,
  usageDate: string,
) =>
  toUsage(
    await db
      .prepare(
        "SELECT * FROM api_key_usage_daily WHERE api_key = ? AND usage_date = ? LIMIT 1",
      )
      .bind(apiKey, usageDate)
      .first<Record<string, unknown>>(),
  );

export const upsertUsage = async (
  db: D1Database,
  usageDate: string,
  apiKey: string,
  kind: UsageKind,
  updatedAt: string,
) => {
  const row = await findUsageForDate(db, apiKey, usageDate);
  const next = {
    requestCount: (row?.requestCount ?? 0) + 1,
    pullCount: (row?.pullCount ?? 0) + (kind === "pull" ? 1 : 0),
    sendCount: (row?.sendCount ?? 0) + (kind === "send" ? 1 : 0),
    ackCount: (row?.ackCount ?? 0) + (kind === "ack" ? 1 : 0),
    heartbeatCount: (row?.heartbeatCount ?? 0) + (kind === "heartbeat" ? 1 : 0),
  };

  await db
    .prepare(
      `INSERT INTO api_key_usage_daily
        (api_key, usage_date, request_count, pull_count, send_count, ack_count, heartbeat_count, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(api_key, usage_date) DO UPDATE SET
        request_count = excluded.request_count,
        pull_count = excluded.pull_count,
        send_count = excluded.send_count,
        ack_count = excluded.ack_count,
        heartbeat_count = excluded.heartbeat_count,
        updated_at = excluded.updated_at`,
    )
    .bind(
      apiKey,
      usageDate,
      next.requestCount,
      next.pullCount,
      next.sendCount,
      next.ackCount,
      next.heartbeatCount,
      updatedAt,
    )
    .run();

  return {
    apiKey,
    usageDate,
    ...next,
    updatedAt,
  } satisfies UsageRow;
};

export const listUsageForApiKey = async (db: D1Database, apiKey: string) =>
  allRows(
    db
      .prepare(
        "SELECT * FROM api_key_usage_daily WHERE api_key = ? ORDER BY usage_date DESC",
      )
      .bind(apiKey),
    toUsage,
  );

export const listUsageHistory = async (
  db: D1Database,
  apiKeys: string[],
  startDate: string,
) => {
  if (apiKeys.length === 0) {
    return [] as UsageRow[];
  }
  const placeholders = apiKeys.map(() => "?").join(", ");
  return allRows(
    db
      .prepare(
        `SELECT * FROM api_key_usage_daily
         WHERE api_key IN (${placeholders}) AND usage_date >= ?
         ORDER BY usage_date DESC, api_key ASC`,
      )
      .bind(...apiKeys, startDate),
    toUsage,
  );
};

export const createCommand = async (db: D1Database, row: DeviceCommandRow) => {
  await db
    .prepare(
      "INSERT INTO device_commands (id, api_key, name, value, status, expires_at, pulled_at, acknowledged_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(
      row.id,
      row.apiKey,
      row.name,
      row.value,
      row.status,
      row.expiresAt,
      row.pulledAt,
      row.acknowledgedAt,
      row.createdAt,
      row.updatedAt,
    )
    .run();
};

export const getOldestPendingCommand = async (
  db: D1Database,
  apiKey: string,
  now: string,
) =>
  toCommand(
    await db
      .prepare(
        `SELECT * FROM device_commands
         WHERE api_key = ?
           AND status = 'pending'
           AND (expires_at IS NULL OR expires_at > ?)
         ORDER BY created_at ASC
         LIMIT 1`,
      )
      .bind(apiKey, now)
      .first<Record<string, unknown>>(),
  );

export const markCommandPulled = async (
  db: D1Database,
  commandId: string,
  now: string,
) => {
  await db
    .prepare(
      "UPDATE device_commands SET status = 'pulled', pulled_at = ?, updated_at = ? WHERE id = ?",
    )
    .bind(now, now, commandId)
    .run();
};

export const acknowledgeCommand = async (
  db: D1Database,
  commandId: string,
  apiKey: string,
  now: string,
) => {
  await db
    .prepare(
      "UPDATE device_commands SET status = 'acknowledged', acknowledged_at = ?, updated_at = ? WHERE id = ? AND api_key = ?",
    )
    .bind(now, now, commandId, apiKey)
    .run();
};

export const findCommand = async (db: D1Database, commandId: string) =>
  toCommand(
    await db
      .prepare("SELECT * FROM device_commands WHERE id = ? LIMIT 1")
      .bind(commandId)
      .first<Record<string, unknown>>(),
  );

export const listCommandsForApiKey = async (db: D1Database, apiKey: string) =>
  allRows(
    db
      .prepare(
        "SELECT * FROM device_commands WHERE api_key = ? ORDER BY created_at DESC",
      )
      .bind(apiKey),
    toCommand,
  );

export const createEvent = async (db: D1Database, row: DeviceEventRow) => {
  await db
    .prepare(
      "INSERT INTO device_events (id, api_key, name, value, created_at) VALUES (?, ?, ?, ?, ?)",
    )
    .bind(row.id, row.apiKey, row.name, row.value, row.createdAt)
    .run();
};

export const listEventsForApiKey = async (db: D1Database, apiKey: string) =>
  allRows(
    db
      .prepare(
        "SELECT * FROM device_events WHERE api_key = ? ORDER BY created_at DESC",
      )
      .bind(apiKey),
    toEvent,
  );

export const upsertDeviceState = async (
  db: D1Database,
  apiKey: string,
  lastEventName: string | null,
  lastEventValue: string | null,
  lastSeenAt: string | null,
  updatedAt: string,
) => {
  await db
    .prepare(
      `INSERT INTO device_state (api_key, last_event_name, last_event_value, last_seen_at, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(api_key) DO UPDATE SET
         last_event_name = excluded.last_event_name,
         last_event_value = excluded.last_event_value,
         last_seen_at = excluded.last_seen_at,
         updated_at = excluded.updated_at`,
    )
    .bind(apiKey, lastEventName, lastEventValue, lastSeenAt, updatedAt)
    .run();
};

export const findDeviceState = async (db: D1Database, apiKey: string) =>
  toState(
    await db
      .prepare("SELECT * FROM device_state WHERE api_key = ? LIMIT 1")
      .bind(apiKey)
      .first<Record<string, unknown>>(),
  );

export const createUnlimitedRequest = async (
  db: D1Database,
  row: UnlimitedRequestRow,
) => {
  await db
    .prepare(
      "INSERT INTO unlimited_requests (id, api_key, requested_by_user_id, requested_until, reason, status, reviewed_by_user_id, reviewed_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(
      row.id,
      row.apiKey,
      row.requestedByUserId,
      row.requestedUntil,
      row.reason,
      row.status,
      row.reviewedByUserId,
      row.reviewedAt,
      row.createdAt,
      row.updatedAt,
    )
    .run();
};

export const findUnlimitedRequest = async (db: D1Database, requestId: string) =>
  toUnlimited(
    await db
      .prepare("SELECT * FROM unlimited_requests WHERE id = ? LIMIT 1")
      .bind(requestId)
      .first<Record<string, unknown>>(),
  );

export const listUnlimitedRequests = async (
  db: D1Database,
  apiKeys?: string[],
) => {
  if (!apiKeys) {
    return allRows(
      db.prepare("SELECT * FROM unlimited_requests ORDER BY created_at DESC"),
      toUnlimited,
    );
  }
  if (apiKeys.length === 0) {
    return [] as UnlimitedRequestRow[];
  }
  const placeholders = apiKeys.map(() => "?").join(", ");
  return allRows(
    db
      .prepare(
        `SELECT * FROM unlimited_requests
         WHERE api_key IN (${placeholders})
         ORDER BY created_at DESC`,
      )
      .bind(...apiKeys),
    toUnlimited,
  );
};

export const updateUnlimitedRequestStatus = async (
  db: D1Database,
  requestId: string,
  status: UnlimitedRequestRow["status"],
  reviewedByUserId: string,
  reviewedAt: string,
) => {
  await db
    .prepare(
      "UPDATE unlimited_requests SET status = ?, reviewed_by_user_id = ?, reviewed_at = ?, updated_at = ? WHERE id = ?",
    )
    .bind(status, reviewedByUserId, reviewedAt, reviewedAt, requestId)
    .run();
};

export const createAuditLog = async (db: D1Database, row: AuditLogRow) => {
  await db
    .prepare(
      "INSERT INTO admin_audit_logs (id, user_id, action, target_type, target_id, details_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(
      row.id,
      row.userId,
      row.action,
      row.targetType,
      row.targetId,
      row.detailsJson,
      row.createdAt,
    )
    .run();
};

export const listAuditLogs = async (db: D1Database, action?: string) => {
  if (action) {
    return allRows(
      db
        .prepare(
          "SELECT * FROM admin_audit_logs WHERE action = ? ORDER BY created_at DESC",
        )
        .bind(action),
      toAudit,
    );
  }
  return allRows(
    db.prepare("SELECT * FROM admin_audit_logs ORDER BY created_at DESC"),
    toAudit,
  );
};

export const aggregateTodayUsage = async (
  db: D1Database,
  apiKeys: string[],
  usageDate: string,
) => {
  if (apiKeys.length === 0) {
    return {
      requestCount: 0,
      pullCount: 0,
      sendCount: 0,
      ackCount: 0,
      heartbeatCount: 0,
    };
  }
  const placeholders = apiKeys.map(() => "?").join(", ");
  const row = await db
    .prepare(
      `SELECT
         COALESCE(SUM(request_count), 0) AS request_count,
         COALESCE(SUM(pull_count), 0) AS pull_count,
         COALESCE(SUM(send_count), 0) AS send_count,
         COALESCE(SUM(ack_count), 0) AS ack_count,
         COALESCE(SUM(heartbeat_count), 0) AS heartbeat_count
       FROM api_key_usage_daily
       WHERE api_key IN (${placeholders}) AND usage_date = ?`,
    )
    .bind(...apiKeys, usageDate)
    .first<Record<string, unknown>>();

  return {
    requestCount: Number(row?.request_count ?? 0),
    pullCount: Number(row?.pull_count ?? 0),
    sendCount: Number(row?.send_count ?? 0),
    ackCount: Number(row?.ack_count ?? 0),
    heartbeatCount: Number(row?.heartbeat_count ?? 0),
  };
};

export const createCenterScopedUser = async (
  db: D1Database,
  user: {
    id: string;
    email: string;
    passwordSalt: string;
    passwordHash: string;
    role: UserRole;
    status: "active" | "disabled";
    centerId: string | null;
    createdAt: string;
    updatedAt: string;
  },
) => {
  await db
    .prepare(
      "INSERT INTO admin_users (id, email, password_salt, password_hash, role, status, center_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(
      user.id,
      user.email,
      user.passwordSalt,
      user.passwordHash,
      user.role,
      user.status,
      user.centerId,
      user.createdAt,
      user.updatedAt,
    )
    .run();
};
