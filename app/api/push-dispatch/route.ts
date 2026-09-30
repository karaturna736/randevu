import webpush from 'web-push';
import { timingSafeEqual } from 'node:crypto';
import { all, fail, ok, q, now } from '@/lib/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const token = process.env.PUSH_DISPATCH_SECRET || '';
    const supplied = req.headers.get('authorization')?.replace(/^Bearer /, '') || '';
    if (!token || !supplied || Buffer.byteLength(token) !== Buffer.byteLength(supplied) ||
        !timingSafeEqual(Buffer.from(token), Buffer.from(supplied))) {
      return Response.json({ error: 'Yetkisiz.' }, { status: 401 });
    }
    if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY || !process.env.VAPID_SUBJECT) {
      return Response.json({ error: 'Web Push yapılandırılmadı.' }, { status: 503 });
    }
    webpush.setVapidDetails(process.env.VAPID_SUBJECT, process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
    // Old events must never be delivered after a delayed deployment or subscription.
    const rows = await all(`SELECT n.id,n.type,n.title,n.tenant_id,s.endpoint,s.p256dh,s.auth
      FROM notification_events n JOIN push_subscriptions s ON s.tenant_id=n.tenant_id
      JOIN members m ON m.tenant_id=n.tenant_id AND m.user_id=s.user_id AND m.disabled=0
      LEFT JOIN push_deliveries d ON d.event_id=n.id AND d.endpoint=s.endpoint
      WHERE n.recipient_user_id IS NULL AND d.event_id IS NULL
        AND n.created_at> s.created_at AND n.created_at>?
        AND n.type IN ('appointment.created','appointment.cancelled','appointment.updated')
      ORDER BY n.created_at ASC LIMIT 80`, new Date(Date.now() - 24 * 3600_000).toISOString());
    let delivered = 0;
    for (const row of rows) {
      try {
        await webpush.sendNotification({ endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
          JSON.stringify({ id: row.id, title: row.title, body: 'Randevu ayrıntılarını Neta panelinden görüntüleyin.' }), { TTL: 3600 });
        await q('INSERT OR IGNORE INTO push_deliveries(event_id,endpoint,delivered_at) VALUES(?,?,?)', row.id, row.endpoint, now()).run();
        delivered++;
      } catch (error: any) {
        if (error?.statusCode === 404 || error?.statusCode === 410) {
          await q('DELETE FROM push_subscriptions WHERE endpoint=?', row.endpoint).run();
        } else {
          console.error('Web Push delivery failed', { status: error?.statusCode, eventId: row.id });
        }
      }
    }
    return ok({ delivered, pending: rows.length - delivered });
  } catch (error) { return fail(error); }
}
