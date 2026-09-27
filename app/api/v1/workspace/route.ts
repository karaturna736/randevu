import { getBusinessConfig } from "@/lib/business-config";
import { roleWorkspace } from "@/lib/role-workspace";
import { fail, ok } from "@/lib/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const data = await roleWorkspace(url.searchParams.get("tenant") || undefined);
    return ok(
      data.business
        ? { ...data, configuration: getBusinessConfig(data.business.category) }
        : data,
    );
  } catch (e) {
    return fail(e);
  }
}
