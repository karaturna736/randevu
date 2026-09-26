import { NextResponse } from "next/server";
import { z } from "zod";
import { PLAN_CATALOG, type PlanCode } from "@/lib/entitlements";
import { quoteCampaign } from "@/lib/campaigns";
import { all, tenant, user } from "@/lib/server";

export const dynamic = "force-dynamic";

const planCode = z.enum(["normal", "pro", "plus"]);

export async function GET(request: Request) {
  const actor = await user();
  const url = new URL(request.url);
  const tenantId = url.searchParams.get("tenant");
  const business = tenantId ? await tenant(tenantId) : null;
  const requestedPlan = planCode.catch("normal").parse(url.searchParams.get("plan"));
  const plan = business
    ? planCode.catch("normal").parse(business.selected_plan)
    : requestedPlan;
  const businessId = business?.id || null;
  const amount = PLAN_CATALOG[plan as PlanCode].amount;
  const stamp = new Date().toISOString();

  const rows = await all(
    `SELECT code FROM campaigns
     WHERE active=1 AND deleted_at IS NULL AND starts_at<=? AND ends_at>=?
       AND instr(applicable_plans,?)>0
       AND target_type IN ('all','new','selected','selected_users','plan')
     ORDER BY created_at DESC LIMIT 100`,
    stamp,
    stamp,
    `\"${plan}\"`,
  );

  let best: Awaited<ReturnType<typeof quoteCampaign>> | null = null;
  for (const row of rows) {
    try {
      const quote = await quoteCampaign({
        code: row.code,
        plan,
        originalAmount: amount,
        businessId,
        userId: actor.userId,
        record: false,
      });
      if (!best || quote.discount_amount > best.discount_amount) best = quote;
    } catch {
      // Hedefe uymayan veya limiti dolmuş kampanyaları sessizce atla.
    }
  }

  return NextResponse.json(
    { campaign: best },
    { headers: { "Cache-Control": "no-store" } },
  );
}
