import { branchAction, branchSnapshot, saveBranch } from "@/lib/branches";
import { businessAccess } from "@/lib/business-access";
import { managerBranchSnapshot } from "@/lib/manager-branches";
import { body, db, fail, now, ok, one, q, ApiError } from "@/lib/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const tenantId = z.string().min(1).parse(url.searchParams.get("tenant"));
    const month = monthSchema.parse(url.searchParams.get("month") || new Date().toISOString().slice(0, 7));
    const access = await businessAccess(tenantId, ["owner", "manager"]);
    return ok(access.role === "owner" ? await branchSnapshot(tenantId, month) : await managerBranchSnapshot(tenantId, month));
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: Request) {
  try {
    const x = await body(req);
    const tenantId = z.string().min(1).parse(x.tenant_id);
    const access = await businessAccess(tenantId, ["owner", "manager"]);
    if (access.role === "owner")
      return ok(x.action ? await branchAction(tenantId, x) : await saveBranch(tenantId, x));

    const branchId = String(access.branchId);
    if (!x.action) {
      const id = z.string().min(1).parse(x.id);
      if (id !== branchId) throw new ApiError("Yalnızca kendi şubenizi düzenleyebilirsiniz.", 403);
      const name = z.string().trim().min(2).max(80).parse(x.name);
      const city = z.string().trim().max(80).parse(x.city || "");
      const address = z.string().trim().max(300).parse(x.address || "");
      const phone = z.string().trim().max(30).parse(x.phone || "");
      await q("UPDATE branches SET name=?,city=?,address=?,phone=? WHERE tenant_id=? AND id=?", name, city, address, phone, tenantId, branchId).run();
      return ok({ ok: true, id: branchId });
    }
    if (x.action === "confirm-expenses") {
      if (String(x.branch_id) !== branchId) throw new ApiError("Yalnızca kendi şubenizin giderlerini onaylayabilirsiniz.", 403);
      const month = monthSchema.parse(x.month);
      await q(
        "INSERT INTO branch_month_closings(tenant_id,branch_id,month,expenses_confirmed,confirmed_at) VALUES(?,?,?,1,?) ON CONFLICT(tenant_id,branch_id,month) DO UPDATE SET expenses_confirmed=1,confirmed_at=excluded.confirmed_at",
        tenantId, branchId, month, now(),
      ).run();
      return ok({ ok: true });
    }
    if (x.action === "delete-expense") {
      const expense = await one("SELECT branch_id,month FROM branch_expenses WHERE tenant_id=? AND id=?", tenantId, z.string().min(1).parse(x.id));
      if (!expense) throw new ApiError("Gider kaydı bulunamadı.", 404);
      if (expense.branch_id !== branchId) throw new ApiError("Bu gider üzerinde yetkiniz yok.", 403);
      await db().batch([
        q("DELETE FROM branch_expenses WHERE tenant_id=? AND id=?", tenantId, x.id),
        q("INSERT INTO branch_month_closings(tenant_id,branch_id,month,expenses_confirmed) VALUES(?,?,?,0) ON CONFLICT(tenant_id,branch_id,month) DO UPDATE SET expenses_confirmed=0,confirmed_at=NULL", tenantId, branchId, expense.month),
      ]);
      return ok({ ok: true });
    }
    throw new ApiError("Bu şube işlemi için yönetici yetkisi gerekir.", 403);
  } catch (e) {
    return fail(e);
  }
}
