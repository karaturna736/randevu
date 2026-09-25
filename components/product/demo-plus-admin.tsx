"use client";

import { useEffect, useState } from "react";
import { ArrowRight, BarChart3, CheckCircle2, Gauge, ShieldCheck, Sparkles } from "lucide-react";
import { PublicShell } from "./public";
import { api, Busy } from "./common";

export default function DemoPlusAdmin() {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [workspace, setWorkspace] = useState<any>(null);

  async function openDemo() {
    setBusy(true);
    setError("");
    try {
      const result = await api("demo-workspace", {});
      setWorkspace(result);
      location.href = "/panel?tenant=" + encodeURIComponent(result.business.id);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    // Demo yalnızca yönetici bu sayfada düğmeye bastığında oluşturulur/açılır.
  }, []);

  return (
    <PublicShell>
      <main className="admin-page">
        <div className="page-heading">
          <div>
            <span className="eyebrow">PLATFORM YÖNETİMİ · PLUS DEMO</span>
            <h1>Müşteriye göstereceğiniz gerçek veritabanlı demo.</h1>
            <p>
              Bu demo geçici HTML değildir. Ayrı bir demo işletmesi olarak veritabanına kaydolur,
              örnek randevu ve müşteri verileriyle açılır ve Neta Plus modüllerinin tamamını kullanır.
            </p>
          </div>
          <span className="badge neutral"><ShieldCheck size={14} /> Satış demosu</span>
        </div>

        <div className="stats-grid">
          <section className="stat-card"><div className="stat-top">Paket <Sparkles size={19} /></div><strong className="stat-value">Plus</strong></section>
          <section className="stat-card"><div className="stat-top">Şube/personel <Gauge size={19} /></div><strong className="stat-value">Sınırsız</strong></section>
          <section className="stat-card"><div className="stat-top">Neta modülleri <CheckCircle2 size={19} /></div><strong className="stat-value">Tam erişim</strong></section>
          <section className="stat-card"><div className="stat-top">Veri analizi <BarChart3 size={19} /></div><strong className="stat-value">Canlı DB</strong></section>
        </div>

        <section className="panel margin-top">
          <h2>Demo nasıl çalışır?</h2>
          <p className="muted">
            Aynı yönetici hesabında tek bir demo işletmesi tutulur. Yaptığınız randevu, müşteri,
            veresiye, hizmet yolculuğu, gider ve rapor değişiklikleri gerçek demo veritabanına yazılır;
            böylece sunumdan önce sistemi gerçekten deneyebilirsiniz.
          </p>
          <div className="notice margin-top">
            WhatsApp ve AI gibi dış servislerde Neta demo kotası uygulanmaz. Ancak dış sağlayıcı gerçekten
            bağlıysa sağlayıcının kendi ücretleri ve teknik sınırları geçerlidir.
          </div>
          <button className="button primary margin-top" disabled={busy} onClick={openDemo}>
            {busy ? <Busy /> : <ArrowRight size={17} />} Plus demo panelini aç
          </button>
          {workspace?.business?.slug && (
            <a className="button margin-top" href={"/" + workspace.business.slug} target="_blank" rel="noopener noreferrer">
              Müşteri randevu sayfasını aç
            </a>
          )}
          {error && <p className="error-message">{error}</p>}
        </section>
      </main>
    </PublicShell>
  );
}
