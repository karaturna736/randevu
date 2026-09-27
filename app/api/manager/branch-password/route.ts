import { body, fail, limit, ok, tenant } from '@/lib/server';
import { setBranchAccessPassword } from '@/lib/branch-access';
import { z } from 'zod';

export async function GET(req: Request) {
  try {
    const tenantId = new URL(req.url).searchParams.get('tenant') || '';
    z.string().min(1).parse(tenantId);
    await tenant(tenantId);
    return ok({ branches: [] });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(req: Request) {
  try {
    await limit(req, 'branch-password-set', 10);
    const x = z.object({ tenant_id: z.string().min(1), branch_id: z.string().min(1), password: z.string().min(1).max(72) }).parse(await body(req));
    return ok(await setBranchAccessPassword(x.tenant_id, x.branch_id, x.password));
  } catch (error) {
    return fail(error);
  }
}
