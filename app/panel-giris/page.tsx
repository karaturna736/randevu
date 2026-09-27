import TurnstileGate from "@/components/product/turnstile-gate";
import { BusinessLogin } from "@/components/product/business-auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Panele giriş · Neta" };

export default function Page() {
  return (
    <>
      <TurnstileGate />
      <BusinessLogin />
    </>
  );
}
