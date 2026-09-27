import { z } from "zod";
import { body, fail, limit, ok } from "@/lib/server";
import { staffWorkspace } from "@/lib/team";

export async function POST(req: Request) {
  try {
    await limit(req, "staff-branch-password", 20);
    const x = z
      .object({
        tenant_id: z.string().min(1),
        date: z.string().min(1),
        branch_password: z.string().min(8).max(72),
      })
      .parse(await body(req));
    return ok(await staffWorkspace(x.tenant_id, x.date, x.branch_password));
  } catch (error) {
    return fail(error);
  }
}
