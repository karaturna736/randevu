import { z } from "zod";
import { body, fail, limit, ok } from "@/lib/server";
import { setBranchAccessPassword } from "@/lib/branch-access";

export async function POST(req: Request) {
  try {
    await limit(req, "staff-branch-password-set", 10);
    const x = z
      .object({
        tenant_id: z.string().min(1),
        branch_id: z.string().min(1),
        password: z.string().min(1).max(72),
      })
      .parse(await body(req));
    return ok(await setBranchAccessPassword(x.tenant_id, x.branch_id, x.password));
  } catch (error) {
    return fail(error);
  }
}
