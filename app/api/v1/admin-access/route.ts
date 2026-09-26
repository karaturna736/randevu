import { body, fail, limit, ok } from "@/lib/server";
import {
  manualProvisioningAction,
  manualProvisioningSnapshot,
} from "@/lib/manual-provisioning";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    await limit(req, "manual-admin-access-read", 120);
    return ok(await manualProvisioningSnapshot());
  } catch (error) {
    return fail(error);
  }
}

export async function POST(req: Request) {
  try {
    await limit(req, "manual-admin-access-write", 60);
    return ok(await manualProvisioningAction(await body(req)));
  } catch (error) {
    return fail(error);
  }
}
