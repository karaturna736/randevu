import { issueAppSession } from "@/lib/identity";
import { requireTurnstileGate } from "@/lib/turnstile";
import { hashPanelPassword, panelLoginSchema, panelPasswordSchema } from "@/lib/password-auth";
import { body, db, fail, limit, name, now, ok, one, q } from "@/lib/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const schema = z.object({
  name,
  email: panelLoginSchema,
  password: panelPasswordSchema,
});

export async function POST(req: Request) {
  try {
    await limit(req, "business-password-signup", 6);
    await requireTurnstileGate(req);
    const input = schema.parse(await body(req));
    const existing = await one(
      "SELECT user_id FROM profiles WHERE lower(email)=? LIMIT 1",
      input.email,
    );
    if (existing)
      return ok({ error: "Bu e-posta ile bir hesap zaten bulunuyor. Giriş yapın." }, 409);
    if (await one("SELECT user_id FROM password_credentials WHERE login=?", input.email))
      return ok({ error: "Bu e-posta ile bir hesap zaten bulunuyor. Giriş yapın." }, 409);

    const userId = `local:${crypto.randomUUID()}`;
    const stamp = now();
    const passwordHash = await hashPanelPassword(input.password);
    await db().batch([
      q(
        `INSERT INTO profiles(user_id,name,email,phone,city,account_type,marketing_consent,disabled,created_at,updated_at)
         VALUES(?,?,?,'','','business',0,0,?,?)`,
        userId,
        input.name,
        input.email,
        stamp,
        stamp,
      ),
      q(
        `INSERT INTO password_credentials(user_id,login,password_hash,must_change_password,created_at,updated_at)
         VALUES(?,?,?,0,?,?)`,
        userId,
        input.email,
        passwordHash,
        stamp,
        stamp,
      ),
    ]);

    const sessionCookie = await issueAppSession(req, {
      userId,
      email: input.email,
      name: input.name,
    });
    const response = ok({ ok: true, next: "/erisim-bekliyor", role: "owner" }, 201);
    response.headers.append("Set-Cookie", sessionCookie);
    return response;
  } catch (e) {
    return fail(e);
  }
}
