import { PLAN_LIMITS, tenantPlan } from "./entitlements";
import { businessAccess } from "./business-access";
import { all, ApiError, one } from "./server";

function percent(value: number) {
  return Math.round(value * 1000) / 10;
}

export async function managerBranchSnapshot(tenantId: string, month: string) {
  const access = await businessAccess(tenantId, ["manager"]);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new ApiError("Geçerli bir ay seçin.", 400);
  const branchId = String(access.branchId);
  const actualPlan = await tenantPlan(tenantId);
  const effectivePlan = actualPlan === "normal" ? "normal" : "pro";
  const baseLimits = PLAN_LIMITS[effectivePlan];
  const b = await one(
    `SELECT b.*,
      COALESCE((SELECT SUM(a.price) FROM appointments a WHERE a.tenant_id=b.tenant_id AND a.branch_id=b.id AND a.status='completed' AND substr(a.date,1,7)=?),0) revenue,
      COALESCE((SELECT SUM(e.amount) FROM branch_expenses e WHERE e.tenant_id=b.tenant_id AND e.branch_id=b.id AND e.month=?),0) expenses,
      COALESCE((SELECT COUNT(*) FROM appointments a WHERE a.tenant_id=b.tenant_id AND a.branch_id=b.id AND a.status='completed' AND substr(a.date,1,7)=?),0) completed,
      COALESCE((SELECT SUM(a.duration) FROM appointments a WHERE a.tenant_id=b.tenant_id AND a.branch_id=b.id AND a.status='completed' AND substr(a.date,1,7)=?),0) completed_minutes,
      COALESCE((SELECT COUNT(*) FROM appointments a WHERE a.tenant_id=b.tenant_id AND a.branch_id=b.id AND a.status='no_show' AND substr(a.date,1,7)=?),0) no_show,
      COALESCE((SELECT COUNT(*) FROM appointments a WHERE a.tenant_id=b.tenant_id AND a.branch_id=b.id AND a.status='cancelled' AND substr(a.date,1,7)=?),0) cancelled,
      COALESCE((SELECT COUNT(DISTINCT a.customer_id) FROM appointments a WHERE a.tenant_id=b.tenant_id AND a.branch_id=b.id AND a.status='completed' AND substr(a.date,1,7)=?),0) unique_customers,
      COALESCE((SELECT COUNT(*) FROM staff s WHERE s.tenant_id=b.tenant_id AND s.branch_id=b.id AND s.active=1),0) staff_count,
      COALESCE((SELECT expenses_confirmed FROM branch_month_closings c WHERE c.tenant_id=b.tenant_id AND c.branch_id=b.id AND c.month=?),0) expenses_confirmed
     FROM branches b WHERE b.tenant_id=? AND b.id=? AND b.active=1`,
    month, month, month, month, month, month, month, month, tenantId, branchId,
  );
  if (!b) throw new ApiError("Atandığınız şube bulunamadı.", 404);

  const expenses = await all(
    `SELECT e.*,b.name branch_name,c.name catalog_name FROM branch_expenses e
     JOIN branches b ON b.tenant_id=e.tenant_id AND b.id=e.branch_id
     LEFT JOIN expense_catalog_items c ON c.tenant_id=e.tenant_id AND c.id=e.catalog_item_id
     WHERE e.tenant_id=? AND e.branch_id=? AND e.month=? ORDER BY e.created_at DESC`,
    tenantId, branchId, month,
  );
  const topService = await one(
    `SELECT a.service_id,COALESCE(s.name,'Hizmet') name,COUNT(*) completed,COALESCE(SUM(a.price),0) revenue
     FROM appointments a LEFT JOIN services s ON s.tenant_id=a.tenant_id AND s.id=a.service_id
     WHERE a.tenant_id=? AND a.branch_id=? AND a.status='completed' AND substr(a.date,1,7)=?
     GROUP BY a.service_id,s.name ORDER BY revenue DESC,completed DESC LIMIT 1`,
    tenantId, branchId, month,
  );
  const returning = await one(
    `SELECT COUNT(DISTINCT a.customer_id) n FROM appointments a
     WHERE a.tenant_id=? AND a.branch_id=? AND a.status='completed' AND substr(a.date,1,7)=?
       AND EXISTS(SELECT 1 FROM appointments p WHERE p.tenant_id=a.tenant_id AND p.customer_id=a.customer_id AND p.status='completed' AND p.date<?)`,
    tenantId, branchId, month, month + "-01",
  );
  const revenue = Number(b.revenue || 0);
  const expenseTotal = Number(b.expenses || 0);
  const completed = Number(b.completed || 0);
  const minutes = Number(b.completed_minutes || 0);
  const noShow = Number(b.no_show || 0);
  const uniqueCustomers = Number(b.unique_customers || 0);
  const returningCustomers = Number(returning?.n || 0);
  const net = revenue - expenseTotal;
  const row = {
    ...b,
    revenue,
    expenses: expenseTotal,
    net,
    completed,
    completed_minutes: minutes,
    no_show: noShow,
    cancelled: Number(b.cancelled || 0),
    unique_customers: uniqueCustomers,
    returning_customers: returningCustomers,
    staff_count: Number(b.staff_count || 0),
    avg_ticket: completed ? Math.round(revenue / completed) : 0,
    revenue_per_hour: minutes ? Math.round((revenue * 60) / minutes) : 0,
    no_show_rate: completed + noShow ? percent(noShow / (completed + noShow)) : 0,
    returning_rate: uniqueCustomers ? percent(returningCustomers / uniqueCustomers) : 0,
    net_margin: revenue ? percent(net / revenue) : 0,
    top_service: topService ? { ...topService, revenue_share: revenue ? percent(Number(topService.revenue) / revenue) : 0 } : null,
    estimated: Number(b.expenses_confirmed) !== 1,
  };
  return {
    month,
    plan: effectivePlan,
    actual_plan: actualPlan,
    limits: { ...baseLimits, branches: 1 },
    branches: [row],
    expenses,
    catalog: [],
    analysis: { method: "branch-scoped", leader: { id: row.id, name: row.name, net: row.net }, comparisons: [] },
    summary: { revenue, expenses: expenseTotal, net, estimated: row.estimated },
    access: { role: "manager", branch_id: branchId, branch_name: access.branchName },
  };
}
