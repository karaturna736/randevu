import { referralOperation } from "./growth";
import { PLAN_LIMITS, tenantPlan } from "./entitlements";
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
    q(
      "SELECT s.*,br.name branch_name FROM staff s LEFT JOIN branches br ON br.tenant_id=s.tenant_id AND br.id=s.branch_id WHERE s.tenant_id=? ORDER BY s.name",
      b.id,
    ),
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
    q(
      "SELECT * FROM branches WHERE tenant_id=? AND active=1 ORDER BY is_primary DESC,name",
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
    branches: rs[6].results,
    user: u,
    isAdmin: await isAdmin(u),
    preview: false,
  };
}
export async function createBusiness(input: any) {
  const u = await user();
  const demo = input.demo === true;
  const owned = await one(
    "SELECT COUNT(*) n FROM members m JOIN businesses b ON b.id=m.tenant_id WHERE m.user_id=? AND m.role='owner' AND m.disabled=0 AND b.status!='deleted' AND b.demo=?",
    u.userId,
    demo ? 1 : 0,
  );
  if (demo && owned.n >= 1)
    throw new ApiError("Bu hesap için bir demo işletme zaten var.", 409);
  const starter = z
    .object({
      service_name: name,
      duration: z.number().int().min(15).max(480).multipleOf(15),
      price: z.number().int().min(0).max(100000000),
      staff_name: name,
      staff_title: z.string().min(2).max(80),
      hours,
    })
    .optional();
  const x = z
    .object({
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
      starter,
    })
    .parse(
      demo
        ? {
            name: "Atölye Studio",
            slug: "atolye-" + uid().slice(0, 8),
            category: CATEGORIES[0],
            city: "İstanbul",
          }
        : input,
    );
  if (
    [
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
      "panel",
      "abonelik",
      "yonetim",
      "gizlilik",
      "kosullar",
      "cikis",
      "signin-with-chatgpt",
      "signout-with-chatgpt",
      "callback",
      "yardim",
      "yolculugum",
    ].includes(x.slug)
  )
    throw new ApiError("Bu bağlantı kullanılamaz.");
  const id = uid(),
    branchId = "branch-" + id,
    workingHours = demo
      ? demoWorkspace().business.hours
      : x.starter
        ? JSON.stringify(x.starter.hours)
        : HOURS;
  const ops = [
    q(
      "INSERT INTO businesses (id,name,slug,category,city,address,phone,description,status,demo,hours,selected_plan,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
      id,
      x.name,
      x.slug,
      x.category,
      x.city,
      x.address,
      x.phone,
      x.description,
      demo ? "approved" : "pending",
      demo ? 1 : 0,
      workingHours,
      x.plan,
      now(),
    ),
    q(
      "INSERT INTO members (tenant_id,user_id,email,name) VALUES (?,?,?,?)",
      id,
      u.userId,
      u.email,
      u.displayName,
    ),
    q(
      "INSERT INTO branches(id,tenant_id,name,city,address,phone,active,is_primary,created_at) VALUES(?,?,?,?,?,?,1,1,?)",
      branchId,
      id,
      "Merkez Şube",
      x.city,
      x.address,
      x.phone,
      now(),
    ),
  ];
  if (!demo)
    ops.push(
      q(
        "INSERT INTO billing_profiles(tenant_id,name,address,phone,email,updated_at) VALUES(?,?,?,?,?,?)",
        id,
        u.displayName || x.name,
        x.address,
        x.phone,
        u.email,
        now(),
      ),
    );
  if (x.starter) {
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
    );
    ops.push(
      q(
        "INSERT INTO staff (id,tenant_id,branch_id,name,title,hours,color) VALUES (?,?,?,?,?,?,?)",
        uid(),
        id,
        branchId,
        x.starter.staff_name,
        x.starter.staff_title,
        workingHours,
        "#e1eccd",
      ),
    );
  }
  if (!demo) {
    const referral = await referralOperation(id, u.userId, input.ref);
    if (referral) ops.push(referral);
  }
  await db().batch(ops);
  if (demo) await seed(id);
  return { id, slug: x.slug };
}
async function seed(id: string) {
  const d = demoWorkspace(),
    branchId = "branch-" + id,
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
        "INSERT INTO staff (id,tenant_id,branch_id,name,title,hours,color) VALUES (?,?,?,?,?,?,?)",
        key(p.id),
        id,
        branchId,
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
        "INSERT INTO appointments (id,tenant_id,branch_id,customer_id,service_id,staff_id,date,minute,duration,price,status,token_hash,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
        key(a.id),
        id,
        branchId,
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
  await tenant(id);
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
      active: z.number().int().min(0).max(1).default(1),
    })
    .parse(input);
  const r = x.id
    ? await q(
        "UPDATE services SET name=?,duration=?,price=?,description=?,color=?,active=? WHERE tenant_id=? AND id=?",
        x.name,
        x.duration,
        x.price,
        x.description,
        x.color,
        x.active,
        id,
        x.id,
      ).run()
    : await q(
        "INSERT INTO services (id,tenant_id,name,duration,price,description,color,active) VALUES (?,?,?,?,?,?,?,?)",
        uid(),
        id,
        x.name,
        x.duration,
        x.price,
        x.description,
        x.color,
        x.active,
      ).run();
  if (!r.meta.changes) throw new ApiError("Hizmet bulunamadı.", 404);
  return { ok: true };
}
export async function saveStaff(id: string, input: any) {
  await tenant(id);
  const defaultBranch = await one(
    "SELECT id FROM branches WHERE tenant_id=? AND active=1 ORDER BY is_primary DESC,created_at LIMIT 1",
    id,
  );
  const x = z
    .object({
      id: z.string().optional(),
      branch_id: z.string().default(String(defaultBranch?.id || "")),
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
  if (
    !(await one(
      "SELECT id FROM branches WHERE tenant_id=? AND id=? AND active=1",
      id,
      x.branch_id,
    ))
  )
    throw new ApiError("Şube bulunamadı.", 404);
  if (!x.id) {
    const plan = await tenantPlan(id),
      limit = PLAN_LIMITS[plan].staff,
      count = Number(
        (
          await one(
            "SELECT COUNT(*) n FROM staff WHERE tenant_id=? AND active=1",
            id,
          )
        ).n,
      );
    if (limit !== null && count >= limit)
      throw new ApiError(
        `${PLAN_LIMITS[plan].label} paketi en fazla ${limit} personel destekler.`,
        403,
      );
  }
  const r = x.id
    ? await q(
        "UPDATE staff SET branch_id=?,name=?,title=?,hours=?,color=?,active=? WHERE tenant_id=? AND id=?",
        x.branch_id,
        x.name,
        x.title,
        JSON.stringify(x.hours),
        x.color,
        x.active,
        id,
        x.id,
      ).run()
    : await q(
        "INSERT INTO staff (id,tenant_id,branch_id,name,title,hours,color,active) VALUES (?,?,?,?,?,?,?,?)",
        uid(),
        id,
        x.branch_id,
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
    })
    .parse(input);
  await q(
    "UPDATE businesses SET name=?,category=?,city=?,address=?,phone=?,description=?,hours=?,cancellation_hours=? WHERE id=?",
    x.name,
    x.category,
    x.city,
    x.address,
    x.phone,
    x.description,
    JSON.stringify(x.hours),
    x.cancellation_hours,
    id,
  ).run();
  return { ok: true };
}
