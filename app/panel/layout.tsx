import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getAppUser } from "@/lib/identity";
import { businessMemberships, businessPanelActive, type BusinessRole } from "@/lib/business-access";
import RolePanelGuard from "@/components/product/role-panel-guard";

export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: ReactNode }) {
  const current = await getAppUser();
  if (!current) redirect("/panel-giris");

  const memberships = await businessMemberships(current.userId);
  let activeMembership: any = null;
  for (const membership of memberships) {
    if (await businessPanelActive(String(membership.id))) {
      activeMembership = membership;
      break;
    }
  }
  if (!activeMembership) redirect("/erisim-bekliyor");
  return (
    <>
      <RolePanelGuard
        role={activeMembership.access_role as BusinessRole}
        branchName={activeMembership.branch_name || null}
      />
      {children}
    </>
  );
}
