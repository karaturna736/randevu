import { one, q, tenant, now, ApiError } from './server';

const ITERATIONS = 210000;
const ITERATIONS_MIN = 100000;
const ITERATIONS_MAX = 1000000;

export function validateBranchPasswordInput(value: unknown) {
  if (typeof value !== 'string' || value.length < 8 || value.length > 72 || !/\p{L}/u.test(value) || !/\d/.test(value))
    throw new ApiError('Şube şifresi en az 8 karakter olmalı ve en az bir harf ile bir rakam içermeli.', 400);
  return value;
}

function toHex(bytes: Uint8Array) {
  return Array.from(bytes).map(value => value.toString(16).padStart(2, '0')).join('');
}

function fromHex(value: string) {
  if (!/^[0-9a-f]+$/i.test(value) || value.length % 2) return null;
  const bytes = new Uint8Array(value.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = Number.parseInt(value.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

async function derive(password: string, salt: Uint8Array, iterations: number) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: new Uint8Array(salt), iterations }, key, 256));
}

export async function setBranchAccessPassword(tenantId: string, branchId: string, rawPassword: unknown) {
  await tenant(tenantId);
  const password = validateBranchPasswordInput(rawPassword);
  if (!(await one('SELECT 1 ok FROM branches WHERE tenant_id=? AND id=? AND active=1', tenantId, branchId))) throw new ApiError('Şube bulunamadı.', 404);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const digest = await derive(password, salt, ITERATIONS);
  const encoded = `pbkdf2-sha256$${ITERATIONS}$${toHex(salt)}$${toHex(digest)}`;
  await q(`INSERT INTO branch_manager_passwords(tenant_id,branch_id,password_hash,updated_at) VALUES(?,?,?,?)
    ON CONFLICT(tenant_id,branch_id) DO UPDATE SET password_hash=excluded.password_hash,updated_at=excluded.updated_at`, tenantId, branchId, encoded, now()).run();
  return { ok: true, branch_id: branchId, password_configured: true };
}

export async function verifyBranchAccessPassword(tenantId: string, branchId: string, rawPassword: unknown) {
  const password = validateBranchPasswordInput(rawPassword);
  const row = await one('SELECT password_hash FROM branch_manager_passwords WHERE tenant_id=? AND branch_id=?', tenantId, branchId);
  if (!row?.password_hash) throw new ApiError('Bu şube için erişim şifresi henüz belirlenmemiş.', 409);
  const [scheme, iterationsRaw, saltRaw, expectedRaw] = String(row.password_hash).split('$');
  const iterations = Number(iterationsRaw), salt = fromHex(saltRaw || ''), expected = fromHex(expectedRaw || '');
  if (scheme !== 'pbkdf2-sha256' || !Number.isInteger(iterations) || iterations < ITERATIONS_MIN || iterations > ITERATIONS_MAX || !salt || !expected || expected.length !== 32) throw new ApiError('Şube erişim şifresi yapılandırması geçersiz.', 503);
  const actual = await derive(password, salt, iterations);
  let difference = 0;
  for (let i = 0; i < actual.length; i++) difference |= actual[i] ^ expected[i];
  if (difference !== 0) throw new ApiError('Şube şifresi hatalı.', 403);
  return true;
}
