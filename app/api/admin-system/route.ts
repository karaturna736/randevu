import { z } from "zod";
import {
  admin,
  all,
  body,
  db,
  fail,
  name,
  now,
  ok,
  one,
  phone,
  q,
  uid,
  ApiError,
} from "@/lib/server";
import { change, SELECT_APPOINTMENTS } from "@/lib/booking";

export const dynamic = "force-dynamic";

function auditOp(userId: string, action: string, targetId: string) {
  return q(
    "INSERT INTO audit (id,user_id,action,target_id,created_at) VALUES (?,?,?,?,?)",
    uid(),
    userId,
    action,
    targetId,
    now(),
  );
}

export async function GET() {
  try {
    await admin();

    const [businesses, users, appointments, customers, recentAudit, counts, diagnostics] =
      await Promise.all([
        all(
          "SELECT id,name,slug,status,category,city,demo,created_at FROM businesses ORDER BY created_at DESC LIMIT 500",
        ),
        all(
          "SELECT user_id,name,email,phone,account_type,disabled,created_at FROM profiles ORDER BY created_at DESC LIMIT 500",
        ),
        all(
          `SELECT a.id,a.tenant_id,a.customer_id,a.date,a.minute,a.duration,a.status,a.source,a.created_at,
            b.name business_name,c.name customer_name,c.phone customer_phone,c.email customer_email,
            ab.user_id account_user_id,p.email account_email,p.name account_name
           FROM appointments a
           JOIN businesses b ON b.id=a.tenant_id
           JOIN customers c ON c.tenant_id=a.tenant_id AND c.id=a.customer_id
           LEFT JOIN account_bookings ab ON ab.tenant_id=a.tenant_id AND ab.appointment_id=a.id
           LEFT JOIN profiles p ON p.user_id=ab.user_id
           ORDER BY a.created_at DESC LIMIT 500`,
        ),
        all(
          `SELECT c.id,c.tenant_id,b.name business_name,c.name,c.phone,c.email,c.consent,c.created_at,
            (SELECT COUNT(*) FROM appointments a WHERE a.tenant_id=c.tenant_id AND a.customer_id=c.id) appointment_count
           FROM customers c JOIN businesses b ON b.id=c.tenant_id
           ORDER BY c.created_at DESC LIMIT 500`,
        ),
        all(
          `SELECT a.id,a.user_id,a.action,a.target_id,a.created_at,
            COALESCE(p.name,m.name,a.user_id) actor_name,
            COALESCE(p.email,m.email,'') actor_email
           FROM audit a
           LEFT JOIN profiles p ON p.user_id=a.user_id
           LEFT JOIN members m ON m.user_id=a.user_id
           ORDER BY a.created_at DESC LIMIT 100`,
        ),
        one(
          `SELECT
            (SELECT COUNT(*) FROM businesses WHERE status!='deleted' AND demo=0) businesses,
            (SELECT COUNT(*) FROM profiles) users,
            (SELECT COUNT(*) FROM appointments) appointments,
            (SELECT COUNT(*) FROM customers) customers,
            (SELECT COUNT(*) FROM businesses WHERE status='pending') pending_businesses,
            (SELECT COUNT(*) FROM profiles WHERE disabled=1) disabled_users,
            (SELECT COUNT(*) FROM payments WHERE status NOT IN ('paid','succeeded','active')) payment_attention`,
        ),
        one(
          `SELECT
            (SELECT COUNT(*) FROM account_bookings ab LEFT JOIN appointments a ON a.id=ab.appointment_id AND a.tenant_id=ab.tenant_id WHERE a.id IS NULL) orphan_account_bookings,
            (SELECT COUNT(*) FROM account_bookings ab LEFT JOIN profiles p ON p.user_id=ab.user_id WHERE p.user_id IS NULL) orphan_account_profiles,
            (SELECT COUNT(*) FROM slots s LEFT JOIN appointments a ON a.id=s.appointment_id AND a.tenant_id=s.tenant_id WHERE a.id IS NULL) orphan_slots,
            (SELECT COUNT(*) FROM appointments a LEFT JOIN customers c ON c.id=a.customer_id AND c.tenant_id=a.tenant_id WHERE c.id IS NULL) orphan_appointment_customers`,
        ),
      ]);

    return ok({
      health: { database: "ok", admin: "ok" },
      counts,
      diagnostics,
      businesses,
      users,
      appointments,
      customers,
      recent_audit: recentAudit,
    });
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: Request) {
  try {
    const u = await admin();
    const x = await body(req);
    const action = z
      .enum(["appointment-status", "customer-update", "booking-account"])
      .parse(x.action);

    if (action === "appointment-status") {
      const id = z.string().min(1).max(100).parse(x.id);
      const status = z.enum(["cancelled", "completed", "no_show"]).parse(x.status);
      const appointment = await one(SELECT_APPOINTMENTS + " WHERE a.id=?", id);
      if (!appointment) throw new ApiError("Randevu bulunamadı.", 404);
      const business = await one("SELECT * FROM businesses WHERE id=?", appointment.tenant_id);
      if (!business) throw new ApiError("İşletme bulunamadı.", 404);

      await change(business, appointment, { status }, false, [
        auditOp(u.userId, `admin-system:appointment-status:${status}`, id),
      ]);
      return ok({ ok: true });
    }

    if (action === "customer-update") {
      const input = z
        .object({
          id: z.string().min(1).max(100),
          tenant_id: z.string().min(1).max(100),
          name,
          phone,
          email: z.string().trim().email().or(z.literal("")),
        })
        .parse(x);
      const existing = await one(
        "SELECT id FROM customers WHERE id=? AND tenant_id=?",
        input.id,
        input.tenant_id,
      );
      if (!existing) throw new ApiError("Müşteri bulunamadı.", 404);

      await db().batch([
        q(
          "UPDATE customers SET name=?,phone=?,email=? WHERE id=? AND tenant_id=?",
          input.name,
          input.phone,
          input.email,
          input.id,
          input.tenant_id,
        ),
        auditOp(u.userId, "admin-system:customer-update", input.id),
      ]);
      return ok({ ok: true });
    }

    const input = z
      .object({
        id: z.string().min(1).max(100),
        user_id: z.string().min(1).max(200).nullable(),
      })
      .parse({ id: x.id, user_id: x.user_id || null });
    const appointment = await one(
      "SELECT id,tenant_id FROM appointments WHERE id=?",
      input.id,
    );
    if (!appointment) throw new ApiError("Randevu bulunamadı.", 404);
    if (input.user_id) {
      const profile = await one(
        "SELECT user_id FROM profiles WHERE user_id=? AND disabled=0",
        input.user_id,
      );
      if (!profile) throw new ApiError("Aktif kullanıcı bulunamadı.", 404);
    }

    const ops = [
      q("DELETE FROM account_bookings WHERE appointment_id=?", input.id),
    ];
    if (input.user_id) {
      ops.push(
        q(
          "INSERT INTO account_bookings (appointment_id,tenant_id,user_id,created_at) VALUES (?,?,?,?)",
          input.id,
          appointment.tenant_id,
          input.user_id,
          now(),
        ),
      );
    }
    ops.push(
      auditOp(
        u.userId,
        input.user_id ? "admin-system:booking-account-link" : "admin-system:booking-account-unlink",
        input.id,
      ),
    );
    await db().batch(ops);
    return ok({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
