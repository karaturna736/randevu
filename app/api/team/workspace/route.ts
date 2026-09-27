import { body, fail, limit, ok } from '@/lib/server';
import { teamWorkspace } from '@/lib/team';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    await limit(req, 'staff-branch-password', 20);
    const x = await body(req);
    return ok(await teamWorkspace(String(x.tenant_id || ''), String(x.date || ''), x.branch_password));
  } catch (e) {
    return fail(e);
  }
}
