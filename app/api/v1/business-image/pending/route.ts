import { appOrigin } from "@/lib/identity";
import { ApiError, fail, now, one, q, user } from "@/lib/server";

export const dynamic = "force-dynamic";

const MAX_IMAGE_BYTES = 700_000;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function assertSameOrigin(req: Request) {
  const site = req.headers.get("sec-fetch-site");
  const origin = req.headers.get("origin");
  const expected = appOrigin() || new URL(req.url).origin;
  if (site === "cross-site") throw new ApiError("İstek kaynağı geçersiz.", 403);
  if (origin) {
    let parsed = "";
    try {
      parsed = new URL(origin).origin;
    } catch {
      throw new ApiError("İstek kaynağı geçersiz.", 403);
    }
    if (parsed !== expected) throw new ApiError("İstek kaynağı geçersiz.", 403);
  }
}

function validMagic(bytes: Uint8Array, type: string) {
  if (type === "image/jpeg") return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === "image/png") return bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  if (type === "image/webp") return bytes.length > 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  return false;
}

function encodeBase64(bytes: Uint8Array) {
  let binary = "";
  const size = 0x8000;
  for (let i = 0; i < bytes.length; i += size) {
    binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + size, bytes.length)));
  }
  return btoa(binary);
}

export async function GET() {
  try {
    const u = await user();
    const row = await one("SELECT updated_at FROM pending_business_media WHERE user_id=?", u.userId);
    return Response.json({ has_image: !!row, updated_at: row?.updated_at || null }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const u = await user();
    const contentType = (req.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    if (!ALLOWED_TYPES.has(contentType)) throw new ApiError("JPG, PNG veya WebP görsel yükleyin.", 415);
    const declared = Number(req.headers.get("content-length") || 0);
    if (Number.isFinite(declared) && declared > MAX_IMAGE_BYTES) throw new ApiError("Görsel çok büyük. Daha küçük bir fotoğraf seçin.", 413);
    const bytes = new Uint8Array(await req.arrayBuffer());
    if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) throw new ApiError("Görsel çok büyük. Daha küçük bir fotoğraf seçin.", 413);
    if (!validMagic(bytes, contentType)) throw new ApiError("Görsel dosyası doğrulanamadı.", 400);
    await q(
      `INSERT INTO pending_business_media (user_id,image_data,content_type,updated_at)
       VALUES (?,?,?,?)
       ON CONFLICT(user_id) DO UPDATE SET image_data=excluded.image_data,content_type=excluded.content_type,updated_at=excluded.updated_at`,
      u.userId,
      encodeBase64(bytes),
      contentType,
      now(),
    ).run();
    await q("DELETE FROM pending_business_media WHERE updated_at<?", new Date(Date.now() - 14 * 86400000).toISOString()).run();
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(req: Request) {
  try {
    assertSameOrigin(req);
    const u = await user();
    await q("DELETE FROM pending_business_media WHERE user_id=?", u.userId).run();
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return fail(e);
  }
}
