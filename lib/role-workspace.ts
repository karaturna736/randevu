import { PLAN_LIMITS, tenantPlan } from "./entitlements";
import { SELECT_APPOINTMENTS } from "./booking";
import { all, isAdmin, one } from "./server";
import { workspace } from "./workspace";
import { businessAccess } from "./business-access";
import { today } from "./types";

export async function roleWorkspace(id?: string) {
  const access = await businessAccess(id);
  if (access.role === "owner") {
    const data = await workspace(access.business.id);
    return {
      ...data,
      access: {
        role: access.role,
        label: access.capabilities.label,
        branch_id: null,
        branch_name: null,
        capabilities: access.capabilities,
      },
    };
  }

  const tenantId = String(access.business.id);
  const branchId = String(access.branchId);
  const business = await one(
    "SELECT * FROM businesses WHERE id=? AND status NOT IN ('deleted','suspended')",
    tenantId,
  );
  const plan = await tenantPlan(tenantId);
  const planLimits = PLAN_LIMITS[plan];
  const memberships = access.memberships.filter((row: any) => !row.demo);

  const services = await all(
    "SELECT * FROM services WHERE tenant_id=? AND active=1 ORDER BY name",
    tenantId,
  );
  const staff = await all(
    `SELECT s.*,br.name branch_name FROM staff s
     LEFT JOIN branches br ON br.tenant_id=s.tenant_id AND br.id=s.branch_id
     WHERE s.tenant_id=? AND s.branch_id=? AND s.active=1 ORDER BY s.name`,
    tenantId,
    branchId,
  );
  const appointments = await all(
    SELECT_APPOINTMENTS +
      " WHERE a.tenant_id=? AND a.branch_id=? ORDER BY a.date DESC,a.minute LIMIT 3000",
    tenantId,
    branchId,
  );
  const customers = await all(
    `SELECT c.*,
       COUNT(CASE WHEN a.status='completed' THEN 1 END) visits,
       COALESCE(SUM(CASE WHEN a.status='completed' THEN a.price ELSE 0 END),0) total_spent,
       MAX(CASE WHEN a.status='completed' THEN a.date END) last_visit,
       COUNT(CASE WHEN a.status='no_show' THEN 1 END) no_shows,
       (SELECT p.name FROM appointments ap JOIN staff p ON p.id=ap.staff_id AND p.tenant_id=ap.tenant_id
        WHERE ap.tenant_id=c.tenant_id AND ap.customer_id=c.id AND ap.branch_id=? AND ap.status='completed'
        GROUP BY ap.staff_id ORDER BY COUNT(*) DESC LIMIT 1) preferred_staff
     FROM customers c
     LEFT JOIN appointments a ON a.tenant_id=c.tenant_id AND a.customer_id=c.id AND a.branch_id=?
     WHERE c.tenant_id=? AND EXISTS(
       SELECT 1 FROM appointments ax WHERE ax.tenant_id=c.tenant_id AND ax.customer_id=c.id AND ax.branch_id=?
     )
     GROUP BY c.id ORDER BY c.name LIMIT 3000`,
    branchId,
    branchId,
    tenantId,
    branchId,
  );
  const closures = await all(
    `SELECT c.* FROM closures c
     WHERE c.tenant_id=? AND c.date>=? AND (
       c.staff_id IS NULL OR EXISTS(
         SELECT 1 FROM staff s WHERE s.tenant_id=c.tenant_id AND s.id=c.staff_id AND s.branch_id=?
       )
     ) ORDER BY c.date`,
    tenantId,
    today(),
    branchId,
  );
  const reviews = await all(
    `SELECT r.* FROM reviews r JOIN appointments a
       ON a.tenant_id=r.tenant_id AND a.id=r.appointment_id
     WHERE r.tenant_id=? AND a.branch_id=? ORDER BY r.created_at DESC LIMIT 100`,
    tenantId,
    branchId,
  );
  const branches = await all(
    "SELECT * FROM branches WHERE tenant_id=? AND id=? AND active=1",
    tenantId,
    branchId,
  );

  return {
    business,
    businesses: memberships.map((row: any) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      category: row.category,
      city: row.city,
      access_role: row.access_role,
      branch_id: row.branch_id,
      branch_name: row.branch_name,
    })),
    entitlements: {
      plan,
      label: planLimits.label,
      modules: planLimits.modules,
      branches: planLimits.branches,
      staff: planLimits.staff,
      advancedReports: planLimits.advancedReports,
      whatsappMonthly: planLimits.whatsappMonthly,
      aiDaily: planLimits.aiDaily,
    },
    services,
    staff,
    appointments,
    customers,
    closures,
    reviews,
    branches,
    user: access.actor,
    isAdmin: await isAdmin(access.actor),
    preview: false,
    access: {
      role: access.role,
      label: access.capabilities.label,
      branch_id: branchId,
      branch_name: access.branchName,
      capabilities: access.capabilities,
    },
  };
}
