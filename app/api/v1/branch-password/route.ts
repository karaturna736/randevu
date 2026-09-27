import { z } from "zod";
import {
  ApiError,
  body,
  fail,
  limit,
  ok,
  one,
  ownedTenant,
  user,
} from "@/lib/server";
import {
  branchPasswordOverview,
  branchPasswordSchema,
  setBranchPassword,
  verifyBranchPassword,
} from "@/lib/branch-password";

const requestSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("set"),
    tenant_id: z.string().min(1),
    branch_id: z.string().min(1),
    password: branchPasswordSchema,
  }),
  z.object({
    action: z.literal("verify"),
    tenant_id: z.string().min(1),
    branch_id: z.string().min(1),
    password: branchPasswordSchema,
  }),
]);

export async function GET(req: Request) {
  try {
    const tenantId = new URL(req.url).searchParams.get("tenant") || "";
    if (!tenantId) throw new ApiError("İşletme seçilmelidir.", 400);
    await ownedTenant(tenantId);
    return ok({ branches: await branchPasswordOverview(tenantId) });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(req: Request) {
  try {
    const input = requestSchema.parse(await body(req));

    if (input.action === "set") {
      await ownedTenant(input.tenant_id);
      await setBranchPassword(input.tenant_id, input.branch_id, input.password);
      return ok({ ok: true });
    }

    const current = await user();
    const membership = await one(
      `SELECT m.role,m.staff_id,s.branch_id
       FROM members m
       LEFT JOIN staff s ON s.tenant_id=m.tenant_id AND s.id=m.staff_id AND s.active=1
       WHERE m.tenant_id=? AND m.user_id=? AND m.disabled=0`,
      input.tenant_id,
      current.userId,
    );
    if (!membership)
      throw new ApiError("Bu işletmeye erişim yetkiniz yok.", 403);

    const role = String(membership.role || "");
    const authorized =
      role === "owner" ||
      role === "manager" ||
      role === "branch_manager" ||
      (role === "staff" && String(membership.branch_id || "") === input.branch_id);
    if (!authorized)
      throw new ApiError("Bu şubenin şifresini doğrulama yetkiniz yok.", 403);

    const branch = await one(
      "SELECT id,name FROM branches WHERE tenant_id=? AND id=? AND active=1",
      input.tenant_id,
      input.branch_id,
    );
    if (!branch) throw new ApiError("Şube bulunamadı.", 404);

    await limit(
      req,
      `branch-password:${current.userId}:${input.tenant_id}:${input.branch_id}`,
      10,
    );
    if (
      !(await verifyBranchPassword(
        input.tenant_id,
        input.branch_id,
        input.password,
      ))
    )
      throw new ApiError("Şube şifresi hatalı.", 401);

    return ok({
      ok: true,
      branch: { id: String(branch.id), name: String(branch.name) },
    });
  } catch (error) {
    return fail(error);
  }
}
