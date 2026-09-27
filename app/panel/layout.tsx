import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getAppUser } from "@/lib/identity";
import { businessMemberships, businessPanelActive } from "@/lib/business-access";

export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: ReactNode }) {
  const current = await getAppUser();
  if (!current) redirect("/panel-giris");

  const memberships = await businessMemberships(current.userId);
  let active = false;
  for (const membership of memberships) {
    if (await businessPanelActive(String(membership.id))) {
      active = true;
      break;
    }
  }
  if (!active) redirect("/erisim-bekliyor");
  return children;
}
