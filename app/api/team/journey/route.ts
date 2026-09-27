import { body, fail, limit, ok } from '@/lib/server';
import { advanceTeamJourney } from '@/lib/team';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    await limit(req, 'staff-journey-action', 60);
    const x = await body(req);
    return ok(await advanceTeamJourney(String(x.tenant_id || ''), x));
  } catch (e) {
    return fail(e);
  }
}
