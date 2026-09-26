import { z } from "zod";
import { authenticateManagementApi } from "@/lib/plus-platform";
import { all, one, ok, fail, body, limit, date, ApiError } from "@/lib/server";
import { available, book, change, SELECT_APPOINTMENTS } from "@/lib/booking";

export const dynamic = "force-dynamic";

async function businessForApi(tenantId: string) {
  const b = await one("SELECT * FROM businesses WHERE id=? AND status='approved' AND demo=0", tenantId);
  if (!b) throw new ApiError("İşletme bulunamadı veya API erişimine açık değil.", 404);
  return b;
}

function parts(req: Request) {
  return new URL(req.url).pathname.split("/").filter(Boolean).slice(3);
}

export async function GET(req: Request) {
  try {
    await limit(req, "management-api-read", 240);
    const auth = await authenticateManagementApi(req), p = parts(req), u = new URL(req.url);
    const id = auth.tenant_id;
    if (p[0] === "business") {
      const b = await businessForApi(id);
      return ok({
        id: b.id, name: b.name, slug: b.slug, category: b.category, city: b.city,
        address: b.address, phone: b.phone, description: b.description,
        booking_url: `/${b.slug}`,
      });
    }
    if (p[0] === "branches")
      return ok({ branches: await all("SELECT id,name,city,address,is_primary,active FROM branches WHERE tenant_id=? ORDER BY is_primary DESC,name", id) });
    if (p[0] === "services")
      return ok({ services: await all("SELECT id,name,description,duration,price,color,active FROM services WHERE tenant_id=? ORDER BY active DESC,name", id) });
    if (p[0] === "staff")
      return ok({ staff: await all("SELECT id,branch_id,name,title,color,active FROM staff WHERE tenant_id=? ORDER BY active DESC,name", id) });
    if (p[0] === "appointments") {
      const where = ["a.tenant_id=?"], values: any[] = [id];
      const from = u.searchParams.get("from"), to = u.searchParams.get("to"), branch = u.searchParams.get("branch");
      if (from) { where.push("a.date>=?"); values.push(date.parse(from)); }
      if (to) { where.push("a.date<=?"); values.push(date.parse(to)); }
      if (branch) { where.push("a.branch_id=?"); values.push(branch); }
      return ok({
        appointments: await all(
          SELECT_APPOINTMENTS + ` WHERE ${where.join(" AND ")} ORDER BY a.date DESC,a.minute DESC LIMIT 500`,
          ...values,
        ),
      });
    }
    if (p[0] === "availability") {
      const b = await businessForApi(id), service = z.string().min(1).parse(u.searchParams.get("service"));
      return ok({
        slots: await available(
          b,
          service,
          date.parse(u.searchParams.get("date")),
          u.searchParams.get("staff") || "any",
          "",
          undefined,
          u.searchParams.get("branch") || undefined,
        ),
      });
    }
    throw new ApiError("Yönetim API yolu bulunamadı.", 404);
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: Request) {
  try {
    await limit(req, "management-api-write", 120);
    const auth = await authenticateManagementApi(req), p = parts(req), x = await body(req), id = auth.tenant_id;
    const b = await businessForApi(id);
    if (p[0] === "appointments")
      return ok(await book(b, x, undefined, undefined, undefined, "api"), 201);
    if (p[0] === "appointment-action") {
      const appointmentId = z.string().min(1).parse(x.id);
      const a = await one(SELECT_APPOINTMENTS + " WHERE a.tenant_id=? AND a.id=?", id, appointmentId);
      if (!a) throw new ApiError("Randevu bulunamadı.", 404);
      return ok(await change(b, a, x));
    }
    throw new ApiError("Yönetim API yolu bulunamadı.", 404);
  } catch (e) {
    return fail(e);
  }
}
