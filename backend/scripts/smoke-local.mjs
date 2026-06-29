import { spawn } from "node:child_process";
import assert from "node:assert/strict";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";

const baseUrl = "http://127.0.0.1:8787";
const seededKey = "velozzadminseed";
const klDate = (value = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);

const readText = async (res) => res.text();

const assertOk = async (res, label) => {
  const text = await readText(res);
  if (!res.ok) {
    throw new Error(`${label} failed: ${res.status} ${text}`);
  }
  return text;
};

const assertText = async (res, label, pattern) => {
  const text = await readText(res);
  if (!pattern.test(text)) {
    throw new Error(`${label} unexpected response: ${text}`);
  }
  return text;
};

const assertJson = async (res, label, expected) => {
  const text = await readText(res);
  const json = JSON.parse(text);
  assert.equal(res.headers.get("content-type"), "application/json; charset=utf-8");
  assert.deepEqual(json, expected, `${label} unexpected response: ${text}`);
  return json;
};

const waitForHealth = async () => {
  for (let i = 0; i < 60; i += 1) {
    try {
      const res = await fetch(`${baseUrl}/v1/health`);
      if (res.ok && (await res.text()) === "OK") {
        return;
      }
    } catch {}
    await delay(500);
  }
  throw new Error("local Worker did not become ready");
};

const run = (cmd, args) =>
  new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: "inherit", shell: false });
    child.on("exit", (code) => {
      if (code === 0) {
        resolve(child);
      } else {
        reject(new Error(`${cmd} ${args.join(" ")} exited with ${code}`));
      }
    });
    child.on("error", reject);
  });

const executeLocal = async (sql) => {
  await run("npm", [
    "exec",
    "--",
    "wrangler",
    "d1",
    "execute",
    "DB",
    "--local",
    "--persist-to",
    ".wrangler/state",
    "--command",
    sql,
  ]);
};

await run("npm", ["run", "db:reset:local"]);

const server = spawn("npm", ["exec", "--", "wrangler", "dev", "--persist-to", ".wrangler/state"], {
  stdio: "inherit",
  shell: false,
});
const stop = async () => {
  if (server.exitCode !== null) {
    return;
  }
  server.kill("SIGINT");
  const exited = await Promise.race([
    once(server, "exit").then(() => true),
    delay(5000).then(() => false),
  ]);
  if (!exited) {
    server.kill("SIGKILL");
    await once(server, "exit");
  }
};

try {
  await waitForHealth();

  const loginRes = await fetch(`${baseUrl}/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: "admin@velozz.com",
      password: "XDman100#",
    }),
  });
  const loginText = await assertOk(loginRes, "login");
  const token = JSON.parse(loginText).sessionToken;

  await assertOk(
    await fetch(`${baseUrl}/v1/auth/me`, {
      headers: { authorization: `Bearer ${token}` },
    }),
    "me",
  );

  const listSeedRes = await fetch(`${baseUrl}/v1/admin/api-keys`, {
    headers: { authorization: `Bearer ${token}` },
  });
  const listSeedText = await assertOk(listSeedRes, "list api keys");
  if (!JSON.parse(listSeedText).items.some((item) => item.apiKey === seededKey)) {
    throw new Error(`missing seeded api key: ${seededKey}`);
  }

  const smokeCreateRes = await fetch(`${baseUrl}/v1/admin/api-keys`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ label: "smoke-kit" }),
  });
  const smokeCreateText = await assertOk(smokeCreateRes, "create api key");
  const smokeApiKey = JSON.parse(smokeCreateText).item.apiKey;
  if (!/^velozz[a-z]+$/.test(smokeApiKey)) {
    throw new Error(`unexpected api key: ${smokeApiKey}`);
  }

  const limitCreateRes = await fetch(`${baseUrl}/v1/admin/api-keys`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ label: "limit-kit" }),
  });
  const limitCreateText = await assertOk(limitCreateRes, "create limit key");
  const limitApiKey = JSON.parse(limitCreateText).item.apiKey;

  await assertOk(
    await fetch(`${baseUrl}/v1/admin/api-keys/${seededKey}`, {
      headers: { authorization: `Bearer ${token}` },
    }),
    "get seeded key",
  );
  await assertOk(
    await fetch(`${baseUrl}/v1/admin/api-keys/${smokeApiKey}`, {
      headers: { authorization: `Bearer ${token}` },
    }),
    "get smoke key",
  );

  const commandRes = await fetch(`${baseUrl}/v1/admin/api-keys/${smokeApiKey}/command`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ name: "show", value: "7" }),
  });
  const commandText = await assertOk(commandRes, "create command");
  const commandId = JSON.parse(commandText).item.id;

  await assertOk(
    await fetch(`${baseUrl}/v1/admin/api-keys/${smokeApiKey}/commands`, {
      headers: { authorization: `Bearer ${token}` },
    }),
    "list commands",
  );

  await assertJson(
    await fetch(`${baseUrl}/v1/microbit/pull?deviceId=${smokeApiKey}`),
    "pull command",
    {
      ok: true,
      type: "cmd",
      cmdId: commandId,
      name: "show",
      value: "7",
      poll: 10000,
      left: 999,
    },
  );

  await assertJson(
    await fetch(`${baseUrl}/v1/microbit/ack?deviceId=${smokeApiKey}&cmdId=${commandId}`),
    "ack command",
    { ok: true, type: "ack", left: 998 },
  );

  await assertJson(
    await fetch(`${baseUrl}/v1/microbit/send?deviceId=${smokeApiKey}&name=light&value=88`),
    "send event",
    { ok: true, type: "send", left: 997 },
  );

  await assertJson(
    await fetch(`${baseUrl}/v1/microbit/heartbeat?deviceId=${smokeApiKey}`),
    "heartbeat",
    { ok: true, type: "heartbeat", left: 996 },
  );

  await assertOk(
    await fetch(`${baseUrl}/v1/admin/api-keys/${smokeApiKey}/events`, {
      headers: { authorization: `Bearer ${token}` },
    }),
    "list events",
  );
  await assertOk(
    await fetch(`${baseUrl}/v1/admin/api-keys/${smokeApiKey}/state`, {
      headers: { authorization: `Bearer ${token}` },
    }),
    "get state",
  );

  await assertOk(
    await fetch(`${baseUrl}/v1/admin/usage/today`, {
      headers: { authorization: `Bearer ${token}` },
    }),
    "usage today",
  );
  await assertOk(
    await fetch(`${baseUrl}/v1/admin/api-keys/${smokeApiKey}/usage`, {
      headers: { authorization: `Bearer ${token}` },
    }),
    "api key usage",
  );
  await assertOk(
    await fetch(`${baseUrl}/v1/admin/usage/history?days=7`, {
      headers: { authorization: `Bearer ${token}` },
    }),
    "usage history",
  );

  const unlimitedReq1Res = await fetch(`${baseUrl}/v1/admin/api-keys/${smokeApiKey}/unlimited/request`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      requestedUntil: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      reason: "smoke approve",
    }),
  });
  const unlimitedReq1Text = await assertOk(unlimitedReq1Res, "unlimited request 1");
  const unlimitedRequestId = JSON.parse(unlimitedReq1Text).item.id;

  await assertOk(
    await fetch(`${baseUrl}/v1/admin/unlimited-requests`, {
      headers: { authorization: `Bearer ${token}` },
    }),
    "list unlimited requests",
  );

  await assertOk(
    await fetch(`${baseUrl}/v1/super/unlimited-requests/${unlimitedRequestId}/approve`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
    }),
    "approve unlimited",
  );

  const unlimitedReq2Res = await fetch(`${baseUrl}/v1/admin/api-keys/${smokeApiKey}/unlimited/request`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      requestedUntil: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      reason: "smoke reject",
    }),
  });
  const unlimitedReq2Text = await assertOk(unlimitedReq2Res, "unlimited request 2");
  const unlimitedRequestId2 = JSON.parse(unlimitedReq2Text).item.id;
  await assertOk(
    await fetch(`${baseUrl}/v1/super/unlimited-requests/${unlimitedRequestId2}/reject`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
    }),
    "reject unlimited",
  );

  await assertOk(
    await fetch(`${baseUrl}/v1/super/api-keys/${smokeApiKey}/unlimited/cancel`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
    }),
    "cancel unlimited",
  );

  await assertOk(
    await fetch(`${baseUrl}/v1/admin/api-keys/${smokeApiKey}/disable`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
    }),
    "disable key",
  );
  await assertOk(
    await fetch(`${baseUrl}/v1/admin/api-keys/${smokeApiKey}/enable`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
    }),
    "enable key",
  );

  const rotateRes = await fetch(`${baseUrl}/v1/admin/api-keys/${smokeApiKey}/rotate`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
  });
  const rotateText = await assertOk(rotateRes, "rotate key");
  const rotatedApiKey = JSON.parse(rotateText).newKey.apiKey;
  if (!/^velozz[a-z]+$/.test(rotatedApiKey)) {
    throw new Error(`unexpected rotated api key: ${rotatedApiKey}`);
  }

  await assertJson(
    await fetch(`${baseUrl}/v1/microbit/pull?deviceId=${smokeApiKey}`),
    "old key invalid",
    { ok: false, error: "INVALID_KEY" },
  );
  await assertJson(
    await fetch(`${baseUrl}/v1/microbit/pull?deviceId=${rotatedApiKey}`),
    "new key pull",
    { ok: true, type: "none", poll: 10000, left: 999 },
  );

  const limitUpdate = [
    "INSERT INTO api_key_usage_daily (api_key, usage_date, request_count, pull_count, send_count, ack_count, heartbeat_count, updated_at)",
    `VALUES ('${limitApiKey}', '${klDate()}', 1000, 1000, 0, 0, 0, '${new Date().toISOString()}')`,
    "ON CONFLICT(api_key, usage_date) DO UPDATE SET",
    "request_count = excluded.request_count,",
    "pull_count = excluded.pull_count,",
    "send_count = excluded.send_count,",
    "ack_count = excluded.ack_count,",
    "heartbeat_count = excluded.heartbeat_count,",
    "updated_at = excluded.updated_at;",
  ].join(" ");
  await executeLocal(limitUpdate);

  await assertJson(
    await fetch(`${baseUrl}/v1/microbit/pull?deviceId=${limitApiKey}`),
    "quota limit",
    { ok: false, error: "LIMIT", type: "limit", poll: 60000, left: 0 },
  );

  await assertOk(
    await fetch(`${baseUrl}/v1/admin/audit-logs`, {
      headers: { authorization: `Bearer ${token}` },
    }),
    "audit logs",
  );

  await assertOk(
    await fetch(`${baseUrl}/v1/auth/logout`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
    }),
    "logout",
  );

  console.log(
    JSON.stringify(
      { ok: true, seededKey, smokeApiKey, limitApiKey, rotatedApiKey, commandId },
      null,
      2,
    ),
  );
} finally {
  await stop();
}
