import { env } from "cloudflare:workers";
import { z } from "zod";
import {
  ApiError,
  admin,
  all,
  db,
  now,
  one,
  q,
  tenant,
  uid,
  user,
} from "./server";
import { PLAN_CATALOG, type PlanCode } from "./entitlements";

const planCode = z.enum(["normal", "pro", "plus"]);
const campaignCode = z
  .string()
  .trim()
  .min(3)
  .max(32)
  .transform((value) => value.toLocaleUpperCase("tr-TR"))
  .refine((value) => /^[A-Z0-9][A-Z0-9_-]*$/.test(value), {
    message: "Kampanya kodu yalnızca harf, rakam, tire ve alt çizgi içerebilir.",
  });
const campaignForm = z
  .object({
    id: z.string().min(1).optional(),
    name: z.string().trim().min(2).max(120),
    code: campaignCode,
    description: z.string().trim().max(500).default(""),
    discount_type: z.enum(["percentage", "fixed"]),
    discount_value: z.number().int().positive().max(100000000),
    target_type: z.enum(["all", "new", "selected", "plan"]),
    applicable_plans: z.array(planCode).min(1).max(3),
    starts_at: z.string().datetime(),
    ends_at: z.string().datetime(),
    total_usage_limit: z.number().int().positive().max(1000000).nullable(),
    per_business_limit: z.number().int().positive().max(10000).nullable(),
    first_payment_only: z.boolean(),
    recurring_enabled: z.boolean(),
    active: z.boolean(),
    business_ids: z.array(z.string().min(1)).max(500).default([]),
  })
  .superRefine((value, context) => {
    if (value.starts_at >= value.ends_at)
      context.addIssue({
        code: "custom",
        path: ["ends_at"],
        message: "Bitiş tarihi başlangıç tarihinden sonra olmalıdır.",
      });
    if (value.discount_type === "percentage" && value.discount_value > 10000)
      context.addIssue({
        code: "custom",
        path: ["discount_value"],
        message: "Yüzdelik indirim %100'ü aşamaz.",
      });
    if (value.target_type === "selected" && !value.business_ids.length)
      context.addIssue({
        code: "custom",
        path: ["business_ids"],
        message: "En az bir işletme seçin.",
      });
    if (value.first_payment_only && value.recurring_enabled)
      context.addIssue({
        code: "custom",
        path: ["recurring_enabled"],
        message: "İlk ödeme kampanyası aylık yenilemelerde kullanılamaz.",
      });
  });

export type CampaignQuote = {
  campaign_id: string;
  campaign_name: string;
  code: string;
  description: string;
  original_amount: number;
  discount_amount: number;
  final_amount: number;
  starts_at: string;
  ends_at: string;
  first_payment_only: boolean;
  recurring_enabled: boolean;
  plan: PlanCode;
  checkout_supported: boolean;
  provider_note: string;
};

type CampaignRow = {
  id: string;
  name: string;
  code: string;
  description: string;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  target_type: "all" | "new" | "selected" | "plan";
  applicable_plans: string;
  starts_at: string;
  ends_at: string;
  total_usage_limit: number | null;
  per_business_limit: number | null;
  first_payment_only: number;
  recurring_enabled: number;
  active: number;
};

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Kampanya reddedildi.";

function parsePlans(value: string): PlanCode[] {
  try {
    return z.array(planCode).parse(JSON.parse(value));
  } catch {
    return [];
  }
}

function computeDiscount(row: CampaignRow, amount: number) {
  const raw =
    row.discount_type === "percentage"
      ? Math.floor((amount * Number(row.discount_value)) / 10000)
      : Number(row.discount_value);
  const discount = Math.min(Math.max(raw, 1), amount - 100);
  if (discount <= 0 || amount - discount < 100)
    throw new ApiError("Bu kampanya minimum tahsilat kuralını karşılamıyor.", 409);
  return discount;
}

async function firstPaymentFor(businessId: string | null, userId: string) {
  if (businessId)
    return !(
      await one(
        "SELECT 1 ok FROM recurring_events WHERE tenant_id=? AND test_mode=0 UNION ALL SELECT 1 FROM billing_grants WHERE tenant_id=? LIMIT 1",
        businessId,
        businessId,
      )
    );
  return !(
    await one(
      "SELECT 1 ok FROM onboarding_payments WHERE user_id=? AND state='active' AND test_mode=0 LIMIT 1",
      userId,
    )
  );
}

async function recordAttempt(input: {
  campaignId?: string;
  businessId?: string | null;
  userId: string;
  code: string;
  plan: string;
  status: string;
  reason?: string;
}) {
  await q(
    "INSERT INTO campaign_attempts(id,campaign_id,business_id,user_id,code,plan,status,reason,created_at) VALUES(?,?,?,?,?,?,?,?,?)",
    uid(),
    input.campaignId || null,
    input.businessId || null,
    input.userId,
    input.code.slice(0, 32),
    input.plan,
    input.status,
    (input.reason || "").slice(0, 240),
    now(),
  ).run();
}

export async function quoteCampaign(input: {
  code: unknown;
  plan: unknown;
  originalAmount: number;
  businessId?: string | null;
  userId: string;
  isFirstPayment?: boolean;
  record?: boolean;
}): Promise<CampaignQuote> {
  const code = campaignCode.parse(input.code),
    plan = planCode.parse(input.plan),
    businessId = input.businessId || null,
    stamp = now();
  let row: CampaignRow | null = null;
  try {
    row = (await one(
      "SELECT * FROM campaigns WHERE code=? COLLATE NOCASE AND deleted_at IS NULL",
      code,
    )) as CampaignRow | null;
    if (!row) throw new ApiError("Kampanya kodu geçersiz.", 404);
    if (!row.active) throw new ApiError("Bu kampanya aktif değil.", 409);
    if (row.starts_at > stamp) throw new ApiError("Kampanya henüz başlamadı.", 409);
    if (row.ends_at < stamp) throw new ApiError("Kampanyanın süresi doldu.", 409);
    if (!parsePlans(row.applicable_plans).includes(plan))
      throw new ApiError("Bu kampanya seçilen pakette geçerli değil.", 409);
    const isFirst =
      input.isFirstPayment ?? (await firstPaymentFor(businessId, input.userId));
    if (row.first_payment_only && !isFirst)
      throw new ApiError("Bu kampanya yalnızca ilk abonelik ödemesinde geçerli.", 409);
    if (!isFirst && !row.recurring_enabled)
      throw new ApiError("Bu kampanya aylık yenilemelerde geçerli değil.", 409);
    if (row.target_type === "new" && !isFirst)
      throw new ApiError("Bu kampanya yalnızca yeni işletmelere özel.", 403);
    if (row.target_type === "selected") {
      if (
        !businessId ||
        !(await one(
          "SELECT 1 ok FROM campaign_businesses WHERE campaign_id=? AND business_id=?",
          row.id,
          businessId,
        ))
      )
        throw new ApiError("Bu kampanya işletmenize tanımlı değil.", 403);
    }
    const used = await one(
      "SELECT COUNT(*) total,SUM(CASE WHEN business_id=? OR (business_id IS NULL AND user_id=?) THEN 1 ELSE 0 END) subject FROM campaign_redemptions WHERE campaign_id=? AND status IN ('reserved','succeeded')",
      businessId,
      input.userId,
      row.id,
    );
    if (row.total_usage_limit && used.total >= row.total_usage_limit)
      throw new ApiError("Kampanyanın toplam kullanım limiti doldu.", 409);
    if (row.per_business_limit && used.subject >= row.per_business_limit)
      throw new ApiError("İşletmeniz bu kampanyanın kullanım limitine ulaştı.", 409);
    if (!Number.isInteger(input.originalAmount) || input.originalAmount < 100)
      throw new ApiError("Paket fiyatı doğrulanamadı.", 409);
    const discount = computeDiscount(row, input.originalAmount);
    const paytrReady = !!(
      (env as unknown as Record<string, string | undefined>).PAYTR_MERCHANT_ID &&
      (env as unknown as Record<string, string | undefined>).PAYTR_MERCHANT_KEY &&
      (env as unknown as Record<string, string | undefined>).PAYTR_MERCHANT_SALT &&
      (env as unknown as Record<string, string | undefined>).PUBLIC_SITE_READY === "true"
    );
    if (input.record)
      await recordAttempt({
        campaignId: row.id,
        businessId,
        userId: input.userId,
        code,
        plan,
        status: "eligible",
      });
    return {
      campaign_id: row.id,
      campaign_name: row.name,
      code: row.code,
      description: row.description,
      original_amount: input.originalAmount,
      discount_amount: discount,
      final_amount: input.originalAmount - discount,
      starts_at: row.starts_at,
      ends_at: row.ends_at,
      first_payment_only: !!row.first_payment_only,
      recurring_enabled: !!row.recurring_enabled,
      plan,
      checkout_supported: !!businessId && paytrReady,
      provider_note:
        businessId && paytrReady
          ? "İndirim PayTR tahsilat tutarına sunucu tarafından uygulanır."
          : "İndirim doğrulandı. Gerçek tahsilat için dinamik tutarı destekleyen PayTR bağlantısı açılmalıdır.",
    };
  } catch (error: unknown) {
    if (input.record)
      await recordAttempt({
        campaignId: row?.id,
        businessId,
        userId: input.userId,
        code,
        plan,
        status: "rejected",
        reason: errorMessage(error),
      });
    throw error;
  }
}

export async function campaignPreview(search: URLSearchParams) {
  const actor = await user(),
    requestedPlan = planCode.parse(search.get("plan")),
    tenantId = search.get("tenant"),
    business = tenantId ? await tenant(tenantId) : null,
    plan = business
      ? planCode.catch("normal").parse(business.selected_plan)
      : requestedPlan,
    legacyPlan = business
      ? await one("SELECT amount,active FROM billing_settings WHERE id=1")
      : null,
    amount =
      business && legacyPlan?.active && legacyPlan.amount
        ? Number(legacyPlan.amount)
        : PLAN_CATALOG[plan].amount;
  return quoteCampaign({
    code: search.get("code"),
    plan,
    originalAmount: amount,
    businessId: business?.id || null,
    userId: actor.userId,
    record: true,
  });
}

export async function reserveCampaign(input: {
  quote: CampaignQuote;
  paymentId: string;
  businessId: string | null;
  userId: string;
  subscriptionId?: string | null;
  isFirstPayment: boolean;
}) {
  const stamp = now(),
    result = await q(
      `INSERT INTO campaign_redemptions(id,campaign_id,business_id,user_id,subscription_id,payment_id,plan,original_amount,discount_amount,final_amount,status,created_at,updated_at)
       SELECT ?,c.id,?,?,?,?,?,?,?,?,'reserved',?,? FROM campaigns c
       WHERE c.id=? AND c.active=1 AND c.deleted_at IS NULL AND c.starts_at<=? AND c.ends_at>=?
       AND instr(c.applicable_plans,?)>0
       AND (c.target_type!='selected' OR EXISTS(SELECT 1 FROM campaign_businesses cb WHERE cb.campaign_id=c.id AND cb.business_id=?))
       AND (c.target_type!='new' OR ?=1)
       AND (c.first_payment_only=0 OR ?=1)
       AND (?=1 OR c.recurring_enabled=1)
       AND (c.total_usage_limit IS NULL OR (SELECT COUNT(*) FROM campaign_redemptions r WHERE r.campaign_id=c.id AND r.status IN ('reserved','succeeded'))<c.total_usage_limit)
       AND (c.per_business_limit IS NULL OR (SELECT COUNT(*) FROM campaign_redemptions r WHERE r.campaign_id=c.id AND r.status IN ('reserved','succeeded') AND (r.business_id=? OR (r.business_id IS NULL AND r.user_id=?)))<c.per_business_limit)`,
      uid(),
      input.businessId,
      input.userId,
      input.subscriptionId || null,
      input.paymentId,
      input.quote.plan,
      input.quote.original_amount,
      input.quote.discount_amount,
      input.quote.final_amount,
      stamp,
      stamp,
      input.quote.campaign_id,
      stamp,
      stamp,
      `"${input.quote.plan}"`,
      input.businessId,
      input.isFirstPayment ? 1 : 0,
      input.isFirstPayment ? 1 : 0,
      input.isFirstPayment ? 1 : 0,
      input.businessId,
      input.userId,
    ).run();
  if (!result.meta.changes)
    throw new ApiError(
      "Kampanya limiti veya uygunluk durumu değişti. Kodu yeniden doğrulayın.",
      409,
    );
}

export async function finalizeCampaignRedemption(
  paymentId: string,
  success: boolean,
  businessId?: string | null,
  subscriptionId?: string | null,
  reason = "",
) {
  const stamp = now();
  await q(
    `UPDATE campaign_redemptions SET status=?,business_id=COALESCE(business_id,?),subscription_id=COALESCE(subscription_id,?),failure_reason=?,redeemed_at=CASE WHEN ? THEN COALESCE(redeemed_at,?) ELSE redeemed_at END,updated_at=?
     WHERE payment_id=? AND status='reserved'`,
    success ? "succeeded" : "failed",
    businessId || null,
    subscriptionId || null,
    success ? "" : reason.slice(0, 240),
    success ? 1 : 0,
    stamp,
    stamp,
    paymentId,
  ).run();
}

export async function platformCampaigns() {
  await admin();
  const campaigns = await all(
    `SELECT c.*,
      (SELECT COUNT(*) FROM campaign_businesses cb WHERE cb.campaign_id=c.id) selected_businesses,
      (SELECT COUNT(*) FROM campaign_redemptions r WHERE r.campaign_id=c.id AND r.status='succeeded') usage_count,
      (SELECT COUNT(DISTINCT COALESCE(r.business_id,r.user_id)) FROM campaign_redemptions r WHERE r.campaign_id=c.id AND r.status='succeeded') acquired_businesses,
      (SELECT COALESCE(SUM(r.discount_amount),0) FROM campaign_redemptions r WHERE r.campaign_id=c.id AND r.status='succeeded') total_discount,
      (SELECT COALESCE(SUM(r.final_amount),0) FROM campaign_redemptions r WHERE r.campaign_id=c.id AND r.status='succeeded') net_revenue,
      (SELECT r.plan FROM campaign_redemptions r WHERE r.campaign_id=c.id AND r.status='succeeded' GROUP BY r.plan ORDER BY COUNT(*) DESC,r.plan LIMIT 1) top_plan,
      (SELECT COUNT(*) FROM campaign_attempts a WHERE a.campaign_id=c.id AND a.status='rejected') failed_attempts
     FROM campaigns c ORDER BY c.created_at DESC LIMIT 500`,
  );
  return {
    campaigns: campaigns.map((campaign) => ({
      ...campaign,
      applicable_plans: parsePlans(campaign.applicable_plans),
      business_ids: [],
    })),
    assignments: await all(
      "SELECT campaign_id,business_id FROM campaign_businesses ORDER BY created_at",
    ),
    businesses: await all(
      `SELECT b.id,b.name,
        COALESCE((SELECT m.name FROM members m WHERE m.tenant_id=b.id AND m.role='owner' ORDER BY m.user_id LIMIT 1),'') owner_name,
        COALESCE((SELECT m.email FROM members m WHERE m.tenant_id=b.id AND m.role='owner' ORDER BY m.user_id LIMIT 1),'') owner_email,
        b.selected_plan current_plan,
        COALESCE((SELECT rs.state FROM recurring_subscriptions rs WHERE rs.tenant_id=b.id),b.status) subscription_status,
        1 branch_count
       FROM businesses b WHERE b.demo=0 AND b.status!='deleted' ORDER BY b.name LIMIT 1000`,
    ),
    redemptions: await all(
      `SELECT r.*,c.name campaign_name,c.code campaign_code,b.name business_name
       FROM campaign_redemptions r JOIN campaigns c ON c.id=r.campaign_id
       LEFT JOIN businesses b ON b.id=r.business_id ORDER BY r.created_at DESC LIMIT 500`,
    ),
    daily: await all(
      `SELECT substr(redeemed_at,1,10) day,COUNT(*) uses,SUM(discount_amount) discount,SUM(final_amount) revenue
       FROM campaign_redemptions WHERE status='succeeded' AND redeemed_at IS NOT NULL
       GROUP BY substr(redeemed_at,1,10) ORDER BY day DESC LIMIT 90`,
    ),
  };
}

export async function campaignOperation(input: unknown) {
  const actor = await admin(),
    action = z
      .object({ action: z.enum(["create", "update", "toggle", "delete"]) })
      .passthrough()
      .parse(input).action,
    stamp = now();
  if (action === "toggle" || action === "delete") {
    const x = z
      .object({
        action: z.enum(["toggle", "delete"]),
        id: z.string().min(1),
        active: z.boolean().optional(),
      })
      .parse(input);
    const existing = await one("SELECT id FROM campaigns WHERE id=?", x.id);
    if (!existing) throw new ApiError("Kampanya bulunamadı.", 404);
    await db().batch([
      q(
        action === "delete"
          ? "UPDATE campaigns SET active=0,deleted_at=?,updated_at=? WHERE id=? AND deleted_at IS NULL"
          : "UPDATE campaigns SET active=?,updated_at=? WHERE id=? AND deleted_at IS NULL",
        ...(action === "delete"
          ? [stamp, stamp, x.id]
          : [x.active ? 1 : 0, stamp, x.id]),
      ),
      q(
        "INSERT INTO audit(id,user_id,action,target_id,created_at) VALUES(?,?,?,?,?)",
        uid(),
        actor.userId,
        `campaign.${action}`,
        x.id,
        stamp,
      ),
    ]);
    return { ok: true };
  }
  const form = campaignForm.parse(input),
    id = action === "create" ? uid() : z.string().min(1).parse(form.id),
    unique = await one(
      "SELECT id FROM campaigns WHERE code=? COLLATE NOCASE AND id!=?",
      form.code,
      id,
    );
  if (unique) throw new ApiError("Bu kampanya kodu kullanımda.", 409);
  if (form.target_type === "selected") {
    const placeholders = form.business_ids.map(() => "?").join(",");
    const count = await one(
      `SELECT COUNT(*) n FROM businesses WHERE id IN (${placeholders}) AND demo=0 AND status!='deleted'`,
      ...form.business_ids,
    );
    if (count.n !== new Set(form.business_ids).size)
      throw new ApiError("Seçilen işletmelerden biri geçersiz.", 409);
  }
  const operations: ReturnType<typeof q>[] = [];
  if (action === "create")
    operations.push(
      q(
        `INSERT INTO campaigns(id,name,code,description,discount_type,discount_value,target_type,applicable_plans,starts_at,ends_at,total_usage_limit,per_business_limit,first_payment_only,recurring_enabled,active,created_by,created_at,updated_at)
         VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        id,
        form.name,
        form.code,
        form.description,
        form.discount_type,
        form.discount_value,
        form.target_type,
        JSON.stringify(form.applicable_plans),
        form.starts_at,
        form.ends_at,
        form.total_usage_limit,
        form.per_business_limit,
        form.first_payment_only ? 1 : 0,
        form.recurring_enabled ? 1 : 0,
        form.active ? 1 : 0,
        actor.userId,
        stamp,
        stamp,
      ),
    );
  else {
    if (!(await one("SELECT id FROM campaigns WHERE id=? AND deleted_at IS NULL", id)))
      throw new ApiError("Kampanya bulunamadı.", 404);
    operations.push(
      q(
        `UPDATE campaigns SET name=?,code=?,description=?,discount_type=?,discount_value=?,target_type=?,applicable_plans=?,starts_at=?,ends_at=?,total_usage_limit=?,per_business_limit=?,first_payment_only=?,recurring_enabled=?,active=?,updated_at=? WHERE id=?`,
        form.name,
        form.code,
        form.description,
        form.discount_type,
        form.discount_value,
        form.target_type,
        JSON.stringify(form.applicable_plans),
        form.starts_at,
        form.ends_at,
        form.total_usage_limit,
        form.per_business_limit,
        form.first_payment_only ? 1 : 0,
        form.recurring_enabled ? 1 : 0,
        form.active ? 1 : 0,
        stamp,
        id,
      ),
      q("DELETE FROM campaign_businesses WHERE campaign_id=?", id),
    );
  }
  if (form.target_type === "selected")
    for (const businessId of new Set(form.business_ids))
      operations.push(
        q(
          "INSERT INTO campaign_businesses(id,campaign_id,business_id,created_at) VALUES(?,?,?,?)",
          uid(),
          id,
          businessId,
          stamp,
        ),
      );
  operations.push(
    q(
      "INSERT INTO audit(id,user_id,action,target_id,created_at) VALUES(?,?,?,?,?)",
      uid(),
      actor.userId,
      `campaign.${action}`,
      id,
      stamp,
    ),
  );
  await db().batch(operations);
  return { ok: true, id };
}
