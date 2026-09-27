import { z } from "zod";
import { equalSecret } from "./security";
import { ApiError, now, one, q } from "./server";

const ALGORITHM = "pbkdf2-sha256";
const ITERATIONS = 310_000;
const KEY_BYTES = 32;
const SALT_BYTES = 16;

export const branchPasswordSchema = z
  .string()
  .min(8, "Şube şifresi en az 8 karakter olmalıdır.")
  .max(72, "Şube şifresi en fazla 72 karakter olabilir.");

function toBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string) {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

async function derive(password: string, salt: Uint8Array, iterations: number) {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    material,
    KEY_BYTES * 8,
  );
  return new Uint8Array(bits);
}

export async function hashBranchPassword(raw: string) {
  const password = branchPasswordSchema.parse(raw);
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const digest = await derive(password, salt, ITERATIONS);
  return [ALGORITHM, String(ITERATIONS), toBase64(salt), toBase64(digest)].join("$");
}

export async function verifyBranchPasswordHash(raw: string, stored: string) {
  try {
    const [algorithm, roundsRaw, saltRaw, digestRaw] = stored.split("$");
    const rounds = Number(roundsRaw);
    if (
      algorithm !== ALGORITHM ||
      !Number.isInteger(rounds) ||
      rounds < 100_000 ||
      rounds > 1_000_000 ||
      !saltRaw ||
      !digestRaw
    )
      return false;
    const password = branchPasswordSchema.parse(raw);
    const digest = await derive(password, fromBase64(saltRaw), rounds);
    return equalSecret(toBase64(digest), digestRaw);
  } catch {
    return false;
  }
}

export async function setBranchPassword(
  tenantId: string,
  branchId: string,
  raw: string,
) {
  const branch = await one(
    "SELECT id FROM branches WHERE tenant_id=? AND id=?",
    tenantId,
    branchId,
  );
  if (!branch) throw new ApiError("Şube bulunamadı.", 404);
  const passwordHash = await hashBranchPassword(raw);
  await q(
    `INSERT INTO branch_credentials(tenant_id,branch_id,password_hash,updated_at)
     VALUES(?,?,?,?)
     ON CONFLICT(tenant_id,branch_id) DO UPDATE SET
       password_hash=excluded.password_hash,
       updated_at=excluded.updated_at`,
    tenantId,
    branchId,
    passwordHash,
    now(),
  ).run();
  return { ok: true };
}

export async function verifyBranchPassword(
  tenantId: string,
  branchId: string,
  raw: string,
) {
  const row = await one(
    `SELECT bc.password_hash
     FROM branch_credentials bc
     JOIN branches b ON b.tenant_id=bc.tenant_id AND b.id=bc.branch_id
     WHERE bc.tenant_id=? AND bc.branch_id=? AND b.active=1`,
    tenantId,
    branchId,
  );
  if (!row?.password_hash) return false;
  return verifyBranchPasswordHash(raw, String(row.password_hash));
}
