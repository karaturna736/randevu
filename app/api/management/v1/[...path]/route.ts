import { fail, ok } from "@/lib/server";
import { managementApiGet, managementApiPost } from "@/lib/plus-business-tools";

export const dynamic = "force-dynamic";

function resource(req: Request) {
  const path = new URL(req.url).pathname.split("/").filter(Boolean);
  return path[path.length - 1] || "";
}

export async function GET(req: Request) {
  try {
    return ok(await managementApiGet(req, resource(req)));
  } catch (error) {
    return fail(error);
  }
}

export async function POST(req: Request) {
  try {
    return ok(await managementApiPost(req, resource(req)), 201);
  } catch (error) {
    return fail(error);
  }
}
