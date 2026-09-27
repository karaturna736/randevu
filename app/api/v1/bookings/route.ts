import { book, bookingAccount, publicBusiness } from "@/lib/booking";
import { businessAccess } from "@/lib/business-access";
import { visitIdentity } from "@/lib/demand";
import { body, fail, limit, ok } from "@/lib/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    await limit(req, "booking", 30);
    const x = await body(req);
    const tenantId = String(x.tenant_id || "");
    if (tenantId) {
      const access = await businessAccess(tenantId, ["owner", "manager", "employee"]);
      const scoped = {
        ...x,
        branch_id: access.role === "owner" ? x.branch_id : access.branchId,
      };
      return ok(await book(access.business, scoped, undefined, undefined, undefined, "panel"), 201);
    }
    const business = await publicBusiness(z.string().parse(x.slug));
    return ok(
      await book(
        business,
        x,
        await bookingAccount(),
        await visitIdentity(business.id, x),
        undefined,
        "web",
      ),
      201,
    );
  } catch (e) {
    return fail(e);
  }
}
