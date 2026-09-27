import { redirect } from "next/navigation";
import BranchPasswordSetup from "@/components/product/branch-password-setup";
import { getAppUser } from "@/lib/identity";
import { accountPaymentState } from "@/lib/onboarding-payment";
import { branchPasswordSetupTarget } from "@/lib/branch-password";

export const dynamic = "force-dynamic";
export const metadata = { title: "Şube şifresi kurulumu · Neta" };

export default async function Page() {
  const current = await getAppUser();
  if (!current)
    redirect("/giris?rol=business&sonra=%2Fsube-sifre-kurulum");

  const payment = await accountPaymentState(current.userId);
  if (payment.state !== "active") redirect("/erisim-bekliyor");

  const target = await branchPasswordSetupTarget(current.userId);
  if (!target) redirect("/panel");

  return <BranchPasswordSetup target={target} />;
}
