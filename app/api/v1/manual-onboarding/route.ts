import { body, fail, limit, ok } from "@/lib/server";
import { createPendingBusiness } from "@/lib/manual-provisioning";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    await limit(req, "manual-onboarding", 10);
    return ok(await createPendingBusiness(await body(req)), 201);
  } catch (error) {
    return fail(error);
  }
}
