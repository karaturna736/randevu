import { platformHelpInsights, updateHelpInsight } from "@/lib/help";
import { body, fail, limit, ok } from "@/lib/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    await limit(req, "platform-help-insights-read", 120);
    return ok(await platformHelpInsights());
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: Request) {
  try {
    await limit(req, "platform-help-insights-write", 60);
    return ok(await updateHelpInsight(await body(req)));
  } catch (e) {
    return fail(e);
  }
}
