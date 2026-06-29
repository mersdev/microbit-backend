import {
  acknowledgeCommand,
  createEvent,
  findApiKey,
  findCommand,
  findDeviceState,
  getOldestPendingCommand,
  markCommandPulled,
  touchApiKeyLastUsedAt,
  upsertDeviceState,
} from "./db.ts";
import { consumeQuota, nowIso } from "./quota.ts";
import {
  MICROBIT_LIMIT_POLL_MS,
  MICROBIT_POLL_MS,
  type AppEnv,
  type ApiKeyRow,
} from "./types.ts";
import { broadcastDeviceUpdate } from "./stream.ts";

type MicrobitPayload = Record<string, string | number | boolean | null>;

/**
 * Telegram-style JSON response.
 *
 * Important for Cytron ESP8266:
 * - JSON.stringify keeps this exact success pattern: "ok":true
 * - The MakeCode extension can simply search for "\"ok\":true"
 * - Always return HTTP 200 so ESP8266 does not need to handle many HTTP status codes
 */
const jsonResponse = (payload: MicrobitPayload) => {
  const body = JSON.stringify(payload);

  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "content-length": String(body.length),
    },
  });
};

const jsonOk = (payload: MicrobitPayload = {}) => {
  return jsonResponse({
    ok: true,
    ...payload,
  });
};

const jsonFail = (error: string, payload: MicrobitPayload = {}) => {
  return jsonResponse({
    ok: false,
    error,
    ...payload,
  });
};

const invalidKey = () => jsonFail("INVALID_KEY");

const getApiKey = async (
  c: import("hono").Context<AppEnv>,
): Promise<ApiKeyRow | null> => {
  const deviceId = c.req.query("deviceId")?.trim();

  if (!deviceId) {
    return null;
  }

  const apiKey = await findApiKey(c.env.DB, deviceId);

  if (!apiKey || apiKey.status !== "active") {
    return null;
  }

  return apiKey;
};

export const pullHandler = async (c: import("hono").Context<AppEnv>) => {
  const apiKey = await getApiKey(c);

  if (!apiKey) {
    return invalidKey();
  }

  const now = nowIso();
  const quota = await consumeQuota(c.env.DB, apiKey, "pull", now);

  if (!quota.ok) {
    return jsonFail("LIMIT", {
      type: "limit",
      poll: MICROBIT_LIMIT_POLL_MS,
      left: 0,
    });
  }

  await touchApiKeyLastUsedAt(c.env.DB, apiKey.apiKey, now);

  const command = await getOldestPendingCommand(c.env.DB, apiKey.apiKey, now);

  if (!command) {
    return jsonOk({
      type: "none",
      poll: MICROBIT_POLL_MS,
      left: quota.left,
    });
  }

  await markCommandPulled(c.env.DB, command.id, now);

  return jsonOk({
    type: "cmd",
    cmdId: command.id,
    name: command.name,
    value: command.value,
    poll: MICROBIT_POLL_MS,
    left: quota.left,
  });
};

export const sendHandler = async (c: import("hono").Context<AppEnv>) => {
  const apiKey = await getApiKey(c);
  const name = c.req.query("name")?.trim();
  const value = c.req.query("value")?.trim();

  if (!apiKey) {
    return invalidKey();
  }

  if (!name || value === undefined) {
    return jsonFail("INVALID_REQUEST");
  }

  const now = nowIso();
  const quota = await consumeQuota(c.env.DB, apiKey, "send", now);

  if (!quota.ok) {
    return jsonFail("LIMIT", {
      type: "limit",
      left: 0,
    });
  }

  await touchApiKeyLastUsedAt(c.env.DB, apiKey.apiKey, now);

  await createEvent(c.env.DB, {
    id: crypto.randomUUID(),
    apiKey: apiKey.apiKey,
    name,
    value,
    createdAt: now,
  });

  await upsertDeviceState(c.env.DB, apiKey.apiKey, name, value, now, now);

  await broadcastDeviceUpdate(c.env, apiKey.apiKey, {
    kind: "event",
    item: {
      apiKey: apiKey.apiKey,
      name,
      value,
      createdAt: now,
    },
    state: {
      apiKey: apiKey.apiKey,
      lastEventName: name,
      lastEventValue: value,
      lastSeenAt: now,
      updatedAt: now,
    },
  });

  return jsonOk({
    type: "send",
    left: quota.left,
  });
};

export const ackHandler = async (c: import("hono").Context<AppEnv>) => {
  const apiKey = await getApiKey(c);
  const cmdId = c.req.query("cmdId")?.trim();

  if (!apiKey) {
    return invalidKey();
  }

  if (!cmdId) {
    return jsonFail("INVALID_REQUEST");
  }

  const now = nowIso();
  const quota = await consumeQuota(c.env.DB, apiKey, "ack", now);

  if (!quota.ok) {
    return jsonFail("LIMIT", {
      type: "limit",
      left: 0,
    });
  }

  const command = await findCommand(c.env.DB, cmdId);

  if (!command || command.apiKey !== apiKey.apiKey) {
    return jsonFail("INVALID_COMMAND");
  }

  await touchApiKeyLastUsedAt(c.env.DB, apiKey.apiKey, now);
  await acknowledgeCommand(c.env.DB, cmdId, apiKey.apiKey, now);

  return jsonOk({
    type: "ack",
    left: quota.left,
  });
};

export const heartbeatHandler = async (c: import("hono").Context<AppEnv>) => {
  const apiKey = await getApiKey(c);

  if (!apiKey) {
    return invalidKey();
  }

  const now = nowIso();
  const quota = await consumeQuota(c.env.DB, apiKey, "heartbeat", now);

  if (!quota.ok) {
    return jsonFail("LIMIT", {
      type: "limit",
      left: 0,
    });
  }

  await touchApiKeyLastUsedAt(c.env.DB, apiKey.apiKey, now);

  const state = await findDeviceState(c.env.DB, apiKey.apiKey);

  await upsertDeviceState(
    c.env.DB,
    apiKey.apiKey,
    state?.lastEventName ?? null,
    state?.lastEventValue ?? null,
    now,
    now,
  );

  await broadcastDeviceUpdate(c.env, apiKey.apiKey, {
    kind: "heartbeat",
    state: {
      apiKey: apiKey.apiKey,
      lastEventName: state?.lastEventName ?? null,
      lastEventValue: state?.lastEventValue ?? null,
      lastSeenAt: now,
      updatedAt: now,
    },
  });

  return jsonOk({
    type: "heartbeat",
    left: quota.left,
  });
};
