import { env } from "cloudflare:workers";
import { ApiError } from "./server";

const cfg = () => env as any;
const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const PROD_HOST = "netarandevu.com";

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmac(value: string) {
  const secret = String(cfg().TURNSTILE_SECRET || "");
  if (!secret) throw new ApiError("TURNSTILE_NOT_CONFIGURED", 503);
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return bytesToHex(
    new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value))),
  );
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function verifyTurnstile(req: Request, token: string, expectedAction = "auth") {
  const secret = String(cfg().TURNSTILE_SECRET || "");
  if (!secret) throw new ApiError("TURNSTILE_NOT_CONFIGURED", 503);
  if (!token || token.length > 2048) throw new ApiError("TURNSTILE_REQUIRED", 403);

  let result: any;
  try {
    const response = await fetch(SITEVERIFY, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      signal: AbortSignal.timeout(10_000),
      body: new URLSearchParams({
        secret,
        response: token,
        remoteip:
          req.headers.get("cf-connecting-ip") ||
          req.headers.get("x-real-ip") ||
          "",
      }),
    });
    if (!response.ok) throw new Error(`siteverify ${response.status}`);
    result = await response.json();
  } catch {
    throw new ApiError("TURNSTILE_UNAVAILABLE", 403);
  }

  if (
    !result?.success ||
    result.action !== expectedAction ||
    result.hostname !== PROD_HOST
  ) {
    throw new ApiError("TURNSTILE_FAILED", 403);
  }
  return result;
}

export async function issueTurnstileGate() {
  const expires = Date.now() + 5 * 60_000;
  const payload = String(expires);
  const signature = await hmac(`auth:${payload}`);
  return `${payload}.${signature}`;
}

export async function requireTurnstileGate(req: Request) {
  // Turnstile is a production-edge control. Isolated test/dev hosts keep using
  // the existing auth tests without weakening enforcement on netarandevu.com.
  if (new URL(req.url).hostname.toLowerCase() !== PROD_HOST) return;

  const cookie = req.headers.get("cookie") || "";
  const raw = cookie
    .split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith("neta_turnstile="))
    ?.slice("neta_turnstile=".length);
  if (!raw) throw new ApiError("TURNSTILE_REQUIRED", 403);
  const [expiresText, signature] = raw.split(".");
  const expires = Number(expiresText);
  if (!Number.isSafeInteger(expires) || expires < Date.now() || expires > Date.now() + 6 * 60_000)
    throw new ApiError("TURNSTILE_REQUIRED", 403);
  const expected = await hmac(`auth:${expiresText}`);
  if (!signature || !safeEqual(signature, expected))
    throw new ApiError("TURNSTILE_REQUIRED", 403);
}
