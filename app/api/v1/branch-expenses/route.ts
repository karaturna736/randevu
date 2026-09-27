import { saveBranchExpense } from "@/lib/branches";
import { businessAccess } from "@/lib/business-access";
import { PLAN_LIMITS, tenantPlan } from "@/lib/entitlements";
import { body, fail, now, ok, q, uid, ApiError } from "@/lib/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const schema = z.object({
  id: z.string().optional(),
  branch_id: z.string().min(1),
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  category: z.enum(["kira", "personel", "malzeme", "fatura", "pazarlama", "vergi", "diger"]),
  amount: z.coerce.number().int().min(1).max(1000000000),
  catalog_item_id: z.string().nullable().optional(),
  quantity: z.coerce.number().positive().max(100000).default(1),
  unit: z.string().trim().min(1).max(20).default("adet"),
  note: z.string().trim().max(300).default(""),
});

export async function POST(req: Request) {
  try {
    const raw = await body(req);
    const tenantId = z.string().min(1).parse(raw.tenant_id);
    const access = await businessAccess(tenantId, ["owner", "manager"]);
    if (access.role === "owner") return ok(await saveBranchExpense(tenantId, raw));
    const plan = await tenantPlan(tenantId);
    if (!PLAN_LIMITS[plan].modules.branchProfit)
      throw new ApiError("Şube gideri ve kârlılık bu pakette kapalı.", 402);
    const x = schema.parse(raw);
    if (x.branch_id !== access.branchId)
      throw new ApiError("Yalnızca kendi şubenize gider girebilirsiniz.", 403);
    if (x.catalog_item_id)
      throw new ApiError("Müdür hesabı kayıtlı gider kataloğunu değiştiremez.", 403);
    const id = x.id || uid();
    const stamp = now();
    const result = x.id
      ? await q(
          "UPDATE branch_expenses SET month=?,category=?,amount=?,quantity=?,unit=?,note=?,updated_at=? WHERE tenant_id=? AND branch_id=? AND id=?",
          x.month,x.category,x.amount,x.quantity,x.unit,x.note,stamp,tenantId,access.branchId,x.id,
        ).run()
      : await q(
          "INSERT INTO branch_expenses(id,tenant_id,branch_id,month,category,amount,catalog_item_id,quantity,unit,note,created_at,updated_at) VALUES(?,?,?,?,?,?,NULL,?,?,?,?,?)",
          id,tenantId,access.branchId,x.month,x.category,x.amount,x.quantity,x.unit,x.note,stamp,stamp,
        ).run();
    if (!result.meta.changes) throw new ApiError("Gider kaydı bulunamadı.", 404);
    await q(
      "INSERT INTO branch_month_closings(tenant_id,branch_id,month,expenses_confirmed) VALUES(?,?,?,0) ON CONFLICT(tenant_id,branch_id,month) DO UPDATE SET expenses_confirmed=0,confirmed_at=NULL",
      tenantId,access.branchId,x.month,
    ).run();
    return ok({ ok: true, id });
  } catch (e) {
    return fail(e);
  }
}
