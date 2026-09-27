import { referralSnapshot } from "@/lib/growth";
import { fail, ok } from "@/lib/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const tenantId = new URL(request.url).searchParams.get("tenant") || "";
    return ok(await referralSnapshot(tenantId));
  } catch (error) {
    return fail(error);
  }
}
