import { fail, limit } from "@/lib/server";
import { issueTurnstileGate, verifyTurnstile } from "@/lib/turnstile";

export const dynamic = "force-dynamic";

type TurnstileBody = {
  token?: unknown;
};

export async function POST(req: Request) {
  try {
    await limit(req, "turnstile-auth", 30);
    const body = (await req.json()) as TurnstileBody;
    const token = typeof body.token === "string" ? body.token : "";
    await verifyTurnstile(req, token, "auth");
    const gate = await issueTurnstileGate();
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        "Set-Cookie": `neta_turnstile=${gate}; Path=/api/auth/google; HttpOnly; Secure; SameSite=Lax; Max-Age=300`,
      },
    });
  } catch (e) {
    return fail(e);
  }
}
