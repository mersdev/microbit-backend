import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import app from "../src/index.ts";
import { hashPassword } from "../src/auth.ts";
import { DeviceStreamRoom } from "../src/stream.ts";

type BindValue = string | number | null;

class SqliteD1PreparedStatement {
  private readonly db: DatabaseSync;
  private readonly sql: string;
  private readonly params: BindValue[];

  constructor(
    db: DatabaseSync,
    sql: string,
    params: BindValue[] = [],
  ) {
    this.db = db;
    this.sql = sql;
    this.params = params;
  }

  bind(...values: BindValue[]) {
    return new SqliteD1PreparedStatement(this.db, this.sql, values);
  }

  async first<T>() {
    const stmt = this.db.prepare(this.sql);
    return (stmt.get(...this.params) as T | undefined) ?? null;
  }

  async all<T>() {
    const stmt = this.db.prepare(this.sql);
    return { results: (stmt.all(...this.params) as T[]) ?? [] };
  }

  async run() {
    const stmt = this.db.prepare(this.sql);
    stmt.run(...this.params);
    return { success: true };
  }
}

class SqliteD1Database {
  private readonly db: DatabaseSync;

  constructor(db: DatabaseSync) {
    this.db = db;
  }

  prepare(sql: string) {
    return new SqliteD1PreparedStatement(this.db, sql);
  }
}

const migrationPath = path.resolve(process.cwd(), "migrations/0001_init.sql");

const createDb = () => {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(readFileSync(migrationPath, "utf8"));
  return new SqliteD1Database(sqlite) as unknown as D1Database;
};

const env = () => ({ DB: createDb() });
const createStreamNamespace = (db: D1Database) => {
  const room = new DeviceStreamRoom({} as DurableObjectState, { DB: db });
  return {
    idFromName: (name: string) => ({ toString: () => name }),
    get: () => room as unknown as DurableObjectStub,
  } as unknown as DurableObjectNamespace;
};
const envWithStream = (db: D1Database) => ({
  DB: db,
  STREAM: createStreamNamespace(db),
});

const login = async (db: D1Database, email = "admin@velozz.com", password = "XDman100#") => {
  const response = await app.request(
    "http://local/v1/auth/login",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    },
    { DB: db },
  );
  return response;
};

test("health endpoint returns OK", async () => {
  const response = await app.request("http://local/v1/health", {}, env());
  assert.equal(await response.text(), "OK");
});

test("seeded super admin can log in and wrong password fails", async () => {
  const db = createDb();
  const ok = await login(db);
  const okJson = await ok.json();
  assert.equal(ok.status, 200);
  assert.equal(okJson.ok, true);
  assert.ok(okJson.sessionToken);

  const seeded = await app.request(
    "http://local/v1/admin/api-keys",
    { headers: { authorization: `Bearer ${okJson.sessionToken}` } },
    { DB: db },
  );
  const seededJson = await seeded.json();
  assert.ok(
    seededJson.items.some(
      (item: { apiKey: string }) => item.apiKey === "velozz_admin_seed",
    ),
  );

  const fail = await login(db, "admin@velozz.com", "wrong");
  assert.equal(fail.status, 401);
});

test("auth middleware rejects missing or invalid bearer token", async () => {
  const db = createDb();
  const missing = await app.request("http://local/v1/admin/api-keys", {}, { DB: db });
  assert.equal(missing.status, 401);

  const invalid = await app.request(
    "http://local/v1/admin/api-keys",
    { headers: { authorization: "Bearer nope" } },
    { DB: db },
  );
  assert.equal(invalid.status, 401);
});

test("api key creation returns full visible key", async () => {
  const db = createDb();
  const auth = await login(db);
  const { sessionToken } = await auth.json();
  const response = await app.request(
    "http://local/v1/admin/api-keys",
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${sessionToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ label: "kit-1" }),
    },
    { DB: db },
  );

  const json = await response.json();
  assert.equal(response.status, 201);
  assert.match(json.item.apiKey, /^velozz_/);
});

test("disabled key returns INVALID_KEY and rotate disables old key while new key works", async () => {
  const db = createDb();
  const auth = await login(db);
  const { sessionToken } = await auth.json();
  const created = await app.request(
    "http://local/v1/admin/api-keys",
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${sessionToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({}),
    },
    { DB: db },
  );
  const { item } = await created.json();

  await app.request(
    `http://local/v1/admin/api-keys/${item.apiKey}/disable`,
    { method: "POST", headers: { authorization: `Bearer ${sessionToken}` } },
    { DB: db },
  );
  const disabled = await app.request(
    `http://local/v1/microbit/pull?deviceId=${item.apiKey}`,
    {},
    { DB: db },
  );
  assert.equal(await disabled.text(), "INVALID_KEY");

  await app.request(
    `http://local/v1/admin/api-keys/${item.apiKey}/enable`,
    { method: "POST", headers: { authorization: `Bearer ${sessionToken}` } },
    { DB: db },
  );
  const rotated = await app.request(
    `http://local/v1/admin/api-keys/${item.apiKey}/rotate`,
    { method: "POST", headers: { authorization: `Bearer ${sessionToken}` } },
    { DB: db },
  );
  const rotatedJson = await rotated.json();
  const oldResult = await app.request(
    `http://local/v1/microbit/pull?deviceId=${item.apiKey}`,
    {},
    { DB: db },
  );
  const newResult = await app.request(
    `http://local/v1/microbit/pull?deviceId=${rotatedJson.newKey.apiKey}`,
    {},
    { DB: db },
  );
  assert.equal(await oldResult.text(), "INVALID_KEY");
  assert.match(await newResult.text(), /^NONE\|/);
});

test("pull returns NONE then CMD and ack marks command acknowledged", async () => {
  const db = createDb();
  const auth = await login(db);
  const { sessionToken } = await auth.json();
  const created = await app.request(
    "http://local/v1/admin/api-keys",
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${sessionToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({}),
    },
    { DB: db },
  );
  const { item } = await created.json();

  const none = await app.request(
    `http://local/v1/microbit/pull?deviceId=${item.apiKey}`,
    {},
    { DB: db },
  );
  assert.match(await none.text(), /^NONE\|POLL=10000\|LEFT=/);

  const command = await app.request(
    `http://local/v1/admin/api-keys/${item.apiKey}/command`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${sessionToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ name: "show", value: "7" }),
    },
    { DB: db },
  );
  const commandJson = await command.json();

  const pulled = await app.request(
    `http://local/v1/microbit/pull?deviceId=${item.apiKey}`,
    {},
    { DB: db },
  );
  const pulledText = await pulled.text();
  assert.match(pulledText, new RegExp(`^CMD\\|cmdId=${commandJson.item.id}\\|name=show\\|value=7\\|POLL=10000\\|LEFT=`));

  const ack = await app.request(
    `http://local/v1/microbit/ack?deviceId=${item.apiKey}&cmdId=${commandJson.item.id}`,
    {},
    { DB: db },
  );
  assert.match(await ack.text(), /^OK\|LEFT=/);

  const commands = await app.request(
    `http://local/v1/admin/api-keys/${item.apiKey}/commands`,
    { headers: { authorization: `Bearer ${sessionToken}` } },
    { DB: db },
  );
  const commandsJson = await commands.json();
  assert.equal(commandsJson.items[0].status, "acknowledged");
});

test("app endpoint creates commands and exposes microbit messages", async () => {
  const db = createDb();
  const auth = await login(db);
  const { sessionToken } = await auth.json();
  const created = await app.request(
    "http://local/v1/admin/api-keys",
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${sessionToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({}),
    },
    { DB: db },
  );
  const { item } = await created.json();

  const command = await app.request(
    `http://local/v1/app/devices/${item.apiKey}/command`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "button_a", value: "pressed" }),
    },
    { DB: db },
  );
  assert.equal(command.status, 201);

  const pulled = await app.request(
    `http://local/v1/microbit/pull?deviceId=${item.apiKey}`,
    {},
    { DB: db },
  );
  assert.match(await pulled.text(), /^CMD\|/);

  await app.request(
    `http://local/v1/microbit/send?deviceId=${item.apiKey}&name=hello&value=world`,
    {},
    { DB: db },
  );

  const state = await app.request(
    `http://local/v1/app/devices/${item.apiKey}`,
    {},
    { DB: db },
  );
  const stateJson = await state.json();
  assert.equal(stateJson.item.latestEvent.name, "hello");
  assert.equal(stateJson.item.latestEvent.value, "world");
});

test("app stream emits snapshot and live updates", async () => {
  const db = createDb();
  const streamEnv = envWithStream(db);
  const auth = await login(db);
  const { sessionToken } = await auth.json();
  const created = await app.request(
    "http://local/v1/admin/api-keys",
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${sessionToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({}),
    },
    streamEnv,
  );
  const { item } = await created.json();

  const response = await app.request(
    `http://local/v1/app/devices/${item.apiKey}/stream?deviceId=${item.apiKey}`,
    {},
    streamEnv,
  );
  assert.equal(response.status, 200);
  assert.equal(
    response.headers.get("content-type"),
    "text/event-stream; charset=utf-8",
  );

  const reader = response.body?.getReader();
  assert.ok(reader);
  const first = await reader.read();
  assert.ok(first.value);
  assert.match(new TextDecoder().decode(first.value), /event: snapshot/);

  await app.request(
    `http://local/v1/microbit/send?deviceId=${item.apiKey}&name=hello&value=world`,
    {},
    streamEnv,
  );

  const second = await reader.read();
  assert.ok(second.value);
  assert.match(new TextDecoder().decode(second.value), /event: update/);
  await reader.cancel();
});

test("send stores an event and updates latest state, heartbeat updates last seen without creating events", async () => {
  const db = createDb();
  const auth = await login(db);
  const { sessionToken } = await auth.json();
  const created = await app.request(
    "http://local/v1/admin/api-keys",
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${sessionToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({}),
    },
    { DB: db },
  );
  const { item } = await created.json();

  const send = await app.request(
    `http://local/v1/microbit/send?deviceId=${item.apiKey}&name=light&value=88`,
    {},
    { DB: db },
  );
  assert.match(await send.text(), /^OK\|LEFT=/);

  const events = await app.request(
    `http://local/v1/admin/api-keys/${item.apiKey}/events`,
    { headers: { authorization: `Bearer ${sessionToken}` } },
    { DB: db },
  );
  const eventsJson = await events.json();
  assert.equal(eventsJson.items.length, 1);
  assert.equal(eventsJson.items[0].name, "light");

  const stateBefore = await app.request(
    `http://local/v1/admin/api-keys/${item.apiKey}/state`,
    { headers: { authorization: `Bearer ${sessionToken}` } },
    { DB: db },
  );
  const stateBeforeJson = await stateBefore.json();
  assert.equal(stateBeforeJson.item.lastEventValue, "88");

  await app.request(
    `http://local/v1/microbit/heartbeat?deviceId=${item.apiKey}`,
    {},
    { DB: db },
  );
  const eventsAfter = await app.request(
    `http://local/v1/admin/api-keys/${item.apiKey}/events`,
    { headers: { authorization: `Bearer ${sessionToken}` } },
    { DB: db },
  );
  const stateAfter = await app.request(
    `http://local/v1/admin/api-keys/${item.apiKey}/state`,
    { headers: { authorization: `Bearer ${sessionToken}` } },
    { DB: db },
  );
  const eventsAfterJson = await eventsAfter.json();
  const stateAfterJson = await stateAfter.json();
  assert.equal(eventsAfterJson.items.length, 1);
  assert.ok(stateAfterJson.item.lastSeenAt);
});

test("quota stops at 1000 and unlimited approval allows requests past limit", async () => {
  const db = createDb();
  const auth = await login(db);
  const { sessionToken } = await auth.json();
  const created = await app.request(
    "http://local/v1/admin/api-keys",
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${sessionToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({}),
    },
    { DB: db },
  );
  const { item } = await created.json();

  const statement = (db as unknown as SqliteD1Database)
    .prepare(
      "INSERT INTO api_key_usage_daily (api_key, usage_date, request_count, pull_count, send_count, ack_count, heartbeat_count, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(item.apiKey, new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kuala_Lumpur" }).format(new Date()), 1000, 1000, 0, 0, 0, new Date().toISOString());
  await statement.run();

  const limited = await app.request(
    `http://local/v1/microbit/pull?deviceId=${item.apiKey}`,
    {},
    { DB: db },
  );
  assert.match(await limited.text(), /^LIMIT\|/);

  const requestedUntil = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
  const request = await app.request(
    `http://local/v1/admin/api-keys/${item.apiKey}/unlimited/request`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${sessionToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ requestedUntil }),
    },
    { DB: db },
  );
  const requestJson = await request.json();
  await app.request(
    `http://local/v1/super/unlimited-requests/${requestJson.item.id}/approve`,
    { method: "POST", headers: { authorization: `Bearer ${sessionToken}` } },
    { DB: db },
  );

  const allowed = await app.request(
    `http://local/v1/microbit/heartbeat?deviceId=${item.apiKey}`,
    {},
    { DB: db },
  );
  assert.match(await allowed.text(), /^OK\|LEFT=/);
});

test("center-scoped authorization blocks another center key", async () => {
  const db = createDb();
  const sqlite = db as unknown as SqliteD1Database;
  const salt = "teacher_salt";
  const hash = await hashPassword("Teacher100#", salt);
  await sqlite
    .prepare(
      "INSERT INTO centers (id, name, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
    )
    .bind("center_other", "Other Center", "active", new Date().toISOString(), new Date().toISOString())
    .run();
  await sqlite
    .prepare(
      "INSERT INTO api_keys (api_key, center_id, label, status, daily_limit, unlimited_until, last_used_at, rotated_to_api_key, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind("velozz_other", "center_other", null, "active", 1000, null, null, null, new Date().toISOString(), new Date().toISOString())
    .run();
  await sqlite
    .prepare(
      "INSERT INTO admin_users (id, email, password_salt, password_hash, role, status, center_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind("user_teacher", "teacher@velozz.com", salt, hash, "teacher", "active", "center_default", new Date().toISOString(), new Date().toISOString())
    .run();

  const teacherLogin = await login(db, "teacher@velozz.com", "Teacher100#");
  const { sessionToken } = await teacherLogin.json();
  const response = await app.request(
    "http://local/v1/admin/api-keys/velozz_other",
    { headers: { authorization: `Bearer ${sessionToken}` } },
    { DB: db },
  );
  assert.equal(response.status, 403);
});

test("audit logs are written for admin mutations", async () => {
  const db = createDb();
  const auth = await login(db);
  const { sessionToken } = await auth.json();
  const created = await app.request(
    "http://local/v1/admin/api-keys",
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${sessionToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({}),
    },
    { DB: db },
  );
  const { item } = await created.json();
  const command = await app.request(
    `http://local/v1/admin/api-keys/${item.apiKey}/command`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${sessionToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ name: "show", value: "1" }),
    },
    { DB: db },
  );
  assert.equal(command.status, 201);

  await app.request(
    `http://local/v1/admin/api-keys/${item.apiKey}/disable`,
    { method: "POST", headers: { authorization: `Bearer ${sessionToken}` } },
    { DB: db },
  );
  await app.request(
    `http://local/v1/admin/api-keys/${item.apiKey}/enable`,
    { method: "POST", headers: { authorization: `Bearer ${sessionToken}` } },
    { DB: db },
  );
  await app.request(
    `http://local/v1/admin/api-keys/${item.apiKey}/rotate`,
    { method: "POST", headers: { authorization: `Bearer ${sessionToken}` } },
    { DB: db },
  );

  const request = await app.request(
    `http://local/v1/admin/api-keys/${item.apiKey}/unlimited/request`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${sessionToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        requestedUntil: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      }),
    },
    { DB: db },
  );
  const requestJson = await request.json();
  await app.request(
    `http://local/v1/super/unlimited-requests/${requestJson.item.id}/reject`,
    { method: "POST", headers: { authorization: `Bearer ${sessionToken}` } },
    { DB: db },
  );

  const logs = await app.request(
    "http://local/v1/admin/audit-logs",
    { headers: { authorization: `Bearer ${sessionToken}` } },
    { DB: db },
  );
  const logsJson = await logs.json();
  const actions = logsJson.items.map((item: { action: string }) => item.action);
  assert.ok(actions.includes("api_key.disable"));
  assert.ok(actions.includes("api_key.enable"));
  assert.ok(actions.includes("api_key.rotate"));
  assert.ok(actions.includes("api_key.command"));
  assert.ok(actions.includes("unlimited.rejected"));
});
