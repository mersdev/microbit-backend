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

const text = (body: string) =>
  new Response(body, {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });

const invalidKey = () => text("INVALID_KEY");

const formatOk = (left: number) => text(`OK|LEFT=${left}`);

const formatLimit = (poll = false) =>
  text(poll ? `LIMIT|POLL=${MICROBIT_LIMIT_POLL_MS}|LEFT=0` : "LIMIT|LEFT=0");

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
    return formatLimit(true);
  }

  await touchApiKeyLastUsedAt(c.env.DB, apiKey.apiKey, now);
  const command = await getOldestPendingCommand(c.env.DB, apiKey.apiKey, now);
  if (!command) {
    return text(`NONE|POLL=${MICROBIT_POLL_MS}|LEFT=${quota.left}`);
  }

  await markCommandPulled(c.env.DB, command.id, now);
  return text(
    `CMD|cmdId=${command.id}|name=${command.name}|value=${command.value}|POLL=${MICROBIT_POLL_MS}|LEFT=${quota.left}`,
  );
};

export const sendHandler = async (c: import("hono").Context<AppEnv>) => {
  const apiKey = await getApiKey(c);
  const name = c.req.query("name")?.trim();
  const value = c.req.query("value")?.trim();
  if (!apiKey) {
    return invalidKey();
  }
  if (!name || value === undefined) {
    return text("INVALID_REQUEST");
  }

  const now = nowIso();
  const quota = await consumeQuota(c.env.DB, apiKey, "send", now);
  if (!quota.ok) {
    return formatLimit();
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
  return formatOk(quota.left);
};

export const ackHandler = async (c: import("hono").Context<AppEnv>) => {
  const apiKey = await getApiKey(c);
  const cmdId = c.req.query("cmdId")?.trim();
  if (!apiKey) {
    return invalidKey();
  }
  if (!cmdId) {
    return text("INVALID_REQUEST");
  }

  const now = nowIso();
  const quota = await consumeQuota(c.env.DB, apiKey, "ack", now);
  if (!quota.ok) {
    return formatLimit();
  }

  const command = await findCommand(c.env.DB, cmdId);
  if (!command || command.apiKey !== apiKey.apiKey) {
    return text("INVALID_COMMAND");
  }

  await touchApiKeyLastUsedAt(c.env.DB, apiKey.apiKey, now);
  await acknowledgeCommand(c.env.DB, cmdId, apiKey.apiKey, now);
  return formatOk(quota.left);
};

export const heartbeatHandler = async (c: import("hono").Context<AppEnv>) => {
  const apiKey = await getApiKey(c);
  if (!apiKey) {
    return invalidKey();
  }

  const now = nowIso();
  const quota = await consumeQuota(c.env.DB, apiKey, "heartbeat", now);
  if (!quota.ok) {
    return formatLimit();
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
  return formatOk(quota.left);
};
