import { z } from "zod";
import { PLAN_CATALOG, type PlanCode } from "./entitlements";
import { businessCreation } from "./workspace";
import { CATEGORIES } from "./types";
import { admin, all, ApiError, db, now, one, q, uid } from "./server";

const grantSchema = z.object({
  action: z.literal("grant"),
  user_id: z.string().min(1).max(200),
  plan: z.enum(["normal", "pro", "plus"]),
});

const revokeSchema = z.object({
  action: z.literal("revoke"),
  user_id: z.string().min(1).max(200),
});

function temporaryBusinessName(name: string) {
  const clean = String(name || "Neta İşletmesi").trim().slice(0, 70);
  return /işletmesi$/i.test(clean) ? clean : `${clean} İşletmesi`;
}

function temporarySlug() {
  return `neta-${uid().replace(/[^a-z0-9]/gi, "").toLowerCase().slice(0, 14)}`;
}

export async function manualAccessSnapshot() {
  await admin();
  return {
    users: await all(
      `SELECT p.user_id,p.email,p.name,
        b.id tenant_id,b.name business_name,b.selected_plan,
        s.plan,s.paid_until,
        CASE WHEN s.paid_until > ? THEN 1 ELSE 0 END active
       FROM profiles p
       LEFT JOIN members m ON m.user_id=p.user_id AND m.role='owner' AND m.disabled=0
       LEFT JOIN businesses b ON b.id=m.tenant_id AND b.demo=0 AND b.status NOT IN ('deleted')
       LEFT JOIN subscriptions s ON s.tenant_id=b.id
       ORDER BY p.created_at DESC,b.created_at DESC`,
      now(),
    ),
  };
}

export async function manualAccessAction(input: unknown) {
  const actor = await admin();
  const parsed = z.discriminatedUnion("action", [grantSchema, revokeSchema]).parse(input);
  const profile = await one(
    "SELECT user_id,email,name FROM profiles WHERE user_id=?",
    parsed.user_id,
  );
  if (!profile) throw new ApiError("Kullanıcı kaydı bulunamadı.", 404);

  if (parsed.action === "revoke") {
    const owned = await all(
      `SELECT b.id FROM businesses b
       JOIN members m ON m.tenant_id=b.id
       WHERE m.user_id=? AND m.role='owner' AND b.demo=0 AND b.status NOT IN ('deleted')`,
      parsed.user_id,
    );
    if (!owned.length) return { ok: true, revoked: 0 };
    const stamp = now();
    await db().batch([
      ...owned.map((b: any) => q("DELETE FROM subscriptions WHERE tenant_id=?", b.id)),
      q(
        "INSERT INTO audit(id,user_id,action,target_id,created_at) VALUES(?,?,?,?,?)",
        uid(),
        actor.userId,
        "manual-access.revoked",
        parsed.user_id,
        stamp,
      ),
    ]);
    return { ok: true, revoked: owned.length };
  }

  const plan = parsed.plan as PlanCode;
  if (!PLAN_CATALOG[plan]) throw new ApiError("Geçersiz paket.", 400);

  let business = await one(
    `SELECT b.* FROM businesses b
     JOIN members m ON m.tenant_id=b.id
     WHERE m.user_id=? AND m.role='owner' AND m.disabled=0
       AND b.demo=0 AND b.status NOT IN ('deleted')
     ORDER BY b.created_at DESC LIMIT 1`,
    parsed.user_id,
  );

  const stamp = now();
  const paidUntil = new Date(Date.now() + 365 * 86400000).toISOString();
  const paymentId = uid();

  if (!business) {
    const tenantId = uid();
    const created = await businessCreation(
      {
        name: temporaryBusinessName(profile.name || profile.email?.split("@")[0] || "Neta"),
        slug: temporarySlug(),
        category: CATEGORIES[0],
        city: "",
        address: "",
        phone: "",
        description: "",
        plan,
      },
      {
        userId: profile.user_id,
        email: profile.email || "",
        displayName: profile.name || profile.email || "Neta kullanıcısı",
      },
      tenantId,
      false,
    );
    await db().batch([
      ...created.ops,
      q("UPDATE businesses SET status='approved',selected_plan=? WHERE id=?", plan, tenantId),
      q(
        `INSERT INTO subscriptions(tenant_id,paid_until,updated_at,plan) VALUES(?,?,?,?)
         ON CONFLICT(tenant_id) DO UPDATE SET paid_until=excluded.paid_until,updated_at=excluded.updated_at,plan=excluded.plan`,
        tenantId,
        paidUntil,
        stamp,
        plan,
      ),
      q(
        "INSERT INTO payments(id,tenant_id,kind,amount,status,provider_ref,created_at) VALUES(?,?,'subscription',0,'paid',?,?)",
        paymentId,
        tenantId,
        `manual-admin:${paymentId}`,
        stamp,
      ),
      q(
        "INSERT INTO audit(id,user_id,action,target_id,created_at) VALUES(?,?,?,?,?)",
        uid(),
        actor.userId,
        `manual-access.granted.${plan}`,
        tenantId,
        stamp,
      ),
    ]);
    business = { id: tenantId, name: created.x.name };
  } else {
    await db().batch([
      q("UPDATE businesses SET status='approved',selected_plan=? WHERE id=?", plan, business.id),
      q(
        `INSERT INTO subscriptions(tenant_id,paid_until,updated_at,plan) VALUES(?,?,?,?)
         ON CONFLICT(tenant_id) DO UPDATE SET paid_until=excluded.paid_until,updated_at=excluded.updated_at,plan=excluded.plan`,
        business.id,
        paidUntil,
        stamp,
        plan,
      ),
      q(
        "INSERT INTO payments(id,tenant_id,kind,amount,status,provider_ref,created_at) VALUES(?,?,'subscription',0,'paid',?,?)",
        paymentId,
        business.id,
        `manual-admin:${paymentId}`,
        stamp,
      ),
      q(
        "INSERT INTO audit(id,user_id,action,target_id,created_at) VALUES(?,?,?,?,?)",
        uid(),
        actor.userId,
        `manual-access.granted.${plan}`,
        business.id,
        stamp,
      ),
    ]);
  }

  return {
    ok: true,
    tenant_id: business.id,
    business_name: business.name,
    plan,
    paid_until: paidUntil,
    manual: true,
  };
}
