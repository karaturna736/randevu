import { NextResponse } from "next/server";
import { z } from "zod";
import { PLAN_CATALOG, type PlanCode } from "@/lib/entitlements";
import { quoteCampaign } from "@/lib/campaigns";
import { all, one, tenant, user } from "@/lib/server";

export const dynamic = "force-dynamic";

const planCode = z.enum(["normal", "pro", "plus"]);
const scopeCode = z.enum(["onboarding", "business"]);

export async function GET(request: Request) {
  const actor = await user();
  const url = new URL(request.url);
  const scope = scopeCode.catch("onboarding").parse(url.searchParams.get("scope"));
  const tenantId = url.searchParams.get("tenant");
  let business = tenantId ? await tenant(tenantId) : null;

  if (!business && scope === "business") {
    const fallback = await one(
      `SELECT b.id FROM businesses b
       JOIN members m ON m.tenant_id=b.id
       WHERE m.user_id=? AND m.role='owner' AND m.disabled=0
         AND b.status NOT IN ('deleted','suspended')
       ORDER BY b.created_at DESC LIMIT 1`,
      actor.userId,
    );
    if (fallback?.id) business = await tenant(fallback.id);
  }

  const requestedPlan = planCode.catch("normal").parse(url.searchParams.get("plan"));
  const plan = business
    ? planCode.catch("normal").parse(business.selected_plan)
    : requestedPlan;
  const businessId = business?.id || null;
  const legacyPlan = business
    ? await one("SELECT amount,active FROM billing_settings WHERE id=1")
    : null;
  const amount =
    business && legacyPlan?.active && legacyPlan.amount
      ? Number(legacyPlan.amount)
      : PLAN_CATALOG[plan as PlanCode].amount;
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
