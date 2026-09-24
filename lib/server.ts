import { env } from "cloudflare:workers";
import { getAppUser } from "./identity";
import { cookieValue } from "./security";
import { z } from "zod";
export class ApiError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export const uid = () => crypto.randomUUID();
export const now = () => new Date().toISOString();
export function db() {
  if (!env.DB)
    throw new ApiError("Veri bağlantısı kurulamadı. Tekrar deneyin.", 503);
  return env.DB;
}
export const q = (sql: string, ...values: any[]) =>
  db()
    .prepare(sql)
    .bind(...values);
export const all = async (sql: string, ...v: any[]) =>
  (await q(sql, ...v).all<any>()).results;
export const one = async (sql: string, ...v: any[]) =>
  q(sql, ...v).first<any>();
export async function user() {
  const u = await getAppUser();
  if (!u) throw new ApiError("Giriş yapmanız gerekiyor.", 401);
  const profile = await one(
    "SELECT name,disabled FROM profiles WHERE user_id=?",
    u.userId,
  );
  if (profile?.disabled)
    throw new ApiError(
      "Üyeliğiniz devre dışı. Platform yöneticisiyle iletişime geçin.",
      403,
    );
  return { ...u, displayName: profile?.name || u.displayName };
}
export async function isAdmin(u: any) {
  if (await one("SELECT user_id FROM admins WHERE user_id=?", u.userId))
    return true;
  const explicit = String((env as any).PLATFORM_ADMIN_USER_IDS || "")
    .split(",")
    .map((v: string) => v.trim())
    .filter(Boolean)
    .includes(u.userId);
  const bootstrap = (env as any).PLATFORM_OWNER_EMAIL_BOOTSTRAP === "true",
    owner = String((env as any).PLATFORM_OWNER_EMAIL || "");
  if (
    explicit ||
    (bootstrap && owner && u.email.toLowerCase() === owner.toLowerCase())
  ) {
    await q(
      "INSERT OR IGNORE INTO admins (user_id,email,created_at) VALUES (?,?,?)",
      u.userId,
      u.email,
      now(),
    ).run();
    return true;
  }
  return false;
}
export async function admin() {
  const u = await user();
  if (!(await isAdmin(u)))
    throw new ApiError("Yalnızca platform yöneticisi erişebilir.", 403);
  return u;
}
export async function paidTenant(userId: string, id?: string) {
  return one(
    `SELECT b.* FROM businesses b JOIN members m ON m.tenant_id=b.id
 WHERE m.user_id=? AND m.disabled=0 AND m.role='owner' AND b.status NOT IN ('deleted','suspended')
 AND (? IS NULL OR b.id=?) AND (b.demo=1 OR EXISTS(SELECT 1 FROM subscriptions s WHERE s.tenant_id=b.id AND s.paid_until>?)
 OR EXISTS(SELECT 1 FROM recurring_subscriptions r WHERE r.tenant_id=b.id AND r.test_mode=0 AND r.plan IN ('normal','pro','plus') AND r.paid_until>?)
 OR EXISTS(SELECT 1 FROM onboarding_payments p JOIN admins a ON a.user_id=p.user_id WHERE p.tenant_id=b.id AND p.user_id=? AND p.state='active' AND p.test_mode=1))
 ORDER BY b.created_at DESC LIMIT 1`,
    userId,
    id || null,
    id || null,
    now(),
    now(),
    userId,
  );
}
export async function ownedTenant(id: string) {
  const u = await user();
  const owned = await one(
    "SELECT b.* FROM businesses b JOIN members m ON m.tenant_id=b.id WHERE b.id=? AND m.user_id=? AND m.disabled=0 AND m.role='owner' AND b.status NOT IN ('deleted','suspended')",
    id,
    u.userId,
  );
  if (!owned) throw new ApiError("Bu işletmeye erişim yetkiniz yok.", 403);
  return owned;
}
export async function tenant(id: string) {
  const u = await user();
  await ownedTenant(id);
  const b = await paidTenant(u.userId, id);
  if (!b)
    throw new ApiError(
      "Panel erişimi için doğrulanmış, aktif bir abonelik gerekiyor.",
      402,
    );
  return b;
}
export async function hash(s: string) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)),
    ),
  )
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}
export const secret = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
export const name = z
  .string()
  .trim()
  .min(2, "En az 2 karakter girin.")
  .max(100);
export const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((s) => {
    const d = new Date(s + "T12:00:00Z");
    return !isNaN(+d) && d.toISOString().slice(0, 10) === s;
  }, "Geçersiz tarih.");
export const phone = z
  .string()
  .transform((s) => s.replace(/[^+\d]/g, ""))
  .refine((s) => /^\+?\d{10,15}$/.test(s), "Geçerli telefon numarası girin.")
  .transform((s) =>
    s.length === 11 && s[0] === "0"
      ? "+90" + s.slice(1)
      : s.length === 10
        ? "+90" + s
        : s.startsWith("90")
          ? "+" + s
          : s,
  );
export const hours = z
  .record(
    z.tuple([
      z.number().int().min(0).max(1425).multipleOf(15),
      z.number().int().min(15).max(1440).multipleOf(15),
    ]),
  )
  .refine(
    (h) => Object.entries(h).every(([k, [a, b]]) => /^[0-6]$/.test(k) && a < b),
    "Saatleri kontrol edin.",
  );
export async function body(req: Request) {
  const origin = req.headers.get("origin"),
    site = req.headers.get("sec-fetch-site");
  let invalid = site === "cross-site";
  if (origin) {
    try {
      invalid = invalid || new URL(origin).origin !== new URL(req.url).origin;
    } catch {
      invalid = true;
    }
  } else if (cookieValue(req.headers.get("cookie"), "__Host-neta-session"))
    invalid = true;
  if (invalid) throw new ApiError("İstek kaynağı geçersiz.", 403);
  if (
    !req.headers
      .get("content-type")
      ?.toLowerCase()
      .startsWith("application/json")
  )
    throw new ApiError("JSON gerekli.", 415);
  const declared = Number(req.headers.get("content-length") || 0);
  if (Number.isFinite(declared) && declared > 16000)
    throw new ApiError("İstek çok büyük.", 413);
  const s = await req.text();
  if (s.length > 16000) throw new ApiError("İstek çok büyük.", 413);
  try {
    return JSON.parse(s);
  } catch {
    throw new ApiError("İstek okunamadı.");
  }
}
export const ok = (data: any, status = 200) =>
  Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
    },
  });
export function fail(e: any) {
  if (e instanceof z.ZodError) return ok({ error: e.issues[0]?.message }, 400);
  if (e instanceof ApiError) return ok({ error: e.message }, e.status);
  if (String(e).includes("RECEIVABLE_CONFLICT"))
    return ok(
      {
        error:
          "Tahsilat kaydı değişti veya tutar kalan borcu aşıyor. Listeyi yenileyin.",
      },
      409,
    );
  if (String(e).includes("EARLY_OFFER_EXPIRED"))
    return ok(
      {
        error:
          "Bu erken saat teklifi artık geçerli değil. Güncel saatleri kontrol edin.",
      },
      409,
    );
  if (String(e).includes("BOOKING_CONFLICT"))
    return ok(
      {
        error:
          "Bu gün için izin veya yeni bir randevu oluştu. Takvimi yenileyin.",
      },
      409,
    );
  if (String(e).includes("UNIQUE constraint"))
    return ok(
      {
        error:
          "Kayıt çakıştı. Saat dolmuş veya randevu başka bir işlemle değişmiş olabilir. Yenileyin.",
      },
      409,
    );
  console.error("API", String(e));
  return ok({ error: "İşlem tamamlanamadı. Lütfen tekrar deneyin." }, 503);
}
export async function limit(req: Request, key: string, max = 30) {
  const bucket = Math.floor(Date.now() / 600000),
    keyHash = await hash(
      key +
        ":" +
        (req.headers.get("cf-connecting-ip") || "local") +
        ":" +
        bucket,
    );
  const r = await one(
    "INSERT INTO rate_limits (key,count,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count",
    keyHash,
    (bucket + 1) * 600000,
  );
  if (r.count > max)
    throw new ApiError(
      "Çok fazla deneme. Birkaç dakika sonra tekrar deneyin.",
      429,
    );
  if (Math.random() < 0.03)
    await q("DELETE FROM rate_limits WHERE expires_at<?", Date.now()).run();
}
