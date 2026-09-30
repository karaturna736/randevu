import { z } from 'zod';
import { ApiError, body, fail, limit, now, ok, q, tenant, user } from '@/lib/server';

export const dynamic = 'force-dynamic';
const schema = z.object({
  tenant_id: z.string().min(1).max(100),
  endpoint: z.string().url().max(2048).refine(value => {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.port && !url.username && !url.password &&
      (url.hostname === 'fcm.googleapis.com' || url.hostname === 'updates.push.services.mozilla.com' ||
       url.hostname === 'web.push.apple.com' || url.hostname.endsWith('.push.apple.com') ||
       url.hostname.endsWith('.notify.windows.com'));
  }, 'Desteklenmeyen bildirim adresi.'),
  keys: z.object({ p256dh: z.string().min(10).max(500), auth: z.string().min(10).max(500) }),
});

export async function GET(req: Request) {
  try {
    await limit(req, 'push-settings', 30);
    const tenantId = new URL(req.url).searchParams.get('tenant') || '';
    await tenant(tenantId);
    const current = await user();
    const configured = !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
    const subscriptions = configured ? await q('SELECT endpoint FROM push_subscriptions WHERE user_id=? AND tenant_id=?', current.userId, tenantId).all<{endpoint:string}>() : null;
    return ok({ configured, public_key: configured ? process.env.VAPID_PUBLIC_KEY : null,
      endpoints: subscriptions?.results.map(row => row.endpoint) || [] });
  } catch (error) { return fail(error); }
}

export async function POST(req: Request) {
  try {
    await limit(req, 'push-register', 15);
    if (!process.env.VAPID_PRIVATE_KEY) throw new ApiError('Cihaz bildirimleri sunucuda henüz yapılandırılmadı.', 503);
    const input = schema.parse(await body(req));
    await tenant(input.tenant_id);
    const current = await user();
    await q(`INSERT INTO push_subscriptions(endpoint,user_id,tenant_id,p256dh,auth,created_at) VALUES(?,?,?,?,?,?)
      ON CONFLICT(endpoint) DO UPDATE SET user_id=excluded.user_id,tenant_id=excluded.tenant_id,p256dh=excluded.p256dh,auth=excluded.auth,created_at=excluded.created_at`,
      input.endpoint, current.userId, input.tenant_id, input.keys.p256dh, input.keys.auth, now()).run();
    return ok({ subscribed: true });
  } catch (error) { return fail(error); }
}
