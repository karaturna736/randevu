"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, ExternalLink, RefreshCw, Save, ShieldCheck, X } from "lucide-react";
import { PublicShell } from "./public";
import { Busy, Field } from "./common";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { money } from "@/lib/types";

async function request(body?: any) {
  const response = await fetch("/api/temporary-payment?scope=admin", {
    method: body ? "POST" : "GET",
    credentials: "same-origin",
    cache: "no-store",
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "İşlem tamamlanamadı.");
  return data;
}

const stateLabel: Record<string, string> = {
  awaiting_payment: "Ödeme bekleniyor",
  awaiting_review: "Doğrulama bekleniyor",
  approving: "Aktifleştiriliyor",
  approved: "Onaylandı",
  rejected: "Reddedildi",
  cancelled: "İptal edildi",
};

export default function TemporaryPaymentAdmin() {
  const [data, setData] = useState<any>(null),
    [form, setForm] = useState<any>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const next = await request();
      setData(next);
      setForm({
        active: !!next.settings.active,
        normal_url: next.settings.normal_url || "",
        pro_url: next.settings.pro_url || "",
        plus_url: next.settings.plus_url || "",
        note: next.settings.note || "",
      });
      setError("");
    } catch (e: any) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await request({ action: "save_settings", ...form });
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function review(id: string, action: "approve" | "reject") {
    setBusy(true);
    setError("");
    try {
      await request({
        action,
        request_id: id,
        ...(action === "approve" ? { payment_verified: true } : {}),
      });
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (!data || !form)
    return <PublicShell><main className="admin-page"><div className="loading-row"><Busy /> Geçici ödeme yönetimi hazırlanıyor…</div></main></PublicShell>;

  return (
    <PublicShell>
      <main className="admin-page">
        <div className="page-heading">
          <div>
            <span className="eyebrow">PLATFORM YÖNETİMİ · GEÇİCİ TAHSİLAT</span>
            <h1>Şirket açılışına kadar kontrollü gerçek ödeme.</h1>
            <p>
              iyzico Link kart tahsilatını kendi güvenli sayfasında yapar. Neta kart verisi almaz;
              kullanıcı erişimi yalnız siz iyzico panelindeki tahsilatı gördükten sonra açılır.
            </p>
          </div>
          <span className="badge neutral"><ShieldCheck size={14} /> Manuel doğrulama</span>
        </div>

        <section className="panel">
          <div className="panel-header">
            <div><h2>iyzico Link bağlantıları</h2><p className="muted">Her paket için iyzico panelinden aynı tutarda ayrı link oluşturup buraya yapıştırın.</p></div>
            <button className="button" onClick={load} disabled={busy}><RefreshCw size={15} /> Yenile</button>
          </div>
          <form className="form-stack" onSubmit={save}>
            {data.plans.map((plan: any) => (
              <Field key={plan.code} label={`${plan.name} · ${money(plan.amount)}`}>
                <Input
                  type="url"
                  placeholder="https://..."
                  value={form[`${plan.code}_url`]}
                  onChange={(event) => setForm((value: any) => ({ ...value, [`${plan.code}_url`]: event.target.value }))}
                />
              </Field>
            ))}
            <Field label="Müşteriye gösterilecek not">
              <Textarea maxLength={500} value={form.note} onChange={(event) => setForm((value: any) => ({ ...value, note: event.target.value }))} />
            </Field>
            <label className="checkbox-line">
              <Checkbox checked={form.active} onCheckedChange={(value) => setForm((current: any) => ({ ...current, active: value === true }))} />
              <span>Geçici ödeme akışını aktif et</span>
            </label>
            <button className="button primary" disabled={busy}><Save size={16} /> Ayarları kaydet</button>
          </form>
        </section>

        <section className="panel margin-top">
          <div className="panel-header"><div><h2>Ödeme doğrulama kuyruğu</h2><p className="muted">Onay vermeden önce tutarı, ödeme yapan kişiyi ve işlemi iyzico panelinde birebir eşleştirin.</p></div><span className="badge neutral">{data.requests.length} kayıt</span></div>
          {!data.requests.length ? (
            <p className="muted">Henüz geçici ödeme talebi yok.</p>
          ) : (
            <div className="collection-list">
              {data.requests.map((item: any) => (
                <article className="collection-row" key={item.id}>
                  <div>
                    <strong>{item.business_name} · {item.user_name}</strong>
                    <small>{item.user_email} · /{item.business_slug}</small>
                    <small>{data.plans.find((plan: any) => plan.code === item.plan)?.name} · {money(item.amount)} · {stateLabel[item.status] || item.status}</small>
                    {item.receipt_note && <small>Not: {item.receipt_note}</small>}
                  </div>
                  <div className="button-group">
                    <a className="icon-button" href={item.payment_url} target="_blank" rel="noopener noreferrer" aria-label="Ödeme bağlantısını aç"><ExternalLink size={16} /></a>
                    {item.status === "awaiting_review" && (
                      <>
                        <button className="button small" disabled={busy} onClick={() => review(item.id, "approve")}><Check size={14} /> iyzico'da gördüm, 30 günü aç</button>
                        <button className="icon-button danger" disabled={busy} onClick={() => review(item.id, "reject")} aria-label="Reddet"><X size={16} /></button>
                      </>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
          {error && <p className="error-message">{error}</p>}
        </section>
      </main>
    </PublicShell>
  );
}
