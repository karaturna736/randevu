import { change, SELECT_APPOINTMENTS } from "@/lib/booking";
import { businessAccess } from "@/lib/business-access";
import { body, fail, ok, one, ApiError } from "@/lib/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const x = await body(req);
    const tenantId = z.string().min(1).parse(x.tenant_id);
    const access = await businessAccess(tenantId, ["owner", "manager", "employee"]);
    const appointmentId = z.string().min(1).parse(x.id);
    const appointment = access.role === "owner"
      ? await one(SELECT_APPOINTMENTS + " WHERE a.tenant_id=? AND a.id=?", tenantId, appointmentId)
      : await one(
          SELECT_APPOINTMENTS + " WHERE a.tenant_id=? AND a.id=? AND a.branch_id=?",
          tenantId,
          appointmentId,
          access.branchId,
        );
    if (!appointment) throw new ApiError("Randevu bulunamadı veya bu şubeye ait değil.", 404);
    return ok(await change(access.business, appointment, x));
  } catch (e) {
    return fail(e);
  }
}
