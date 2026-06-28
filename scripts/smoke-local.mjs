import { spawn } from "node:child_process";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";

const baseUrl = "http://127.0.0.1:8787";
const seededKey = "velozz_admin_seed";

const readText = async (res) => res.text();

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

await run("npm", ["run", "db:reset:local"]);

const server = spawn("./node_modules/.bin/wrangler", ["dev", "--persist-to", ".wrangler/state"], {
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
  const loginText = await readText(loginRes);
  if (!loginRes.ok) {
    throw new Error(`login failed: ${loginRes.status} ${loginText}`);
  }

  const token = JSON.parse(loginText).sessionToken;
  const listRes = await fetch(`${baseUrl}/v1/admin/api-keys`, {
    headers: { authorization: `Bearer ${token}` },
  });
  const listText = await readText(listRes);
  if (!listRes.ok) {
    throw new Error(`api key list failed: ${listRes.status} ${listText}`);
  }

  const items = JSON.parse(listText).items;
  if (!items.some((item) => item.apiKey === seededKey)) {
    throw new Error(`missing seeded api key: ${seededKey}`);
  }

  const pullRes = await fetch(`${baseUrl}/v1/microbit/pull?deviceId=${seededKey}`);
  const pullText = await readText(pullRes);
  if (!/^NONE\|POLL=10000\|LEFT=\d+$/.test(pullText)) {
    throw new Error(`unexpected pull response: ${pullText}`);
  }

  console.log(JSON.stringify({ ok: true, seededKey, pullText }, null, 2));
} finally {
  await stop();
}
