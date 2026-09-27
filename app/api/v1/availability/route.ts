import { available, publicBusiness } from "@/lib/booking";
import { businessAccess } from "@/lib/business-access";
import { crossBranchAlternatives } from "@/lib/plus-platform";
import { date, fail, ok } from "@/lib/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const tenantId = url.searchParams.get("tenant") || "";
    const serviceId = url.searchParams.get("service") || "";
    const requestedDate = date.parse(url.searchParams.get("date"));
    const person = url.searchParams.get("staff") || "any";
    if (tenantId) {
      const access = await businessAccess(tenantId, ["owner", "manager", "employee"]);
      const requestedBranch = url.searchParams.get("branch") || undefined;
      const branchId = access.role === "owner" ? requestedBranch : String(access.branchId);
      const slots = await available(access.business, serviceId, requestedDate, person, "", undefined, branchId);
      return ok({ slots, alternatives: [] });
    }
    const business = await publicBusiness(url.searchParams.get("slug") || "");
    const branchId = url.searchParams.get("branch") || undefined;
    const slots = await available(business, serviceId, requestedDate, person, "", undefined, branchId);
    const alternatives = branchId && !slots.length
      ? await crossBranchAlternatives(business, serviceId, requestedDate, "any", branchId)
      : [];
    return ok({ slots, alternatives });
  } catch (e) {
    return fail(e);
  }
}
