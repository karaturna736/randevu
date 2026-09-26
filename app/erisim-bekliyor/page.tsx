import { redirect } from "next/navigation";
import { getAppUser } from "@/lib/identity";
import { accountPaymentState } from "@/lib/onboarding-payment";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Panel erişimi bekleniyor · Neta",
};

export default async function Page() {
  const current = await getAppUser();
  if (!current) redirect("/giris?rol=business&sonra=%2Ferisim-bekliyor");

  const access = await accountPaymentState(current.userId);
  if (access.state === "active") redirect("/panel");

  return (
    <main className="public-page">
      <section className="neta-container" style={{ maxWidth: 760, paddingTop: 96, paddingBottom: 96 }}>
        <div className="panel" style={{ textAlign: "center", padding: 40 }}>
          <span className="eyebrow">NETA İŞLETME HESABI</span>
          <h1 style={{ marginTop: 16 }}>Kaydın alındı.</h1>
          <p style={{ maxWidth: 560, margin: "14px auto 0" }}>
            İşletme panelin yönetici onayından sonra açılacak. Şimdilik kart veya abonelik işlemi yapmana gerek yok.
          </p>
          <div className="notice" style={{ marginTop: 24, textAlign: "left" }}>
            Yönetici hesabına Standart, Pro veya Plus paketi tanımladığında panelin otomatik olarak kullanıma açılır.
          </div>
          <div className="button-group" style={{ justifyContent: "center", marginTop: 24 }}>
            <a className="button primary" href="/panel">Erişimi tekrar kontrol et</a>
            <a className="button" href="/hesabim">Hesabım</a>
          </div>
        </div>
      </section>
    </main>
  );
}
