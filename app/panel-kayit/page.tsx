import TurnstileGate from "@/components/product/turnstile-gate";
import { BusinessSignup } from "@/components/product/business-auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Yönetici hesabı oluştur · Neta" };

export default function Page() {
  return (
    <>
      <TurnstileGate />
      <BusinessSignup />
    </>
  );
}
