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
      `SELECT role FROM members
       WHERE tenant_id=? AND user_id=? AND disabled=0`,
      input.tenant_id,
      current.userId,
    );
    if (!membership)
      throw new ApiError("Bu işletmeye erişim yetkiniz yok.", 403);

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
