import { env } from "cloudflare:workers";
import { z } from "zod";
import {
  all,
  one,
  q,
  db,
  user,
  tenant,
  admin,
  uid,
  now,
  ApiError,
  phone,
} from "./server";
import { appOrigin, authStatus } from "./identity";
import { hmac, equalSecret, utf8Base64 } from "./security";

const cfg = () => env as any;
export function paymentConnection() {
  const c = cfg();
  return {
    provider: "PayTR",
    credentials: !!(
      c.PAYTR_MERCHANT_ID &&
      c.PAYTR_MERCHANT_KEY &&
      c.PAYTR_MERCHANT_SALT
    ),
    public_site: c.PUBLIC_SITE_READY === "true",
    test_mode: c.PAYTR_TEST_MODE !== "0",
    origin: appOrigin(),
    bank_label: String(
      c.PAYTR_BANK_LABEL || "PayTR mağaza hesabında yönetilir",
    ),
  };
}
async function settings() {
  return (
    (await one("SELECT * FROM billing_settings WHERE id=1")) || {
      amount: 0,
      active: 0,
      seller_name: "",
      support_email: "",
      seller_address: "",
      terms_url: "",
    }
  );
}
export async function publicPlan() {
  const s = await settings(),
    c = cfg();
  return {
    name: "Neta İşletme",
    amount: s.amount,
    currency: "TRY",
    period_days: 30,
    trial_days: 14,
    active: !!s.active,
    seller_name: s.seller_name,
    seller_address: s.seller_address,
    support_email: s.support_email,
    terms_url: s.terms_url,
    data_controller: {
      name: String(c.NETA_DATA_CONTROLLER_NAME || s.seller_name || ""),
      address: String(c.NETA_DATA_CONTROLLER_ADDRESS || s.seller_address || ""),
      email: String(c.NETA_DATA_CONTROLLER_EMAIL || s.support_email || ""),
      kep: String(c.NETA_DATA_CONTROLLER_KEP || ""),
    },
  };
}
export async function billingSnapshot(id?: string) {
  const u = await user();
  const businesses = await all(
    "SELECT b.id,b.name,b.created_at,b.slug FROM businesses b JOIN members m ON m.tenant_id=b.id WHERE m.user_id=? AND m.role='owner' AND m.disabled=0 AND b.status NOT IN ('deleted','suspended') ORDER BY b.created_at DESC",
    u.userId,
  );
  if (!businesses.length) return { businesses, plan: await publicPlan() };
  const b = await tenant(id || businesses[0].id),
    plan = await publicPlan(),
    sub = await one("SELECT * FROM subscriptions WHERE tenant_id=?", b.id),
    trialUntil = new Date(
      new Date(b.created_at).getTime() + 14 * 86400000,
    ).toISOString();
  const conn = paymentConnection();
  return {
    businesses,
    business: b,
    plan,
    subscription: {
      paid_until: sub?.paid_until || null,
      trial_until: trialUntil,
      state:
        !plan.active || conn.test_mode
          ? "pilot"
          : sub?.paid_until > now()
            ? "active"
            : trialUntil > now()
              ? "trial"
              : "expired",
    },
    profile: await one(
      "SELECT * FROM billing_profiles WHERE tenant_id=?",
      b.id,
    ),
    orders: await all(
      "SELECT id,amount,currency,period_days,status,test_mode,created_at,paid_at FROM subscription_orders WHERE tenant_id=? ORDER BY created_at DESC LIMIT 100",
      b.id,
    ),
    checkout_available: !!(
      plan.active &&
      conn.credentials &&
      conn.public_site &&
      conn.origin &&
      (!conn.test_mode || (await import("./server").then((m) => m.isAdmin(u))))
    ),
    test_mode: conn.test_mode,
  };
}
export async function assertBookingPlan(b: any) {
  if (b.demo) return;
  const s = await settings();
  if (
    (env as any).RECURRING_SALES_ENABLED !== "true" &&
    (!s.active || paymentConnection().test_mode)
  )
    return;
  if (
    (env as any).RECURRING_SALES_ENABLED === "true" &&
    (env as any).IYZICO_LIVE !== "true"
  )
    return;
  if (new Date(b.created_at).getTime() + 14 * 86400000 > Date.now()) return;
  const sub = await one(
    "SELECT paid_until FROM subscriptions WHERE tenant_id=?",
    b.id,
  );
  if (!sub || sub.paid_until <= now())
    throw new ApiError(
      "Bu işletmenin çevrim içi randevu erişimi yenilenmeyi bekliyor. İşletmeyle iletişime geçin.",
      402,
    );
}
const billProfile = z.object({
  name: z.string().trim().min(2).max(100),
  address: z.string().trim().min(10).max(350),
  phone,
  email: z.string().email().max(254),
});
export async function saveBillingProfile(id: string, input: any) {
  await tenant(id);
  const x = billProfile.parse(input);
  await q(
    "INSERT INTO billing_profiles(tenant_id,name,address,phone,email,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(tenant_id) DO UPDATE SET name=excluded.name,address=excluded.address,phone=excluded.phone,email=excluded.email,updated_at=excluded.updated_at",
    id,
    x.name,
    x.address,
    x.phone,
    x.email,
    now(),
  ).run();
  return { ok: true };
}
export async function beginCheckout(req: Request, input: any) {
  const x = z
      .object({
        tenant_id: z.string().min(1),
        idempotency_key: z.string().uuid(),
        terms_accepted: z.literal(true),
      })
      .parse(input),
    b = await tenant(x.tenant_id),
    u = await user(),
    s = await settings(),
    c = paymentConnection();
  if (
    await one(
      "SELECT 1 n FROM recurring_subscriptions WHERE tenant_id=? AND state NOT IN ('CANCELED','EXPIRED','failed')",
      b.id,
    )
  )
    throw new ApiError(
      "Bu işletmenin aylık aboneliği var. Abonelik bölümünden yönetin.",
      409,
    );
  if (!s.active || !c.credentials || !c.public_site || !c.origin)
    throw new ApiError(
      "Çevrim içi ödeme henüz açılmadı. Şu anda kart bilgisi girmeyin.",
      503,
    );
  if (c.test_mode && !(await import("./server").then((m) => m.isAdmin(u))))
    throw new ApiError(
      "Ödeme bağlantısı test aşamasında. Henüz gerçek ödeme alınmıyor.",
      503,
    );
  if (!s.amount || !s.seller_name || !s.support_email || !s.terms_url)
    throw new ApiError("Satıcı ve plan bilgileri tamamlanmalı.", 503);
  const buyer = await one(
    "SELECT * FROM billing_profiles WHERE tenant_id=?",
    b.id,
  );
  if (!buyer)
    throw new ApiError("Önce fatura iletişim bilgilerini kaydedin.", 409);
  const existing = await one(
    "SELECT id,status FROM subscription_orders WHERE tenant_id=? AND idempotency_key=?",
    b.id,
    x.idempotency_key,
  );
  if (existing)
    return { order_id: existing.id, status: existing.status, existing: true };
  const ip = req.headers.get("cf-connecting-ip");
  if (!ip || ip.length > 45)
    throw new ApiError(
      "Güvenli bağlantı bilgisi alınamadı. Tekrar deneyin.",
      503,
    );
  const id = "NETA" + uid().replace(/-/g, ""),
    stamp = now(),
    test = c.test_mode ? "1" : "0";
  await q(
    "INSERT INTO subscription_orders(id,tenant_id,user_id,amount,test_mode,idempotency_key,buyer_name,buyer_email,buyer_address,terms_url,terms_accepted_at,created_at,expires_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",
    id,
    b.id,
    u.userId,
    s.amount,
    Number(test),
    x.idempotency_key,
    buyer.name,
    buyer.email,
    buyer.address,
    s.terms_url,
    stamp,
    stamp,
    new Date(Date.now() + 30 * 60000).toISOString(),
  ).run();
  const basket = utf8Base64(
    JSON.stringify([
      ["Neta İşletme — 30 günlük erişim", (s.amount / 100).toFixed(2), 1],
    ]),
  );
  const signature = await hmac(
    String(cfg().PAYTR_MERCHANT_ID) +
      ip +
      id +
      buyer.email +
      s.amount +
      basket +
      "1" +
      "0" +
      "TL" +
      test +
      cfg().PAYTR_MERCHANT_SALT,
    cfg().PAYTR_MERCHANT_KEY,
  );
  try {
    const response = await fetch("https://www.paytr.com/odeme/api/get-token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        merchant_id: String(cfg().PAYTR_MERCHANT_ID),
        user_ip: ip,
        merchant_oid: id,
        email: buyer.email,
        payment_amount: String(s.amount),
        paytr_token: signature,
        user_basket: basket,
        no_installment: "1",
        max_installment: "0",
        currency: "TL",
        test_mode: test,
        user_name: buyer.name,
        user_address: buyer.address,
        user_phone: buyer.phone,
        merchant_ok_url:
          c.origin +
          "/abonelik?tenant=" +
          encodeURIComponent(b.id) +
          "&siparis=" +
          id,
        merchant_fail_url:
          c.origin +
          "/abonelik?tenant=" +
          encodeURIComponent(b.id) +
          "&siparis=" +
          id,
        timeout_limit: "30",
        debug_on: "0",
        lang: "tr",
      }),
      signal: AbortSignal.timeout(15000),
      redirect: "manual",
    });
    if (!response.ok) throw new Error("PROVIDER_UNAVAILABLE");
    const result: any = await response.json();
    if (
      result.status !== "success" ||
      typeof result.token !== "string" ||
      !/^[a-zA-Z0-9_-]{10,300}$/.test(result.token)
    )
      throw new Error("PROVIDER_REJECTED");
    await q(
      "UPDATE subscription_orders SET status='pending' WHERE id=? AND status='creating'",
      id,
    ).run();
    return {
      order_id: id,
      checkout_url:
        "https://www.paytr.com/odeme/guvenli/" +
        encodeURIComponent(result.token),
      test_mode: c.test_mode,
    };
  } catch {
    await q(
      "UPDATE subscription_orders SET status='failed' WHERE id=? AND status='creating'",
      id,
    ).run();
    throw new ApiError(
      "Ödeme sayfası hazırlanamadı. Kartınızdan bu ekran üzerinden bir çekim yapılmadı; tekrar deneyebilirsiniz.",
      503,
    );
  }
}
export async function paymentCallback(req: Request) {
  if (!paymentConnection().credentials)
    throw new ApiError("NOT_CONFIGURED", 503);
  if (
    !req.headers
      .get("content-type")
      ?.includes("application/x-www-form-urlencoded")
  )
    throw new ApiError("INVALID_BODY");
  const raw = await req.text();
  if (raw.length > 8000) throw new ApiError("TOO_LARGE", 413);
  const params = new URLSearchParams(raw);
  for (const key of ["merchant_oid", "status", "total_amount", "hash"])
    if (params.getAll(key).length !== 1) throw new ApiError("INVALID_BODY");
  const data = Object.fromEntries(params);
  const x = z
    .object({
      merchant_oid: z.string().regex(/^NETA[a-f0-9]{32}$/),
      status: z.enum(["success", "failed"]),
      total_amount: z.string().regex(/^\d{1,10}$/),
      hash: z.string().max(100),
    })
    .parse(data);
  const expected = await hmac(
    x.merchant_oid + cfg().PAYTR_MERCHANT_SALT + x.status + x.total_amount,
    cfg().PAYTR_MERCHANT_KEY,
  );
  if (!equalSecret(expected, x.hash))
    throw new ApiError("INVALID_SIGNATURE", 403);
  const order = await one(
    "SELECT * FROM subscription_orders WHERE id=?",
    x.merchant_oid,
  );
  if (!order) throw new ApiError("UNKNOWN_ORDER", 404);
  if (x.status === "success" && Number(x.total_amount) !== order.amount) {
    await q(
      "INSERT INTO audit(id,user_id,action,target_id,created_at) VALUES(?,?,?,?,?)",
      uid(),
      "paytr",
      "billing.amount_mismatch",
      order.id,
      now(),
    ).run();
    throw new ApiError("AMOUNT_MISMATCH", 409);
  }
  // Browser return pages never grant access. Only this signed server callback can do so.
  const stamp = now();
  if (x.status === "success") {
    const status = order.test_mode ? "test_paid" : "paid";
    await db().batch([
      q(
        "UPDATE subscription_orders SET status=?,paid_at=? WHERE id=? AND status NOT IN ('paid','test_paid')",
        status,
        stamp,
        order.id,
      ),
      q(
        "INSERT OR IGNORE INTO billing_grants(order_id,tenant_id,period_days,created_at) SELECT id,tenant_id,period_days,? FROM subscription_orders WHERE id=? AND status='paid' AND test_mode=0",
        stamp,
        order.id,
      ),
    ]);
  } else
    await q(
      "UPDATE subscription_orders SET status='failed' WHERE id=? AND status NOT IN ('paid','test_paid')",
      order.id,
    ).run();
  return new Response("OK", {
    headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" },
  });
}
export async function platformBilling() {
  await admin();
  return {
    settings: await settings(),
    connection: paymentConnection(),
    auth: authStatus(),
    totals: await one(
      "SELECT COUNT(CASE WHEN status='paid' THEN 1 END) paid_count,COALESCE(SUM(CASE WHEN status='paid' THEN amount ELSE 0 END),0) paid_amount,COUNT(CASE WHEN status IN ('pending','creating') THEN 1 END) pending_count,COUNT(CASE WHEN status='failed' THEN 1 END) failed_count FROM subscription_orders WHERE test_mode=0",
    ),
    subscriptions: await all(
      "SELECT s.*,b.name business_name FROM subscriptions s JOIN businesses b ON b.id=s.tenant_id ORDER BY s.paid_until DESC LIMIT 200",
    ),
    orders: await all(
      "SELECT o.id,o.tenant_id,o.amount,o.status,o.test_mode,o.created_at,o.paid_at,b.name business_name FROM subscription_orders o JOIN businesses b ON b.id=o.tenant_id ORDER BY o.created_at DESC LIMIT 200",
    ),
  };
}
export async function savePlatformBilling(input: any) {
  const u = await admin();
  const x = z
    .object({
      amount: z.number().int().min(100).max(100000000),
      active: z.boolean(),
      seller_name: z.string().trim().min(2).max(150),
      support_email: z.string().email().max(254),
      seller_address: z.string().trim().min(10).max(350),
      terms_url: z
        .string()
        .url()
        .max(500)
        .refine((s) => s.startsWith("https://")),
    })
    .parse(input);
  const c = paymentConnection();
  if (x.active && (!c.credentials || !c.public_site || !c.origin))
    throw new ApiError(
      "Planı satışa açmadan önce ödeme bağlantısı ve herkese açık site kurulumu tamamlanmalı.",
      409,
    );
  const stamp = now();
  await db().batch([
    q(
      "INSERT INTO billing_settings(id,amount,active,seller_name,support_email,seller_address,terms_url,updated_at) VALUES(1,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET amount=excluded.amount,active=excluded.active,seller_name=excluded.seller_name,support_email=excluded.support_email,seller_address=excluded.seller_address,terms_url=excluded.terms_url,updated_at=excluded.updated_at",
      x.amount,
      x.active ? 1 : 0,
      x.seller_name,
      x.support_email,
      x.seller_address,
      x.terms_url,
      stamp,
    ),
    q(
      "INSERT INTO audit(id,user_id,action,target_id,created_at) VALUES(?,?,?,?,?)",
      uid(),
      u.userId,
      "billing.settings",
      "platform",
      stamp,
    ),
  ]);
  return { ok: true };
}
