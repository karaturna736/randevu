import { env } from "cloudflare:workers";
import { z } from "zod";
import {
  admin,
  all,
  db,
  now,
  one,
  q,
  uid,
  user,
  ApiError,
} from "./server";
import { businessCreation } from "./workspace";

export type ManualPlan = "normal" | "pro" | "plus";

const planSchema = z.enum(["normal", "pro", "plus"]);
const MANUAL_ACCESS_UNTIL = "2099-12-31T23:59:59.999Z";

export function manualProvisioningEnabled() {
  return String((env as any).MANUAL_PANEL_PROVISIONING ?? "true").toLowerCase() !== "false";
}

function requireManualProvisioning() {
  if (!manualProvisioningEnabled())
    throw new ApiError("Manuel panel aktivasyonu şu anda kapalı.", 404);
}

export async function createPendingBusiness(input: unknown) {
  requireManualProvisioning();
  const owner = await user();
  const profile = await one(
    "SELECT account_type,disabled FROM profiles WHERE user_id=?",
    owner.userId,
  );
  if (!profile) throw new ApiError("Önce üyeliğinizi tamamlayın.", 409);
  if (Number(profile.disabled) === 1) throw new ApiError("Hesabınız devre dışı.", 403);
  if (profile.account_type !== "business")
    throw new ApiError("İşletme paneli için işletme hesabı gereklidir.", 403);

  const owned = await one(
    "SELECT COUNT(*) n FROM members m JOIN businesses b ON b.id=m.tenant_id WHERE m.user_id=? AND m.role='owner' AND m.disabled=0 AND b.status!='deleted' AND b.demo=0",
    owner.userId,
  );
  if (Number(owned?.n || 0) >= 10)
    throw new ApiError("En fazla 10 işletme oluşturabilirsiniz.");

  const candidate = z
    .object({
      name: z.string().min(2).max(100),
      slug: z.string().min(3).max(60),
      category: z.string().min(2).max(100),
      city: z.string().max(80).default(""),
      address: z.string().max(300).default(""),
      phone: z.string().max(30).default(""),
      description: z.string().max(1000).default(""),
      ref: z.string().optional(),
      starter: z.any().optional(),
    })
    .parse(input);

  if (await one("SELECT id FROM businesses WHERE slug=?", candidate.slug))
    throw new ApiError("Bu randevu bağlantısı kullanımda.", 409);

  const { id, x, ops } = await businessCreation(
    { ...candidate, plan: "normal" },
    owner,
    uid(),
    false,
  );
  await db().batch(ops);
  return {
    id,
    slug: x.slug,
    status: "pending",
    message: "İşletmeniz kaydedildi. Panel erişimi Neta yöneticisi tarafından açılacak.",
  };
}

export async function manualProvisioningSnapshot() {
  requireManualProvisioning();
  await admin();
  const stamp = now();
  return {
    enabled: true,
    businesses: await all(
      `SELECT
        b.id,b.name,b.slug,b.category,b.city,b.status,b.selected_plan,b.created_at,
        (SELECT m.user_id FROM members m WHERE m.tenant_id=b.id AND m.role='owner' ORDER BY m.rowid LIMIT 1) owner_user_id,
        (SELECT m.name FROM members m WHERE m.tenant_id=b.id AND m.role='owner' ORDER BY m.rowid LIMIT 1) owner_name,
        (SELECT m.email FROM members m WHERE m.tenant_id=b.id AND m.role='owner' ORDER BY m.rowid LIMIT 1) owner_email,
        (SELECT s.plan FROM subscriptions s WHERE s.tenant_id=b.id AND s.paid_until>? LIMIT 1) manual_plan,
        (SELECT s.paid_until FROM subscriptions s WHERE s.tenant_id=b.id AND s.paid_until>? LIMIT 1) manual_paid_until,
        (SELECT r.plan FROM recurring_subscriptions r WHERE r.tenant_id=b.id AND ((r.paid_until>? AND r.test_mode=0) OR (r.test_mode=1 AND r.state IN ('ACTIVE','PENDING','UPGRADED'))) LIMIT 1) recurring_plan
      FROM businesses b
      WHERE b.demo=0 AND b.status!='deleted'
      ORDER BY b.created_at DESC
      LIMIT 500`,
      stamp,
      stamp,
      stamp,
    ),
    users: await all(
      `SELECT
        p.user_id,p.name,p.email,p.account_type,p.disabled,p.created_at,
        (SELECT COUNT(*) FROM members m JOIN businesses b ON b.id=m.tenant_id WHERE m.user_id=p.user_id AND b.demo=0 AND b.status!='deleted') businesses
      FROM profiles p
      WHERE p.account_type='business'
      ORDER BY p.created_at DESC
      LIMIT 500`,
    ),
  };
}

export async function manualProvisioningAction(input: unknown) {
  requireManualProvisioning();
  const actor = await admin();
  const x = z
    .object({
      action: z.enum(["grant", "revoke"]),
      id: z.string().min(1),
      plan: planSchema.optional(),
    })
    .parse(input);

  const business = await one(
    "SELECT id,name,demo,status FROM businesses WHERE id=?",
    x.id,
  );
  if (!business || Number(business.demo) === 1 || business.status === "deleted")
    throw new ApiError("İşletme bulunamadı.", 404);

  if (x.action === "grant") {
    const plan = planSchema.parse(x.plan);
    const stamp = now();
    await db().batch([
      q(
        `INSERT INTO subscriptions(tenant_id,paid_until,updated_at,plan)
         VALUES(?,?,?,?)
         ON CONFLICT(tenant_id) DO UPDATE SET
           paid_until=excluded.paid_until,
           updated_at=excluded.updated_at,
           plan=excluded.plan`,
        x.id,
        MANUAL_ACCESS_UNTIL,
        stamp,
        plan,
      ),
      q(
        "UPDATE businesses SET status='approved',selected_plan=? WHERE id=?",
        plan,
        x.id,
      ),
      q(
        "INSERT INTO audit(id,user_id,action,target_id,created_at) VALUES(?,?,?,?,?)",
        uid(),
        actor.userId,
        `manual-panel-grant:${plan}`,
        x.id,
        stamp,
      ),
    ]);
    return {
      ok: true,
      action: "grant",
      plan,
      paid_until: MANUAL_ACCESS_UNTIL,
      message: `${business.name} için panel erişimi açıldı.`,
    };
  }

  const recurring = await one(
    "SELECT plan,state,test_mode,paid_until FROM recurring_subscriptions WHERE tenant_id=?",
    x.id,
  );
  const recurringActive =
    !!recurring &&
    ((Number(recurring.test_mode) === 0 && String(recurring.paid_until || "") > now()) ||
      (Number(recurring.test_mode) === 1 &&
        ["ACTIVE", "PENDING", "UPGRADED"].includes(String(recurring.state))));
  if (recurringActive)
    throw new ApiError(
      "Bu işletmenin aktif sağlayıcı aboneliği var. Manuel erişim kapatılamaz.",
      409,
    );

  const stamp = now();
  await db().batch([
    q("DELETE FROM subscriptions WHERE tenant_id=?", x.id),
    q("UPDATE businesses SET status='pending' WHERE id=?", x.id),
    q(
      "INSERT INTO audit(id,user_id,action,target_id,created_at) VALUES(?,?,?,?,?)",
      uid(),
      actor.userId,
      "manual-panel-revoke",
      x.id,
      stamp,
    ),
  ]);
  return {
    ok: true,
    action: "revoke",
    message: `${business.name} için manuel panel erişimi kapatıldı.`,
  };
}
