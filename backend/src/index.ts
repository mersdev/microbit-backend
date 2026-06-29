import { Hono } from "hono";
import {
  approveUnlimitedHandler,
  apiKeyUsageHandler,
  auditLogHandler,
  cancelUnlimitedHandler,
  createApiKeyHandler,
  createCommandHandler,
  disableApiKeyHandler,
  enableApiKeyHandler,
  getApiKeyHandler,
  getStateHandler,
  listApiKeysHandler,
  listCommandsHandler,
  listEventsHandler,
  listUnlimitedRequestsHandler,
  rejectUnlimitedHandler,
  requestUnlimitedHandler,
  rotateApiKeyHandler,
  usageHistoryHandler,
  usageTodayHandler,
} from "./admin.ts";
import {
  createDeviceCommandHandler,
  getDeviceHandler,
  getDeviceStreamHandler,
} from "./app.ts";
import { bearerAuth, loginHandler, logoutHandler, meHandler, requireRole } from "./auth.ts";
import { ackHandler, heartbeatHandler, pullHandler, sendHandler } from "./microbit.ts";
import { openApiDoc } from "./openapi.ts";
import { swaggerUI } from "@hono/swagger-ui";
export { DeviceStreamRoom } from "./stream.ts";
import type { AppEnv } from "./types.ts";
import { cors } from "hono/cors";

const app = new Hono<AppEnv>();

app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  }),
);

app.get("/v1/health", (c) => c.text("OK"));
app.get("/v1/openapi.json", (c) => c.json(openApiDoc));
app.get("/v1/docs", swaggerUI({ url: "/v1/openapi.json" }));

app.post("/v1/auth/login", loginHandler);
app.post("/v1/auth/logout", bearerAuth, logoutHandler);
app.get("/v1/auth/me", bearerAuth, meHandler);

app.get("/v1/microbit/pull", pullHandler);
app.get("/v1/microbit/send", sendHandler);
app.get("/v1/microbit/ack", ackHandler);
app.get("/v1/microbit/heartbeat", heartbeatHandler);

app.get("/v1/app/devices/:deviceId", getDeviceHandler);
app.get("/v1/app/devices/:deviceId/stream", getDeviceStreamHandler);
app.post("/v1/app/devices/:deviceId/command", createDeviceCommandHandler);

app.use("/v1/admin/*", bearerAuth);
app.use("/v1/super/*", bearerAuth, requireRole("super_admin"));

app.get("/v1/admin/api-keys", listApiKeysHandler);
app.post("/v1/admin/api-keys", createApiKeyHandler);
app.get("/v1/admin/api-keys/:apiKey", getApiKeyHandler);
app.post("/v1/admin/api-keys/:apiKey/disable", disableApiKeyHandler);
app.post("/v1/admin/api-keys/:apiKey/enable", enableApiKeyHandler);
app.post("/v1/admin/api-keys/:apiKey/rotate", rotateApiKeyHandler);
app.post("/v1/admin/api-keys/:apiKey/command", createCommandHandler);
app.get("/v1/admin/api-keys/:apiKey/commands", listCommandsHandler);
app.get("/v1/admin/api-keys/:apiKey/events", listEventsHandler);
app.get("/v1/admin/api-keys/:apiKey/state", getStateHandler);
app.get("/v1/admin/usage/today", usageTodayHandler);
app.get("/v1/admin/api-keys/:apiKey/usage", apiKeyUsageHandler);
app.get("/v1/admin/usage/history", usageHistoryHandler);
app.post(
  "/v1/admin/api-keys/:apiKey/unlimited/request",
  requestUnlimitedHandler,
);
app.get("/v1/admin/unlimited-requests", listUnlimitedRequestsHandler);
app.get("/v1/admin/audit-logs", auditLogHandler);

app.post(
  "/v1/super/unlimited-requests/:requestId/approve",
  approveUnlimitedHandler,
);
app.post(
  "/v1/super/unlimited-requests/:requestId/reject",
  rejectUnlimitedHandler,
);
app.post("/v1/super/api-keys/:apiKey/unlimited/cancel", cancelUnlimitedHandler);

export default app;
