import { z } from "zod";
import { all, one, q, tenant, user, uid, now, ApiError } from "./server";

export type NotificationType =
  | "appointment.created"
  | "appointment.updated"
  | "appointment.cancelled"
  | "appointment.payment_updated"
  | "waitlist.slot_available";

export function notificationOp(input: {
  tenantId: string;
  appointmentId?: string | null;
  recipientUserId?: string | null;
  waitlistId?: string | null;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, unknown>;
}) {
  return q(
    `INSERT INTO notification_events
      (id,tenant_id,appointment_id,recipient_user_id,waitlist_id,type,title,message,payload,created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    uid(),
    input.tenantId,
    input.appointmentId || null,
    input.recipientUserId || null,
    input.waitlistId || null,
    input.type,
    input.title,
    input.message,
    JSON.stringify(input.data || {}),
    now(),
  );
}

function present(item: any) {
  let data: Record<string, unknown> = {};
  try {
    data = JSON.parse(item.payload || "{}");
  } catch {}
  return {
    id: item.id,
    appointment_id: item.appointment_id || null,
    waitlist_id: item.waitlist_id || null,
    type: item.type as NotificationType,
    title: item.title,
    message: item.message,
    created_at: item.created_at,
    read: !!item.read,
    data,
  };
}

export async function businessNotificationSnapshot(tenantId: string) {
  await tenant(tenantId);
  const current = await user();
  const notifications = await all(
    `SELECT n.id,n.appointment_id,n.waitlist_id,n.type,n.title,n.message,n.payload,n.created_at,
            CASE WHEN r.notification_id IS NULL THEN 0 ELSE 1 END read
       FROM notification_events n
       LEFT JOIN notification_reads r
         ON r.notification_id=n.id AND r.user_id=?
      WHERE n.tenant_id=? AND n.recipient_user_id IS NULL
      ORDER BY n.created_at DESC
      LIMIT 100`,
    current.userId,
    tenantId,
  );
  const unread = await one(
    `SELECT COUNT(*) count
       FROM notification_events n
      WHERE n.tenant_id=? AND n.recipient_user_id IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM notification_reads r
           WHERE r.notification_id=n.id AND r.user_id=?
        )`,
    tenantId,
    current.userId,
  );
  return {
    unread_count: Number(unread?.count || 0),
    notifications: notifications.map(present),
  };
}

const readAction = z.discriminatedUnion("action", [
  z.object({ action: z.literal("read"), id: z.string().min(1).max(100) }),
  z.object({ action: z.literal("read-all") }),
]);

async function mark(userId: string, notificationId: string) {
  await q(
    `INSERT INTO notification_reads (notification_id,user_id,read_at)
     VALUES (?,?,?)
     ON CONFLICT(notification_id,user_id) DO UPDATE SET read_at=excluded.read_at`,
    notificationId,
    userId,
    now(),
  ).run();
}

export async function businessNotificationAction(tenantId: string, input: unknown) {
  await tenant(tenantId);
  const current = await user();
  const action = readAction.parse(input);
  if (action.action === "read") {
    const exists = await one(
      "SELECT id FROM notification_events WHERE tenant_id=? AND recipient_user_id IS NULL AND id=?",
      tenantId,
      action.id,
    );
    if (!exists) throw new ApiError("Bildirim bulunamadı.", 404);
    await mark(current.userId, action.id);
    return { ok: true };
  }
  await q(
    `INSERT OR IGNORE INTO notification_reads (notification_id,user_id,read_at)
     SELECT id,?,? FROM notification_events
      WHERE tenant_id=? AND recipient_user_id IS NULL`,
    current.userId,
    now(),
    tenantId,
  ).run();
  return { ok: true };
}

function customerVisibilitySql(alias = "n") {
  return `(
    ${alias}.recipient_user_id=? OR
    (${alias}.appointment_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM account_bookings ab
       WHERE ab.user_id=?
         AND ab.tenant_id=${alias}.tenant_id
         AND ab.appointment_id=${alias}.appointment_id
    ))
  )`;
}

export async function customerNotificationSnapshot() {
  const current = await user();
  const visible = customerVisibilitySql("n");
  const notifications = await all(
    `SELECT n.id,n.appointment_id,n.waitlist_id,n.type,n.title,n.message,n.payload,n.created_at,
            CASE WHEN r.notification_id IS NULL THEN 0 ELSE 1 END read
       FROM notification_events n
       LEFT JOIN notification_reads r
         ON r.notification_id=n.id AND r.user_id=?
      WHERE ${visible}
      ORDER BY n.created_at DESC
      LIMIT 100`,
    current.userId,
    current.userId,
    current.userId,
  );
  const unread = await one(
    `SELECT COUNT(*) count FROM notification_events n
      WHERE ${visible}
        AND NOT EXISTS (
          SELECT 1 FROM notification_reads r
           WHERE r.notification_id=n.id AND r.user_id=?
        )`,
    current.userId,
    current.userId,
    current.userId,
  );
  return {
    unread_count: Number(unread?.count || 0),
    notifications: notifications.map(present),
  };
}

export async function customerNotificationAction(input: unknown) {
  const current = await user();
  const action = readAction.parse(input);
  const visible = customerVisibilitySql("n");
  if (action.action === "read") {
    const exists = await one(
      `SELECT n.id FROM notification_events n WHERE n.id=? AND ${visible}`,
      action.id,
      current.userId,
      current.userId,
    );
    if (!exists) throw new ApiError("Bildirim bulunamadı.", 404);
    await mark(current.userId, action.id);
    return { ok: true };
  }
  await q(
    `INSERT OR IGNORE INTO notification_reads (notification_id,user_id,read_at)
     SELECT n.id,?,? FROM notification_events n WHERE ${visible}`,
    current.userId,
    now(),
    current.userId,
    current.userId,
  ).run();
  return { ok: true };
}
