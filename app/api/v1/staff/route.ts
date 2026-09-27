import { saveStaff } from "@/lib/workspace";
import { businessAccess } from "@/lib/business-access";
import { PLAN_LIMITS, tenantPlan } from "@/lib/entitlements";
import { body, fail, hours, name, ok, one, q, uid, ApiError } from "@/lib/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const raw = await body(req);
    const tenantId = z.string().min(1).parse(raw.tenant_id);
    const access = await businessAccess(tenantId, ["owner", "manager"]);
    if (access.role === "owner") return ok(await saveStaff(tenantId, raw));

    const x = z.object({
      id: z.string().optional(),
      name,
      title: z.string().min(2).max(80),
      hours,
      color: z.string().regex(/^#[a-f\d]{6}$/i).default("#e1eccd"),
      active: z.coerce.number().int().min(0).max(1).default(1),
    }).parse(raw);
    const branchId = String(access.branchId);
    if (x.id) {
      const existing = await one("SELECT id FROM staff WHERE tenant_id=? AND id=? AND branch_id=?", tenantId, x.id, branchId);
      if (!existing) throw new ApiError("Personel bulunamadı veya bu şubeye ait değil.", 404);
    } else {
      const plan = await tenantPlan(tenantId);
      const staffLimit = PLAN_LIMITS[plan].staff;
      const total = Number((await one("SELECT COUNT(*) n FROM staff WHERE tenant_id=? AND active=1", tenantId)).n || 0);
      if (staffLimit !== null && total >= staffLimit)
        throw new ApiError(`${PLAN_LIMITS[plan].label} paketi en fazla ${staffLimit} personel destekler.`, 403);
    }
    const result = x.id
      ? await q(
          "UPDATE staff SET name=?,title=?,hours=?,color=?,active=? WHERE tenant_id=? AND id=? AND branch_id=?",
          x.name,x.title,JSON.stringify(x.hours),x.color,x.active,tenantId,x.id,branchId,
        ).run()
      : await q(
          "INSERT INTO staff(id,tenant_id,branch_id,name,title,hours,color,active) VALUES(?,?,?,?,?,?,?,?)",
          uid(),tenantId,branchId,x.name,x.title,JSON.stringify(x.hours),x.color,x.active,
        ).run();
    if (!result.meta.changes) throw new ApiError("Personel kaydedilemedi.", 404);
    return ok({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
