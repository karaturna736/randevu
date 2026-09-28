import { z } from "zod";
import { all, one, q, user, tenant, admin, now, date, uid, ApiError } from "./server";
import { SELECT_APPOINTMENTS, change } from "./booking";
import { adminAccessConfigured, hasAdminAccess } from "./admin-access";
import { branchPasswordAddon } from "./branch-access";

const ADDON = "management";
const PASSWORD_ITERATIONS = 210000;
const branchPassword = z
  .string()
  .min(8, "Şube şifresi en az 8 karakter olmalı.")
  .max(72, "Şube şifresi en fazla 72 karakter olabilir.")
  .refine((value) => /\p{L}/u.test(value) && /\d/.test(value), "Şube şifresinde en az bir harf ve bir rakam olmalı.");

function toHex(bytes: Uint8Array) {
  return Array.from(bytes).map((value) => value.toString(16).padStart(2, "0")).join("");
}

function fromHex(value: string) {
  if (!/^[0-9a-f]+$/i.test(value) || value.length % 2) return null;
  const bytes = new Uint8Array(value.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = Number.parseInt(value.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

async function derivePassword(password: string, salt: Uint8Array, iterations = PASSWORD_ITERATIONS) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  return new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "PBKDF2", hash: "SHA-256", salt: new Uint8Array(salt), iterations },
      key,
      256,
    ),
  );
}

async function hashBranchPassword(password: string) {
  const normalized = branchPassword.parse(password);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const digest = await derivePassword(normalized, salt);
  return `pbkdf2-sha256$${PASSWORD_ITERATIONS}$${toHex(salt)}$${toHex(digest)}`;
}

async function verifyBranchPassword(password: string, encoded: string) {
  const [scheme, iterationsRaw, saltRaw, expectedRaw] = encoded.split("$");
  if (scheme !== "pbkdf2-sha256") return false;
  const iterations = Number(iterationsRaw);
  const salt = fromHex(saltRaw || "");
  const expected = fromHex(expectedRaw || "");
  if (!Number.isInteger(iterations) || iterations < 100000 || iterations > 1000000 || !salt || !expected || expected.length !== 32) return false;
  let passwordValue: string;
  try {
    passwordValue = branchPassword.parse(password);
  } catch {
    return false;
  }
  const actual = await derivePassword(passwordValue, salt, iterations);
  if (actual.length !== expected.length) return false;
  let difference = 0;
  for (let i = 0; i < actual.length; i++) difference |= actual[i] ^ expected[i];
  return difference === 0;
}

export async function managerAddon(tenantId: string) {
  return !!(await one(
    "SELECT 1 ok FROM tenant_addons WHERE tenant_id=? AND code=? AND enabled=1",
    tenantId, ADDON,
  ));
}

export async function managerAccess(tenantId: string) {
  const u = await user();
  const membership = await one(
    `SELECT m.branch_id,b.name business_name,b.demo,b.status,br.name branch_name
     FROM members m JOIN businesses b ON b.id=m.tenant_id
     JOIN branches br ON br.tenant_id=m.tenant_id AND br.id=m.branch_id AND br.active=1
     WHERE m.tenant_id=? AND m.user_id=? AND m.role='manager' AND m.disabled=0
       AND b.status NOT IN ('deleted','suspended')`,
    tenantId, u.userId,
  );
  if (!membership) throw new ApiError("Bu şubeye müdür erişiminiz yok.", 403);
  if (!(await managerAddon(tenantId))) throw new ApiError("Müdürlük modülü bu işletmede etkin değil.", 402);
  const paid = membership.demo || await one(
    `SELECT 1 ok FROM subscriptions WHERE tenant_id=? AND paid_until>?
     UNION SELECT 1 ok FROM recurring_subscriptions WHERE tenant_id=? AND test_mode=0
       AND plan IN ('normal','pro','plus') AND paid_until>? LIMIT 1`,
    tenantId, now(), tenantId, now(),
  );
  if (!paid) throw new ApiError("İşletmenin aktif aboneliği gerekiyor.", 402);
  return { ...membership, tenant_id: tenantId };
}

export async function managerDirectory(tenantId: string) {
  await tenant(tenantId);
  return {
    enabled: await managerAddon(tenantId),
    password_enabled: await branchPasswordAddon(tenantId),
    branches: await all(
      `SELECT b.id,b.name,CASE WHEN p.password_hash IS NULL THEN 0 ELSE 1 END password_configured
       FROM branches b LEFT JOIN branch_manager_passwords p ON p.tenant_id=b.tenant_id AND p.branch_id=b.id
       WHERE b.tenant_id=? AND b.active=1 ORDER BY b.name`,
      tenantId,
    ),
    members: await all("SELECT user_id,email,name,branch_id,disabled FROM members WHERE tenant_id=? AND role='manager'", tenantId),
  };
}

export async function setManagerBranchPassword(tenantId: string, input: unknown) {
  await tenant(tenantId);
  if (!(await branchPasswordAddon(tenantId))) throw new ApiError("Şifreli giriş ek paketini etkinleştirin.", 402);
  const x = z.object({ branch_id: z.string().min(1), password: branchPassword }).parse(input);
  const branch = await one("SELECT id FROM branches WHERE tenant_id=? AND id=? AND active=1", tenantId, x.branch_id);
  if (!branch) throw new ApiError("Şube bulunamadı.", 404);
  const passwordHash = await hashBranchPassword(x.password);
  await q(
    `INSERT INTO branch_manager_passwords(tenant_id,branch_id,password_hash,updated_at) VALUES(?,?,?,?)
     ON CONFLICT(tenant_id,branch_id) DO UPDATE SET password_hash=excluded.password_hash,updated_at=excluded.updated_at`,
    tenantId,
    x.branch_id,
    passwordHash,
    now(),
  ).run();
  return { ok: true, branch_id: x.branch_id, password_configured: true };
}

export async function businessAddons(tenantId: string) {
  await tenant(tenantId);
  return {
    addons: [{
      code: ADDON,
      name: "Müdürlük ve şube yönetimi",
      description: "Müdüre yalnızca atandığı şubenin randevularını ve finans özetini gösterir.",
      included: false,
      enabled: await managerAddon(tenantId),
      price: (await one("SELECT price FROM addon_catalog WHERE code=?", ADDON))?.price ?? null,
      purchasable: false,
    }, {
      code: "branch_password",
      name: "Şifreli şube girişi",
      description: "Çalışan ve müdür hesaplarında, kişisel hesap girişine ek olarak şube şifresi ister.",
      included: false,
      enabled: await branchPasswordAddon(tenantId),
      price: (await one("SELECT price FROM addon_catalog WHERE code='branch_password'"))?.price ?? 150000,
      purchasable: false,
    }],
    employee: { name: "Çalışan paneli", included: true, price: 0 },
  };
}

export async function setManager(tenantId: string, input: unknown) {
  await tenant(tenantId);
  if (!(await managerAddon(tenantId))) throw new ApiError("Önce müdürlük modülünü etkinleştirin.", 402);
  const x = z.discriminatedUnion("action", [
    z.object({ action: z.literal("assign"), email: z.string().email().max(254), branch_id: z.string().min(1) }),
    z.object({ action: z.literal("remove"), user_id: z.string().min(1) }),
  ]).parse(input);
  if (x.action === "remove") {
    await q("UPDATE members SET disabled=1 WHERE tenant_id=? AND user_id=? AND role='manager'", tenantId, x.user_id).run();
    return { ok: true };
  }
  const branch = await one("SELECT id FROM branches WHERE tenant_id=? AND id=? AND active=1", tenantId, x.branch_id);
  if (!branch) throw new ApiError("Şube bulunamadı.", 404);
  if (await branchPasswordAddon(tenantId)) {
    const configured = await one("SELECT 1 ok FROM branch_manager_passwords WHERE tenant_id=? AND branch_id=?", tenantId, x.branch_id);
    if (!configured) throw new ApiError("Şifreli giriş etkinken önce bu şubenin şifresini belirleyin.", 409);
  }
  const people = await all("SELECT user_id,email,name FROM profiles WHERE lower(email)=? AND disabled=0 LIMIT 2", x.email.toLowerCase());
  if (people.length !== 1) throw new ApiError("Müdür önce bu e-posta ile üyeliğini tamamlamalı.");
  const person = people[0];
  const existing = await one("SELECT role FROM members WHERE tenant_id=? AND user_id=?", tenantId, person.user_id);
  if (existing?.role && existing.role !== "manager") throw new ApiError("Bu kişinin mevcut işletme rolünü önce kaldırın.", 409);
  await q(`INSERT INTO members(tenant_id,user_id,email,name,role,branch_id,disabled) VALUES(?,?,?,?,'manager',?,0)
    ON CONFLICT(tenant_id,user_id) DO UPDATE SET email=excluded.email,name=excluded.name,branch_id=excluded.branch_id,disabled=0
    WHERE members.role='manager'`, tenantId, person.user_id, person.email, person.name, x.branch_id).run();
  return { ok: true };
}

export async function managerBusinesses() {
  const u = await user();
  return all(`SELECT b.id,b.name,br.name branch_name,CASE WHEN pa.enabled=1 THEN 1 ELSE 0 END password_required FROM members m JOIN businesses b ON b.id=m.tenant_id
    JOIN branches br ON br.tenant_id=b.id AND br.id=m.branch_id AND br.active=1
    JOIN tenant_addons ta ON ta.tenant_id=b.id AND ta.code=? AND ta.enabled=1
    LEFT JOIN tenant_addons pa ON pa.tenant_id=b.id AND pa.code='branch_password'
    WHERE m.user_id=? AND m.role='manager' AND m.disabled=0 AND b.status NOT IN ('deleted','suspended')`, ADDON, u.userId);
}

export async function managerSnapshot(tenantId: string, dayInput: string, password?: string) {
  const access = await managerAccess(tenantId);
  if (await branchPasswordAddon(tenantId)) {
    if (!password) throw new ApiError("Şube erişim şifresi gerekli.", 401);
    const passwordRow = await one("SELECT password_hash FROM branch_manager_passwords WHERE tenant_id=? AND branch_id=?", tenantId, access.branch_id);
    if (!passwordRow?.password_hash) throw new ApiError("Bu şube için müdür erişim şifresi henüz belirlenmemiş.", 409);
    if (!(await verifyBranchPassword(password, passwordRow.password_hash))) throw new ApiError("Şube şifresi hatalı.", 403);
  }
  const day = date.parse(dayInput);
  const appointments = await all(
    SELECT_APPOINTMENTS + " WHERE a.tenant_id=? AND a.branch_id=? AND a.date=? ORDER BY a.minute LIMIT 200",
    tenantId, access.branch_id, day,
  );
  const month = day.slice(0, 7);
  const revenue = await one("SELECT COALESCE(SUM(price),0) amount FROM appointments WHERE tenant_id=? AND branch_id=? AND status='completed' AND substr(date,1,7)=?", tenantId, access.branch_id, month);
  const expenses = await one("SELECT COALESCE(SUM(amount),0) amount FROM branch_expenses WHERE tenant_id=? AND branch_id=? AND month=?", tenantId, access.branch_id, month);
  return { access, appointments, finance: { month, revenue: revenue.amount, expenses: expenses.amount, estimate: revenue.amount - expenses.amount } };
}

export async function managerAppointment(tenantId: string, input: unknown) {
  const access = await managerAccess(tenantId);
  const x = z.object({ id: z.string().min(1), status: z.enum(["cancelled", "completed", "no_show"]), branch_password: z.string().optional() }).parse(input);
  if (await branchPasswordAddon(tenantId)) {
    const passwordRow = await one("SELECT password_hash FROM branch_manager_passwords WHERE tenant_id=? AND branch_id=?", tenantId, access.branch_id);
    if (!passwordRow?.password_hash || !(await verifyBranchPassword(x.branch_password || "", passwordRow.password_hash)))
      throw new ApiError("Şube şifresi hatalı.", 403);
  }
  const appointment = await one(SELECT_APPOINTMENTS + " WHERE a.tenant_id=? AND a.branch_id=? AND a.id=?", tenantId, access.branch_id, x.id);
  if (!appointment) throw new ApiError("Bu şubede randevu bulunamadı.", 404);
  const business = await one("SELECT * FROM businesses WHERE id=?", tenantId);
  return change(business, appointment, { status: x.status });
}

async function verifiedAdmin() {
  const u = await admin();
  if (adminAccessConfigured() && !(await hasAdminAccess(u.userId)))
    throw new ApiError("Yönetici şifresiyle tekrar doğrulama gerekiyor.", 403);
  return u;
}

export async function adminAddonOverview() {
  await verifiedAdmin();
  return {
    catalog: await all("SELECT code,price,updated_at FROM addon_catalog WHERE code IN ('management','branch_password') ORDER BY code"),
    businesses: await all(`SELECT b.id,b.name,b.slug,b.status,b.demo,COALESCE(a.enabled,0) enabled,COALESCE(p.enabled,0) password_enabled,a.updated_at
      FROM businesses b LEFT JOIN tenant_addons a ON a.tenant_id=b.id AND a.code='management'
      LEFT JOIN tenant_addons p ON p.tenant_id=b.id AND p.code='branch_password'
      WHERE b.status NOT IN ('deleted','suspended') ORDER BY b.created_at DESC LIMIT 500`),
  };
}

export async function adminSetAddonPrice(input: unknown) {
  const u = await verifiedAdmin();
  const x = z.object({ code: z.enum(["management", "branch_password"]).default("management"), price: z.number().int().min(0).max(100000000).nullable() }).parse(input);
  await q("UPDATE addon_catalog SET price=?,updated_at=?,updated_by=? WHERE code=?", x.price, now(), u.userId, x.code).run();
  await q("INSERT INTO audit(id,user_id,action,target_id,created_at) VALUES(?,?,?,?,?)", uid(), u.userId, "addon.price.updated", x.code, now()).run();
  return { ok: true, price: x.price };
}

// Only the platform administrator can provision an addon. This is not a payment callback.
export async function adminSetManagerAddon(input: unknown) {
  const u = await verifiedAdmin();
  const x = z.object({ tenant_id: z.string().min(1), code: z.enum(["management", "branch_password"]).default("management"), enabled: z.boolean() }).parse(input);
  if (!(await one("SELECT id FROM businesses WHERE id=?", x.tenant_id))) throw new ApiError("İşletme bulunamadı.", 404);
  await q(`INSERT INTO tenant_addons(tenant_id,code,enabled,updated_at,updated_by) VALUES(?,?,?,?,?)
    ON CONFLICT(tenant_id,code) DO UPDATE SET enabled=excluded.enabled,updated_at=excluded.updated_at,updated_by=excluded.updated_by`,
    x.tenant_id, x.code, x.enabled ? 1 : 0, now(), u.userId).run();
  await q("INSERT INTO audit(id,user_id,action,target_id,created_at) VALUES(?,?,?,?,?)", uid(), u.userId, `addon.${x.code}.${x.enabled ? "enabled" : "disabled"}`, x.tenant_id, now()).run();
  return { ok: true, enabled: x.enabled };
}
