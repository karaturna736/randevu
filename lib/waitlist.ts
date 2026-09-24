import { z } from "zod";
import { all, ApiError, now, one, phone, q, tenant, uid } from "./server";
import { available } from "./booking";
import { date as dateSchema, name } from "./server";

const requestSchema = z
  .object({
    service_id: z.string().min(1),
    staff_id: z.string().optional(),
    date: dateSchema,
    minute_from: z.coerce
      .number()
      .int()
      .min(0)
      .max(1425)
      .multipleOf(15)
      .default(0),
    minute_to: z.coerce
      .number()
      .int()
      .min(15)
      .max(1440)
      .multipleOf(15)
      .default(1440),
    name,
    phone,
    consent: z.boolean().default(false),
  })
  .refine((value) => value.minute_from < value.minute_to, {
    message: "Saat aralığını kontrol edin.",
  });

export async function joinWaitlist(b: any, input: any) {
  const value = requestSchema.parse(input),
    staffId =
      value.staff_id && value.staff_id !== "any" ? value.staff_id : null;
  const service = await one(
    "SELECT id FROM services WHERE tenant_id=? AND id=? AND active=1",
    b.id,
    value.service_id,
  );
  if (!service) throw new ApiError("Hizmet bulunamadı.", 404);
  if (
    staffId &&
    !(await one(
      "SELECT id FROM staff WHERE tenant_id=? AND id=? AND active=1",
      b.id,
      staffId,
    ))
  )
    throw new ApiError("Personel bulunamadı.", 404);
  const slots = await available(
    b,
    value.service_id,
    value.date,
    staffId || "any",
  );
  if (
    slots.some(
      (slot) =>
        slot.minute >= value.minute_from && slot.minute < value.minute_to,
    )
  )
    throw new ApiError(
      "Bu aralıkta uygun saat var; doğrudan randevu oluşturabilirsiniz.",
      409,
    );
  const id = uid();
  await q(
    "INSERT INTO waitlist(id,tenant_id,service_id,staff_id,date,minute_from,minute_to,name,phone,consent,status,created_at) VALUES(?,?,?,?,?,?,?,?,?,? ,'waiting',?)",
    id,
    b.id,
    value.service_id,
    staffId,
    value.date,
    value.minute_from,
    value.minute_to,
    value.name,
    value.phone,
    value.consent ? 1 : 0,
    now(),
  ).run();
  return { id, status: "waiting" };
}

export async function waitlistSnapshot(id: string) {
  await tenant(id);
  return {
    requests: await all(
      `SELECT w.*,s.name service_name,p.name staff_name FROM waitlist w JOIN services s ON s.tenant_id=w.tenant_id AND s.id=w.service_id LEFT JOIN staff p ON p.tenant_id=w.tenant_id AND p.id=w.staff_id WHERE w.tenant_id=? ORDER BY CASE w.status WHEN 'waiting' THEN 0 ELSE 1 END,w.date,w.minute_from LIMIT 500`,
      id,
    ),
  };
}

export async function updateWaitlist(id: string, input: any) {
  await tenant(id);
  const value = z
      .object({
        id: z.string().min(1),
        status: z.enum(["waiting", "contacted", "booked", "cancelled"]),
      })
      .parse(input),
    result = await q(
      "UPDATE waitlist SET status=?,notified_at=CASE WHEN ?='contacted' THEN ? ELSE notified_at END WHERE tenant_id=? AND id=?",
      value.status,
      value.status,
      now(),
      id,
      value.id,
    ).run();
  if (!result.meta.changes)
    throw new ApiError("Bekleme kaydı bulunamadı.", 404);
  return { ok: true };
}
