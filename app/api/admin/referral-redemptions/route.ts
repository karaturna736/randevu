import { z } from "zod";
import { admin, ApiError, body, db, fail, limit, now, one, q, uid } from "@/lib/server";
import { adminAccessConfigured, hasAdminAccess } from "@/lib/admin-access";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    await limit(req, "point-redemption-admin", 15);
    const actor = await admin();
    if (adminAccessConfigured() && !(await hasAdminAccess(actor.userId)))
      throw new ApiError("Yönetici ek doğrulaması gerekli.", 403);
    const input = z.object({
      id: z.string().uuid(),
      action: z.enum(["fulfill", "reject"]),
      // The reference is entered only after the next provider charge is actually adjusted.
      provider_reference: z.string().trim().min(8).max(180).optional(),
    }).parse(await body(req));
    const row = await one("SELECT tenant_id,kind,status FROM neta_point_redemptions WHERE id=?", input.id);
    if (!row || row.status !== "pending") throw new ApiError("Talep zaten sonuçlanmış.", 409);
    if (input.action === "fulfill" && row.kind === "month" && !input.provider_reference)
      throw new ApiError("Önce ödeme sağlayıcısındaki ücretsiz dönemi doğrulayın ve işlem referansını girin.", 409);
    const stamp = now();
    if (input.action === "reject") {
      await db().batch([
        q("UPDATE neta_point_redemptions SET status='rejected',reviewed_at=?,reviewed_by=? WHERE id=? AND status='pending'",
          stamp, actor.userId, input.id),
        q(`INSERT INTO neta_point_ledger(id,tenant_id,amount,reference,description,created_at)
          SELECT ?,tenant_id,1000,?,'Reddedilen talep puan iadesi',? FROM neta_point_redemptions
          WHERE id=? AND status='rejected' ON CONFLICT(reference) DO NOTHING`,
          uid(), "refund:" + input.id, stamp, input.id),
      ]);
    } else {
      const operations = [q("UPDATE neta_point_redemptions SET status='fulfilled',reviewed_at=?,reviewed_by=?,provider_reference=? WHERE id=? AND status='pending'",
        stamp, actor.userId, input.provider_reference || null, input.id)];
      if (row.kind === "management") operations.push(q(`INSERT INTO tenant_addons(tenant_id,code,enabled,updated_at,updated_by)
        SELECT tenant_id,'management',1,?,? FROM neta_point_redemptions WHERE id=? AND status='fulfilled'
        ON CONFLICT(tenant_id,code) DO UPDATE SET enabled=1,updated_at=excluded.updated_at,updated_by=excluded.updated_by`,
        stamp, actor.userId, input.id));
      await db().batch(operations);
    }
    return Response.json({ ok: true });
  } catch (error) { return fail(error); }
}
