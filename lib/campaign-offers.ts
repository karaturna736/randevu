import { z } from "zod";
import { PLAN_CATALOG } from "./entitlements";
import { quoteCampaign, type CampaignQuote } from "./campaigns";
import { all, now, one, tenant, user } from "./server";

const planCode = z.enum(["normal", "pro", "plus"]);

type Candidate = {
  code: string;
  target_type: "all" | "new" | "selected" | "selected_users" | "plan";
};

export async function automaticCampaignOffer(search: URLSearchParams): Promise<{
  offer: CampaignQuote | null;
}> {
  const actor = await user();
  const tenantId = search.get("tenant");
  const business = tenantId ? await tenant(tenantId) : null;
  const plan = business
    ? planCode.catch("normal").parse(business.selected_plan)
    : planCode.parse(search.get("plan"));
  const legacyPlan = business
    ? await one("SELECT amount,active FROM billing_settings WHERE id=1")
    : null;
  const amount =
    business && legacyPlan?.active && legacyPlan.amount
      ? Number(legacyPlan.amount)
      : PLAN_CATALOG[plan].amount;
  const stamp = now();

  const candidates = (await all(
    `SELECT code,target_type FROM campaigns
     WHERE active=1 AND deleted_at IS NULL AND starts_at<=? AND ends_at>=?
       AND instr(applicable_plans,?)>0
     ORDER BY CASE target_type
       WHEN 'selected_users' THEN 0
       WHEN 'selected' THEN 1
       WHEN 'new' THEN 2
       WHEN 'plan' THEN 3
       ELSE 4
     END, created_at DESC
     LIMIT 100`,
    stamp,
    stamp,
    `"${plan}"`,
  )) as Candidate[];

  for (const candidate of candidates) {
    try {
      const offer = await quoteCampaign({
        code: candidate.code,
        plan,
        originalAmount: amount,
        businessId: business?.id || null,
        userId: actor.userId,
        record: false,
      });
      return { offer };
    } catch {
      // Bu aday kullanıcıya uygun değilse sıradaki aktif kampanyayı dene.
    }
  }

  return { offer: null };
}
