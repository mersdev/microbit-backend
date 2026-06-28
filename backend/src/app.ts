import {
  createCommand,
  findApiKey,
  findDeviceState,
  listEventsForApiKey,
} from "./db.ts";
import { nowIso } from "./quota.ts";
import type { AppEnv, DeviceCommandRow } from "./types.ts";

const jsonError = (status: number, error: string) =>
  new Response(JSON.stringify({ ok: false, error }), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

const ensureDevice = async (db: D1Database, apiKey: string) => {
  const row = await findApiKey(db, apiKey);
  if (!row || row.status !== "active") {
    return null;
  }
  return row;
};

const makeCommand = (apiKey: string, body: { name: string; value: string }): DeviceCommandRow => {
  const now = nowIso();
  return {
    id: crypto.randomUUID(),
    apiKey,
    name: body.name,
    value: body.value,
    status: "pending",
    expiresAt: null,
    pulledAt: null,
    acknowledgedAt: null,
    createdAt: now,
    updatedAt: now,
  };
};

export const getDeviceHandler = async (c: import("hono").Context<AppEnv>) => {
  const apiKey = c.req.param("deviceId");
  const device = await ensureDevice(c.env.DB, apiKey);
  if (!device) {
    return jsonError(404, "INVALID_KEY");
  }

  const [state, events] = await Promise.all([
    findDeviceState(c.env.DB, apiKey),
    listEventsForApiKey(c.env.DB, apiKey),
  ]);

  return c.json({
    ok: true,
    item: {
      apiKey: device.apiKey,
      label: device.label,
      state,
      latestEvent: events[0] ?? null,
      recentEvents: events.slice(0, 10),
    },
  });
};

export const getDeviceStreamHandler = async (c: import("hono").Context<AppEnv>) => {
  const deviceId = c.req.param("deviceId");
  if (!c.env.STREAM) {
    return c.text("STREAM_UNAVAILABLE", 503);
  }
  const stub = c.env.STREAM.get(c.env.STREAM.idFromName(deviceId));
  return stub.fetch(
    `https://stream/v1/app/devices/${encodeURIComponent(deviceId)}/stream?deviceId=${encodeURIComponent(deviceId)}`,
    { headers: { accept: "text/event-stream" } },
  );
};

export const createDeviceCommandHandler = async (c: import("hono").Context<AppEnv>) => {
  const apiKey = c.req.param("deviceId");
  const device = await ensureDevice(c.env.DB, apiKey);
  if (!device) {
    return jsonError(404, "INVALID_KEY");
  }

  const body = await c.req
    .json<{ name?: string; value?: string | number }>()
    .catch(() => ({}));
  if (!body.name || body.value === undefined) {
    return jsonError(400, "INVALID_BODY");
  }

  const row = makeCommand(apiKey, {
    name: body.name.trim(),
    value: String(body.value),
  });
  await createCommand(c.env.DB, row);

  return c.json({ ok: true, item: row }, 201);
};
