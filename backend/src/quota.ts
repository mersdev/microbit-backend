import {
  DEFAULT_DAILY_LIMIT,
  DEFAULT_TIMEZONE,
  MAX_UNLIMITED_DAYS,
  ONLINE_WINDOW_MS,
} from "./types.ts";
import { findUsageForDate, upsertUsage } from "./db.ts";
import type { ApiKeyRow, UsageKind } from "./types.ts";

const klDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: DEFAULT_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export const nowIso = () => new Date().toISOString();

export const klDate = (value = nowIso()) => klDateFormatter.format(new Date(value));

export const addDays = (value: string, days: number) =>
  new Date(new Date(value).getTime() + days * 24 * 60 * 60 * 1000).toISOString();

export const isUnlimitedActive = (apiKey: ApiKeyRow, now = nowIso()) =>
  Boolean(apiKey.unlimitedUntil && apiKey.unlimitedUntil > now);

export const remainingQuota = (
  apiKey: ApiKeyRow,
  requestCount: number,
  now = nowIso(),
) => {
  if (isUnlimitedActive(apiKey, now)) {
    return Math.max(0, apiKey.dailyLimit - requestCount);
  }
  return Math.max(0, apiKey.dailyLimit - requestCount);
};

export const canUseApiKey = (
  apiKey: ApiKeyRow,
  requestCount: number,
  now = nowIso(),
) => isUnlimitedActive(apiKey, now) || requestCount < (apiKey.dailyLimit || DEFAULT_DAILY_LIMIT);

export const consumeQuota = async (
  db: D1Database,
  apiKey: ApiKeyRow,
  kind: UsageKind,
  now = nowIso(),
) => {
  const usageDate = klDate(now);
  const usage = await findUsageForDate(db, apiKey.apiKey, usageDate);
  const current = usage?.requestCount ?? 0;

  if (!canUseApiKey(apiKey, current, now)) {
    return {
      ok: false as const,
      left: 0,
      usageDate,
      requestCount: current,
    };
  }

  const next = await upsertUsage(db, usageDate, apiKey.apiKey, kind, now);
  return {
    ok: true as const,
    left: remainingQuota(apiKey, next.requestCount, now),
    usageDate,
    requestCount: next.requestCount,
  };
};

export const validateUnlimitedUntil = (requestedUntil: string, now = nowIso()) => {
  if (!requestedUntil) {
    return false;
  }

  const requestedAt = new Date(requestedUntil).toISOString();
  const latest = addDays(now, MAX_UNLIMITED_DAYS);
  return requestedAt > now && requestedAt <= latest;
};

export const isOnline = (lastSeenAt: string | null, now = nowIso()) => {
  if (!lastSeenAt) {
    return false;
  }
  return new Date(now).getTime() - new Date(lastSeenAt).getTime() <= ONLINE_WINDOW_MS;
};
