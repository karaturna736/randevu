import { one } from "@/lib/server";

export const dynamic = "force-dynamic";

function decodeBase64(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function GET(req: Request) {
  const id = decodeURIComponent(new URL(req.url).pathname.split("/").filter(Boolean).pop() || "");
  if (!/^[a-zA-Z0-9_-]{8,80}$/.test(id)) return new Response(null, { status: 404 });
  const row = await one(
    `SELECT bm.image_data,bm.content_type
     FROM business_media bm
     JOIN businesses b ON b.id=bm.tenant_id
     WHERE bm.tenant_id=? AND b.status='approved' AND b.demo=0
     LIMIT 1`,
    id,
  );
  if (!row?.image_data || !["image/jpeg", "image/png", "image/webp"].includes(String(row.content_type))) {
    return new Response(null, { status: 404, headers: { "Cache-Control": "public, max-age=300" } });
  }
  try {
    const bytes = decodeBase64(String(row.image_data));
    if (!bytes.length || bytes.length > 700_000) return new Response(null, { status: 404 });
    return new Response(bytes, {
      status: 200,
      headers: {
        "Content-Type": String(row.content_type),
        "Content-Length": String(bytes.byteLength),
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  } catch {
    return new Response(null, { status: 404 });
  }
}
