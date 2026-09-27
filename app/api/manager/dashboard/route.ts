import { body, fail, limit, ok } from "@/lib/server";
import { managerSnapshot } from "@/lib/manager";
import { z } from "zod";

export async function POST(req: Request) {
  try {
    await limit(req, "manager-branch-password", 12);
    const x = z.object({
      tenant_id: z.string().min(1),
      date: z.string().min(1),
      branch_password: z.string().min(1).max(72),
    }).parse(await body(req));
    return ok(await managerSnapshot(x.tenant_id, x.date, x.branch_password));
  } catch (error) {
    return fail(error);
  }
}
