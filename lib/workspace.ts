import { makeReferralCode, referralOperation } from "./growth";
import { z } from "zod";
import {
  db,
  q,
  all,
  one,
  user,
  isAdmin,
  tenant,
  uid,
  now,
  hash,
  secret,
  ApiError,
  name,
  hours,
} from "./server";
import { HOURS, CATEGORIES, today } from "./types";
import { SELECT_APPOINTMENTS } from "./booking";
import { demoWorkspace } from "./demo";
const starterSchema = z
  .object({
    service_name: name,
    duration: z.number().int().min(15).max(480).multipleOf(15),
    price: z.number().int().min(0).max(100000000),
    staff_name: name,
    staff_title: z.string().min(2).max(80),
    hours,
  })
  .optional();
export const businessSchema = z.object({
  name,
  slug: z
    .string()
    .min(3)
    .max(60)
    .regex(
      /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/,
      "Bağlantı için küçük harf, rakam ve tire kullanın.",
    ),
  category: z.enum(CATEGORIES as [string, ...string[]]),
  city: z.string().max(80).default(""),
  address: z.string().max(300).default(""),
  phone: z.string().max(30).default(""),
  description: z.string().max(1000).default(""),
  plan: z.enum(["normal", "pro", "plus"]).default("normal"),
  ref: z.string().optional(),
  starter: starterSchema,
});
const reservedSlugs = [
  "api",
  "admin",
  "kesfet",
  "randevum",
  "atolye-studio",
  "giris",
  "kayit",
  "hesabim",
  "randevularim",
  "kurulum",
  "panel",
  "ekibim",
  "abonelik",
  "odeme",
  "yonetim",
  "gizlilik",
  "kosullar",
  "cikis",
  "signin-with-chatgpt",
  "signout-with-chatgpt",
  "callback",
  "yardim",
  "yolculugum",
];
export function terminologyFor(category: string) {
  return /psikolog|klinik|danış|diyet/i.test(category)
    ? "Seans"
    : /spor|fitness|ders/i.test(category)
      ? "Ders / Antrenman"
      : /avukat/i.test(category)
        ? "Danışmanlık"
        : "Hizmet";
}
export async function businessCreation(
  input: any,
  owner: { userId: string; email: string; displayName: string },
  id = uid(),
  demo = false,
) {
  const x = businessSchema.parse(
    demo
      ? {
          name: "Atölye Studio",
          slug: "atolye-" + uid().slice(0, 8),
          category: CATEGORIES[0],
          city: "İstanbul",
        }
      : input,
  );
  if (reservedSlugs.includes(x.slug))
    throw new ApiError("Bu bağlantı kullanılamaz.");
  const workingHours = demo
    ? demoWorkspace().business.hours
    : x.starter
      ? JSON.stringify(x.starter.hours)
      : HOURS;
  const ops = [
    q(
      "INSERT INTO businesses (id,name,slug,invite_code,category,city,address,phone,description,status,demo,hours,selected_plan,terminology,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      id,
      x.name,
      x.slug,
      makeReferralCode(id),
      x.category,
      x.city,
      x.address,
      x.phone,
      x.description,
      demo ? "approved" : "pending",
      demo ? 1 : 0,
      workingHours,
      x.plan,
      terminologyFor(x.category),
      now(),
    ),
    q(
      "INSERT INTO members (tenant_id,user_id,email,name) VALUES (?,?,?,?)",
      id,
      owner.userId,
      owner.email,
      owner.displayName,
    ),
  ];
  if (!demo)
    ops.push(
      q(
        "INSERT INTO billing_profiles(tenant_id,name,address,phone,email,updated_at) VALUES(?,?,?,?,?,?)",
        id,
        owner.displayName || x.name,
        x.address,
        x.phone,
        owner.email,
        now(),
      ),
    );
  if (x.starter)
    ops.push(
      q(
        "INSERT INTO services (id,tenant_id,name,duration,price,color) VALUES (?,?,?,?,?,?)",
        uid(),
        id,
        x.starter.service_name,
        x.starter.duration,
        x.starter.price,
        "#789c74",
      ),
      q(
        "INSERT INTO staff (id,tenant_id,name,title,hours,color) VALUES (?,?,?,?,?,?)",
        uid(),
        id,
        x.starter.staff_name,
        x.starter.staff_title,
        workingHours,
        "#e1eccd",
      ),
    );
  if (!demo) {
    const referral = await referralOperation(id, owner.userId, x.ref);
    if (referral) ops.push(referral);
  }
  return { id, x, ops };
}
export async function workspace(id?: string) {
  const u = await user(),
    businesses = await all(
      "SELECT b.* FROM businesses b JOIN members m ON m.tenant_id=b.id WHERE m.user_id=? AND m.disabled=0 AND m.role='owner' AND b.status NOT IN ('deleted','suspended') ORDER BY b.created_at DESC",
      u.userId,
    );
  if (id && !businesses.some((b) => b.id === id))
    throw new ApiError("İşletme erişimi reddedildi.", 403);
  if (!businesses.length)
    return { needs_onboarding: true, user: u, isAdmin: await isAdmin(u) };
  const b = id ? businesses.find((b) => b.id === id) : businesses[0];
  if (!b) throw new ApiError("İşletme erişimi reddedildi.", 403);
  const rs = await db().batch([
    q("SELECT * FROM services WHERE tenant_id=? ORDER BY name", b.id),
    q("SELECT * FROM staff WHERE tenant_id=? ORDER BY name", b.id),
    q(
      SELECT_APPOINTMENTS +
        " WHERE a.tenant_id=? ORDER BY a.date DESC,a.minute LIMIT 3000",
      b.id,
    ),
    q(
      `SELECT c.*,COUNT(CASE WHEN a.status='completed' THEN 1 END) visits,COALESCE(SUM(CASE WHEN a.status='completed' THEN a.price ELSE 0 END),0) total_spent,MAX(CASE WHEN a.status='completed' THEN a.date END) last_visit,COUNT(CASE WHEN a.status='no_show' THEN 1 END) no_shows,(SELECT p.name FROM appointments ap JOIN staff p ON p.id=ap.staff_id AND p.tenant_id=ap.tenant_id WHERE ap.tenant_id=c.tenant_id AND ap.customer_id=c.id AND ap.status='completed' GROUP BY ap.staff_id ORDER BY COUNT(*) DESC LIMIT 1) preferred_staff FROM customers c LEFT JOIN appointments a ON a.tenant_id=c.tenant_id AND a.customer_id=c.id WHERE c.tenant_id=? GROUP BY c.id ORDER BY c.name LIMIT 3000`,
      b.id,
    ),
    q(
      "SELECT * FROM closures WHERE tenant_id=? AND date>=? ORDER BY date",
      b.id,
      today(),
    ),
    q(
      "SELECT * FROM reviews WHERE tenant_id=? ORDER BY created_at DESC LIMIT 100",
      b.id,
    ),
  ]);
  return {
    business: b,
    businesses,
    services: rs[0].results,
    staff: rs[1].results,
    appointments: rs[2].results,
    customers: rs[3].results,
    closures: rs[4].results,
    reviews: rs[5].results,
    user: u,
    isAdmin: await isAdmin(u),
    preview: false,
  };
}
export async function createBusiness(input: any) {
  const u = await user();
  if (
    (await one("SELECT COUNT(*) n FROM members WHERE user_id=?", u.userId)).n >=
    10
  )
    throw new ApiError("En fazla 10 işletme oluşturabilirsiniz.");
  const demo = input.demo === true;
  if (!demo)
    throw new ApiError(
      "Gerçek işletme, paket ödemesi doğrulandıktan sonra oluşturulur. Ödeme ekranından devam edin.",
      402,
    );
  const { id, x, ops } = await businessCreation(input, u, uid(), demo);
  await db().batch(ops);
  if (demo) await seed(id);
  return { id, slug: x.slug };
}
async function seed(id: string) {
  const d = demoWorkspace(),
    key = (s: string) => id + "-" + s;
  const ops = [];
  for (const s of d.services)
    ops.push(
      q(
        "INSERT INTO services (id,tenant_id,name,duration,price,color) VALUES (?,?,?,?,?,?)",
        key(s.id),
        id,
        s.name,
        s.duration,
        s.price,
        s.color,
      ),
    );
  for (const p of d.staff)
    ops.push(
      q(
        "INSERT INTO staff (id,tenant_id,name,title,hours,color) VALUES (?,?,?,?,?,?)",
        key(p.id),
        id,
        p.name,
        p.title,
        p.hours,
        p.color,
      ),
    );
  for (const c of d.customers)
    ops.push(
      q(
        "INSERT INTO customers (id,tenant_id,name,phone,created_at) VALUES (?,?,?,?,?)",
        key(c.id),
        id,
        c.name,
        c.phone,
        now(),
      ),
    );
  await db().batch(ops);
  for (const a of d.appointments.filter(
    (a, i) => a.date >= today() || i % 5 === 0,
  )) {
    const batch = [
      q(
        "INSERT INTO appointments (id,tenant_id,customer_id,service_id,staff_id,date,minute,duration,price,status,token_hash,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
        key(a.id),
        id,
        key(a.customer_id),
        key(a.service_id),
        key(a.staff_id),
        a.date,
        a.minute,
        a.duration,
        a.price,
        a.status,
        await hash(secret()),
        now(),
      ),
    ];
    for (let m = a.minute; m < a.minute + a.duration; m += 15)
      batch.push(
        q(
          "INSERT INTO slots (tenant_id,staff_id,date,minute,appointment_id) VALUES (?,?,?,?,?)",
          id,
          key(a.staff_id),
          a.date,
          m,
          key(a.id),
        ),
      );
    await db().batch(batch);
  }
}
export async function saveService(id: string, input: any) {
  const b = await tenant(id);
  const x = z
    .object({
      id: z.string().optional(),
      name,
      duration: z.coerce.number().int().min(15).max(480).multipleOf(15),
      price: z.coerce.number().int().min(0).max(100000000),
      description: z.string().trim().max(600).default(""),
      color: z
        .string()
        .regex(/^#[a-f\d]{6}$/i)
        .default("#789c74"),
      delivery_mode: z
        .enum(["in_person", "online", "hybrid"])
        .default("in_person"),
      meeting_url: z
        .string()
        .trim()
        .url("Geçerli bir görüşme bağlantısı girin.")
        .max(500)
        .or(z.literal(""))
        .default(""),
      active: z.number().int().min(0).max(1).default(1),
    })
    .parse(input);
  if (x.delivery_mode !== "in_person" && !b.online_enabled)
    throw new ApiError(
      "Önce Ayarlar bölümünden çevrim içi randevuyu açın.",
      409,
    );
  if (x.delivery_mode !== "in_person" && !x.meeting_url)
    throw new ApiError("Çevrim içi hizmet için görüşme bağlantısı gerekiyor.");
  const r = x.id
    ? await q(
        "UPDATE services SET name=?,duration=?,price=?,description=?,color=?,delivery_mode=?,meeting_url=?,active=? WHERE tenant_id=? AND id=?",
        x.name,
        x.duration,
        x.price,
        x.description,
        x.color,
        x.delivery_mode,
        x.meeting_url,
        x.active,
        id,
        x.id,
      ).run()
    : await q(
        "INSERT INTO services (id,tenant_id,name,duration,price,description,color,delivery_mode,meeting_url,active) VALUES (?,?,?,?,?,?,?,?,?,?)",
        uid(),
        id,
        x.name,
        x.duration,
        x.price,
        x.description,
        x.color,
        x.delivery_mode,
        x.meeting_url,
        x.active,
      ).run();
  if (!r.meta.changes) throw new ApiError("Hizmet bulunamadı.", 404);
  return { ok: true };
}
export async function saveStaff(id: string, input: any) {
  await tenant(id);
  const x = z
    .object({
      id: z.string().optional(),
      name,
      title: z.string().min(2).max(80),
      hours,
      color: z
        .string()
        .regex(/^#[a-f\d]{6}$/i)
        .default("#e1eccd"),
      active: z.number().int().min(0).max(1).default(1),
    })
    .parse(input);
  const r = x.id
    ? await q(
        "UPDATE staff SET name=?,title=?,hours=?,color=?,active=? WHERE tenant_id=? AND id=?",
        x.name,
        x.title,
        JSON.stringify(x.hours),
        x.color,
        x.active,
        id,
        x.id,
      ).run()
    : await q(
        "INSERT INTO staff (id,tenant_id,name,title,hours,color,active) VALUES (?,?,?,?,?,?,?)",
        uid(),
        id,
        x.name,
        x.title,
        JSON.stringify(x.hours),
        x.color,
        x.active,
      ).run();
  if (!r.meta.changes) throw new ApiError("Personel bulunamadı.", 404);
  return { ok: true };
}
export async function settings(id: string, input: any) {
  await tenant(id);
  const x = z
    .object({
      name,
      category: z.enum(CATEGORIES as [string, ...string[]]),
      city: z.string().max(80),
      address: z.string().max(300),
      phone: z.string().max(30),
      description: z.string().max(1000),
      hours,
      cancellation_hours: z.coerce.number().int().min(0).max(72),
      terminology: z.string().trim().min(2).max(40).default("Hizmet"),
      online_enabled: z.coerce.number().int().min(0).max(1).default(0),
    })
    .parse(input);
  await q(
    "UPDATE businesses SET name=?,category=?,city=?,address=?,phone=?,description=?,hours=?,cancellation_hours=?,terminology=?,online_enabled=? WHERE id=?",
    x.name,
    x.category,
    x.city,
    x.address,
    x.phone,
    x.description,
    JSON.stringify(x.hours),
    x.cancellation_hours,
    x.terminology,
    x.online_enabled,
    id,
  ).run();
  return { ok: true };
}
