"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Check, ExternalLink, ShieldCheck } from "lucide-react";
import { PublicShell } from "./public";
import { AccountGate, useSession } from "./session";
import { Busy, Field, Pick } from "./common";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { CATEGORIES, HOURS, money } from "@/lib/types";

async function temporary(body?: Record<string, unknown>): Promise<any> {
  const response = await fetch("/api/temporary-payment", {
    method: body ? "POST" : "GET",
    credentials: "same-origin",
    cache: "no-store",
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data: any = await response.json();
  if (!response.ok) throw new Error(data.error || "İşlem tamamlanamadı.");
  return data;
}

const slugify = (value: string) =>
  value
    .toLocaleLowerCase("tr-TR")
    .replace(/[ışğüöç]/g, (char) => ({ ı: "i", ş: "s", ğ: "g", ü: "u", ö: "o", ç: "c" })[char]!)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export default function TemporaryPaymentCustomer() {
  return (
    <PublicShell>
      <main className="onboarding-page">
        <AccountGate returnTo="/odeme/gecici">
          <Wizard />
        </AccountGate>
      </main>
    </PublicShell>
  );
}

function Wizard() {
  const { data: session } = useSession();
  const [data, setData] = useState<any>(null);
  const [plan, setPlan] = useState<"normal" | "pro" | "plus">("pro");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [note, setNote] = useState("");
  const [form, setForm] = useState({
    name: "",
    slug: "",
    category: CATEGORIES[0],
    city: session.profile.city || "",
    address: "",
    phone: session.profile.phone || "",
    service_name: "İlk Hizmet",
    duration: 30,
    price: "0",
    staff_name: session.profile.name || "İşletme Sahibi",
    staff_title: "Yetkili",
  });

  async function load() {
    try {
      const next: any = await temporary();
      setData(next);
      if (next.request?.status === "approved" && next.request?.tenant_id)
        location.replace("/panel?tenant=" + encodeURIComponent(next.request.tenant_id));
    } catch (e: any) {
      setError(e.message);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function prepare(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const request: any = await temporary({
        action: "prepare",
        plan,
        terms_accepted: accepted,
        business: {
          name: form.name,
          slug: form.slug,
          category: form.category,
          city: form.city,
          address: form.address,
          phone: form.phone,
          plan,
          starter: {
            service_name: form.service_name,
            duration: Number(form.duration),
            price: Math.round(Number(form.price || 0) * 100),
            staff_name: form.staff_name,
            staff_title: form.staff_title,
            hours: JSON.parse(HOURS),
          },
        },
      });
      setData((current: any) => ({ ...current, request }));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function submitted() {
    setBusy(true);
    setError("");
    try {
      await temporary({ action: "submitted", request_id: data.request.id, receipt_note: note });
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (!data) return <div className="loading-row"><Busy /> Ödeme seçenekleri hazırlanıyor…</div>;

  const current = data.request;
  if (current && ["awaiting_payment", "awaiting_review", "approving"].includes(current.status)) {
    return (
      <section className="panel payment-checkout">
        <span className="eyebrow">IYZICO LINK · GÜVENLİ ÖDEME</span>
        <h1>{current.business_name}</h1>
        <div className="payment-total">
          <span>{data.plans.find((item: any) => item.code === current.plan)?.name}</span>
          <strong>{money(current.amount)} / 30 gün</strong>
        </div>
        {current.status === "awaiting_payment" ? (
          <>
            <p>Kart işlemi iyzico'nun kendi güvenli sayfasında tamamlanır. Neta kart bilgisi almaz veya saklamaz.</p>
            <a className="button primary full" href={current.payment_url} target="_blank" rel="noopener noreferrer">
              iyzico ödeme sayfasını aç <ExternalLink size={16} />
            </a>
            <Field label="Ödeme yapan kişi / kısa not">
              <Input maxLength={240} value={note} onChange={(event) => setNote(event.target.value)} />
            </Field>
            <button className="button primary" disabled={busy} onClick={submitted}>
              {busy ? <Busy /> : <Check size={16} />} Ödemeyi yaptım, doğrulamaya gönder
            </button>
          </>
        ) : (
          <div className="notice">
            <ShieldCheck size={18} /> Ödeme yönetici tarafından iyzico hesabında doğrulanıyor. Doğrulanmadan panel erişimi açılmaz.
          </div>
        )}
        {error && <p className="error-message">{error}</p>}
      </section>
    );
  }

  return (
    <>
      <div className="member-heading">
        <div>
          <span className="eyebrow">GEÇİCİ GERÇEK ÖDEME</span>
          <h1>İşletmenizi 30 gün için aktifleştirin.</h1>
          <p>Ödeme iyzico Link üzerinden alınır ve yönetici doğrulamasından sonra kullanıma hazır panel açılır.</p>
        </div>
      </div>
      {!data.available ? (
        <section className="panel"><h2>Ödeme bağlantısı hazırlanıyor</h2><p className="muted">Geçici ödeme bağlantıları henüz aktif değil.</p></section>
      ) : (
        <form className="panel payment-form form-stack" onSubmit={prepare}>
          <Field label="Paket">
            <Pick
              label="Paket"
              value={plan}
              onChange={(value) => setPlan(value as typeof plan)}
              options={data.plans.filter((item: any) => item.available).map((item: any) => ({ value: item.code, label: `${item.name} · ${money(item.amount)}` }))}
            />
          </Field>
          <Field label="İşletme adı"><Input required minLength={2} maxLength={100} value={form.name} onChange={(event) => setForm((value) => ({ ...value, name: event.target.value, slug: slugify(event.target.value) }))} /></Field>
          <Field label="Randevu bağlantısı"><Input required minLength={3} maxLength={60} pattern="[a-z][a-z0-9]*(?:-[a-z0-9]+)*" value={form.slug} onChange={(event) => setForm((value) => ({ ...value, slug: event.target.value }))} /></Field>
          <Field label="Sektör"><Pick label="Sektör" value={form.category} onChange={(value) => setForm((current) => ({ ...current, category: value }))} options={CATEGORIES.map((value) => ({ value, label: value }))} /></Field>
          <div className="form-grid">
            <Field label="Şehir"><Input required maxLength={80} value={form.city} onChange={(event) => setForm((value) => ({ ...value, city: event.target.value }))} /></Field>
            <Field label="Telefon"><Input required maxLength={30} value={form.phone} onChange={(event) => setForm((value) => ({ ...value, phone: event.target.value }))} /></Field>
          </div>
          <Field label="Adres"><Input required maxLength={300} value={form.address} onChange={(event) => setForm((value) => ({ ...value, address: event.target.value }))} /></Field>
          <div className="form-grid">
            <Field label="İlk hizmet"><Input required minLength={2} maxLength={100} value={form.service_name} onChange={(event) => setForm((value) => ({ ...value, service_name: event.target.value }))} /></Field>
            <Field label="Hizmet fiyatı (₺)"><Input required type="number" min="0" step="0.01" value={form.price} onChange={(event) => setForm((value) => ({ ...value, price: event.target.value }))} /></Field>
          </div>
          <div className="form-grid">
            <Field label="Personel / işletme sahibi"><Input required minLength={2} maxLength={100} value={form.staff_name} onChange={(event) => setForm((value) => ({ ...value, staff_name: event.target.value }))} /></Field>
            <Field label="Unvan"><Input required minLength={2} maxLength={80} value={form.staff_title} onChange={(event) => setForm((value) => ({ ...value, staff_title: event.target.value }))} /></Field>
          </div>
          {data.note && <div className="notice">{data.note}</div>}
          <label className="checkbox-line"><Checkbox checked={accepted} onCheckedChange={(value) => setAccepted(value === true)} /><span>30 günlük erişim ve kullanım koşullarını kabul ediyorum.</span></label>
          <button className="button primary full" disabled={busy || !accepted}>{busy ? <Busy /> : <ArrowRight size={17} />} Ödeme bağlantısını hazırla</button>
        </form>
      )}
      {error && <p className="error-message">{error}</p>}
    </>
  );
}
