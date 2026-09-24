import { one } from "@/lib/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await one("SELECT 1 ok");
    return Response.json(
      { status: "ok", database: "ok", time: new Date().toISOString() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { status: "error", database: "unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
