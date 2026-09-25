import { env } from "cloudflare:workers";
import { headers } from "next/headers";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import {
  digest,
  randomToken,
  cookieValue,
  privateHeaders,
  equalSecret,
  base64,
} from "./security";
import { safeDestination } from "./calendar";

const SESSION = "__Host-neta-session",
  FLOW = "__Host-neta-flow";
const googleKeys = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs"),
  { timeoutDuration: 6000, cooldownDuration: 30000 },
);
const config = () => env as any;
export function appOrigin() {
  try {
    const u = new URL(String(config().PUBLIC_APP_URL || ""));
    return u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      u.pathname === "/" &&
      !u.search &&
      !u.hash
      ? u.origin
      : null;
  } catch {
    return null;
  }
}
function chatGPTAuthEnabled() {
  return String(config().CHATGPT_AUTH_ENABLED || "true").toLowerCase() === "true";
}
export function authStatus() {
  return {
    google: !!(
      config().GOOGLE_AUTH_ENABLED === "true" &&
      config().GOOGLE_CLIENT_ID &&
      config().GOOGLE_CLIENT_SECRET &&
      appOrigin()
    ),
  };
}
export async function getAppUser() {
  const h = await headers(),
    token = cookieValue(h.get("cookie"), SESSION);
  if (token) {
    if (!/^[a-f0-9]{64}$/.test(token) || !env.DB) return null;
    const s = await env.DB.prepare(
      "SELECT user_id,email,full_name FROM auth_sessions WHERE token_hash=? AND expires_at>?",
    )
      .bind(await digest(token), Date.now())
      .first<any>();
    return s
      ? {
          userId: s.user_id,
          email: s.email,
          fullName: s.full_name,
          displayName: s.full_name || s.email,
          provider: "google",
        }
      : null;
  }
  if (!chatGPTAuthEnabled()) return null;
  const u = await getChatGPTUser();
  return u ? { ...u, provider: "chatgpt" } : null;
}
function cookie(name: string, value: string, seconds: number) {
  return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Priority=High; Max-Age=${seconds}`;
}
function redirect(path: string, cookies: string[] = []) {
  const h = new Headers({ ...privateHeaders, Location: path });
  cookies.forEach((c) => h.append("Set-Cookie", c));
  return new Response(null, { status: 303, headers: h });
}
export async function startGoogle(req: Request) {
  if (!authStatus().google || !env.DB)
    return redirect("/giris?rol=business&hata=google_hazir_degil");
  const state = randomToken(),
    binding = randomToken(),
    nonce = randomToken(),
    verifier = randomToken(),
    now = Date.now();
  const returnTo = safeDestination(
    new URL(req.url).searchParams.get("sonra"),
    "/kayit?rol=business&sonra=%2Fpanel",
  );
  await env.DB.batch([
    env.DB.prepare("DELETE FROM auth_flows WHERE expires_at<?").bind(now),
    env.DB.prepare(
      "INSERT INTO auth_flows(state_hash,binding_hash,nonce,verifier,return_to,expires_at) VALUES(?,?,?,?,?,?)",
    ).bind(
      await digest(state),
      await digest(binding),
      nonce,
      verifier,
      returnTo,
      now + 600000,
    ),
  ]);
  const challenge = base64(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)),
    ),
  )
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: config().GOOGLE_CLIENT_ID,
    redirect_uri: appOrigin() + "/api/auth/google/callback",
    response_type: "code",
    scope: "openid email profile",
    state,
    nonce,
    code_challenge: challenge,
    code_challenge_method: "S256",
    prompt: "select_account",
    access_type: "online",
  }).toString();
  return redirect(url.toString(), [cookie(FLOW, binding, 600)]);
}
export function googleClaims(payload: JWTPayload, nonce: string) {
  if (
    typeof payload.nonce !== "string" ||
    !equalSecret(payload.nonce, nonce) ||
    payload.email_verified !== true ||
    typeof payload.email !== "string" ||
    !payload.email.includes("@") ||
    typeof payload.sub !== "string" ||
    !payload.sub ||
    payload.sub.length > 255
  )
    throw new Error("GOOGLE_CLAIMS_INVALID");
  return {
    userId: "google:" + payload.sub,
    email: payload.email.toLowerCase(),
    name: typeof payload.name === "string" ? payload.name.slice(0, 100) : "",
  };
}
export async function finishGoogle(req: Request) {
  const clear = cookie(FLOW, "", 0);
  try {
    if (!authStatus().google || !env.DB) throw new Error("NOT_CONFIGURED");
    const u = new URL(req.url),
      state = u.searchParams.get("state") || "",
      code = u.searchParams.get("code") || "",
      binding = cookieValue(req.headers.get("cookie"), FLOW) || "";
    if (
      !/^[a-f0-9]{64}$/.test(state) ||
      !/^[a-f0-9]{64}$/.test(binding) ||
      !code ||
      code.length > 4096
    )
      throw new Error("BAD_FLOW");
    const flow = await env.DB.prepare(
      "DELETE FROM auth_flows WHERE state_hash=? AND binding_hash=? AND expires_at>? RETURNING *",
    )
      .bind(await digest(state), await digest(binding), Date.now())
      .first<any>();
    if (!flow) throw new Error("BAD_FLOW");
    const result = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config().GOOGLE_CLIENT_ID,
        client_secret: config().GOOGLE_CLIENT_SECRET,
        code,
        code_verifier: flow.verifier,
        grant_type: "authorization_code",
        redirect_uri: appOrigin() + "/api/auth/google/callback",
      }),
      signal: AbortSignal.timeout(10000),
      redirect: "manual",
    });
    if (!result.ok) throw new Error("EXCHANGE_FAILED");
    const token: any = await result.json();
    if (typeof token.id_token !== "string") throw new Error("NO_IDENTITY");
    const { payload } = await jwtVerify(token.id_token, googleKeys, {
      issuer: ["https://accounts.google.com", "accounts.google.com"],
      audience: config().GOOGLE_CLIENT_ID,
      algorithms: ["RS256"],
      requiredClaims: ["sub", "iat", "exp", "nonce", "email", "email_verified"],
      maxTokenAge: "10 minutes",
      clockTolerance: 5,
    });
    const identity = googleClaims(payload, flow.nonce);
    const p = await env.DB.prepare(
      "SELECT disabled FROM profiles WHERE user_id=?",
    )
      .bind(identity.userId)
      .first<any>();
    if (p?.disabled) throw new Error("ACCOUNT_DISABLED");
    const session = randomToken(),
      old = cookieValue(req.headers.get("cookie"), SESSION),
      stamp = Date.now();
    const ops = [
      env.DB.prepare("DELETE FROM auth_sessions WHERE expires_at<?").bind(
        stamp,
      ),
      env.DB.prepare(
        "INSERT INTO auth_sessions(token_hash,user_id,email,full_name,created_at,expires_at) VALUES(?,?,?,?,?,?)",
      ).bind(
        await digest(session),
        identity.userId,
        identity.email,
        identity.name,
        stamp,
        stamp + 7 * 86400000,
      ),
    ];
    if (old)
      ops.push(
        env.DB.prepare("DELETE FROM auth_sessions WHERE token_hash=?").bind(
          await digest(old),
        ),
      );
    await env.DB.batch(ops);
    return redirect(safeDestination(flow.return_to, "/panel"), [
      clear,
      cookie(SESSION, session, 7 * 86400),
    ]);
  } catch {
    return redirect("/giris?rol=business&hata=google_dogrulanamadi", [clear]);
  }
}
export async function signOutApp(req: Request) {
  const token = cookieValue(req.headers.get("cookie"), SESSION);
  if (token && env.DB)
    await env.DB.prepare("DELETE FROM auth_sessions WHERE token_hash=?")
      .bind(await digest(token))
      .run();
  const destination =
    token || !chatGPTAuthEnabled()
      ? "/giris"
      : "/signout-with-chatgpt?return_to=%2Fgiris";
  return redirect(destination, [
    cookie(SESSION, "", 0),
    cookie(FLOW, "", 0),
  ]);
}
