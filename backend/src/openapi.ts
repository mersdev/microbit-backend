const json = (example: unknown) => ({
  description: "OK",
  content: {
    "application/json": {
      schema: { type: "object" },
      example,
    },
  },
});

const text = (example: string) => ({
  description: "OK",
  content: {
    "text/plain": {
      schema: { type: "string" },
      example,
    },
  },
});

const bearerAuth = [{ BearerAuth: [] }];

export const openApiDoc = {
  openapi: "3.0.0",
  info: {
    title: "microbit-backend",
    version: "1.0.0",
    description: "Cloudflare Worker API for microbit devices and admin tools.",
  },
  servers: [{ url: "/" }],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: "http",
        scheme: "bearer",
      },
    },
  },
  paths: {
    "/v1/health": {
      get: {
        summary: "Health check",
        tags: ["public"],
        responses: { 200: text("OK") },
      },
    },
    "/v1/auth/login": {
      post: {
        summary: "Log in",
        tags: ["auth"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  email: { type: "string" },
                  password: { type: "string" },
                },
                required: ["email", "password"],
              },
            },
          },
        },
        responses: {
          200: json({ ok: true, sessionToken: "session-token" }),
        },
      },
    },
    "/v1/auth/logout": {
      post: {
        summary: "Log out",
        tags: ["auth"],
        security: bearerAuth,
        responses: { 200: json({ ok: true }) },
      },
    },
    "/v1/auth/me": {
      get: {
        summary: "Current session",
        tags: ["auth"],
        security: bearerAuth,
        responses: {
          200: json({
            ok: true,
            item: {
              id: "user_1",
              email: "admin@velozz.com",
              role: "super_admin",
              status: "active",
              centerId: null,
            },
          }),
        },
      },
    },
    "/v1/microbit/pull": {
      get: {
        summary: "Pull the next queued command",
        tags: ["microbit"],
        parameters: [
          { name: "deviceId", in: "query", required: true, schema: { type: "string" } },
        ],
        responses: {
          200: json({
            ok: true,
            type: "cmd",
            cmdId: "uuid",
            name: "show",
            value: "7",
            poll: 10000,
            left: 999,
          }),
        },
      },
    },
    "/v1/microbit/send": {
      get: {
        summary: "Store an event from a microbit",
        tags: ["microbit"],
        parameters: [
          { name: "deviceId", in: "query", required: true, schema: { type: "string" } },
          { name: "name", in: "query", required: true, schema: { type: "string" } },
          { name: "value", in: "query", required: true, schema: { type: "string" } },
        ],
        responses: {
          200: json({ ok: true, type: "send", left: 999 }),
        },
      },
    },
    "/v1/microbit/ack": {
      get: {
        summary: "Acknowledge a pulled command",
        tags: ["microbit"],
        parameters: [
          { name: "deviceId", in: "query", required: true, schema: { type: "string" } },
          { name: "cmdId", in: "query", required: true, schema: { type: "string" } },
        ],
        responses: {
          200: json({ ok: true, type: "ack", left: 999 }),
        },
      },
    },
    "/v1/microbit/heartbeat": {
      get: {
        summary: "Record a heartbeat",
        tags: ["microbit"],
        parameters: [
          { name: "deviceId", in: "query", required: true, schema: { type: "string" } },
        ],
        responses: {
          200: json({ ok: true, type: "heartbeat", left: 999 }),
        },
      },
    },
    "/v1/app/devices/{deviceId}": {
      get: {
        summary: "Read a device snapshot",
        tags: ["app"],
        parameters: [
          { name: "deviceId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          200: json({
            ok: true,
            item: {
              apiKey: "velozzexample",
              label: "Demo device",
              state: null,
              latestEvent: null,
              recentEvents: [],
            },
          }),
        },
      },
    },
    "/v1/app/devices/{deviceId}/stream": {
      get: {
        summary: "Open the device event stream",
        tags: ["app"],
        parameters: [
          { name: "deviceId", in: "path", required: true, schema: { type: "string" } },
          { name: "deviceId", in: "query", required: true, schema: { type: "string" } },
        ],
        responses: {
          200: {
            description: "Server-sent events stream",
            content: {
              "text/event-stream": {
                schema: { type: "string" },
              },
            },
          },
        },
      },
    },
    "/v1/app/devices/{deviceId}/command": {
      post: {
        summary: "Queue a command for a device",
        tags: ["app"],
        parameters: [
          { name: "deviceId", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  value: { oneOf: [{ type: "string" }, { type: "number" }] },
                },
                required: ["name", "value"],
              },
            },
          },
        },
        responses: {
          201: json({
            ok: true,
            item: {
              id: "uuid",
              apiKey: "velozzexample",
              name: "show",
              value: "7",
              status: "pending",
              expiresAt: null,
              pulledAt: null,
              acknowledgedAt: null,
              createdAt: "2026-06-29T00:00:00.000Z",
              updatedAt: "2026-06-29T00:00:00.000Z",
            },
          }),
        },
      },
    },
    "/v1/admin/api-keys": {
      get: {
        summary: "List API keys",
        tags: ["admin"],
        security: bearerAuth,
        responses: { 200: json({ ok: true, items: [] }) },
      },
      post: {
        summary: "Create an API key",
        tags: ["admin"],
        security: bearerAuth,
        requestBody: {
          required: false,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: { label: { type: "string" } },
              },
            },
          },
        },
        responses: {
          201: json({
            ok: true,
            item: { apiKey: "velozzexample", label: "kit-1" },
          }),
        },
      },
    },
    "/v1/admin/api-keys/{apiKey}": {
      get: {
        summary: "Fetch an API key",
        tags: ["admin"],
        security: bearerAuth,
        parameters: [
          { name: "apiKey", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { 200: json({ ok: true, item: { apiKey: "velozzexample" } }) },
      },
    },
    "/v1/admin/api-keys/{apiKey}/disable": {
      post: {
        summary: "Disable an API key",
        tags: ["admin"],
        security: bearerAuth,
        parameters: [
          { name: "apiKey", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { 200: json({ ok: true }) },
      },
    },
    "/v1/admin/api-keys/{apiKey}/enable": {
      post: {
        summary: "Enable an API key",
        tags: ["admin"],
        security: bearerAuth,
        parameters: [
          { name: "apiKey", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { 200: json({ ok: true }) },
      },
    },
    "/v1/admin/api-keys/{apiKey}/rotate": {
      post: {
        summary: "Rotate an API key",
        tags: ["admin"],
        security: bearerAuth,
        parameters: [
          { name: "apiKey", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { 200: json({ ok: true, newKey: { apiKey: "velozzexample" } }) },
      },
    },
    "/v1/admin/api-keys/{apiKey}/command": {
      post: {
        summary: "Queue a command",
        tags: ["admin"],
        security: bearerAuth,
        parameters: [
          { name: "apiKey", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  value: { type: "string" },
                },
                required: ["name", "value"],
              },
            },
          },
        },
        responses: { 201: json({ ok: true, item: { id: "uuid" } }) },
      },
    },
    "/v1/admin/api-keys/{apiKey}/commands": {
      get: {
        summary: "List commands",
        tags: ["admin"],
        security: bearerAuth,
        parameters: [
          { name: "apiKey", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { 200: json({ ok: true, items: [] }) },
      },
    },
    "/v1/admin/api-keys/{apiKey}/events": {
      get: {
        summary: "List device events",
        tags: ["admin"],
        security: bearerAuth,
        parameters: [
          { name: "apiKey", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { 200: json({ ok: true, items: [] }) },
      },
    },
    "/v1/admin/api-keys/{apiKey}/state": {
      get: {
        summary: "Get device state",
        tags: ["admin"],
        security: bearerAuth,
        parameters: [
          { name: "apiKey", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { 200: json({ ok: true, item: null }) },
      },
    },
    "/v1/admin/api-keys/{apiKey}/usage": {
      get: {
        summary: "Get API key usage",
        tags: ["admin"],
        security: bearerAuth,
        parameters: [
          { name: "apiKey", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { 200: json({ ok: true, item: null }) },
      },
    },
    "/v1/admin/usage/today": {
      get: {
        summary: "Get today's usage",
        tags: ["admin"],
        security: bearerAuth,
        responses: { 200: json({ ok: true, items: [] }) },
      },
    },
    "/v1/admin/usage/history": {
      get: {
        summary: "Get usage history",
        tags: ["admin"],
        security: bearerAuth,
        parameters: [
          { name: "days", in: "query", required: false, schema: { type: "integer" } },
        ],
        responses: { 200: json({ ok: true, items: [] }) },
      },
    },
    "/v1/admin/api-keys/{apiKey}/unlimited/request": {
      post: {
        summary: "Request unlimited access",
        tags: ["admin"],
        security: bearerAuth,
        parameters: [
          { name: "apiKey", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { 201: json({ ok: true, item: { id: "uuid" } }) },
      },
    },
    "/v1/admin/unlimited-requests": {
      get: {
        summary: "List unlimited requests",
        tags: ["admin"],
        security: bearerAuth,
        responses: { 200: json({ ok: true, items: [] }) },
      },
    },
    "/v1/admin/audit-logs": {
      get: {
        summary: "List audit logs",
        tags: ["admin"],
        security: bearerAuth,
        responses: { 200: json({ ok: true, items: [] }) },
      },
    },
    "/v1/super/unlimited-requests/{requestId}/approve": {
      post: {
        summary: "Approve unlimited access",
        tags: ["super"],
        security: bearerAuth,
        parameters: [
          { name: "requestId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { 200: json({ ok: true }) },
      },
    },
    "/v1/super/unlimited-requests/{requestId}/reject": {
      post: {
        summary: "Reject unlimited access",
        tags: ["super"],
        security: bearerAuth,
        parameters: [
          { name: "requestId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { 200: json({ ok: true }) },
      },
    },
    "/v1/super/api-keys/{apiKey}/unlimited/cancel": {
      post: {
        summary: "Cancel unlimited access",
        tags: ["super"],
        security: bearerAuth,
        parameters: [
          { name: "apiKey", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { 200: json({ ok: true }) },
      },
    },
  },
} as const;
