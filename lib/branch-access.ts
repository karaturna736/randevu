import { one, ApiError } from "./server";

const PASSWORD_ITERATIONS_MIN = 100000;
const PASSWORD_ITERATIONS_MAX = 1000000;

function fromHex(value: string) {
  if (!/^[0-9a-f]+$/i.test(value) || value.length % 2) return null;
  const bytes = new Uint8Array(value.length / 2);
  for (let i = 0; i < bytes.length; i++)
    bytes[i] = Number.parseInt(value.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

async function derivePassword(password: string, salt: Uint8Array, iterations: number) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  return new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "PBKDF2", hash: "SHA-256", salt, iterations },
      key,
      256,
    ),
  );
}

async function matches(password: string, encoded: string) {
  if (password.length < 8 || password.length > 72) return false;
  const [scheme, iterationsRaw, saltRaw, expectedRaw] = encoded.split("$");
  const iterations = Number(iterationsRaw);
  const salt = fromHex(saltRaw || "");
  const expected = fromHex(expectedRaw || "");
  if (
    scheme !== "pbkdf2-sha256" ||
    !Number.isInteger(iterations) ||
    iterations < PASSWORD_ITERATIONS_MIN ||
    iterations > PASSWORD_ITERATIONS_MAX ||
    !salt ||
    !expected ||
    expected.length !== 32
  )
    return false;
  const actual = await derivePassword(password, salt, iterations);
  let difference = actual.length ^ expected.length;
  for (let i = 0; i < Math.min(actual.length, expected.length); i++)
    difference |= actual[i] ^ expected[i];
  return difference === 0;
}

export async function branchPasswordConfigured(tenantId: string, branchId: string) {
  return !!(await one(
    "SELECT 1 ok FROM branch_manager_passwords WHERE tenant_id=? AND branch_id=?",
    tenantId,
    branchId,
  ));
}

export async function verifyBranchAccessPassword(
  tenantId: string,
  branchId: string,
  password?: string,
) {
  if (!password) throw new ApiError("Şube erişim şifresi gerekli.", 401);
  const row = await one(
    "SELECT password_hash FROM branch_manager_passwords WHERE tenant_id=? AND branch_id=?",
    tenantId,
    branchId,
  );
  if (!row?.password_hash)
    throw new ApiError("Bu şube için erişim şifresi henüz belirlenmemiş.", 409);
  if (!(await matches(password, String(row.password_hash))))
    throw new ApiError("Şube şifresi hatalı.", 403);
  return true;
}
