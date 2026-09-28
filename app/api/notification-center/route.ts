import { notificationAction, notificationSnapshot } from "@/lib/notifications";
import { body, fail, ok, ApiError } from "@/lib/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const tenantId = new URL(req.url).searchParams.get("tenant") || "";
    if (!tenantId) throw new ApiError("İşletme kimliği gerekli.", 400);
    return ok(await notificationSnapshot(tenantId));
  } catch (error) {
    return fail(error);
  }
}

export async function POST(req: Request) {
  try {
    const input = await body(req);
    const tenantId = String(input.tenant_id || "");
    if (!tenantId) throw new ApiError("İşletme kimliği gerekli.", 400);
    return ok(await notificationAction(tenantId, input));
  } catch (error) {
    return fail(error);
  }
}
