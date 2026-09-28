import {
  businessNotificationAction,
  businessNotificationSnapshot,
} from "@/lib/notifications";
import { body, fail, ok, limit, ApiError } from "@/lib/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    await limit(req, "business-notifications", 120);
    const tenantId = new URL(req.url).searchParams.get("tenant") || "";
    if (!tenantId) throw new ApiError("İşletme kimliği gerekli.", 400);
    return ok(await businessNotificationSnapshot(tenantId));
  } catch (error) {
    return fail(error);
  }
}

export async function POST(req: Request) {
  try {
    await limit(req, "business-notifications-write", 120);
    const input = await body(req);
    const tenantId = String(input.tenant_id || "");
    if (!tenantId) throw new ApiError("İşletme kimliği gerekli.", 400);
    return ok(await businessNotificationAction(tenantId, input));
  } catch (error) {
    return fail(error);
  }
}
