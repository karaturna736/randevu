import { safeDestination } from "@/lib/calendar";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const returnTo = safeDestination(url.searchParams.get("return_to"), "/panel");
  const target = new URL("/giris", url.origin);
  target.searchParams.set("rol", "business");
  target.searchParams.set("sonra", returnTo);
  return Response.redirect(target, 307);
}
