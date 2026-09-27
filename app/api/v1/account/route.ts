import { getAppUser } from "@/lib/identity";
import { businessMemberships } from "@/lib/business-access";
import { saveProfile } from "@/lib/accounts";
import { body, fail, isAdmin, limit, ok, one, user } from "@/lib/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const identity = await getAppUser();
    if (!identity) return ok({ authenticated: false, profile: null });
    const actor = await user();
    const profile = await one("SELECT * FROM profiles WHERE user_id=?", actor.userId);
    const memberships = await businessMemberships(actor.userId);
    const businesses = memberships.map((row: any) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      status: row.status,
      demo: row.demo,
      access_role: row.access_role,
      branch_id: row.branch_id,
      branch_name: row.branch_name,
    }));
    return ok({
      authenticated: true,
      user: actor,
      profile,
      businesses,
      panel_memberships: businesses,
      staff_memberships: businesses.filter((row: any) => row.access_role === "employee"),
      isAdmin: await isAdmin(actor),
    });
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: Request) {
  try {
    await limit(req, "profile", 40);
    return ok(await saveProfile(await body(req)));
  } catch (e) {
    return fail(e);
  }
}
