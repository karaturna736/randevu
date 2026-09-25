import { signOutApp } from "@/lib/identity";
import { body, fail } from "@/lib/server";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  try {
    await body(req);
    const r = await signOutApp(req);
    const headers = new Headers(r.headers);
    const redirect = headers.get("Location") || "/giris";
    headers.delete("Location");
    headers.set("Content-Type", "application/json");
    return new Response(JSON.stringify({ redirect }), { headers });
  } catch (e) {
    return fail(e);
  }
}
