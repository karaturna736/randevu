import { env } from "cloudflare:workers";
import { makeReferralCode, referralOperation } from "./growth";
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
import { HOURS, CATEGORIES, today, addDays } from "./types";
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
  "api", "admin", "kesfet", "randevum", "atolye-studio", "giris",
  "kayit", "hesabim", "randevularim", "kurulum", "panel", "ekibim",
  "abonelik", "odeme", "yonetim", "gizlilik", "kosullar", "cikis",
  "signin-with-chatgpt", "signout-with-chatgpt", "callback", "yardim",
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
  const branchId = "branch-" + id,
    workingHours = demo
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
      id, owner.userId, owner.email, owner.displayName,
    ),
    q(
      "INSERT INTO branches(id,tenant_id,name,city,address,phone,active,is_primary,created_at) VALUES(?,?,?,?,?,?,1,1,?)",
      branchId, id, "Merkez Şube", x.city, x.address, x.phone, now(),
    ),
  ];
  if (!demo)
    ops.push(
      q(
        "INSERT INTO billing_profiles(tenant_id,name,address,phone,email,updated_at) VALUES(?,?,?,?,?,?)",
        id, owner.displayName || x.name, x.address, x.phone, owner.email, now(),
      ),
    );
  if (x.starter)
    ops.push(
      q(
        "INSERT INTO services (id,tenant_id,name,duration,price,color) VALUES (?,?,?,?,?,?)",
        uid(), id, x.starter.service_name, x.starter.duration, x.starter.price, "#789c74",
      ),
      q(
        "INSERT INTO staff (id,tenant_id,branch_id,name,title,hours,color) VALUES (?,?,?,?,?,?,?)",
        uid(), id, branchId, x.starter.staff_name, x.starter.staff_title,
        workingHours, "#e1eccd",
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
  const b = id
    ? businesses.find((b) => b.id === id)
    : businesses.find((business) => !business.demo);
  if (!b && !id)
    return { needs_onboarding: true, user: u, isAdmin: await isAdmin(u) };
  if (!b) throw new ApiError("İşletme erişimi reddedildi.", 403);
  if (!b.demo && !(await panelAccess(b.id)))
    return {
      subscription_required: true,
      business: {
        id: b.id,
        name: b.name,
        selected_plan: b.selected_plan || "normal",
      },
      user: u,
      isAdmin: await isAdmin(u),
    };
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

async function panelAccess(id: string) {
  const active = await one(
    `SELECT 1 n FROM recurring_subscriptions
     WHERE tenant_id=? AND plan IN ('normal','pro','plus') AND
     ((test_mode=1 AND state IN ('ACTIVE','PENDING','UPGRADED')) OR
      (test_mode=0 AND paid_until>?))
     UNION ALL
     SELECT 1 n FROM subscriptions WHERE tenant_id=? AND paid_until>?
     LIMIT 1`,
    id,
    now(),
    id,
    now(),
  );
  return !!active;
}

export async function demoWorkspaceForUser() {
  const u = await user();
  let demo = await one(
    "SELECT b.id FROM businesses b JOIN members m ON m.tenant_id=b.id WHERE m.user_id=? AND m.disabled=0 AND m.role='owner' AND b.demo=1 AND b.status!='deleted' ORDER BY b.created_at DESC LIMIT 1",
    u.userId,
  );
  if (!demo) demo = await createBusiness({ demo: true });
  await seedDemoExtras(String(demo.id), u.userId);
  return workspace(String(demo.id));
}
export async function createBusiness(input: any) {
  const u = await user();
  const demo = input.demo === true;
  if (!demo && (env as any).RECURRING_SALES_ENABLED === "true")
    throw new ApiError(
      "İşletme, yalnızca doğrulanmış abonelik ödemesinden sonra oluşturulabilir.",
      402,
    );
  const owned = await one(
    "SELECT COUNT(*) n FROM members m JOIN businesses b ON b.id=m.tenant_id WHERE m.user_id=? AND m.role='owner' AND m.disabled=0 AND b.status!='deleted' AND b.demo=?",
    u.userId,
    demo ? 1 : 0,
  );
  if (demo && owned.n >= 1)
    throw new ApiError("Bu hesap için bir demo işletme zaten var.", 409);
  const { id, x, ops } = await businessCreation(input, u, uid(), demo);
  await db().batch(ops);
  if (demo) await seed(id, u.userId);
  return { id, slug: x.slug };
}
async function seed(id: string, ownerId: string) {
  const d = demoWorkspace(),
    branchId = "branch-" + id,
    key = (s: string) => id + "-" + s,
    seededAppointments = d.appointments.filter(
      (a, i) => a.date >= today() || i % 5 === 0,
    );
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
  for (const a of seededAppointments) {
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
  await seedDemoExtras(id, ownerId);
}

async function seedDemoExtras(id: string, ownerId: string) {
  const key = (s: string) => id + "-" + s,
    branchId = "branch-" + id,
    catalogCream = key("expense-cream");
  if (
    await one(
      "SELECT id FROM expense_catalog_items WHERE tenant_id=? AND id=?",
      id,
      catalogCream,
    )
  )
    return;
  const d = demoWorkspace(),
    seededAppointments = d.appointments.filter(
      (a, i) => a.date >= today() || i % 5 === 0,
    );
  const stamp = now(),
    month = today().slice(0, 7),
    secondBranch = key("branch-bostanci"),
    catalogRent = key("expense-rent"),
    debtOne = key("debt-one"),
    journeyOne = key("journey-one"),
    completed = seededAppointments.filter((a) => a.status === "completed");
  await db().batch([
    q("INSERT INTO branches(id,tenant_id,name,city,address,phone,active,is_primary,created_at) VALUES(?,?,?,?,?,?,1,0,?)",secondBranch,id,"Bostancı Şubesi","İstanbul","Bostancı, Kadıköy / İstanbul","+902165550200",stamp),
    q("UPDATE staff SET branch_id=? WHERE tenant_id=? AND id=?",secondBranch,id,key("p2")),
    q("UPDATE appointments SET branch_id=? WHERE tenant_id=? AND staff_id=?",secondBranch,id,key("p2")),
    q("INSERT INTO expense_catalog_items(id,tenant_id,name,category,unit,default_unit_amount,note,active,created_at,updated_at) VALUES(?,?,?,?,?,?,?,1,?,?)",catalogCream,id,"Saç bakım kremi","malzeme","kutu",48000,"Aylık stok",stamp,stamp),
    q("INSERT INTO expense_catalog_items(id,tenant_id,name,category,unit,default_unit_amount,note,active,created_at,updated_at) VALUES(?,?,?,?,?,?,?,1,?,?)",catalogRent,id,"Şube kirası","kira","ay",2400000,"Aylık sabit gider",stamp,stamp),
    q("INSERT INTO branch_expenses(id,tenant_id,branch_id,month,category,amount,note,created_at,updated_at,catalog_item_id,quantity,unit) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",key("expense-1"),id,branchId,month,"kira",2400000,"Merkez kira",stamp,stamp,catalogRent,1,"ay"),
    q("INSERT INTO branch_expenses(id,tenant_id,branch_id,month,category,amount,note,created_at,updated_at,catalog_item_id,quantity,unit) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",key("expense-2"),id,secondBranch,month,"malzeme",192000,"Bakım ürünleri",stamp,stamp,catalogCream,4,"kutu"),
    q("INSERT INTO branch_month_closings(tenant_id,branch_id,month,expenses_confirmed,confirmed_at) VALUES(?,?,?,?,?)",id,branchId,month,1,stamp),
    q("INSERT INTO branch_month_closings(tenant_id,branch_id,month,expenses_confirmed,confirmed_at) VALUES(?,?,?,?,?)",id,secondBranch,month,1,stamp),
    q("INSERT INTO receivables(id,tenant_id,customer_id,appointment_id,title,amount,remaining,due_date,note,created_by,created_at,idempotency_key) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",debtOne,id,key("c0"),null,"Bakım paketi",150000,150000,addDays(today(),7),"Örnek veresiye kaydı",ownerId,stamp,key("idem-debt")),
    q("INSERT INTO receivables(id,tenant_id,customer_id,appointment_id,title,amount,remaining,due_date,note,created_by,created_at,idempotency_key) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",key("debt-two"),id,key("c1"),null,"Saç ve bakım işlemi",90000,90000,addDays(today(),-3),"Kısmi tahsilat örneği",ownerId,stamp,key("idem-debt-two")),
    q("INSERT INTO receivable_payments(id,tenant_id,receivable_id,amount,method,note,created_by,created_at,idempotency_key) VALUES(?,?,?,?,?,?,?,?,?)",key("payment-one"),id,key("debt-two"),45000,"cash","Kısmi ödeme",ownerId,stamp,key("idem-payment")),
    q("INSERT INTO journeys(id,tenant_id,customer_id,title,template,share_hash,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)",journeyOne,id,key("c2"),"4 aşamalı bakım süreci","care",key("share-hash"),stamp,stamp),
    q("INSERT INTO journey_steps(id,tenant_id,journey_id,position,title,due_date,completed_at) VALUES(?,?,?,?,?,?,?)",key("journey-step-1"),id,journeyOne,0,"İlk görüşme",null,stamp),
    q("INSERT INTO journey_steps(id,tenant_id,journey_id,position,title,due_date,completed_at) VALUES(?,?,?,?,?,?,?)",key("journey-step-2"),id,journeyOne,1,"Hizmet planı",addDays(today(),2),null),
    q("INSERT INTO journey_steps(id,tenant_id,journey_id,position,title,due_date,completed_at) VALUES(?,?,?,?,?,?,?)",key("journey-step-3"),id,journeyOne,2,"Uygulama / seans",addDays(today(),9),null),
    q("INSERT INTO waitlist_entries(id,tenant_id,service_id,staff_id,requested_date,minute_from,minute_to,name,phone,email,consent,status,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,1,'waiting',?)",key("wait-1"),id,key("s0"),key("p0"),addDays(today(),2),1020,1200,"Melis Karaca","+905559990001","melis@example.com",stamp),
    q("INSERT INTO waitlist_entries(id,tenant_id,service_id,staff_id,requested_date,minute_from,minute_to,name,phone,email,consent,status,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,1,'waiting',?)",key("wait-2"),id,key("s1"),null,addDays(today(),3),1080,1260,"Eren Yalın","+905559990002","",stamp),
    q("INSERT INTO setup_import_batches(id,tenant_id,kind,row_count,created_by,created_at) VALUES(?,?,?,?,?,?)",key("import-1"),id,"customers",18,ownerId,stamp),
    q("INSERT INTO setup_training_requests(id,tenant_id,preferred_date,note,status,created_at) VALUES(?,?,?,?,?,?)",key("training-1"),id,addDays(today(),5),"Panel ve raporlama eğitimi","pending",stamp),
    q("INSERT INTO growth_settings(tenant_id,theme,hide_brand,autopilot,recall_days,welcome,updated_at) VALUES(?,?,?,?,?,?,?)",id,"salon",1,0,45,"Merhaba! Hizmeti ve uygun olduğunuz günü yazın; birlikte saat bulalım.",stamp),
    ...(completed.length >= 2 ? [
      q("INSERT INTO reviews(id,tenant_id,appointment_id,rating,comment,status,created_at) VALUES(?,?,?,?,?,'published',?)",key("review-1"),id,key(completed[0].id),5,"Çok memnun kaldım, tekrar geleceğim.",stamp),
      q("INSERT INTO reviews(id,tenant_id,appointment_id,rating,comment,status,created_at) VALUES(?,?,?,?,?,'published',?)",key("review-2"),id,key(completed[1].id),4,"Randevu süreci hızlı ve düzenliydi.",stamp),
    ] : []),
  ]);
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
