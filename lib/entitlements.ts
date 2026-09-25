import { one, q, hash, now, ApiError } from "./server";

export type PlanCode = "normal" | "pro" | "plus";

/**
 * Neta paketlerinin kullanım sınırları. Hiçbir paket sınırsız dış sağlayıcı
 * kullanımı vaat etmez; sağlayıcı maliyeti ve kötüye kullanım kontrolü bu
 * sayaçlarla sunucu tarafında uygulanır. Demo işletmeler ayrı tutulur ve
 * satış sunumu/testi için Neta içi kota engeline takılmaz.
 */
export const PLAN_LIMITS: Record<
  PlanCode,
  {
    whatsappMonthly: number;
    aiDaily: number;
    label: string;
    branches: number | null;
    staff: number | null;
    advancedReports: boolean;
    modules: Record<
      | "receivables"
      | "journeys"
      | "growth"
      | "recovery"
      | "demand"
      | "serviceReport"
      | "revenueReport"
      | "branchProfit"
      | "whatsapp"
      | "accounting"
      | "referral"
      | "website",
      boolean
    >;
  }
> = {
  normal: {
    whatsappMonthly: 0,
    aiDaily: 0,
    label: "Standart",
    branches: 1,
    staff: 5,
    advancedReports: false,
    modules: {
      receivables: false,
      journeys: false,
      growth: false,
      recovery: false,
      demand: false,
      serviceReport: true,
      revenueReport: false,
      branchProfit: false,
      whatsapp: false,
      accounting: false,
      referral: false,
      website: false,
    },
  },
  pro: {
    whatsappMonthly: 1000,
    aiDaily: 50,
    label: "Pro",
    branches: 3,
    staff: null,
    advancedReports: false,
    modules: {
      receivables: true,
      journeys: true,
      growth: true,
      recovery: true,
      demand: true,
      serviceReport: true,
      revenueReport: true,
      branchProfit: true,
      whatsapp: true,
      accounting: false,
      referral: false,
      website: false,
    },
  },
  plus: {
    whatsappMonthly: 5000,
    aiDaily: 200,
    label: "Plus",
    branches: null,
    staff: null,
    advancedReports: true,
    modules: {
      receivables: true,
      journeys: true,
      growth: true,
      recovery: true,
      demand: true,
      serviceReport: true,
      revenueReport: true,
      branchProfit: true,
      whatsapp: true,
      accounting: true,
      referral: true,
      website: true,
    },
  },
};

export type PlanModule =
  | "receivables"
  | "journeys"
  | "growth"
  | "recovery"
  | "demand"
  | "serviceReport"
  | "revenueReport"
  | "branchProfit"
  | "whatsapp"
  | "accounting"
  | "referral"
  | "website";

/** Sunucu tarafı modül kilidi: paketin izin vermediği özellik 402 döner. */
export async function requirePlanModule(
  tenantId: string,
  module: PlanModule,
) {
  const plan = await tenantPlan(tenantId);
  if (!PLAN_LIMITS[plan].modules[module])
    throw new ApiError(
      PLAN_LIMITS[plan].label +
        " paketi " +
        MODULE_LABELS[module] +
        " özelliğini içermez. Paketinizi yükseltin.",
      402,
    );
  return plan;
}

export const MODULE_LABELS: Record<PlanModule, string> = {
  receivables: "Borç / Veresiye takibi",
  journeys: "Hizmet yolculuğu",
  growth: "Pazarlama ve büyüme",
  recovery: "Gelir kurtarma",
  demand: "Talep fırsatları",
  serviceReport: "İşlem analizi",
  revenueReport: "Gelir raporu",
  branchProfit: "Şube kârlılığı",
  whatsapp: "WhatsApp kurulumu",
  accounting: "Muhasebe gider kataloğu",
  referral: "Neta ortaklık programı",
  website: "İşletme web sitesi",
};

export const PLAN_CATALOG: Record<
  PlanCode,
  {
    name: string;
    amount: number;
    limits: { whatsappMonthly: number; aiDaily: number };
  }
> = {
  normal: { name: "Neta Standart", amount: 60000, limits: PLAN_LIMITS.normal },
  pro: { name: "Neta Pro", amount: 99900, limits: PLAN_LIMITS.pro },
  plus: { name: "Neta Plus", amount: 250000, limits: PLAN_LIMITS.plus },
};

export async function tenantPlan(tenantId: string): Promise<PlanCode> {
  const business = await one(
    "SELECT demo FROM businesses WHERE id=?",
    tenantId,
  );
  if (Number(business?.demo) === 1) return "plus";

  const recurring = await one(
    "SELECT plan,state,test_mode,paid_until FROM recurring_subscriptions WHERE tenant_id=?",
    tenantId,
  );
  if (recurring && ["normal", "pro", "plus"].includes(recurring.plan)) {
    const paid =
        typeof recurring.paid_until === "string" && recurring.paid_until > now(),
      test =
        Number(recurring.test_mode) === 1 &&
        ["ACTIVE", "PENDING", "UPGRADED"].includes(String(recurring.state));
    if (paid || test) return recurring.plan as PlanCode;
  }

  const manual = await one(
    "SELECT plan,paid_until FROM subscriptions WHERE tenant_id=? AND paid_until>?",
    tenantId,
    now(),
  );
  if (manual && ["normal", "pro", "plus"].includes(manual.plan))
    return manual.plan as PlanCode;
  return "normal";
}

function windowFor(feature: "whatsapp" | "ai") {
  const d = new Date();
  if (feature === "ai") {
    const end = new Date(d);
    end.setUTCHours(24, 0, 0, 0);
    return { bucket: d.toISOString().slice(0, 10), expires: end.getTime() };
  }
  const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
  return { bucket: d.toISOString().slice(0, 7), expires: end.getTime() };
}

/** Atomic, tenant-scoped quota reservation. A failed provider call still
 * consumes the attempt, preventing retry storms and unexpected overage.
 * Demo tenantleri yalnız satış sunumu ve test içindir; Neta içi sayaçlardan
 * muaftır. Dış sağlayıcı gerçekten bağlıysa onun kendi maliyet/limitleri sürer. */
export async function consumePlanQuota(
  tenantId: string,
  feature: "whatsapp" | "ai",
) {
  const business = await one("SELECT demo FROM businesses WHERE id=?", tenantId);
  if (Number(business?.demo) === 1)
    return {
      plan: "plus" as PlanCode,
      limit: Number.MAX_SAFE_INTEGER,
      used: 0,
      unlimitedDemo: true,
    };

  const plan = await tenantPlan(tenantId),
    limit = PLAN_LIMITS[plan][feature === "ai" ? "aiDaily" : "whatsappMonthly"],
    window = windowFor(feature),
    key = await hash(`plan-quota:${tenantId}:${feature}:${window.bucket}`);
  const row = await one(
    "INSERT INTO rate_limits(key,count,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1,expires_at=excluded.expires_at RETURNING count",
    key,
    window.expires,
  );
  if (Number(row?.count || 0) > limit) {
    await q(
      "UPDATE rate_limits SET count=CASE WHEN count>0 THEN count-1 ELSE 0 END WHERE key=?",
      key,
    ).run();
    const label = feature === "ai" ? "AI yardım" : "WhatsApp";
    throw new ApiError(
      `${PLAN_LIMITS[plan].label} paketinin ${label} kullanım kotası doldu. Paketinizi yükseltin veya sonraki dönemi bekleyin.`,
      429,
    );
  }
  return { plan, limit, used: Number(row.count) };
}
