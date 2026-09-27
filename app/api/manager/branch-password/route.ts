import { body, fail, limit, ok } from "@/lib/server";
import { managerDirectory, setManagerBranchPassword } from "@/lib/manager";
import { z } from "zod";

export async function GET(req: Request) {
  try {
    const tenantId = new URL(req.url).searchParams.get("tenant") || "";
    z.string().min(1).parse(tenantId);
    const directory = await managerDirectory(tenantId);
    return ok({ branches: directory.branches });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(req: Request) {
  try {
    await limit(req, "manager-branch-password-set", 10);
    const x = z.object({
      tenant_id: z.string().min(1),
      branch_id: z.string().min(1),
      password: z.string().min(1).max(72),
    }).parse(await body(req));
    return ok(await setManagerBranchPassword(x.tenant_id, x));
  } catch (error) {
    return fail(error);
  }
}
