import { z } from "zod";
import { user, isAdmin, limit, body, fail, ApiError } from "@/lib/server";
import {
  adminAccessConfigured,
  adminAccessCookie,
  verifyAdminPassword,
} from "@/lib/admin-access";
import { privateHeaders } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    await limit(req, "admin-access", 6);
    const current = await user();
    if (!(await isAdmin(current)))
      throw new ApiError("Yalnızca platform yöneticisi erişebilir.", 403);
    if (!adminAccessConfigured())
      throw new ApiError("Yönetici şifresi henüz sunucuda ayarlanmadı.", 503);
    const input = z
      .object({ password: z.string().min(12).max(256) })
      .parse(await body(req));
    if (!(await verifyAdminPassword(input.password)))
      throw new ApiError("Yönetici şifresi yanlış.", 401);
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: {
        ...privateHeaders,
        "Content-Type": "application/json",
        "Set-Cookie": await adminAccessCookie(current.userId),
      },
    });
  } catch (error) {
    return fail(error);
  }
}
