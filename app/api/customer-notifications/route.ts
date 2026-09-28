import {
  customerNotificationAction,
  customerNotificationSnapshot,
} from "@/lib/notifications";
import { acceptAccountRecovery } from "@/lib/recovery";
import { body, fail, ok, limit } from "@/lib/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    await limit(req, "customer-notifications", 120);
    return ok(await customerNotificationSnapshot());
  } catch (error) {
    return fail(error);
  }
}

export async function POST(req: Request) {
  try {
    await limit(req, "customer-notifications-write", 120);
    const input = await body(req);
    if (input.action === "accept-offer") {
      return ok(await acceptAccountRecovery(String(input.offer_id || "")), 201);
    }
    return ok(await customerNotificationAction(input));
  } catch (error) {
    return fail(error);
  }
}
