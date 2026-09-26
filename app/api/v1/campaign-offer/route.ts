import { automaticCampaignOffer } from "@/lib/campaign-offers";
import { fail, limit, ok } from "@/lib/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    await limit(req, "campaign-offer", 60);
    return ok(await automaticCampaignOffer(new URL(req.url).searchParams));
  } catch (error) {
    return fail(error);
  }
}
