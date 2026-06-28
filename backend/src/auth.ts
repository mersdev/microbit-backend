import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import {
  createSession,
  deleteSessionByToken,
  findSessionByToken,
  findUserByEmail,
  findUserById,
} from "./db.ts";
import { nowIso } from "./quota.ts";
import { SESSION_TTL_MS } from "./types.ts";
import type { AppEnv, SessionUser, UserRole } from "./types.ts";

const encoder = new TextEncoder();

const jsonError = (status: number, error: string) =>
  new Response(JSON.stringify({ ok: false, error }), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

const hex = (bytes: Uint8Array) =>
  [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");

export const createSalt = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return hex(bytes);
};

export const hashPassword = async (password: string, salt: string) => {
  const input = encoder.encode(`${salt}:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", input);
  return hex(new Uint8Array(digest));
};

export const verifyPassword = async (
  password: string,
  salt: string,
  passwordHash: string,
) => (await hashPassword(password, salt)) === passwordHash;

export const createSessionToken = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return `sess_${hex(bytes)}`;
};

export const sessionUserFromRow = (user: {
  id: string;
  email: string;
  role: SessionUser["role"];
  status: SessionUser["status"];
  centerId: string | null;
}): SessionUser => ({
  id: user.id,
  email: user.email,
  role: user.role,
  status: user.status,
  centerId: user.centerId,
});

export const bearerAuth = createMiddleware<AppEnv>(async (c, next) => {
  const authHeader = c.req.header("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonError(401, "UNAUTHORIZED");
  }

  const sessionToken = authHeader.slice("Bearer ".length).trim();
  if (!sessionToken) {
    return jsonError(401, "UNAUTHORIZED");
  }

  const session = await findSessionByToken(c.env.DB, sessionToken);
  if (!session || session.expiresAt <= nowIso()) {
    return jsonError(401, "UNAUTHORIZED");
  }

  const user = await findUserById(c.env.DB, session.userId);
  if (!user || user.status !== "active") {
    return jsonError(401, "UNAUTHORIZED");
  }

  c.set("session", sessionUserFromRow(user));
  await next();
});

export const requireRole = (...roles: UserRole[]) =>
  createMiddleware<AppEnv>(async (c, next) => {
    const user = c.get("session");
    if (!user || !roles.includes(user.role)) {
      return jsonError(403, "FORBIDDEN");
    }
    await next();
  });

export const loginHandler = async (c: import("hono").Context<AppEnv>) => {
  const body = await c.req.json<{ email?: string; password?: string }>().catch(() => ({}));
  if (!body.email || !body.password) {
    return c.json({ ok: false, error: "INVALID_BODY" }, 400);
  }

  const user = await findUserByEmail(c.env.DB, body.email);
  if (!user || user.status !== "active") {
    return c.json({ ok: false, error: "INVALID_CREDENTIALS" }, 401);
  }

  const valid = await verifyPassword(body.password, user.passwordSalt, user.passwordHash);
  if (!valid) {
    return c.json({ ok: false, error: "INVALID_CREDENTIALS" }, 401);
  }

  const createdAt = nowIso();
  const sessionToken = createSessionToken();
  await createSession(c.env.DB, {
    id: crypto.randomUUID(),
    userId: user.id,
    sessionToken,
    expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
    createdAt,
  });

  return c.json({
    ok: true,
    sessionToken,
    user: sessionUserFromRow(user),
  });
};

export const logoutHandler = async (c: import("hono").Context<AppEnv>) => {
  const authHeader = c.req.header("authorization") ?? "";
  const sessionToken = authHeader.slice("Bearer ".length).trim();
  await deleteSessionByToken(c.env.DB, sessionToken);
  return c.json({ ok: true });
};

export const meHandler = async (c: import("hono").Context<AppEnv>) => {
  return c.json({ ok: true, user: c.get("session") });
};

export const assertCenterAccess = (
  user: SessionUser,
  centerId: string | null,
) => {
  if (user.role === "super_admin") {
    return;
  }
  if (!user.centerId || !centerId || user.centerId !== centerId) {
    throw new HTTPException(403, { res: jsonError(403, "FORBIDDEN") });
  }
};
