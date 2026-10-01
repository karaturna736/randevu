import { redirect } from "next/navigation";
import { getAppUser } from "@/lib/identity";
import { isBaseAdmin } from "@/lib/server";
import { adminAccessConfigured, hasAdminAccess } from "@/lib/admin-access";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getAppUser();
  if (!user) redirect("/giris?rol=business&sonra=%2Fadmin");
  if (!(await isBaseAdmin(user))) redirect("/panel");
  if (adminAccessConfigured() && !(await hasAdminAccess(user.userId))) {
    redirect("/yonetici-giris");
  }
  return children;
}
