import { fail, ok, body, limit } from "@/lib/server";
import { manualAccessAction, manualAccessSnapshot } from "@/lib/admin-manual-access";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    await limit(req, "admin-manual-access-read", 120);
    return ok(await manualAccessSnapshot());
  } catch (error) {
    return fail(error);
  }
}

export async function POST(req: Request) {
  try {
    await limit(req, "admin-manual-access-write", 60);
    return ok(await manualAccessAction(await body(req)));
  } catch (error) {
    return fail(error);
  }
}
