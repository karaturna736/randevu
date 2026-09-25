import { z } from "zod";
import {
  admin,
  all,
  ApiError,
  db,
  isAdmin,
  now,
  one,
  q,
  uid,
  user,
} from "./server";
import { PLAN_CATALOG, type PlanCode } from "./entitlements";
import { businessCreation, businessSchema } from "./workspace";
import { approveReferral } from "./growth";

const planCode = z.enum(["normal", "pro", "plus"]);
const httpsUrl = z
  .string()
  .trim()
  .max(1000)
  .refine((value) => {
    if (!value) return true;
    try {
      return new URL(value).protocol === "https:";
    } catch {
      return false;
    }
  }, "Ödeme bağlantısı geçerli bir HTTPS adresi olmalıdır.");

const settingsSchema = z.object({
  active: z.boolean(),
  normal_url: httpsUrl,
  pro_url: httpsUrl,
  plus_url: httpsUrl,
  note: z.string().trim().max(500).default(""),
});

const prepareSchema = z.object({
  action: z.literal("prepare"),
  plan: planCode,
  terms_accepted: z.literal(true, {
    errorMap: () => ({ message: "Abonelik koşullarını kabul etmeniz gerekiyor." }),
  }),
  business: businessSchema,
});

const submitSchema = z.object({
  action: z.literal("submitted"),
  request_id: z.string().uuid(),
  receipt_note: z.string().trim().max(240).default(""),
});

function linkFor(settings: any, plan: PlanCode) {
  return String(settings?.[`${plan}_url`] || "");
}

async function readSettings() {
  return one("SELECT * FROM temporary_payment_settings WHERE id=1");
}

export async function temporaryPaymentSnapshot() {
  const actor = await user(),
    testMode = await isAdmin(actor),
    settings = await readSettings(),
    latest = await one(
      `SELECT id,plan,amount,business_name,business_slug,payment_url,status,receipt_note,tenant_id,created_at,updated_at
       FROM temporary_payment_requests WHERE user_id=? ORDER BY created_at DESC LIMIT 1`,
      actor.userId,
    );
  const links = {
    normal: linkFor(settings, "normal"),
    pro: linkFor(settings, "pro"),
    plus: linkFor(settings, "plus"),
  };
  return {
    available: testMode || (!!settings?.active && Object.values(links).some(Boolean)),
    provider: testMode ? "admin_test" : "iyzico_link",
    test_mode: testMode,
    note: testMode
      ? "Yönetici test modu: gerçek tahsilat yapılmaz. Seçilen paket 30 gün boyunca gerçek paket yetkileriyle açılır."
      : settings?.note || "",
    plans: (Object.keys(PLAN_CATALOG) as PlanCode[]).map((code) => ({
      code,
      name: PLAN_CATALOG[code].name,
      amount: testMode ? 0 : PLAN_CATALOG[code].amount,
      available: testMode || (!!settings?.active && !!links[code]),
    })),
    request: latest || null,
  };
}

export async function prepareTemporaryPayment(input: unknown) {
  const actor = await user(),
    testMode = await isAdmin(actor),
    x = prepareSchema.parse(input),
    settings = await readSettings();
  if (!testMode && !settings?.active)
    throw new ApiError("Geçici gerçek ödeme bağlantısı şu anda aktif değil.", 503);
  const paymentUrl = testMode ? "" : linkFor(settings, x.plan);
  if (!testMode && !paymentUrl)
    throw new ApiError("Seçilen paket için ödeme bağlantısı hazırlanmadı.", 503);

  const business = businessSchema.parse({ ...x.business, plan: x.plan });
  if (await one("SELECT 1 ok FROM businesses WHERE slug=?", business.slug))
    throw new ApiError("Bu randevu bağlantısı kullanımda.", 409);

  const existing = await one(
    `SELECT id,plan,amount,business_name,business_slug,payment_url,status,tenant_id
     FROM temporary_payment_requests
     WHERE user_id=? AND status IN ('awaiting_payment','awaiting_review','approving')
     ORDER BY created_at DESC LIMIT 1`,
    actor.userId,
  );
  if (existing) return existing;

  const id = uid(),
    stamp = now(),
    amount = testMode ? 0 : PLAN_CATALOG[x.plan].amount;
  try {
    await q(
      `INSERT INTO temporary_payment_requests(
        id,user_id,user_email,user_name,plan,amount,business_payload,business_name,business_slug,payment_url,status,created_at,updated_at
      ) VALUES(?,?,?,?,?,?,?,?,?,?,'awaiting_payment',?,?)`,
      id,
      actor.userId,
      actor.email,
      actor.displayName,
      x.plan,
      amount,
      JSON.stringify(business),
      business.name,
      business.slug,
      paymentUrl,
      stamp,
      stamp,
    ).run();
  } catch (error) {
    if (String(error).toLowerCase().includes("unique"))
      throw new ApiError("Bu randevu bağlantısı başka bir ödeme talebinde ayrılmış.", 409);
    throw error;
  }
  return {
    id,
    plan: x.plan,
    amount,
    business_name: business.name,
    business_slug: business.slug,
    payment_url: paymentUrl,
    status: "awaiting_payment",
    test_mode: testMode,
  };
}

export async function completeTemporaryTestPayment(input: unknown) {
  const actor = await user();
  if (!(await isAdmin(actor)))
    throw new ApiError("Bu test ödeme akışı yalnızca platform yöneticisine açıktır.", 403);
  const x = z
      .object({ action: z.literal("complete_test"), request_id: z.string().uuid() })
      .parse(input),
    request = await one(
      "SELECT * FROM temporary_payment_requests WHERE id=? AND user_id=?",
      x.request_id,
      actor.userId,
    );
  if (!request) throw new ApiError("Test ödeme talebi bulunamadı.", 404);
  if (request.status === "approved" && request.tenant_id)
    return { ok: true, status: "approved", tenant_id: request.tenant_id };
  if (request.status !== "awaiting_payment" || Number(request.amount) !== 0 || request.payment_url)
    throw new ApiError("Bu kayıt 0 TL yönetici test ödemesi değildir.", 409);
  if (await one("SELECT 1 ok FROM businesses WHERE slug=?", request.business_slug))
    throw new ApiError("Bu randevu bağlantısı kullanımda.", 409);

  const stamp = now(),
    claimed = await q(
      "UPDATE temporary_payment_requests SET status='approving',updated_at=? WHERE id=? AND user_id=? AND status='awaiting_payment'",
      stamp,
      request.id,
      actor.userId,
    ).run();
  if (!claimed.meta.changes)
    throw new ApiError("Test aktivasyonu başka bir işlem tarafından değiştirildi.", 409);

  try {
    const plan = planCode.parse(request.plan),
      payload = businessSchema.parse(JSON.parse(request.business_payload)),
      tenantId = uid(),
      created = await businessCreation(
        { ...payload, plan },
        {
          userId: request.user_id,
          email: request.user_email,
          displayName: request.user_name,
        },
        tenantId,
        false,
      ),
      paidUntil = new Date(Date.now() + 30 * 86400000).toISOString(),
      ops = [
        ...created.ops,
        q("UPDATE businesses SET status='approved',selected_plan=? WHERE id=?", plan, tenantId),
        q(
          `INSERT INTO subscriptions(tenant_id,paid_until,updated_at,plan) VALUES(?,?,?,?)
           ON CONFLICT(tenant_id) DO UPDATE SET paid_until=MAX(subscriptions.paid_until,excluded.paid_until),updated_at=excluded.updated_at,plan=excluded.plan`,
          tenantId,
          paidUntil,
          stamp,
          plan,
        ),
        q(
          "INSERT INTO payments(id,tenant_id,kind,amount,status,provider_ref,created_at) VALUES(?,?,'subscription',0,'paid',?,?)",
          uid(),
          tenantId,
          "admin-test:" + request.id,
          stamp,
        ),
        q(
          `UPDATE temporary_payment_requests SET status='approved',tenant_id=?,reviewed_by=?,reviewed_at=?,updated_at=?
           WHERE id=? AND status='approving'`,
          tenantId,
          actor.userId,
          stamp,
          stamp,
          request.id,
        ),
        q(
          "INSERT INTO audit(id,user_id,action,target_id,created_at) VALUES(?,?,?,?,?)",
          uid(),
          actor.userId,
          "temporary-payment.admin-test-approved",
          request.id,
          stamp,
        ),
      ];
    await db().batch(ops);
    return { ok: true, status: "approved", tenant_id: tenantId, paid_until: paidUntil };
  } catch (error) {
    await q(
      "UPDATE temporary_payment_requests SET status='awaiting_payment',updated_at=? WHERE id=? AND status='approving'",
      now(),
      request.id,
    ).run();
    throw error;
  }
}

export async function submitTemporaryPayment(input: unknown) {
  const actor = await user(),
    x = submitSchema.parse(input),
    stamp = now(),
    result = await q(
      `UPDATE temporary_payment_requests
       SET status='awaiting_review',receipt_note=?,updated_at=?
       WHERE id=? AND user_id=? AND status='awaiting_payment' AND amount>0`,
      x.receipt_note,
      stamp,
      x.request_id,
      actor.userId,
    ).run();
  if (!result.meta.changes) {
    const current = await one(
      "SELECT status,tenant_id,amount FROM temporary_payment_requests WHERE id=? AND user_id=?",
      x.request_id,
      actor.userId,
    );
    if (Number(current?.amount) === 0)
      throw new ApiError("0 TL yönetici testinde ödeme doğrulama kuyruğu kullanılmaz.", 409);
    if (current?.status === "awaiting_review" || current?.status === "approved")
      return { ok: true, status: current.status, tenant_id: current.tenant_id || null };
    throw new ApiError("Ödeme talebi bulunamadı veya artık değiştirilemez.", 409);
  }
  return { ok: true, status: "awaiting_review" };
}

export async function cancelTemporaryPayment(input: unknown) {
  const actor = await user(),
    x = z
      .object({ action: z.literal("cancel"), request_id: z.string().uuid() })
      .parse(input),
    result = await q(
      `UPDATE temporary_payment_requests SET status='cancelled',updated_at=?
       WHERE id=? AND user_id=? AND status='awaiting_payment'`,
      now(),
      x.request_id,
      actor.userId,
    ).run();
  if (!result.meta.changes)
    throw new ApiError("Bu ödeme talebi artık iptal edilemez.", 409);
  return { ok: true };
}

export async function temporaryPaymentAdminSnapshot() {
  await admin();
  const settings = (await readSettings()) || {
    id: 1,
    active: 0,
    provider: "iyzico_link",
    normal_url: "",
    pro_url: "",
    plus_url: "",
    note: "",
  };
  return {
    settings,
    plans: (Object.keys(PLAN_CATALOG) as PlanCode[]).map((code) => ({
      code,
      name: PLAN_CATALOG[code].name,
      amount: PLAN_CATALOG[code].amount,
    })),
    requests: await all(
      `SELECT id,user_id,user_email,user_name,plan,amount,business_name,business_slug,payment_url,status,receipt_note,tenant_id,created_at,updated_at,reviewed_by,reviewed_at
       FROM temporary_payment_requests ORDER BY created_at DESC LIMIT 300`,
    ),
  };
}

export async function saveTemporaryPaymentSettings(input: unknown) {
  const actor = await admin(),
    x = settingsSchema.parse(input),
    stamp = now();
  await q(
    `INSERT INTO temporary_payment_settings(id,active,provider,normal_url,pro_url,plus_url,note,updated_by,updated_at)
     VALUES(1,?,'iyzico_link',?,?,?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET active=excluded.active,provider=excluded.provider,normal_url=excluded.normal_url,
       pro_url=excluded.pro_url,plus_url=excluded.plus_url,note=excluded.note,updated_by=excluded.updated_by,updated_at=excluded.updated_at`,
    x.active ? 1 : 0,
    x.normal_url,
    x.pro_url,
    x.plus_url,
    x.note,
    actor.userId,
    stamp,
  ).run();
  await q(
    "INSERT INTO audit(id,user_id,action,target_id,created_at) VALUES(?,?,?,?,?)",
    uid(),
    actor.userId,
    "temporary-payment.settings.updated",
    "temporary-payment-settings",
    stamp,
  ).run();
  return { ok: true };
}

export async function reviewTemporaryPayment(input: unknown) {
  const actor = await admin(),
    x = z
      .discriminatedUnion("action", [
        z.object({
          action: z.literal("approve"),
          request_id: z.string().uuid(),
          payment_verified: z.literal(true, {
            errorMap: () => ({ message: "Ödemeyi iyzico panelinden doğruladığınızı onaylayın." }),
          }),
        }),
        z.object({
          action: z.literal("reject"),
          request_id: z.string().uuid(),
        }),
      ])
      .parse(input),
    stamp = now();

  if (x.action === "reject") {
    const result = await q(
      `UPDATE temporary_payment_requests SET status='rejected',reviewed_by=?,reviewed_at=?,updated_at=?
       WHERE id=? AND status IN ('awaiting_payment','awaiting_review')`,
      actor.userId,
      stamp,
      stamp,
      x.request_id,
    ).run();
    if (!result.meta.changes) throw new ApiError("Talep artık reddedilemez.", 409);
    await q(
      "INSERT INTO audit(id,user_id,action,target_id,created_at) VALUES(?,?,?,?,?)",
      uid(),
      actor.userId,
      "temporary-payment.rejected",
      x.request_id,
      stamp,
    ).run();
    return { ok: true, status: "rejected" };
  }

  const request = await one(
    "SELECT * FROM temporary_payment_requests WHERE id=?",
    x.request_id,
  );
  if (!request) throw new ApiError("Ödeme talebi bulunamadı.", 404);
  if (request.status === "approved")
    return { ok: true, status: "approved", tenant_id: request.tenant_id };
  if (Number(request.amount) === 0)
    throw new ApiError("0 TL yönetici test ödemesi bu onay kuyruğundan geçirilemez.", 409);
  if (request.status !== "awaiting_review")
    throw new ApiError("Yalnızca kullanıcı tarafından ödenmiş olarak işaretlenen talepler onaylanabilir.", 409);
  if (await one("SELECT 1 ok FROM businesses WHERE slug=?", request.business_slug))
    throw new ApiError("İşletme bağlantısı bu sırada kullanımda olmuş. Talebi reddedip yeni bağlantı oluşturun.", 409);

  const claimed = await q(
    "UPDATE temporary_payment_requests SET status='approving',updated_at=? WHERE id=? AND status='awaiting_review'",
    stamp,
    request.id,
  ).run();
  if (!claimed.meta.changes)
    throw new ApiError("Talep başka bir yönetici tarafından işleniyor.", 409);

  try {
    const plan = planCode.parse(request.plan),
      payload = businessSchema.parse(JSON.parse(request.business_payload)),
      tenantId = uid(),
      created = await businessCreation(
        { ...payload, plan },
        {
          userId: request.user_id,
          email: request.user_email,
          displayName: request.user_name,
        },
        tenantId,
        false,
      ),
      paidUntil = new Date(Date.now() + 30 * 86400000).toISOString(),
      paymentId = uid(),
      ops = [
        ...created.ops,
        q("UPDATE businesses SET status='approved',selected_plan=? WHERE id=?", plan, tenantId),
        q(
          `INSERT INTO subscriptions(tenant_id,paid_until,updated_at,plan) VALUES(?,?,?,?)
           ON CONFLICT(tenant_id) DO UPDATE SET paid_until=MAX(subscriptions.paid_until,excluded.paid_until),updated_at=excluded.updated_at,plan=excluded.plan`,
          tenantId,
          paidUntil,
          stamp,
          plan,
        ),
        q(
          "INSERT INTO payments(id,tenant_id,kind,amount,status,provider_ref,created_at) VALUES(?,?,'subscription',?,'paid',?,?)",
          paymentId,
          tenantId,
          request.amount,
          "iyzico-link:" + request.id,
          stamp,
        ),
        q(
          `UPDATE temporary_payment_requests SET status='approved',tenant_id=?,reviewed_by=?,reviewed_at=?,updated_at=?
           WHERE id=? AND status='approving'`,
          tenantId,
          actor.userId,
          stamp,
          stamp,
          request.id,
        ),
        q(
          "INSERT INTO audit(id,user_id,action,target_id,created_at) VALUES(?,?,?,?,?)",
          uid(),
          actor.userId,
          "temporary-payment.approved",
          request.id,
          stamp,
        ),
      ];
    await db().batch(ops);
    await approveReferral(tenantId);
    return { ok: true, status: "approved", tenant_id: tenantId, paid_until: paidUntil };
  } catch (error) {
    await q(
      "UPDATE temporary_payment_requests SET status='awaiting_review',updated_at=? WHERE id=? AND status='approving'",
      now(),
      request.id,
    ).run();
    throw error;
  }
}
