import Database from "better-sqlite3";
import { mkdirSync, chmodSync } from "node:fs";
import { join } from "node:path";
import { admin, ApiError } from "@/lib/server";
import { adminAccessConfigured, hasAdminAccess } from "@/lib/admin-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const retained = new Set([
  "admins", "billing_settings", "temporary_payment_settings", "addon_catalog",
  "__drizzle_migrations", "sqlite_sequence",
]);

async function authorized() {
  const actor = await admin();
  if (!adminAccessConfigured() || !(await hasAdminAccess(actor.userId)))
    throw new ApiError("Yönetici ek doğrulaması gerekli.", 403);
  return actor;
}

function open() {
  const path = process.env.DATABASE_PATH;
  if (!path?.startsWith("/") || process.env.NODE_ENV !== "production")
    throw new ApiError("Sıfırlama yalnızca yapılandırılmış VPS üzerinde kullanılabilir.", 503);
  const database = new Database(path);
  database.pragma("foreign_keys = ON");
  database.pragma("busy_timeout = 5000");
  return database;
}

function summary(db: Database.Database) {
  const count = (table: string) => (db.prepare(`SELECT COUNT(*) AS n FROM "${table}"`).get() as { n: number }).n;
  const realPayments = [
    "SELECT COUNT(*) AS n FROM subscription_orders WHERE test_mode=0",
    "SELECT COUNT(*) AS n FROM recurring_subscriptions WHERE test_mode=0",
    "SELECT COUNT(*) AS n FROM payments WHERE status='paid'",
    "SELECT COUNT(*) AS n FROM temporary_payment_requests WHERE status IN ('approved','paid')",
    "SELECT COUNT(*) AS n FROM onboarding_payments WHERE test_mode=0",
  ].reduce((sum, sql) => sum + (db.prepare(sql).get() as { n: number }).n, 0);
  return {
    users: count("profiles"), businesses: count("businesses"),
    appointments: count("appointments"), realPayments,
  };
}

function response(error: unknown) {
  return Response.json({ error: error instanceof Error ? error.message : "İşlem başarısız." }, { status: error instanceof ApiError ? error.status : 500 });
}

export async function GET() {
  try {
    await authorized();
    const db = open();
    try { return Response.json(summary(db), { headers: { "Cache-Control": "no-store" } }); }
    finally { db.close(); }
  } catch (error) { return response(error); }
}

export async function POST(request: Request) {
  try {
    await authorized();
    if (request.headers.get("origin") !== new URL(request.url).origin)
      throw new ApiError("İstek kaynağı doğrulanamadı.", 403);
    const input = await request.json() as { confirmation?: string; users?: number; businesses?: number; appointments?: number };
    if (input?.confirmation !== "TÜM TEST VERİLERİNİ SIFIRLA")
      throw new ApiError("Onay metni eşleşmiyor.");
    const db = open();
    try {
      const before = summary(db);
      if (before.realPayments) throw new ApiError("Gerçek ödeme kaydı var. Sıfırlama durduruldu.", 409);
      if (before.users !== input.users || before.businesses !== input.businesses || before.appointments !== input.appointments)
        throw new ApiError("Veriler değişti. Önizlemeyi yenileyin.", 409);
      const directory = process.env.BACKUP_DIRECTORY || "/var/backups/neta";
      mkdirSync(directory, { recursive: true, mode: 0o700 });
      const backup = join(directory, `before-admin-reset-${Date.now()}.sqlite`);
      await db.backup(backup);
      chmodSync(backup, 0o600);
      const backupCheck = new Database(backup, { readonly: true, fileMustExist: true });
      try {
        if (backupCheck.pragma("integrity_check", { simple: true }) !== "ok" ||
          JSON.stringify(summary(backupCheck)) !== JSON.stringify(before))
          throw new ApiError("Yedek doğrulanamadı. Sıfırlama durduruldu.", 503);
      } finally { backupCheck.close(); }
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all() as { name: string }[];
      const targets = tables.map(({ name }) => name).filter((name) => !retained.has(name));
      // The backup is complete before this transaction starts. Roll back every deletion on failure.
      db.pragma("foreign_keys = OFF");
      try {
        db.transaction(() => {
          if (summary(db).realPayments) throw new Error("Gerçek ödeme kaydı bulundu.");
          for (const name of targets) db.prepare(`DELETE FROM "${name.replaceAll('"', '""')}"`).run();
          const violations = db.pragma("foreign_key_check") as unknown[];
          if (violations.length) throw new Error("Veri bütünlüğü kontrolü başarısız.");
        })();
      } finally { db.pragma("foreign_keys = ON"); }
      return Response.json({ ok: true, removed: before });
    } finally { db.close(); }
  } catch (error) { return response(error); }
}
