import { env } from "cloudflare:workers";
import { z } from "zod";
import { tenant, user, admin, all, one, q, db, now, uid, ApiError } from "./server";
import { today, addDays } from "./types";
import { requirePlanModule, tenantPlan, PLAN_LIMITS } from "./entitlements";

const cfg = () => env as any;
const referralProgramEnabled = () => cfg().REFERRAL_PROGRAM_ENABLED !== "false";

export const defaultGrowth = {
  theme: "auto",
  hide_brand: 0,
  autopilot: 0,
  recall_days: 30,
  welcome: "Merhaba! Randevu almak istediğiniz hizmeti ve günü yazabilirsiniz.",
};
export const REFERRAL_REWARD = 20000;
export const REFERRAL_POINTS = 200;
const referralCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9-]{6,24}$/, "Geçerli bir davet kodu girin.");

export function makeReferralCode(id: string) {
  return "NETA" + id.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8).toUpperCase();
}

export async function referralPreview(value: unknown) {
  if (!referralProgramEnabled())
    throw new ApiError("Davet programı şu anda kapalı.", 409);
  const code = referralCodeSchema.parse(value);
  const b = await one(
    "SELECT name FROM businesses WHERE invite_code=? AND status='approved' AND demo=0",
    code,
  );
  if (!b)
    throw new ApiError("Davet kodu bulunamadı veya artık aktif değil.", 404);
  return { valid: true, business_name: b.name, code };
}

export async function hasPremium(id: string) {
  return (await tenantPlan(id)) !== "normal";
}

export async function publicStyle(id: string) {
  const g = await one(
    "SELECT theme,hide_brand FROM growth_settings WHERE tenant_id=?",
    id,
  );
  return {
    theme: g?.theme || "auto",
    hide_brand: !!g?.hide_brand && (await hasPremium(id)),
  };
}

export async function recallCandidates(id: string, days: number) {
  return all(
    `SELECT c.id,c.name,c.phone,MAX(a.date) last_visit FROM customers c JOIN appointments a ON a.tenant_id=c.tenant_id AND a.customer_id=c.id WHERE c.tenant_id=? AND c.consent=1 AND a.status='completed' AND NOT EXISTS(SELECT 1 FROM appointments f WHERE f.tenant_id=c.tenant_id AND f.customer_id=c.id AND f.status='confirmed' AND f.date>=?) GROUP BY c.id HAVING MAX(a.date)<=? ORDER BY last_visit LIMIT 100`,
    id,
    today(),
    addDays(today(), -days),
  );
}

async function backfillReferralsForReferrer(id: string, inviteCode: string) {
  if (!referralProgramEnabled()) return;

  // Payment-first onboarding stores the complete server-validated business payload.
  // Older production signups could lose the browser referral state before the
  // referrals row was written. Recover those rows from the persisted payload so
  // already-tested invitations are not lost.
  const candidates = await all(
    `SELECT p.tenant_id,p.user_id,p.created_at
     FROM onboarding_payments p
     JOIN businesses b ON b.id=p.tenant_id
     WHERE p.tenant_id IS NOT NULL
       AND b.demo=0
       AND json_valid(p.payload)=1
       AND upper(COALESCE(json_extract(p.payload,'$.ref'),''))=?
       AND NOT EXISTS(
         SELECT 1 FROM members self
         WHERE self.tenant_id=? AND self.user_id=p.user_id
       )
     ORDER BY p.created_at ASC
     LIMIT 100`,
    inviteCode,
    id,
  );

  for (const row of candidates) {
    if (!row.tenant_id || !row.user_id) continue;
    await q(
      `INSERT INTO referrals(referred_tenant,referrer_tenant,owner_id,status,reward,created_at)
       VALUES(?,?,?,'pending',?,?)
       ON CONFLICT DO NOTHING`,
      String(row.tenant_id),
      id,
      String(row.user_id),
      REFERRAL_REWARD,
      String(row.created_at || now()),
    ).run();
  }
}

async function reconcileReferralsForReferrer(id: string) {
  if (!referralProgramEnabled()) return;
  const pending = await all(
    "SELECT referred_tenant FROM referrals WHERE referrer_tenant=? AND status='pending' ORDER BY created_at ASC LIMIT 100",
    id,
  );
  for (const row of pending)
    await approveReferral(String(row.referred_tenant || ""));
}

async function referralData(id: string) {
  const b = await tenant(id),
    plan = await tenantPlan(id);
  const inviteCode = b.invite_code || makeReferralCode(b.id);
  if (!b.invite_code)
    await q(
      "UPDATE businesses SET invite_code=? WHERE id=? AND invite_code IS NULL",
      inviteCode,
      id,
    ).run();

  await backfillReferralsForReferrer(id, inviteCode);
  await reconcileReferralsForReferrer(id);

  return {
    referral_enabled: referralProgramEnabled(),
    referral_allowed: PLAN_LIMITS[plan].modules.referral,
    referral_reward: REFERRAL_REWARD,
    referral_points: REFERRAL_POINTS,
    referral_code: inviteCode,
    referrals: await all(
      "SELECT status,reward,created_at FROM referrals WHERE referrer_tenant=? ORDER BY created_at DESC LIMIT 100",
      id,
    ),
    balance: (
      await one(
        "SELECT COALESCE(SUM(amount),0) balance FROM credit_ledger WHERE tenant_id=?",
        id,
      )
    ).balance,
    ledger: await all(
      "SELECT amount,kind,description,created_at FROM credit_ledger WHERE tenant_id=? ORDER BY created_at DESC LIMIT 100",
      id,
    ),
  };
}

export async function referralSnapshot(id: string) {
  await requirePlanModule(id, "referral");
  return referralData(id);
}

export async function growthSnapshot(id: string) {
  await requirePlanModule(id, "growth");
  const b = await tenant(id),
    g =
      (await one("SELECT * FROM growth_settings WHERE tenant_id=?", id)) ||
      defaultGrowth;
  return {
    settings: g,
    premium: await hasPremium(id),
    ...(await referralData(id)),
    candidates: await recallCandidates(id, g.recall_days),
    recalls: await all(
      "SELECT status,created_at FROM recall_jobs WHERE tenant_id=? ORDER BY created_at DESC LIMIT 100",
      id,
    ),
    booking_path: "/" + b.slug,
    public_site: cfg().PUBLIC_SITE_READY === "true",
  };
}

export async function saveGrowth(id: string, input: any) {
  await requirePlanModule(id, "growth");
  const x = z
    .object({
      theme: z.enum(["auto", "salon", "consulting", "fitness"]),
      hide_brand: z.boolean(),
      autopilot: z.boolean(),
      recall_days: z.number().int().min(7).max(365),
      welcome: z.string().trim().min(10).max(500),
    })
    .parse(input);
  if (x.hide_brand && !(await hasPremium(id)))
    throw new ApiError(
      "Marka gizlemek için aktif Pro veya Plus aboneliği gerekir.",
      402,
    );
  if (x.autopilot) {
    const { waConnection } = await import("./whatsapp");
    const c = waConnection(id);
    if (
      !c ||
      !c.recall_template ||
      cfg().RECALL_SCHEDULER_READY !== "true" ||
      cfg().PUBLIC_SITE_READY !== "true"
    )
      throw new ApiError(
        "Önce WhatsApp numarası, onaylı mesaj şablonu ve günlük otomasyon bağlantısı tamamlanmalı.",
        409,
      );
  }
  await q(
    "INSERT INTO growth_settings(tenant_id,theme,hide_brand,autopilot,recall_days,welcome,updated_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(tenant_id) DO UPDATE SET theme=excluded.theme,hide_brand=excluded.hide_brand,autopilot=excluded.autopilot,recall_days=excluded.recall_days,welcome=excluded.welcome,updated_at=excluded.updated_at",
    id,
    x.theme,
    +x.hide_brand,
    +x.autopilot,
    x.recall_days,
    x.welcome,
    now(),
  ).run();
  return { ok: true };
}

export async function referralOperation(
  newId: string,
  owner: string,
  value: unknown,
) {
  if (typeof value !== "string" || !value.trim()) return null;
  if (!referralProgramEnabled())
    throw new ApiError("Davet programı şu anda kapalı.", 409);
  let code: string;
  try {
    code = referralCodeSchema.parse(value);
  } catch {
    throw new ApiError("Davet kodu biçimi geçersiz.", 400);
  }
  const b = await one(
    "SELECT id FROM businesses WHERE invite_code=? AND status='approved' AND demo=0 AND NOT EXISTS(SELECT 1 FROM members WHERE tenant_id=businesses.id AND user_id=?)",
    code,
    owner,
  );
  if (!b)
    throw new ApiError(
      "Davet kodu geçersiz veya kendi kodunuzu kullanamazsınız.",
      400,
    );
  const plan = await tenantPlan(b.id);
  if (!PLAN_LIMITS[plan].modules.referral)
    throw new ApiError("Bu pakette Neta davet kredisi kullanılamıyor.", 402);
  return q(
    "INSERT INTO referrals(referred_tenant,referrer_tenant,owner_id,status,reward,created_at) VALUES(?,?,?,'pending',?,?) ON CONFLICT DO NOTHING",
    newId,
    b.id,
    owner,
    REFERRAL_REWARD,
    now(),
  );
}

export async function approveReferral(id: string) {
  if (!id || !referralProgramEnabled()) return;
  const stamp = now();
  await db().batch([
    q(
      `INSERT INTO credit_ledger(id,tenant_id,amount,kind,reference,description,created_at)
       SELECT ?,r.referrer_tenant,r.reward,'referral','referral:'||r.referred_tenant,'Onaylanmış işletme daveti',?
       FROM referrals r
       JOIN businesses b ON b.id=r.referred_tenant
       JOIN businesses f ON f.id=r.referrer_tenant
       WHERE r.referred_tenant=?
         AND r.status='pending'
         AND b.demo=0
         AND b.status='approved'
         AND f.status='approved'
       ON CONFLICT(reference) DO NOTHING`,
      uid(),
      stamp,
      id,
    ),
    q(
      "UPDATE referrals SET status='earned' WHERE referred_tenant=? AND EXISTS(SELECT 1 FROM credit_ledger WHERE reference='referral:'||?)",
      id,
      id,
    ),
  ]);
}

export async function platformGrowth() {
  await admin();
  return {
    referrals: await all(
      "SELECT r.*,b.name referred_name,f.name referrer_name FROM referrals r JOIN businesses b ON b.id=r.referred_tenant JOIN businesses f ON f.id=r.referrer_tenant ORDER BY r.created_at DESC LIMIT 100",
    ),
    enabled: referralProgramEnabled(),
  };
}

export async function referralReview(input: any) {
  const u = await admin(),
    x = z.object({ id: z.string().min(1) }).parse(input);
  await approveReferral(x.id);
  await q(
    "INSERT INTO audit VALUES(?,?,?,?,?)",
    uid(),
    u.userId,
    "referral.review",
    x.id,
    now(),
  ).run();
  return { ok: true };
}
