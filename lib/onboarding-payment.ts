import { env } from "cloudflare:workers";
import { z } from "zod";
import { appOrigin } from "./identity";
import { PLAN_CATALOG } from "./entitlements";
import { iyzico, recurringConnection, recurringPlans } from "./recurring";
import {
  ApiError,
  all,
  db,
  hash,
  isAdmin,
  now,
  one,
  paidTenant,
  q,
  uid,
  user,
} from "./server";
import { businessCreation, businessSchema } from "./workspace";
import { quoteCampaign } from "./campaigns";

const buyerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  surname: z.string().trim().min(2).max(80),
  identity: z
    .string()
    .regex(/^\d{10,11}$/, "Geçerli kimlik veya vergi numarası girin."),
  city: z.string().trim().min(2).max(80),
  terms_accepted: z.literal(true, {
    errorMap: () => ({
      message: "Abonelik koşullarını kabul etmeniz gerekiyor.",
    }),
  }),
  card_storage_accepted: z.literal(true, {
    errorMap: () => ({
      message: "Aylık abonelik için güvenli kart saklama onayı gerekiyor.",
    }),
  }),
});
const checkoutSchema = z.object({
  business: businessSchema,
  buyer: buyerSchema,
  idempotency_key: z.string().uuid(),
  campaign_code: z.string().trim().max(32).optional(),
});
const providerRef = z.string().regex(/^[a-zA-Z0-9_-]{8,120}$/);
const redirect = (path: string) =>
  new Response(null, {
    status: 303,
    headers: {
      Location: (appOrigin() || "") + path,
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
    },
  });

async function zeroCheckoutEnabled(actor: any) {
  let host = "";
  try {
    host = new URL(appOrigin() || "").hostname.toLowerCase();
  } catch {
    return false;
  }
  if (host !== "netarandevu.com" && host !== "www.netarandevu.com")
    return false;
  return isAdmin(actor);
}

export async function accountPaymentState(userId: string) {
  const access = await paidTenant(userId);
  if (access)
    return { state: "active", tenant_id: access.id, demo: !!access.demo };
  const latest = await one(
    "SELECT id,state,tenant_id,plan,amount,currency,failure_reason,expires_at,updated_at FROM onboarding_payments WHERE user_id=? ORDER BY created_at DESC LIMIT 1",
    userId,
  );
  if (latest?.state === "active")
    return {
      ...latest,
      state: "payment_failed",
      failure_reason: "Aboneliğiniz aktif değil. Ödeme durumunu yenileyin.",
    };
  if (latest?.state === "payment_processing" && latest.expires_at <= now()) {
    await q(
      "UPDATE onboarding_payments SET state='payment_failed',failure_reason='Ödeme oturumunun süresi doldu.',failed_at=?,updated_at=? WHERE id=? AND state='payment_processing'",
      now(),
      now(),
      latest.id,
    ).run();
    return {
      ...latest,
      state: "payment_failed",
      failure_reason: "Ödeme oturumunun süresi doldu.",
    };
  }
  return latest || { state: "pending_payment" };
}

export async function currentPaymentState() {
  const u = await user();
  if (await zeroCheckoutEnabled(u))
    return {
      state: "pending_payment",
      zero_test_mode: true,
    };
  return accountPaymentState(u.userId);
}
export function onboardingPaymentStatus() {
  const connection = recurringConnection(),
    configured = recurringPlans();
  return {
    available: !!(
      connection.configured &&
      connection.public_site &&
      connection.enabled &&
      connection.seller_ready &&
      appOrigin()
    ),
    live: connection.live,
    terms_url: String((env as any).NETA_SUBSCRIPTION_TERMS_URL || ""),
    kvkk_url: "/kvkk",
    plans: (Object.keys(PLAN_CATALOG) as Array<keyof typeof PLAN_CATALOG>).map(
      (code) => ({
        ...PLAN_CATALOG[code],
        code,
        configured: configured.some((p) => p.code === code),
      }),
    ),
  };
}

export async function beginOnboardingPayment(input: any) {
  const owner = await user(),
    platformAdmin = await zeroCheckoutEnabled(owner);
  if (!platformAdmin) {
    const current = await accountPaymentState(owner.userId);
    if (current.state === "active")
      return { active: true, tenant_id: current.tenant_id };
    if (current.state === "payment_processing")
      throw new ApiError(
        "Devam eden ödeme işleminiz var. Durum sayfasından kontrol edin.",
        409,
      );
  }
  const x = checkoutSchema.parse(input),
    connection = recurringConnection(),
    plan = recurringPlans().find((p) => p.code === x.business.plan),
    origin = appOrigin();
  const duplicate = await one(
    "SELECT id,state,tenant_id FROM onboarding_payments WHERE user_id=? AND idempotency_key=?",
    owner.userId,
    x.idempotency_key,
  );
  if (duplicate?.state === "active")
    return { active: true, tenant_id: duplicate.tenant_id };
  if (duplicate)
    throw new ApiError(
      "Bu ödeme isteği zaten işleme alındı. Durum sayfasından kontrol edin.",
      409,
    );
  if (
    !platformAdmin &&
    (await one("SELECT COUNT(*) n FROM members WHERE user_id=?", owner.userId))
      .n >= 10
  )
    throw new ApiError("En fazla 10 işletme oluşturabilirsiniz.");
  if (await one("SELECT id FROM businesses WHERE slug=?", x.business.slug))
    throw new ApiError("Bu randevu bağlantısı kullanımda.", 409);
  if (
    await one(
      "SELECT id FROM onboarding_payments WHERE slug=? AND state IN ('payment_processing','active')",
      x.business.slug,
    )
  )
    throw new ApiError("Bu bağlantı devam eden bir kurulumda ayrılmış.", 409);

  if (platformAdmin) {
    const selectedPlan = x.business.plan as keyof typeof PLAN_CATALOG,
      tenantId = uid(),
      paymentId = uid(),
      stamp = now(),
      paidUntil = new Date(Date.now() + 30 * 86400000).toISOString(),
      created = await businessCreation(x.business, owner, tenantId, false);
    await db().batch([
      ...created.ops,
      q(
        "UPDATE businesses SET status='approved',selected_plan=? WHERE id=?",
        selectedPlan,
        tenantId,
      ),
      q(
        `INSERT INTO subscriptions(tenant_id,paid_until,updated_at,plan) VALUES(?,?,?,?)
         ON CONFLICT(tenant_id) DO UPDATE SET paid_until=excluded.paid_until,updated_at=excluded.updated_at,plan=excluded.plan`,
        tenantId,
        paidUntil,
        stamp,
        selectedPlan,
      ),
      q(
        "INSERT INTO payments(id,tenant_id,kind,amount,status,provider_ref,created_at) VALUES(?,?,'subscription',0,'paid',?,?)",
        paymentId,
        tenantId,
        "neta-zero-test:" + paymentId,
        stamp,
      ),
      q(
        `INSERT INTO onboarding_payments(
          id,user_id,user_email,user_name,slug,provider,plan,plan_reference,amount,currency,payload,state,test_mode,
          created_at,updated_at,paid_at,account_activated_at,expires_at,idempotency_key,tenant_id
        ) VALUES(?,?,?,?,?,'neta_zero_test',?,'zero-test',0,'TRY',?,'active',1,?,?,?,?,?,?,?)`,
        paymentId,
        owner.userId,
        owner.email,
        owner.displayName,
        x.business.slug,
        selectedPlan,
        JSON.stringify(x.business),
        stamp,
        stamp,
        stamp,
        stamp,
        paidUntil,
        x.idempotency_key,
        tenantId,
      ),
      q(
        "INSERT INTO payment_consents(id,payment_id,user_id,consent_type,document_version,accepted_at) VALUES(?,?,?,?,?,?)",
        uid(),
        paymentId,
        owner.userId,
        "subscription_terms",
        "2026-09-23",
        stamp,
      ),
      q(
        "INSERT INTO audit(id,user_id,action,target_id,created_at) VALUES(?,?,?,?,?)",
        uid(),
        owner.userId,
        "payment.zero-test.activated",
        tenantId,
        stamp,
      ),
    ]);
    return {
      active: true,
      tenant_id: tenantId,
      test_mode: true,
      zero_test_mode: true,
      amount: 0,
      plan: selectedPlan,
    };
  }

  if (
    !connection.configured ||
    !connection.enabled ||
    !connection.public_site ||
    !connection.seller_ready ||
    !origin ||
    !plan
  )
    throw new ApiError("iyzico abonelik hesabı henüz satışa açılmadı.", 503);
  if (!connection.live)
    throw new ApiError("Ödeme sağlayıcısı test aşamasında.", 403);
  if (x.campaign_code) {
    await quoteCampaign({
      code: x.campaign_code,
      plan: x.business.plan,
      originalAmount: plan.amount,
      businessId: null,
      userId: owner.userId,
      isFirstPayment: true,
      record: true,
    });
    throw new ApiError(
      "Kampanya doğrulandı; ancak mevcut iyzico abonelik planı sabit fiyatlıdır. İndirimli ilk tahsilat PayTR dinamik ödeme bağlantısı açıldığında kullanılabilir.",
      409,
    );
  }
  const verified = (
    await iyzico(
      "/v2/subscription/pricing-plans/" + encodeURIComponent(plan.reference),
    )
  ).data;
  if (
    !verified ||
    Math.round(Number(verified.price) * 100) !== plan.amount ||
    verified.currencyCode !== "TRY" ||
    verified.paymentInterval !== "MONTHLY" ||
    Number(verified.paymentIntervalCount || 1) !== 1 ||
    Number(verified.trialPeriodDays || 0) !== 0 ||
    Number(verified.recurrenceCount || 0) !== 0
  )
    throw new ApiError(
      "iyzico planı ile Neta fiyatı veya aylık dönem uyuşmuyor.",
      409,
    );
  const id = uid(),
    stamp = now(),
    expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  await db().batch([
    q(
      "INSERT INTO onboarding_payments(id,user_id,user_email,user_name,slug,provider,plan,plan_reference,amount,currency,payload,state,test_mode,created_at,updated_at,expires_at,idempotency_key) VALUES(?,?,?,?,?,'iyzico',?,?,?,'TRY',?,'pending_payment',?,?,?,?,?)",
      id,
      owner.userId,
      owner.email,
      owner.displayName,
      x.business.slug,
      plan.code,
      plan.reference,
      plan.amount,
      JSON.stringify(x.business),
      connection.live ? 0 : 1,
      stamp,
      stamp,
      expiresAt,
      x.idempotency_key,
    ),
    q(
      "INSERT INTO payment_consents(id,payment_id,user_id,consent_type,document_version,accepted_at) VALUES(?,?,?,?,?,?)",
      uid(),
      id,
      owner.userId,
      "subscription_terms",
      "2026-09-23",
      stamp,
    ),
    q(
      "INSERT INTO payment_consents(id,payment_id,user_id,consent_type,document_version,accepted_at) VALUES(?,?,?,?,?,?)",
      uid(),
      id,
      owner.userId,
      "iyzico_recurring_card",
      "iyzico-subscription-v1",
      stamp,
    ),
  ]);
  try {
    const result = await iyzico("/v2/subscription/checkoutform/initialize", {
      locale: "tr",
      conversationId: id,
      callbackUrl: origin + "/api/integrations/iyzico/onboarding-callback",
      pricingPlanReferenceCode: plan.reference,
      subscriptionInitialStatus: "ACTIVE",
      customer: {
        name: x.buyer.name,
        surname: x.buyer.surname,
        email: owner.email,
        gsmNumber: x.business.phone,
        identityNumber: x.buyer.identity,
        billingAddress: {
          address: x.business.address,
          contactName: x.buyer.name + " " + x.buyer.surname,
          city: x.buyer.city,
          country: "Turkey",
        },
      },
    });
    if (
      typeof result.token !== "string" ||
      result.token.length > 300 ||
      typeof result.checkoutFormContent !== "string" ||
      result.checkoutFormContent.length > 100000
    )
      throw new Error("INVALID_CHECKOUT");
    await q(
      "UPDATE onboarding_payments SET token_hash=?,state='payment_processing',updated_at=? WHERE id=? AND state='pending_payment'",
      await hash(result.token),
      now(),
      id,
    ).run();
    return {
      form: result.checkoutFormContent,
      test_mode: !connection.live,
      amount: plan.amount,
      payment_id: id,
    };
  } catch (e) {
    await q(
      "UPDATE onboarding_payments SET state='payment_failed',failure_reason='Ödeme sayfası hazırlanamadı.',failed_at=?,updated_at=? WHERE id=?",
      now(),
      now(),
      id,
    ).run();
    if (e instanceof ApiError) throw e;
    throw new ApiError(
      "Ödeme sayfası hazırlanamadı. İşletme oluşturulmadı.",
      503,
    );
  }
}

export async function onboardingPaymentCallback(req: Request) {
  const raw = await req.text();
  if (raw.length > 8000) throw new ApiError("INVALID_BODY", 413);
  const ps = new URLSearchParams(raw);
  if (ps.getAll("token").length !== 1) throw new ApiError("INVALID_TOKEN");
  const token = ps.get("token") || "";
  if (!token || token.length > 300) throw new ApiError("INVALID_TOKEN");
  const tokenHash = await hash(token),
    row = await one(
      "SELECT * FROM onboarding_payments WHERE token_hash=?",
      tokenHash,
    );
  if (!row) throw new ApiError("UNKNOWN_PAYMENT", 404);
  if (row.state === "active" && row.tenant_id)
    return redirect("/panel?tenant=" + encodeURIComponent(row.tenant_id));
  if (row.expires_at <= now()) {
    await q(
      "UPDATE onboarding_payments SET state='payment_failed',failure_reason='Ödeme oturumunun süresi doldu.',failed_at=?,updated_at=? WHERE id=? AND state='payment_processing'",
      now(),
      now(),
      row.id,
    ).run();
    return redirect("/odeme?durum=basarisiz");
  }
  let checkout: any;
  try {
    checkout = await iyzico(
      "/v2/subscription/checkoutform/" + encodeURIComponent(token),
    );
  } catch {
    await q(
      "UPDATE onboarding_payments SET state='payment_failed',failure_reason='Ödeme sağlayıcısı işlemi doğrulayamadı.',failed_at=?,updated_at=? WHERE id=?",
      now(),
      now(),
      row.id,
    ).run();
    return redirect("/odeme?durum=basarisiz");
  }
  const d = checkout.data;
  if (
    !d ||
    d.pricingPlanReferenceCode !== row.plan_reference ||
    !d.referenceCode ||
    !d.customerReferenceCode ||
    (checkout.conversationId && checkout.conversationId !== row.id)
  )
    throw new ApiError("PAYMENT_MISMATCH", 409);
  const reference = providerRef.parse(d.referenceCode),
    customerReference = providerRef.parse(d.customerReferenceCode),
    subscriptionResult = await iyzico(
      "/v2/subscription/subscriptions/" + encodeURIComponent(reference),
    ),
    subscription =
      subscriptionResult.data?.items?.find(
        (v: any) => v.referenceCode === reference,
      ) || subscriptionResult.data;
  if (
    !subscription ||
    subscription.referenceCode !== reference ||
    subscription.pricingPlanReferenceCode !== row.plan_reference ||
    subscription.customerReferenceCode !== customerReference
  )
    throw new ApiError("SUBSCRIPTION_MISMATCH", 409);
  const order = (subscription.orders || []).find(
    (v: any) => v.orderStatus === "SUCCESS",
  );
  if (
    !order ||
    order.currencyCode !== "TRY" ||
    Math.round(Number(order.price) * 100) !== row.amount
  ) {
    await q(
      "UPDATE onboarding_payments SET state='payment_failed',failure_reason='Başarılı tahsilat doğrulanamadı.',failed_at=?,updated_at=? WHERE id=?",
      now(),
      now(),
      row.id,
    ).run();
    return redirect("/odeme?durum=basarisiz");
  }
  const start = new Date(order.startPeriod),
    end = new Date(order.endPeriod);
  if (
    !Number.isFinite(+start) ||
    !Number.isFinite(+end) ||
    +end <= +start ||
    +end - +start > 32 * 86400000
  )
    throw new ApiError("PAYMENT_PERIOD_MISMATCH", 409);
  const payload = businessSchema.parse(JSON.parse(row.payload)),
    tenantId = uid(),
    owner = {
      userId: row.user_id,
      email: row.user_email,
      displayName: row.user_name,
    },
    created = await businessCreation(payload, owner, tenantId, false),
    stamp = now(),
    eventReference = providerRef.parse(order.referenceCode);
  const ops = [
    ...created.ops,
    q(
      "INSERT INTO recurring_subscriptions(tenant_id,reference,customer_reference,plan_reference,plan,amount,state,token_hash,request_id,test_mode,paid_until,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",
      tenantId,
      reference,
      customerReference,
      row.plan_reference,
      row.plan,
      row.amount,
      String(subscription.subscriptionStatus || "ACTIVE"),
      tokenHash,
      row.id,
      row.test_mode,
      end.toISOString(),
      stamp,
      stamp,
    ),
    q(
      "INSERT INTO recurring_events(reference,tenant_id,amount,period_start,period_end,test_mode,created_at) VALUES(?,?,?,?,?,?,?)",
      eventReference,
      tenantId,
      row.amount,
      start.toISOString(),
      end.toISOString(),
      row.test_mode,
      stamp,
    ),
    q(
      "UPDATE onboarding_payments SET state='active',reference=?,transaction_id=?,customer_reference=?,tenant_id=?,paid_at=?,account_activated_at=?,updated_at=? WHERE id=? AND state='payment_processing'",
      reference,
      eventReference,
      customerReference,
      tenantId,
      stamp,
      stamp,
      stamp,
      row.id,
    ),
    q(
      "INSERT INTO payment_events(id,provider,event_key,event_type,payment_id,processed_at,result) VALUES(?,?,?,?,?,?,?)",
      uid(),
      "iyzico",
      "checkout:" + eventReference,
      "subscription.order.success",
      row.id,
      stamp,
      "active",
    ),
    q(
      "INSERT INTO audit(id,user_id,action,target_id,created_at) VALUES(?,?,?,?,?)",
      uid(),
      row.user_id,
      "payment.account.activated",
      tenantId,
      stamp,
    ),
  ];
  if (!row.test_mode)
    ops.push(
      q(
        "INSERT INTO subscriptions(tenant_id,paid_until,updated_at) VALUES(?,?,?)",
        tenantId,
        end.toISOString(),
        stamp,
      ),
    );
  await db().batch(ops);
  return redirect(
    "/panel?tenant=" + encodeURIComponent(tenantId) + "&odeme=basarili",
  );
}

export async function paymentHistory() {
  const u = await user();
  return all(
    "SELECT id,provider,plan,amount,currency,state,reference,transaction_id,failure_reason,created_at,updated_at,paid_at,refunded_at FROM onboarding_payments WHERE user_id=? ORDER BY created_at DESC LIMIT 50",
    u.userId,
  );
}
