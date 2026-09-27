import { redirect } from "next/navigation";
import BranchPasswordManager from "@/components/product/branch-password-manager";
import { getAppUser } from "@/lib/identity";
import { paidTenant } from "@/lib/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Şube şifreleri · Neta" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ tenant?: string }>;
}) {
  const current = await getAppUser();
  if (!current)
    redirect("/giris?rol=business&sonra=%2Fpanel%2Fsube-sifreleri");

  const params = await searchParams;
  const requested = params.tenant || undefined;
  const business = await paidTenant(current.userId, requested);
  if (!business) redirect("/erisim-bekliyor");

  return (
    <BranchPasswordManager
      tenantId={String(business.id)}
      businessName={String(business.name)}
    />
  );
}
