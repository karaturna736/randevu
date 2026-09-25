import { env } from "cloudflare:workers";
import { headers } from "next/headers";
import { cookieValue, digest, equalSecret, hmac } from "./security";

const COOKIE = "__Host-neta-admin";
const cfg = () => env as any;

function urlSafe(value: string) {
  return value.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function adminAccessConfigured() {
  return (
    /^[a-f0-9]{64}$/i.test(String(cfg().ADMIN_ACCESS_PASSWORD_HASH || "")) &&
    String(cfg().ADMIN_ACCESS_SESSION_SECRET || "").length >= 32
  );
}

export async function verifyAdminPassword(password: string) {
  if (!adminAccessConfigured()) return false;
  const actual = await digest(password);
  return equalSecret(
    actual.toLowerCase(),
    String(cfg().ADMIN_ACCESS_PASSWORD_HASH).toLowerCase(),
  );
}

async function signature(userId: string, expires: number) {
  return urlSafe(
    await hmac(`${userId}|${expires}`, String(cfg().ADMIN_ACCESS_SESSION_SECRET)),
  );
}

export async function adminAccessCookie(userId: string) {
  const expires = Date.now() + 8 * 60 * 60 * 1000;
  const sig = await signature(userId, expires);
  return `${COOKIE}=${expires}.${sig}; Path=/; HttpOnly; Secure; SameSite=Strict; Priority=High; Max-Age=${8 * 60 * 60}`;
}

export function clearAdminAccessCookie() {
  return `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Priority=High; Max-Age=0`;
}

export async function hasAdminAccess(userId: string) {
  if (!adminAccessConfigured()) return true;
  const h = await headers();
  const value = cookieValue(h.get("cookie"), COOKIE);
  if (!value) return false;
  const match = /^(\d{13})\.([A-Za-z0-9_-]{20,100})$/.exec(value);
  if (!match) return false;
  const expires = Number(match[1]);
  if (!Number.isFinite(expires) || expires <= Date.now()) return false;
  const expected = await signature(userId, expires);
  return equalSecret(expected, match[2]);
}
