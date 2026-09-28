import { z } from "zod";
import { all, one, q, tenant, user, uid, now, ApiError } from "./server";

export type AppointmentNotificationType =
  | "appointment.created"
  | "appointment.updated"
  | "appointment.cancelled"
  | "appointment.payment_updated";

export function notificationOp(input: {
  tenantId: string;
  appointmentId?: string | null;
  type: AppointmentNotificationType;
  title: string;
  message: string;
  data?: Record<string, unknown>;
}) {
  return q(
    `INSERT INTO notification_events
      (id,tenant_id,appointment_id,type,title,message,payload,created_at)
     VALUES (?,?,?,?,?,?,?,?)`,
    uid(),
    input.tenantId,
    input.appointmentId || null,
    input.type,
    input.title,
    input.message,
    JSON.stringify(input.data || {}),
    now(),
  );
}

export async function notificationSnapshot(tenantId: string) {
  await tenant(tenantId);
  const currentUser = await user();
  const notifications = await all(
    `SELECT n.id,n.appointment_id,n.type,n.title,n.message,n.payload,n.created_at,
            CASE WHEN r.notification_id IS NULL THEN 0 ELSE 1 END read
       FROM notification_events n
       LEFT JOIN notification_reads r
         ON r.notification_id=n.id AND r.user_id=?
      WHERE n.tenant_id=?
      ORDER BY n.created_at DESC
      LIMIT 100`,
    currentUser.userId,
    tenantId,
  );
  const unread = await one(
    `SELECT COUNT(*) count
       FROM notification_events n
      WHERE n.tenant_id=?
        AND NOT EXISTS (
          SELECT 1 FROM notification_reads r
           WHERE r.notification_id=n.id AND r.user_id=?
        )`,
    tenantId,
    currentUser.userId,
  );
  return {
    unread_count: Number(unread?.count || 0),
    notifications: notifications.map((item: any) => {
      let data: Record<string, unknown> = {};
      try {
        data = JSON.parse(item.payload || "{}");
      } catch {}
      return {
        id: item.id,
        appointment_id: item.appointment_id,
        type: item.type,
        title: item.title,
        message: item.message,
        created_at: item.created_at,
        read: !!item.read,
        data,
      };
    }),
  };
}

const notificationId = z
  .string()
  .min(16)
  .max(64)
  .regex(/^[a-f0-9-]+$/i, "Geçersiz bildirim kimliği.");

const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("read"),
    id: notificationId,
  }),
  z.object({
    action: z.literal("read-all"),
  }),
]);

export async function notificationAction(tenantId: string, input: unknown) {
  await tenant(tenantId);
  const currentUser = await user();
  const action = actionSchema.parse(input);
  if (action.action === "read") {
    const exists = await one(
      "SELECT id FROM notification_events WHERE tenant_id=? AND id=?",
      tenantId,
      action.id,
    );
    if (!exists) throw new ApiError("Bildirim bulunamadı.", 404);
    await q(
      `INSERT INTO notification_reads (notification_id,user_id,read_at)
       VALUES (?,?,?)
       ON CONFLICT(notification_id,user_id) DO UPDATE SET read_at=excluded.read_at`,
      action.id,
      currentUser.userId,
      now(),
    ).run();
    return { ok: true };
  }

  await q(
    `INSERT OR IGNORE INTO notification_reads (notification_id,user_id,read_at)
     SELECT id,?,? FROM notification_events WHERE tenant_id=?`,
    currentUser.userId,
    now(),
    tenantId,
  ).run();
  return { ok: true };
}
