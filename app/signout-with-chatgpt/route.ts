export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  return Response.redirect(new URL("/cikis", url.origin), 307);
}
