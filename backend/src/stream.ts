import { findApiKey, findDeviceState, listEventsForApiKey } from "./db.ts";
import type { AppEnv } from "./types.ts";

const encoder = new TextEncoder();

const frame = (event: string, data: unknown) =>
  encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

const sseHeaders = {
  "content-type": "text/event-stream; charset=utf-8",
  "cache-control": "no-cache, no-transform",
  connection: "keep-alive",
  "x-accel-buffering": "no",
};

export const broadcastDeviceUpdate = async (
  env: AppEnv["Bindings"],
  deviceId: string,
  payload: unknown,
) => {
  if (!env.STREAM) {
    return;
  }
  const stub = env.STREAM.get(env.STREAM.idFromName(deviceId));
  await stub.fetch("https://stream/broadcast", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
};

export class DeviceStreamRoom {
  private clients = new Set<ReadableStreamDefaultController<Uint8Array>>();
  private readonly state: DurableObjectState;
  private readonly env: AppEnv["Bindings"];

  constructor(state: DurableObjectState, env: AppEnv["Bindings"]) {
    this.state = state;
    this.env = env;
  }

  private push = (event: string, data: unknown) => {
    const chunk = frame(event, data);
    for (const controller of this.clients) {
      try {
        controller.enqueue(chunk);
      } catch {
        this.clients.delete(controller);
      }
    }
  };

  async fetch(request: RequestInfo | URL, init?: RequestInit) {
    const req = request instanceof Request ? request : new Request(request, init);
    const url = new URL(req.url);
    if (req.method === "GET" && url.pathname.endsWith("/stream")) {
      const deviceId = url.searchParams.get("deviceId")?.trim();
      if (!deviceId) {
        return new Response("INVALID_DEVICE", { status: 400 });
      }

      const apiKey = await findApiKey(this.env.DB, deviceId);
      if (!apiKey || apiKey.status !== "active") {
        return new Response("INVALID_KEY", {
          status: 404,
          headers: { "content-type": "text/plain; charset=utf-8" },
        });
      }

      const [state, events] = await Promise.all([
        findDeviceState(this.env.DB, deviceId),
        listEventsForApiKey(this.env.DB, deviceId),
      ]);

      let controllerRef: ReadableStreamDefaultController<Uint8Array> | null = null;
      const stream = new ReadableStream<Uint8Array>({
        start: (controller) => {
          controllerRef = controller;
          this.clients.add(controller);
          controller.enqueue(
            frame("snapshot", {
              deviceId,
              state,
              latestEvent: events[0] ?? null,
              recentEvents: events.slice(0, 10),
            }),
          );
        },
        cancel: () => {
          if (controllerRef) {
            this.clients.delete(controllerRef);
          }
        },
      });

      return new Response(stream, { headers: sseHeaders });
    }

    if (req.method === "POST" && url.pathname.endsWith("/broadcast")) {
      const body = await req.json().catch(() => null);
      if (body) {
        this.push("update", body);
      }
      return new Response("OK", {
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }

    return new Response("NOT_FOUND", { status: 404 });
  }
}
