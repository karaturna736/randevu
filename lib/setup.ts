import { z } from "zod";
import { requirePlanModule } from "./entitlements";
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
  date,
  hash,
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
const importedAppointment = z.object({
  name,
  phone,
  email: z.string().email().or(z.literal("")).default(""),
  consent: z.boolean().default(false),
  service_name: name,
  staff_name: name,
  date,
  minute: z.number().int().min(0).max(1425).multipleOf(15),
  duration: z.number().int().min(15).max(720).multipleOf(15),
  price: z.number().int().min(0).max(100000000),
  status: z.enum(["confirmed", "completed", "cancelled", "no_show"]),
  note: z.string().trim().max(500).default(""),
});
const importedReceivable = z.object({
  name,
  phone,
  email: z.string().email().or(z.literal("")).default(""),
  title: name.default("Eski borç"),
  amount: z.number().int().min(1).max(100000000),
  due_date: date.nullable().optional(),
  note: z.string().trim().max(300).default(""),
});
const importSchema = z.object({
  batch_id: z.string().uuid(),
  kind: z.enum([
    "customers",
    "services",
    "staff",
    "appointments",
    "receivables",
  ]),
  rows: z.array(z.unknown()).min(1).max(50),
});

export async function setupSnapshot(id: string) {
  await tenant(id);
  await requirePlanModule(id, "setupCenter");
  const b = await tenant(id),
    counts = await one(
      "SELECT (SELECT COUNT(*) FROM customers WHERE tenant_id=?) customers,(SELECT COUNT(*) FROM services WHERE tenant_id=? AND active=1) services,(SELECT COUNT(*) FROM staff WHERE tenant_id=? AND active=1) staff,(SELECT COUNT(*) FROM appointments WHERE tenant_id=?) appointments,(SELECT COUNT(*) FROM receivables WHERE tenant_id=? AND status='open' AND remaining>0) receivables",
      id,
      id,
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
  await tenant(id);
  await requirePlanModule(id, "setupCenter");
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
    return {
      ok: true,
      imported: 0,
      skipped: 0,
      duplicate_rows: 0,
      duplicate: true,
      issues: [],
    };

  const ops: any[] = [],
    issues: string[] = [];
  let imported = 0,
    skipped = 0,
    duplicateRows = 0;
  const issue = (index: number, message: string) => {
    skipped++;
    if (issues.length < 12) issues.push(`${index + 2}. satır: ${message}`);
  };
  const parse = <T>(schema: z.ZodType<T>, raw: unknown, index: number) => {
    const result = schema.safeParse(raw);
    if (result.success) return result.data;
    issue(index, result.error.issues[0]?.message || "Kayıt doğrulanamadı.");
    return null;
  };

  if (x.kind === "customers") {
    x.rows.forEach((raw, index) => {
      const r = parse(customer, raw, index);
      if (!r) return;
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
      imported++;
    });
  }

  if (x.kind === "services") {
    for (let index = 0; index < x.rows.length; index++) {
      const r = parse(service, x.rows[index], index);
      if (!r) continue;
      const old = await one(
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
      imported++;
    }
  }

  const primaryBranch = await one(
    "SELECT id FROM branches WHERE tenant_id=? AND active=1 ORDER BY is_primary DESC,created_at ASC LIMIT 1",
    id,
  );

  if (x.kind === "staff") {
    for (let index = 0; index < x.rows.length; index++) {
      const r = parse(person, x.rows[index], index);
      if (!r) continue;
      const old = await one(
        "SELECT id FROM staff WHERE tenant_id=? AND lower(name)=lower(?) LIMIT 1",
        id,
        r.name,
      );
      ops.push(
        old
          ? q(
              "UPDATE staff SET name=?,title=?,hours=?,active=1,branch_id=COALESCE(branch_id,?) WHERE tenant_id=? AND id=?",
              r.name,
              r.title,
              JSON.stringify(r.hours),
              primaryBranch?.id || null,
              id,
              old.id,
            )
          : q(
              "INSERT INTO staff(id,tenant_id,name,title,hours,color,active,branch_id) VALUES(?,?,?,?,?,?,1,?)",
              uid(),
              id,
              r.name,
              r.title,
              JSON.stringify(r.hours),
              "#d9e5cc",
              primaryBranch?.id || null,
            ),
      );
      imported++;
    }
  }

  if (x.kind === "appointments" || x.kind === "receivables") {
    if (!primaryBranch)
      throw new ApiError("Aktarım için aktif bir şube bulunamadı. Önce şube ayarlarını kontrol edin.");

    const customerIds = new Map<string, string>(),
      touchedCustomers = new Set<string>(),
      serviceIds = new Map<string, string>(),
      touchedServices = new Set<string>(),
      staffIds = new Map<string, string>(),
      staffBranches = new Map<string, string>(),
      touchedStaff = new Set<string>(),
      pendingAppointments = new Set<string>(),
      pendingSlots = new Set<string>();

    const customerId = async (r: {
      name: string;
      phone: string;
      email?: string;
      consent?: boolean;
    }) => {
      let cid = customerIds.get(r.phone);
      if (!cid) {
        const old = await one(
          "SELECT id FROM customers WHERE tenant_id=? AND phone=? LIMIT 1",
          id,
          r.phone,
        );
        cid = old?.id || uid();
        customerIds.set(r.phone, cid);
      }
      if (!touchedCustomers.has(r.phone)) {
        touchedCustomers.add(r.phone);
        ops.push(
          q(
            "INSERT INTO customers(id,tenant_id,name,phone,email,consent,created_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(tenant_id,phone) DO UPDATE SET name=excluded.name,email=CASE WHEN excluded.email<>'' THEN excluded.email ELSE customers.email END,consent=MAX(customers.consent,excluded.consent)",
            cid,
            id,
            r.name,
            r.phone,
            r.email || "",
            r.consent ? 1 : 0,
            now(),
          ),
        );
      }
      return cid;
    };

    const serviceId = async (r: {
      service_name: string;
      duration: number;
      price: number;
    }) => {
      const key = r.service_name.toLocaleLowerCase("tr-TR");
      let sid = serviceIds.get(key);
      if (!sid) {
        const old = await one(
          "SELECT id FROM services WHERE tenant_id=? AND lower(name)=lower(?) ORDER BY active DESC LIMIT 1",
          id,
          r.service_name,
        );
        sid = old?.id || uid();
        serviceIds.set(key, sid);
        if (!old && !touchedServices.has(key)) {
          touchedServices.add(key);
          ops.push(
            q(
              "INSERT INTO services(id,tenant_id,name,description,duration,price,color,active) VALUES(?,?,?,?,?,?,?,1)",
              sid,
              id,
              r.service_name,
              "Eski kayıt aktarımıyla oluşturuldu.",
              r.duration,
              r.price,
              "#6f8061",
            ),
          );
        }
      }
      return sid;
    };

    const staffId = async (staffName: string) => {
      const key = staffName.toLocaleLowerCase("tr-TR");
      let pid = staffIds.get(key);
      if (!pid) {
        const old = await one(
          "SELECT id,branch_id FROM staff WHERE tenant_id=? AND lower(name)=lower(?) ORDER BY active DESC LIMIT 1",
          id,
          staffName,
        );
        pid = old?.id || uid();
        staffIds.set(key, pid);
        staffBranches.set(key, old?.branch_id || primaryBranch.id);
        if (!old && !touchedStaff.has(key)) {
          touchedStaff.add(key);
          ops.push(
            q(
              "INSERT INTO staff(id,tenant_id,name,title,hours,color,active,branch_id) VALUES(?,?,?,?,?,?,1,?)",
              pid,
              id,
              staffName,
              "Uzman",
              b.hours,
              "#d9e5cc",
              primaryBranch.id,
            ),
          );
        }
      }
      return {
        id: pid,
        branchId: staffBranches.get(key) || primaryBranch.id,
      };
    };

    if (x.kind === "appointments") {
      for (let index = 0; index < x.rows.length; index++) {
        const r = parse(importedAppointment, x.rows[index], index);
        if (!r) continue;
        const cid = await customerId(r),
          sid = await serviceId(r),
          staff = await staffId(r.staff_name),
          appointmentKey = [
            cid,
            sid,
            staff.id,
            r.date,
            r.minute,
          ].join("|");
        if (pendingAppointments.has(appointmentKey)) {
          duplicateRows++;
          continue;
        }
        const exists = await one(
          "SELECT id FROM appointments WHERE tenant_id=? AND customer_id=? AND service_id=? AND staff_id=? AND date=? AND minute=? LIMIT 1",
          id,
          cid,
          sid,
          staff.id,
          r.date,
          r.minute,
        );
        if (exists) {
          duplicateRows++;
          continue;
        }
        pendingAppointments.add(appointmentKey);

        const futureConfirmed =
          r.status === "confirmed" &&
          r.date >= new Date().toISOString().slice(0, 10);
        if (futureConfirmed) {
          const dbConflict = await one(
            "SELECT minute FROM slots WHERE tenant_id=? AND staff_id=? AND date=? AND minute>=? AND minute<? LIMIT 1",
            id,
            staff.id,
            r.date,
            r.minute,
            r.minute + r.duration,
          );
          let localConflict = false;
          for (let m = r.minute; m < r.minute + r.duration; m += 15)
            if (pendingSlots.has(`${staff.id}|${r.date}|${m}`)) {
              localConflict = true;
              break;
            }
          if (dbConflict || localConflict) {
            issue(index, "Bu personelin aynı saatte başka bir aktif randevusu var.");
            continue;
          }
        }

        const appointmentId = uid();
        ops.push(
          q(
            "INSERT INTO appointments(id,tenant_id,branch_id,customer_id,service_id,staff_id,date,minute,duration,price,status,source,token_hash,created_at,service_name_snapshot,service_description_snapshot,customer_note) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            appointmentId,
            id,
            staff.branchId,
            cid,
            sid,
            staff.id,
            r.date,
            r.minute,
            r.duration,
            r.price,
            r.status,
            "api",
            "legacy:" + uid(),
            now(),
            r.service_name,
            "Eski kayıt aktarımı",
            r.note,
          ),
        );
        if (futureConfirmed)
          for (let m = r.minute; m < r.minute + r.duration; m += 15) {
            pendingSlots.add(`${staff.id}|${r.date}|${m}`);
            ops.push(
              q(
                "INSERT INTO slots(tenant_id,staff_id,date,minute,appointment_id) VALUES(?,?,?,?,?)",
                id,
                staff.id,
                r.date,
                m,
                appointmentId,
              ),
            );
          }
        imported++;
      }
    }

    if (x.kind === "receivables") {
      for (let index = 0; index < x.rows.length; index++) {
        const r = parse(importedReceivable, x.rows[index], index);
        if (!r) continue;
        const cid = await customerId(r),
          idempotencyKey = await hash(
            [
              "setup-receivable",
              id,
              r.phone,
              r.title,
              r.amount,
              r.due_date || "",
              r.note,
            ].join("|"),
          );
        if (
          await one(
            "SELECT id FROM receivables WHERE tenant_id=? AND idempotency_key=? LIMIT 1",
            id,
            idempotencyKey,
          )
        ) {
          duplicateRows++;
          continue;
        }
        ops.push(
          q(
            "INSERT INTO receivables(id,tenant_id,customer_id,appointment_id,title,amount,remaining,due_date,note,created_by,created_at,idempotency_key) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
            uid(),
            id,
            cid,
            null,
            r.title,
            r.amount,
            r.amount,
            r.due_date || null,
            r.note,
            u.userId,
            now(),
            idempotencyKey,
          ),
        );
        imported++;
      }
    }
  }

  ops.push(
    q(
      "INSERT INTO setup_import_batches(id,tenant_id,kind,row_count,created_by,created_at) VALUES(?,?,?,?,?,?)",
      x.batch_id,
      id,
      x.kind,
      imported,
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
  return {
    ok: true,
    imported,
    skipped,
    duplicate_rows: duplicateRows,
    issues,
  };
}

export async function requestTraining(id: string, input: any) {
  await tenant(id);
  await requirePlanModule(id, "setupCenter");
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
