import request from "./http";
import { API } from "../config/api";
import type { Entry } from "./search-types";

type Response = {
  date: string;
  timeZone: string;
  serverTime: string;
  expiresAt: string;
  entry: Entry;
};
type Cache = { response: Response; receivedAt: number; serverOffset: number };
export type DailyResult = {
  response: Response | null;
  offline: boolean;
  unavailable: boolean;
  error: string;
};
const key = `search-app:daily-entry:${encodeURIComponent(API.baseUrl)}:${wx.getAccountInfoSync().miniProgram.envVersion}`;
let pending: Promise<DailyResult> | null = null;
let blockedId = "";
let blockedDay = "";
let blockedOffset = 0;
try {
  const blocked = wx.getStorageSync(key + ":unavailable");
  if (
    blocked &&
    Number.isFinite(blocked.offset) &&
    Date.now() >= blocked.receivedAt
  ) {
    blockedDay = blocked.date;
    blockedId = blocked.id;
    blockedOffset = blocked.offset;
  }
} catch (_) {}
function block(date: string, id: string, offset: number) {
  blockedDay = date;
  blockedId = id;
  blockedOffset = offset;
  try {
    wx.setStorageSync(key + ":unavailable", {
      date,
      id,
      offset,
      receivedAt: Date.now(),
    });
  } catch (_) {}
}
let anchor: { wall: number; mono: number | null } | null = null;
let failed = false;
let clockUncertain = false;
let uncalibratedUnavailable = false;
const mono = (): number | null => {
  const performance = wx.getPerformance() as unknown as { now?: () => number };
  return typeof performance.now === "function" ? performance.now() : null;
};
const day = (time: number) =>
  new Date(time + 8 * 3600000).toISOString().slice(0, 10);
function read(): Cache | null {
  try {
    const cache = wx.getStorageSync(key) as Cache;
    const r = cache?.response;
    if (
      !r ||
      r.timeZone !== "Asia/Shanghai" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(r.date) ||
      !Number.isFinite(cache.receivedAt) ||
      !Number.isFinite(cache.serverOffset) ||
      !Number.isFinite(Date.parse(r.serverTime)) ||
      !Number.isFinite(Date.parse(r.expiresAt)) ||
      !r.entry?.id ||
      !r.entry.expression ||
      !r.entry.available ||
      !Array.isArray(r.entry.senses)
    )
      return null;
    return cache;
  } catch (_) {
    return null;
  }
}
function write(cache: Cache) {
  try {
    wx.setStorageSync(key, cache);
  } catch (_) {}
}
function clear() {
  try {
    wx.removeStorageSync(key);
  } catch (_) {}
}
export function getDailyRefreshDelay(expiresAt?: string): number {
  const now = Date.now() + (read()?.serverOffset ?? blockedOffset);
  const expiry = expiresAt
    ? Date.parse(expiresAt)
    : (Math.floor((now + 8 * 3600000) / 86400000) + 1) * 86400000 - 8 * 3600000;
  return Math.min(2147483647, Math.max(1000, expiry - now));
}
function clockTrusted(cache: Cache) {
  const now = Date.now(),
    tick = mono();
  const stable =
    !!anchor &&
    (tick !== null && anchor.mono !== null
      ? Math.abs(now - anchor.wall - (tick - anchor.mono)) < 60000
      : now >= anchor.wall && now - anchor.wall < 90000);
  if (!stable) clockUncertain = true;
  anchor = { wall: now, mono: tick };
  return (
    stable &&
    !clockUncertain &&
    now >= cache.receivedAt &&
    now - cache.receivedAt < 36 * 3600000
  );
}
export function invalidateDailyEntry(id?: string) {
  const cache = read();
  if (!id || cache?.response.entry.id === id) {
    if (id && cache)
      block(day(Date.now() + cache.serverOffset), id, cache.serverOffset);
    if (!id) {
      failed = false;
      uncalibratedUnavailable = false;
      blockedDay = "";
      blockedId = "";
      try {
        wx.removeStorageSync(key + ":unavailable");
      } catch (_) {}
    }
    clear();
  }
}
export function loadDailyEntry(backgroundCheck = false): Promise<DailyResult> {
  if (backgroundCheck && (failed || uncalibratedUnavailable))
    return Promise.resolve({
      response: null,
      offline: false,
      unavailable: uncalibratedUnavailable,
      error: "SKIP",
    });
  if (pending) return pending;
  pending = load().finally(() => {
    pending = null;
  });
  return pending;
}
async function load(): Promise<DailyResult> {
  const cache = read();
  const trusted = cache ? clockTrusted(cache) : false;
  const now = Date.now() + (cache?.serverOffset ?? blockedOffset);
  if (
    (uncalibratedUnavailable && blockedDay === day(Date.now())) ||
    (blockedDay && !clockUncertain && anchor && day(now) === blockedDay)
  )
    return { response: null, offline: false, unavailable: true, error: "" };
  if (
    cache &&
    trusted &&
    cache.response.date === day(now) &&
    now < Date.parse(cache.response.expiresAt)
  ) {
    return {
      response: cache.response,
      offline: false,
      unavailable: false,
      error: "",
    };
  }
  try {
    // A response crossing midnight is fetched again once, never stored as today's content.
    for (let attempt = 0; attempt < 2; attempt++) {
      const started = mono();
      const response = await request<Response>("/search/daily-entry", {
        auth: false,
      });
      const receivedAt = Date.now();
      const server = Date.parse(response.serverTime);
      const ended = mono();
      const current =
        server +
        (started !== null && ended !== null ? Math.max(0, ended - started) : 0);
      if (
        !Number.isFinite(server) ||
        response.timeZone !== "Asia/Shanghai" ||
        !Number.isFinite(Date.parse(response.expiresAt))
      )
        throw new Error("每日一句时间信息异常");
      if (
        current >= Date.parse(response.expiresAt) ||
        response.date !== day(current)
      )
        continue;
      if (
        !response.entry?.id ||
        !response.entry.expression ||
        !response.entry.available ||
        !Array.isArray(response.entry.senses)
      )
        throw new Error("今日一句暂不可用");
      if (response.entry.id === blockedId && response.date === blockedDay)
        return { response: null, offline: false, unavailable: true, error: "" };
      write({ response, receivedAt, serverOffset: current - receivedAt });
      anchor = { wall: receivedAt, mono: mono() };
      failed = false;
      clockUncertain = false;
      uncalibratedUnavailable = false;
      blockedDay = "";
      blockedId = "";
      try {
        wx.removeStorageSync(key + ":unavailable");
      } catch (_) {}
      return { response, offline: false, unavailable: false, error: "" };
    }
    throw new Error("今日一句已过期，请重试");
  } catch (error) {
    const failure = error as {
      statusCode?: number;
      responseHeaders?: Record<string, string>;
      data?: { error?: { code?: string } | string };
    };
    const code =
      typeof failure.data?.error === "string"
        ? failure.data.error
        : failure.data?.error?.code;
    if (failure.statusCode === 404 && code === "DAILY_ENTRY_UNAVAILABLE") {
      const headers = failure.responseHeaders || {};
      const dateHeader = Object.keys(headers).find(
        (name) => name.toLowerCase() === "date",
      );
      const server = dateHeader ? Date.parse(headers[dateHeader]) : NaN;
      const calibrated = Number.isFinite(server)
        ? server
        : cache && trusted
          ? now
          : NaN;
      uncalibratedUnavailable = !Number.isFinite(calibrated);
      const time = uncalibratedUnavailable ? Date.now() : calibrated;
      block(day(time), cache?.response.entry.id || "", time - Date.now());
      anchor = { wall: Date.now(), mono: mono() };
      clear();
      return { response: null, offline: false, unavailable: true, error: "" };
    }
    failed = true;
    return {
      response: cache?.response || null,
      offline: !!cache,
      unavailable: false,
      error: "今日一句加载失败，请重试",
    };
  }
}
