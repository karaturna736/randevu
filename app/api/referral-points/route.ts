import { z } from "zod";
import { ApiError, body, db, fail, limit, now, one, ownedTenant, q, uid } from "@/lib/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    await limit(req, "point-redemption", 5);
    const { tenant_id, kind } = z.object({
      tenant_id: z.string().min(1),
      kind: z.enum(["month", "management"]),
    }).parse(await body(req));
    const business = await ownedTenant(tenant_id);
    if (business.demo || business.status !== "approved")
      throw new ApiError("Yalnızca onaylı gerçek işletmeler puan kullanabilir.", 403);
    const subscription = await one(
      "SELECT reference,paid_until,test_mode,state FROM recurring_subscriptions WHERE tenant_id=?",
      tenant_id,
    );
    if (!subscription || subscription.test_mode || subscription.paid_until <= now() ||
      !["ACTIVE", "UPGRADED"].includes(subscription.state))
      throw new ApiError("Puan kullanımı için gerçek ve aktif abonelik gerekir.", 409);
    if (kind === "management" && await one(
      "SELECT 1 ok FROM tenant_addons WHERE tenant_id=? AND code='management' AND enabled=1", tenant_id,
    )) throw new ApiError("Bu ek paket zaten etkin.", 409);
    if (await one("SELECT 1 ok FROM neta_point_redemptions WHERE tenant_id=? AND status='pending'", tenant_id))
      throw new ApiError("Önceki puan talebiniz henüz sonuçlanmadı.", 409);
    const points = await one("SELECT balance FROM neta_point_balances WHERE tenant_id=?", tenant_id);
    if ((points?.balance || 0) < 1000) throw new ApiError("En az 1000 Neta puanı gerekir.", 409);
    const id = uid(), stamp = now();
    // The debit trigger enforces the balance at insert time. Both rows commit together.
    await db().batch([
      q("INSERT INTO neta_point_ledger(id,tenant_id,amount,reference,description,created_at) VALUES(?,?,-1000,?,?,?)",
        uid(), tenant_id, "redeem:" + id, kind === "month" ? "Bir aylık paket talebi" : "Ek paket talebi", stamp),
      q("INSERT INTO neta_point_redemptions(id,tenant_id,kind,status,created_at) VALUES(?,?,?,'pending',?)",
        id, tenant_id, kind, stamp),
    ]);
    return Response.json({ ok: true, id, status: "pending" });
  } catch (error) { return fail(error); }
}
