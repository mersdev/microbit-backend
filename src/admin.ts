import { HTTPException } from "hono/http-exception";
import { assertCenterAccess } from "./auth.ts";
import {
  aggregateTodayUsage,
  createApiKey,
  createAuditLog,
  createCommand,
  createUnlimitedRequest,
  findApiKey,
  findDeviceState,
  findUnlimitedRequest,
  findUsageForDate,
  listApiKeys,
  listAuditLogs,
  listCommandsForApiKey,
  listEventsForApiKey,
  listUnlimitedRequests,
  listUsageForApiKey,
  listUsageHistory,
  setApiKeyRotation,
  setApiKeyUnlimitedUntil,
  updateApiKeyStatus,
  updateUnlimitedRequestStatus,
} from "./db.ts";
import { addDays, isOnline, klDate, nowIso, validateUnlimitedUntil } from "./quota.ts";
import { DEFAULT_DAILY_LIMIT, type AppEnv, type SessionUser } from "./types.ts";

const jsonError = (status: number, error: string) =>
  new Response(JSON.stringify({ ok: false, error }), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

const ensureApiKeyAccess = async (
  db: D1Database,
  user: SessionUser,
  apiKey: string,
) => {
  const row = await findApiKey(db, apiKey);
  if (!row) {
    throw new HTTPException(404, { res: jsonError(404, "NOT_FOUND") });
  }
  assertCenterAccess(user, row.centerId);
  return row;
};

const audit = async (
  db: D1Database,
  userId: string,
  action: string,
  targetType: string,
  targetId: string,
  details?: unknown,
) => {
  await createAuditLog(db, {
    id: crypto.randomUUID(),
    userId,
    action,
    targetType,
    targetId,
    detailsJson: details ? JSON.stringify(details) : null,
    createdAt: nowIso(),
  });
};

const apiKeyResponse = async (db: D1Database, apiKey: string) => {
  const row = await findApiKey(db, apiKey);
  if (!row) {
    return null;
  }
  const usage = await findUsageForDate(db, apiKey, klDate());
  return {
    ...row,
    usageToday: usage ?? {
      apiKey,
      usageDate: klDate(),
      requestCount: 0,
      pullCount: 0,
      sendCount: 0,
      ackCount: 0,
      heartbeatCount: 0,
      updatedAt: row.updatedAt,
    },
  };
};

const scopedApiKeys = async (db: D1Database, user: SessionUser) =>
  listApiKeys(db, user.role === "super_admin" ? null : user.centerId);

const makeApiKey = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  const suffix = [...bytes]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `velozz_${suffix}`;
};

export const listApiKeysHandler = async (c: import("hono").Context<AppEnv>) => {
  const user = c.get("session");
  const rows = await scopedApiKeys(c.env.DB, user);
  const items = await Promise.all(rows.map((row) => apiKeyResponse(c.env.DB, row.apiKey)));
  return c.json({ ok: true, items: items.filter(Boolean) });
};

export const createApiKeyHandler = async (c: import("hono").Context<AppEnv>) => {
  const user = c.get("session");
  const body = await c.req
    .json<{ centerId?: string; label?: string; dailyLimit?: number }>()
    .catch(() => ({}));
  const now = nowIso();
  const centerId =
    user.role === "super_admin" ? body.centerId ?? "center_default" : user.centerId;

  if (!centerId) {
    return c.json({ ok: false, error: "CENTER_REQUIRED" }, 400);
  }

  const row = {
    apiKey: makeApiKey(),
    centerId,
    label: body.label ?? null,
    status: "active" as const,
    dailyLimit: body.dailyLimit ?? DEFAULT_DAILY_LIMIT,
    unlimitedUntil: null,
    lastUsedAt: null,
    rotatedToApiKey: null,
    createdAt: now,
    updatedAt: now,
  };
  await createApiKey(c.env.DB, row);
  await audit(c.env.DB, user.id, "api_key.create", "api_key", row.apiKey, {
    centerId,
  });
  return c.json({ ok: true, item: await apiKeyResponse(c.env.DB, row.apiKey) }, 201);
};

export const getApiKeyHandler = async (c: import("hono").Context<AppEnv>) => {
  const user = c.get("session");
  const apiKey = c.req.param("apiKey");
  await ensureApiKeyAccess(c.env.DB, user, apiKey);
  return c.json({ ok: true, item: await apiKeyResponse(c.env.DB, apiKey) });
};

const setStatusHandler =
  (status: "active" | "disabled", action: string) =>
  async (c: import("hono").Context<AppEnv>) => {
    const user = c.get("session");
    const apiKey = c.req.param("apiKey");
    await ensureApiKeyAccess(c.env.DB, user, apiKey);
    await updateApiKeyStatus(c.env.DB, apiKey, status, nowIso());
    await audit(c.env.DB, user.id, action, "api_key", apiKey);
    return c.json({ ok: true, item: await apiKeyResponse(c.env.DB, apiKey) });
  };

export const disableApiKeyHandler = setStatusHandler("disabled", "api_key.disable");
export const enableApiKeyHandler = setStatusHandler("active", "api_key.enable");

export const rotateApiKeyHandler = async (c: import("hono").Context<AppEnv>) => {
  const user = c.get("session");
  const apiKey = c.req.param("apiKey");
  const current = await ensureApiKeyAccess(c.env.DB, user, apiKey);
  const now = nowIso();
  const nextApiKey = makeApiKey();

  await createApiKey(c.env.DB, {
    apiKey: nextApiKey,
    centerId: current.centerId,
    label: current.label,
    status: "active",
    dailyLimit: current.dailyLimit,
    unlimitedUntil: current.unlimitedUntil,
    lastUsedAt: null,
    rotatedToApiKey: null,
    createdAt: now,
    updatedAt: now,
  });
  await setApiKeyRotation(c.env.DB, apiKey, nextApiKey, now);
  await audit(c.env.DB, user.id, "api_key.rotate", "api_key", apiKey, {
    rotatedToApiKey: nextApiKey,
  });
  return c.json({
    ok: true,
    oldKey: await apiKeyResponse(c.env.DB, apiKey),
    newKey: await apiKeyResponse(c.env.DB, nextApiKey),
  });
};

export const createCommandHandler = async (c: import("hono").Context<AppEnv>) => {
  const user = c.get("session");
  const apiKey = c.req.param("apiKey");
  await ensureApiKeyAccess(c.env.DB, user, apiKey);
  const body = await c.req
    .json<{ name?: string; value?: string; expiresAt?: string | null }>()
    .catch(() => ({}));

  if (!body.name || body.value === undefined) {
    return c.json({ ok: false, error: "INVALID_BODY" }, 400);
  }

  const now = nowIso();
  const row = {
    id: crypto.randomUUID(),
    apiKey,
    name: body.name,
    value: String(body.value),
    status: "pending" as const,
    expiresAt: body.expiresAt ?? null,
    pulledAt: null,
    acknowledgedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  await createCommand(c.env.DB, row);
  await audit(c.env.DB, user.id, "api_key.command", "device_command", row.id, {
    apiKey,
    name: row.name,
  });
  return c.json({ ok: true, item: row }, 201);
};

export const listCommandsHandler = async (c: import("hono").Context<AppEnv>) => {
  const user = c.get("session");
  const apiKey = c.req.param("apiKey");
  await ensureApiKeyAccess(c.env.DB, user, apiKey);
  return c.json({ ok: true, items: await listCommandsForApiKey(c.env.DB, apiKey) });
};

export const listEventsHandler = async (c: import("hono").Context<AppEnv>) => {
  const user = c.get("session");
  const apiKey = c.req.param("apiKey");
  await ensureApiKeyAccess(c.env.DB, user, apiKey);
  return c.json({ ok: true, items: await listEventsForApiKey(c.env.DB, apiKey) });
};

export const getStateHandler = async (c: import("hono").Context<AppEnv>) => {
  const user = c.get("session");
  const apiKey = c.req.param("apiKey");
  await ensureApiKeyAccess(c.env.DB, user, apiKey);
  const state = await findDeviceState(c.env.DB, apiKey);
  return c.json({
    ok: true,
    item: state
      ? {
          ...state,
          online: isOnline(state.lastSeenAt),
        }
      : null,
  });
};

export const usageTodayHandler = async (c: import("hono").Context<AppEnv>) => {
  const user = c.get("session");
  const rows = await scopedApiKeys(c.env.DB, user);
  const apiKeys = rows.map((row) => row.apiKey);
  const usageDate = klDate();
  const totals = await aggregateTodayUsage(c.env.DB, apiKeys, usageDate);
  const items = await Promise.all(
    rows.map(async (row) => ({
      ...(await apiKeyResponse(c.env.DB, row.apiKey)),
    })),
  );
  return c.json({ ok: true, usageDate, totals, items });
};

export const apiKeyUsageHandler = async (c: import("hono").Context<AppEnv>) => {
  const user = c.get("session");
  const apiKey = c.req.param("apiKey");
  await ensureApiKeyAccess(c.env.DB, user, apiKey);
  return c.json({ ok: true, items: await listUsageForApiKey(c.env.DB, apiKey) });
};

export const usageHistoryHandler = async (c: import("hono").Context<AppEnv>) => {
  const user = c.get("session");
  const days = Math.max(1, Number(c.req.query("days") ?? "7") || 7);
  const rows = await scopedApiKeys(c.env.DB, user);
  const startDate = klDate(addDays(nowIso(), -(days - 1)));
  return c.json({
    ok: true,
    days,
    items: await listUsageHistory(
      c.env.DB,
      rows.map((row) => row.apiKey),
      startDate,
    ),
  });
};

export const requestUnlimitedHandler = async (c: import("hono").Context<AppEnv>) => {
  const user = c.get("session");
  const apiKey = c.req.param("apiKey");
  await ensureApiKeyAccess(c.env.DB, user, apiKey);
  const body = await c.req
    .json<{ requestedUntil?: string; reason?: string }>()
    .catch(() => ({}));

  const now = nowIso();
  if (!body.requestedUntil || !validateUnlimitedUntil(body.requestedUntil, now)) {
    return c.json({ ok: false, error: "INVALID_UNLIMITED_WINDOW" }, 400);
  }

  const row = {
    id: crypto.randomUUID(),
    apiKey,
    requestedByUserId: user.id,
    requestedUntil: new Date(body.requestedUntil).toISOString(),
    reason: body.reason ?? null,
    status: "pending" as const,
    reviewedByUserId: null,
    reviewedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  await createUnlimitedRequest(c.env.DB, row);
  await audit(
    c.env.DB,
    user.id,
    "unlimited.request",
    "unlimited_request",
    row.id,
    { apiKey },
  );
  return c.json({ ok: true, item: row }, 201);
};

export const listUnlimitedRequestsHandler = async (
  c: import("hono").Context<AppEnv>,
) => {
  const user = c.get("session");
  const rows = await scopedApiKeys(c.env.DB, user);
  const apiKeys = user.role === "super_admin" ? undefined : rows.map((row) => row.apiKey);
  return c.json({ ok: true, items: await listUnlimitedRequests(c.env.DB, apiKeys) });
};

const reviewUnlimitedHandler =
  (status: "approved" | "rejected") =>
  async (c: import("hono").Context<AppEnv>) => {
    const user = c.get("session");
    const requestId = c.req.param("requestId");
    const request = await findUnlimitedRequest(c.env.DB, requestId);
    if (!request) {
      return c.json({ ok: false, error: "NOT_FOUND" }, 404);
    }

    const now = nowIso();
    await updateUnlimitedRequestStatus(c.env.DB, requestId, status, user.id, now);
    if (status === "approved") {
      await setApiKeyUnlimitedUntil(c.env.DB, request.apiKey, request.requestedUntil, now);
    }
    await audit(
      c.env.DB,
      user.id,
      `unlimited.${status}`,
      "unlimited_request",
      requestId,
      { apiKey: request.apiKey },
    );
    return c.json({
      ok: true,
      item: await findUnlimitedRequest(c.env.DB, requestId),
      apiKey: await apiKeyResponse(c.env.DB, request.apiKey),
    });
  };

export const approveUnlimitedHandler = reviewUnlimitedHandler("approved");
export const rejectUnlimitedHandler = reviewUnlimitedHandler("rejected");

export const cancelUnlimitedHandler = async (c: import("hono").Context<AppEnv>) => {
  const user = c.get("session");
  const apiKey = c.req.param("apiKey");
  await ensureApiKeyAccess(c.env.DB, user, apiKey);
  await setApiKeyUnlimitedUntil(c.env.DB, apiKey, null, nowIso());
  await audit(c.env.DB, user.id, "unlimited.cancel", "api_key", apiKey);
  return c.json({ ok: true, item: await apiKeyResponse(c.env.DB, apiKey) });
};

export const auditLogHandler = async (c: import("hono").Context<AppEnv>) => {
  return c.json({ ok: true, items: await listAuditLogs(c.env.DB) });
};
