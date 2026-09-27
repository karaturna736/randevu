import { ApiError, all, now, one, user } from "./server";

export type BusinessRole = "owner" | "manager" | "employee";

export const BUSINESS_ROLE_LABELS: Record<BusinessRole, string> = {
  owner: "Yönetici",
  manager: "Müdür / Sorumlu",
  employee: "Çalışan",
};

export function normalizeBusinessRole(value: unknown): BusinessRole {
  const role = String(value || "").toLowerCase();
  if (role === "owner") return "owner";
  if (role === "manager") return "manager";
  if (role === "employee" || role === "staff") return "employee";
  throw new ApiError("İşletme rolü geçersiz.", 403);
}

export function roleCapabilities(role: BusinessRole) {
  const owner = role === "owner";
  const manager = role === "manager";
  return {
    role,
    label: BUSINESS_ROLE_LABELS[role],
    branch_scoped: !owner,
    finance: owner || manager,
    manage_team: owner || manager,
    manage_managers: owner,
    settings: owner,
    billing: owner,
    business_wide_analytics: owner,
    marketing: owner,
    integrations: owner,
    views: owner
      ? null
      : manager
        ? ["overview", "appointments", "calendar", "customers", "services", "staff", "branches", "help"]
        : ["appointments", "calendar", "customers", "help"],
  };
}

export async function businessPanelActive(tenantId: string) {
  const stamp = now();
  return !!(await one(
    `SELECT b.id FROM businesses b
     WHERE b.id=? AND b.status NOT IN ('deleted','suspended') AND (
       b.demo=1
       OR EXISTS(SELECT 1 FROM subscriptions s WHERE s.tenant_id=b.id AND s.paid_until>?)
       OR EXISTS(SELECT 1 FROM recurring_subscriptions r WHERE r.tenant_id=b.id AND r.test_mode=0 AND r.plan IN ('normal','pro','plus') AND r.paid_until>?)
       OR EXISTS(SELECT 1 FROM onboarding_payments p WHERE p.tenant_id=b.id AND p.state='active')
     )`,
    tenantId,
    stamp,
    stamp,
  ));
}

export async function businessMemberships(userId?: string) {
  const actor = userId ? { userId } : await user();
  const rows = await all(
    `SELECT b.id,b.name,b.slug,b.status,b.demo,b.category,b.city,b.address,b.phone,b.description,b.hours,b.selected_plan,
            m.user_id,m.email,m.name member_name,m.role,m.staff_id,m.branch_id,
            COALESCE(m.branch_id,s.branch_id) effective_branch_id,
            br.name branch_name
     FROM members m
     JOIN businesses b ON b.id=m.tenant_id
     LEFT JOIN staff s ON s.tenant_id=m.tenant_id AND s.id=m.staff_id
     LEFT JOIN branches br ON br.tenant_id=m.tenant_id AND br.id=COALESCE(m.branch_id,s.branch_id)
     WHERE m.user_id=? AND m.disabled=0 AND b.status NOT IN ('deleted','suspended')
     ORDER BY CASE WHEN m.role='owner' THEN 0 WHEN m.role='manager' THEN 1 ELSE 2 END,b.created_at DESC`,
    actor.userId,
  );
  return rows.map((row: any) => ({
    ...row,
    access_role: normalizeBusinessRole(row.role),
    branch_id: row.effective_branch_id || null,
  }));
}

export async function businessAccess(tenantId?: string, allowed?: BusinessRole[]) {
  const actor = await user();
  const memberships = await businessMemberships(actor.userId);
  const membership = tenantId
    ? memberships.find((row: any) => row.id === tenantId)
    : memberships.find((row: any) => row.access_role === "owner" && !row.demo) ||
      memberships.find((row: any) => !row.demo) ||
      memberships[0];
  if (!membership) throw new ApiError("Bu işletmeye erişim yetkiniz yok.", 403);
  const role = membership.access_role as BusinessRole;
  if (allowed && !allowed.includes(role))
    throw new ApiError("Bu işlem için yetkiniz bulunmuyor.", 403);
  if (role !== "owner" && !membership.branch_id)
    throw new ApiError("Hesabınıza bir şube atanmamış. Yöneticinizle iletişime geçin.", 403);
  if (!(await businessPanelActive(membership.id)))
    throw new ApiError("İşletme paneli şu anda aktif değil.", 402);
  return {
    actor,
    business: membership,
    role,
    branchId: role === "owner" ? null : String(membership.branch_id),
    branchName: membership.branch_name || null,
    capabilities: roleCapabilities(role),
    memberships,
  };
}

export async function requireBusinessRole(tenantId: string, roles: BusinessRole[]) {
  return businessAccess(tenantId, roles);
}
