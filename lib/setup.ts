import { z } from "zod";
import {
  all,
  db,
  one,
  q,
  tenant,
  user,
  uid,
  now,
  phone,
  name,
  hours,
  ApiError,
} from "./server";

const customer = z.object({
  name,
  phone,
  email: z.string().email().or(z.literal("")).default(""),
  consent: z.boolean().default(false),
});
const service = z.object({
  name,
  description: z.string().trim().max(500).default(""),
  duration: z.number().int().min(15).max(720).multipleOf(15),
  price: z.number().int().min(0).max(100000000),
});
const person = z.object({
  name,
  title: z.string().trim().min(2).max(80).default("Uzman"),
  hours,
});
const importSchema = z.object({
  batch_id: z.string().uuid(),
  kind: z.enum(["customers", "services", "staff"]),
  rows: z.array(z.unknown()).min(1).max(50),
});

export async function setupSnapshot(id: string) {
  const b = await tenant(id),
    counts = await one(
      "SELECT (SELECT COUNT(*) FROM customers WHERE tenant_id=?) customers,(SELECT COUNT(*) FROM services WHERE tenant_id=? AND active=1) services,(SELECT COUNT(*) FROM staff WHERE tenant_id=? AND active=1) staff",
      id,
      id,
      id,
    );
  return {
    business: { name: b.name, slug: b.slug, hours: JSON.parse(b.hours) },
    counts,
    imports: await all(
      "SELECT id,kind,row_count,created_at FROM setup_import_batches WHERE tenant_id=? ORDER BY created_at DESC LIMIT 30",
      id,
    ),
    training: await one(
      "SELECT id,preferred_date,note,status,created_at FROM setup_training_requests WHERE tenant_id=? ORDER BY created_at DESC LIMIT 1",
      id,
    ),
    booking_path: "/" + b.slug,
  };
}

export async function importSetup(id: string, input: any) {
  const b = await tenant(id),
    u = await user(),
    x = importSchema.parse(input);
  if (
    await one(
      "SELECT id FROM setup_import_batches WHERE id=? AND tenant_id=?",
      x.batch_id,
      id,
    )
  )
    return { ok: true, imported: 0, duplicate: true };
  const ops: any[] = [];
  if (x.kind === "customers")
    for (const raw of x.rows) {
      const r = customer.parse(raw);
      ops.push(
        q(
          "INSERT INTO customers(id,tenant_id,name,phone,email,consent,created_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(tenant_id,phone) DO UPDATE SET name=excluded.name,email=CASE WHEN excluded.email<>'' THEN excluded.email ELSE customers.email END,consent=MAX(customers.consent,excluded.consent)",
          uid(),
          id,
          r.name,
          r.phone,
          r.email,
          r.consent ? 1 : 0,
          now(),
        ),
      );
    }
  if (x.kind === "services")
    for (const raw of x.rows) {
      const r = service.parse(raw),
        old = await one(
          "SELECT id FROM services WHERE tenant_id=? AND lower(name)=lower(?) LIMIT 1",
          id,
          r.name,
        );
      ops.push(
        old
          ? q(
              "UPDATE services SET name=?,description=?,duration=?,price=?,active=1 WHERE tenant_id=? AND id=?",
              r.name,
              r.description,
              r.duration,
              r.price,
              id,
              old.id,
            )
          : q(
              "INSERT INTO services(id,tenant_id,name,description,duration,price,color,active) VALUES(?,?,?,?,?,?,?,1)",
              uid(),
              id,
              r.name,
              r.description,
              r.duration,
              r.price,
              "#6f8061",
            ),
      );
    }
  if (x.kind === "staff")
    for (const raw of x.rows) {
      const r = person.parse(raw),
        old = await one(
          "SELECT id FROM staff WHERE tenant_id=? AND lower(name)=lower(?) LIMIT 1",
          id,
          r.name,
        );
      ops.push(
        old
          ? q(
              "UPDATE staff SET name=?,title=?,hours=?,active=1 WHERE tenant_id=? AND id=?",
              r.name,
              r.title,
              JSON.stringify(r.hours),
              id,
              old.id,
            )
          : q(
              "INSERT INTO staff(id,tenant_id,name,title,hours,color,active) VALUES(?,?,?,?,?,?,1)",
              uid(),
              id,
              r.name,
              r.title,
              JSON.stringify(r.hours),
              "#d9e5cc",
            ),
      );
    }
  ops.push(
    q(
      "INSERT INTO setup_import_batches(id,tenant_id,kind,row_count,created_by,created_at) VALUES(?,?,?,?,?,?)",
      x.batch_id,
      id,
      x.kind,
      x.rows.length,
      u.userId,
      now(),
    ),
    q(
      "INSERT INTO audit(id,user_id,action,target_id,created_at) VALUES(?,?,?,?,?)",
      uid(),
      u.userId,
      "setup_import:" + x.kind,
      id,
      now(),
    ),
  );
  await db().batch(ops);
  return { ok: true, imported: x.rows.length };
}

export async function requestTraining(id: string, input: any) {
  await tenant(id);
  const x = z
      .object({
        preferred_date: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .nullable()
          .optional(),
        note: z.string().trim().max(500).default(""),
      })
      .parse(input),
    existing = await one(
      "SELECT id FROM setup_training_requests WHERE tenant_id=? AND status='pending'",
      id,
    );
  if (existing) throw new ApiError("Açık bir eğitim talebiniz zaten var.", 409);
  const requestId = uid();
  await q(
    "INSERT INTO setup_training_requests(id,tenant_id,preferred_date,note,status,created_at) VALUES(?,?,?,?,'pending',?)",
    requestId,
    id,
    x.preferred_date || null,
    x.note,
    now(),
  ).run();
  return { id: requestId, status: "pending" };
}
