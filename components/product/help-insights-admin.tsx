"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, HelpCircle, MessageCircleQuestion, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { PublicShell } from "./public";
import { api, Blank, Busy } from "./common";

const STATUS_LABELS: Record<string, string> = {
  open: "Açık",
  planned: "Planlandı",
  answered: "Kılavuza eklendi",
  ignored: "Yok sayıldı",
};

function dateTime(value: string) {
  return new Date(value).toLocaleString("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function HelpInsightsAdmin() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [search, setSearch] = useState("");

  async function load() {
    setError("");
    try {
      setData(await api("platform-help-insights"));
    } catch (e: any) {
      setError(e.message || "Yardım içgörüleri yüklenemedi.");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const rows = useMemo(() => {
    const q = search.toLocaleLowerCase("tr-TR").trim();
    return (data?.rows || []).filter((row: any) =>
      !q || String(row.sample_question).toLocaleLowerCase("tr-TR").includes(q),
    );
  }, [data, search]);

  async function setStatus(id: string, status: string) {
    setBusy(id);
    try {
      const result = await api("platform-help-insights", { id, status });
      if (!result.ok) throw new Error("Kayıt bulunamadı.");
      toast.success("Soru durumu güncellendi.");
      await load();
    } catch (e: any) {
      toast.error(e.message || "Durum güncellenemedi.");
    } finally {
      setBusy("");
    }
  }

  return (
    <PublicShell>
      <main className="admin-page">
        <div className="page-heading">
          <div>
            <span className="eyebrow">NETA · ÜRÜN İÇGÖRÜLERİ</span>
            <h1>Kullanıcılar neyi bulamıyor?</h1>
            <p>Asistanın cevaplayamadığı sorular anonim olarak gruplanır. Kimlik veya işletme bilgisi tutulmaz.</p>
          </div>
          <a className="button" href="/admin"><ArrowLeft size={16} /> Yönetim merkezine dön</a>
        </div>

        {error ? (
          <section className="panel">
            <Blank title="İçgörüler yüklenemedi" description={error} />
            <button className="button margin-top" onClick={load}><RefreshCw size={16} /> Tekrar dene</button>
          </section>
        ) : !data ? (
          <div className="loading-row"><Busy /> Sorular yükleniyor…</div>
        ) : (
          <>
            <div className="stats-grid">
              {[
                ["Toplam cevaplanamayan soru", data.totals?.asks || 0],
                ["Açık konu", data.totals?.open_topics || 0],
                ["Açık soru tekrarı", data.totals?.open_asks || 0],
                ["Planlanan konu", data.totals?.planned_topics || 0],
              ].map(([label, value]) => (
                <section className="stat-card" key={String(label)}>
                  <div className="stat-top"><span>{label}</span><MessageCircleQuestion size={19} /></div>
                  <strong className="stat-value">{value}</strong>
                </section>
              ))}
            </div>

            <section className="panel margin-top">
              <div className="section-heading">
                <div>
                  <h2>En çok sorulan ama cevaplanamayanlar</h2>
                  <p className="muted">Benzer cümleler tek başlıkta birleştirilir ve tekrar sayısı artırılır.</p>
                </div>
                <div className="search-input">
                  <Search size={16} />
                  <Input
                    aria-label="Cevaplanamayan sorularda ara"
                    placeholder="Sorularda ara…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>

              {rows.length ? (
                <div className="collection-list margin-top">
                  {rows.map((row: any) => (
                    <div className="collection-row" key={row.id} style={{ alignItems: "flex-start", gap: 16 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <strong>{row.sample_question}</strong>
                        <small>
                          İlk: {dateTime(row.first_seen_at)} · Son: {dateTime(row.last_seen_at)}
                        </small>
                        <div className="button-group margin-top">
                          {Object.entries(STATUS_LABELS).map(([status, label]) => (
                            <button
                              key={status}
                              className={"button " + (row.status === status ? "primary" : "")}
                              disabled={busy === row.id || row.status === status}
                              onClick={() => setStatus(row.id, status)}
                            >
                              {busy === row.id && row.status !== status ? <Busy /> : null}
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div style={{ textAlign: "right", minWidth: 110 }}>
                        <span className="badge neutral">{STATUS_LABELS[row.status] || row.status}</span>
                        <div style={{ marginTop: 8 }}>
                          <strong style={{ fontSize: 24 }}>{row.ask_count}</strong>
                          <small style={{ display: "block" }}>kez soruldu</small>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <Blank
                  title={search ? "Bu aramada soru bulunamadı" : "Henüz cevaplanamayan soru yok"}
                  description={search ? "Başka bir kelime deneyin." : "Neta Asistan kılavuz dışında bir soru aldığında burada görünür."}
                />
              )}
            </section>

            <section className="panel margin-top">
              <div className="stat-top"><HelpCircle size={19} /> Bu ekranı nasıl kullanmalı?</div>
              <p className="muted margin-top">
                Çok tekrar eden açık sorular yeni kılavuz maddesi veya ürün özelliği için güçlü sinyaldir. Bir konuyu geliştirmeye karar verdiğinizde “Planlandı”, kılavuza cevabı eklendiğinde “Kılavuza eklendi” olarak işaretleyin.
              </p>
            </section>
          </>
        )}
      </main>
    </PublicShell>
  );
}
