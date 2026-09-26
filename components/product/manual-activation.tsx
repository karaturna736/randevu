"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Clock3, RefreshCw, ShieldCheck } from "lucide-react";
import { PublicShell } from "./public";
import { AccountGate } from "./session";
import { api, Brand, Busy } from "./common";

export default function ManualActivation() {
  return (
    <PublicShell>
      <main className="billing-page">
        <AccountGate returnTo="/abonelik">
          <ActivationState />
        </AccountGate>
      </main>
    </PublicShell>
  );
}

function ActivationState() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams(location.search);
      const tenant = query.get("tenant") || "";
      const result = await api("workspace" + (tenant ? "?tenant=" + encodeURIComponent(tenant) : ""));
      if (!result.subscription_required && result.business) {
        location.replace(
          "/panel" + (result.business.id ? "?tenant=" + encodeURIComponent(result.business.id) : ""),
        );
        return;
      }
      setData(result);
    } catch (e: any) {
      setError(e?.message || "Panel durumu kontrol edilemedi.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = window.setInterval(() => refresh(), 15000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  if (loading && !data)
    return <div className="loading-row"><Busy /> Panel erişiminiz kontrol ediliyor…</div>;

  if (error)
    return (
      <section className="panel payment-checkout">
        <Brand />
        <h1>Panel durumu kontrol edilemedi.</h1>
        <p>{error}</p>
        <button className="button primary" onClick={refresh} disabled={loading}>
          <RefreshCw size={16} /> Tekrar dene
        </button>
      </section>
    );

  if (data?.needs_onboarding)
    return (
      <section className="panel payment-checkout">
        <span className="eyebrow">NETA İŞLETME HESABI</span>
        <h1>Önce işletmenizi oluşturalım.</h1>
        <p>Panel erişimi vermemiz için hesabınıza bir işletme kaydı eklenmesi gerekiyor.</p>
        <a className="button primary" href="/kurulum">İşletmemi oluştur</a>
      </section>
    );

  const business = data?.business;
  return (
    <section className="panel payment-checkout">
      <span className="eyebrow">PANEL AKTİVASYONU</span>
      <div className="payment-total">
        <span>{business?.name || "İşletmeniz"}</span>
        <strong>Onay bekliyor</strong>
      </div>
      <div className="notice">
        <Clock3 size={20} />
        <div>
          <strong>Kaydınız bize ulaştı.</strong>
          <p>
            Şu anda online abonelik ve ödeme alınmıyor. Neta yönetimi hesabınızı
            Standart, Pro veya Plus paketiyle aktifleştirdiğinde paneliniz otomatik açılacak.
          </p>
        </div>
      </div>
      <div className="form-stack">
        <div className="identity-confirmed">
          <ShieldCheck size={17} />
          <span>Ödeme bilgisi gerekmez</span>
          <span>Manuel aktivasyon</span>
        </div>
        <div className="identity-confirmed">
          <CheckCircle2 size={17} />
          <span>İşletme kaydı tamamlandı</span>
          <span>Hazır</span>
        </div>
      </div>
      <p className="helper">
        Bu ekran 15 saniyede bir otomatik kontrol edilir. Yönetici erişimi açtığı anda panelinize yönlendirilirsiniz.
      </p>
      <button className="button primary" onClick={refresh} disabled={loading}>
        {loading ? <Busy /> : <RefreshCw size={16} />} Durumu kontrol et
      </button>
    </section>
  );
}
