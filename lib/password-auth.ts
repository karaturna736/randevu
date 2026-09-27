import { z } from "zod";
import { ApiError, now, one, q } from "./server";

const ITERATIONS = 210_000;
const encoder = new TextEncoder();

export const panelPasswordSchema = z
  .string()
  .min(10, "Şifre en az 10 karakter olmalı.")
  .max(128, "Şifre çok uzun.")
  .refine((value) => /[A-Za-zÇĞİÖŞÜçğıöşü]/.test(value) && /\d/.test(value), "Şifrede en az bir harf ve bir rakam olmalı.");

export const panelLoginSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Geçerli bir e-posta girin.")
  .max(254);

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

async function derive(password: string, salt: Uint8Array, iterations = ITERATIONS) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    key,
    256,
  );
  return new Uint8Array(bits);
}

function safeEqual(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function hashPanelPassword(passwordInput: unknown) {
  const password = panelPasswordSchema.parse(passwordInput);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(password, salt);
  return `pbkdf2-sha256$${ITERATIONS}$${bytesToBase64Url(salt)}$${bytesToBase64Url(hash)}`;
}

export async function verifyPanelPassword(password: string, encoded: string) {
  try {
    const [algorithm, iterationsText, saltText, hashText] = encoded.split("$");
    const iterations = Number(iterationsText);
    if (algorithm !== "pbkdf2-sha256" || !Number.isSafeInteger(iterations) || iterations < 100_000 || iterations > 1_000_000)
      return false;
    const salt = base64UrlToBytes(saltText);
    const expected = base64UrlToBytes(hashText);
    const actual = await derive(password, salt, iterations);
    return safeEqual(actual, expected);
  } catch {
    return false;
  }
}

export async function setPasswordCredential(userId: string, loginInput: unknown, passwordInput: unknown, mustChange = false) {
  const login = panelLoginSchema.parse(loginInput);
  const passwordHash = await hashPanelPassword(passwordInput);
  const collision = await one("SELECT user_id FROM password_credentials WHERE login=? AND user_id<>?", login, userId);
  if (collision) throw new ApiError("Bu e-posta başka bir panel hesabında kullanılıyor.", 409);
  const stamp = now();
  await q(
    `INSERT INTO password_credentials(user_id,login,password_hash,must_change_password,created_at,updated_at)
     VALUES(?,?,?,?,?,?)
     ON CONFLICT(user_id) DO UPDATE SET login=excluded.login,password_hash=excluded.password_hash,must_change_password=excluded.must_change_password,updated_at=excluded.updated_at`,
    userId,
    login,
    passwordHash,
    mustChange ? 1 : 0,
    stamp,
    stamp,
  ).run();
  return { login };
}

export async function authenticatePassword(loginInput: unknown, passwordInput: unknown) {
  const login = panelLoginSchema.parse(loginInput);
  const password = z.string().min(1).max(128).parse(passwordInput);
  const row = await one(
    `SELECT c.user_id,c.login,c.password_hash,c.must_change_password,p.name,p.email,p.disabled,p.account_type
     FROM password_credentials c JOIN profiles p ON p.user_id=c.user_id WHERE c.login=?`,
    login,
  );
  if (!row || row.disabled || !(await verifyPanelPassword(password, row.password_hash)))
    throw new ApiError("E-posta veya şifre hatalı.", 401);
  await q("UPDATE password_credentials SET last_login_at=?,updated_at=updated_at WHERE user_id=?", now(), row.user_id).run();
  return row;
}
