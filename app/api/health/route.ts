import { env } from "cloudflare:workers";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await env.DB!.prepare("SELECT 1 AS ok").first();
    return Response.json(
      { status: "ok", database: "ok" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { status: "error", database: "unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
