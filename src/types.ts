export const DEFAULT_TIMEZONE = "Asia/Kuala_Lumpur";
export const DEFAULT_DAILY_LIMIT = 1000;
export const MAX_UNLIMITED_DAYS = 3;
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const ONLINE_WINDOW_MS = 15 * 60 * 1000;
export const MICROBIT_POLL_MS = 10_000;
export const MICROBIT_LIMIT_POLL_MS = 60_000;

export type UserRole = "super_admin" | "center_admin" | "teacher";
export type UserStatus = "active" | "disabled";
export type ApiKeyStatus = "active" | "disabled" | "rotated";
export type CommandStatus = "pending" | "pulled" | "acknowledged" | "expired";
export type UnlimitedRequestStatus = "pending" | "approved" | "rejected";
export type UsageKind = "pull" | "send" | "ack" | "heartbeat";

export type AppEnv = {
  Bindings: {
    DB: D1Database;
  };
  Variables: {
    session: SessionUser;
  };
};

export type SessionUser = {
  id: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  centerId: string | null;
};

export type AdminUserRow = SessionUser & {
  passwordSalt: string;
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
};

export type SessionRow = {
  id: string;
  userId: string;
  sessionToken: string;
  expiresAt: string;
  createdAt: string;
};

export type ApiKeyRow = {
  apiKey: string;
  centerId: string;
  label: string | null;
  status: ApiKeyStatus;
  dailyLimit: number;
  unlimitedUntil: string | null;
  lastUsedAt: string | null;
  rotatedToApiKey: string | null;
  createdAt: string;
  updatedAt: string;
};

export type UsageRow = {
  apiKey: string;
  usageDate: string;
  requestCount: number;
  pullCount: number;
  sendCount: number;
  ackCount: number;
  heartbeatCount: number;
  updatedAt: string;
};

export type DeviceCommandRow = {
  id: string;
  apiKey: string;
  name: string;
  value: string;
  status: CommandStatus;
  expiresAt: string | null;
  pulledAt: string | null;
  acknowledgedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DeviceStateRow = {
  apiKey: string;
  lastEventName: string | null;
  lastEventValue: string | null;
  lastSeenAt: string | null;
  updatedAt: string;
};

export type DeviceEventRow = {
  id: string;
  apiKey: string;
  name: string;
  value: string;
  createdAt: string;
};

export type UnlimitedRequestRow = {
  id: string;
  apiKey: string;
  requestedByUserId: string;
  requestedUntil: string;
  reason: string | null;
  status: UnlimitedRequestStatus;
  reviewedByUserId: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AuditLogRow = {
  id: string;
  userId: string;
  action: string;
  targetType: string;
  targetId: string;
  detailsJson: string | null;
  createdAt: string;
};
