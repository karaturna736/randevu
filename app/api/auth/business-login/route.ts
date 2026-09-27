import { issueAppSession } from "@/lib/identity";
import { requireTurnstileGate } from "@/lib/turnstile";
import { authenticatePassword } from "@/lib/password-auth";
import { businessPanelActive, normalizeBusinessRole, type BusinessRole } from "@/lib/business-access";
import { all, body, fail, limit, ok } from "@/lib/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const schema = z.object({
  role: z.enum(["owner", "manager", "employee"]),
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(128),
});

export async function POST(req: Request) {
  try {
    await limit(req, "business-password-login", 10);
    await requireTurnstileGate(req);
    const input = schema.parse(await body(req));
    const account = await authenticatePassword(input.email, input.password);
    const memberships = await all(
      `SELECT m.tenant_id,m.role,m.disabled,b.status
       FROM members m JOIN businesses b ON b.id=m.tenant_id
       WHERE m.user_id=? AND m.disabled=0 AND b.status NOT IN ('deleted','suspended')`,
      account.user_id,
    );
    const requestedRole = input.role as BusinessRole;
    const matching = memberships.filter((row: any) => {
      try {
        return normalizeBusinessRole(row.role) === requestedRole;
      } catch {
        return false;
      }
    });

    const pendingOwner =
      requestedRole === "owner" &&
      account.account_type === "business" &&
      memberships.length === 0;
    if (!matching.length && !pendingOwner)
      throw new Error("ROLE_MISMATCH");

    let next = "/erisim-bekliyor";
    for (const membership of matching) {
      if (await businessPanelActive(String(membership.tenant_id))) {
        next = "/panel";
        break;
      }
    }

    const sessionCookie = await issueAppSession(req, {
      userId: account.user_id,
      email: account.email,
      name: account.name,
    });
    const response = ok({ ok: true, next, role: requestedRole });
    response.headers.append("Set-Cookie", sessionCookie);
    return response;
  } catch (e) {
    if (String(e).includes("ROLE_MISMATCH"))
      return ok({ error: "Bu hesap seçtiğiniz panel türüne ait değil." }, 403);
    return fail(e);
  }
}
