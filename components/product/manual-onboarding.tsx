"use client";

import { useState } from "react";
import { ArrowRight, Check, Clock3, Scissors, ShieldCheck, Store, UserRound } from "lucide-react";
import { Input } from "@/components/ui/input";
import { AccountGate, useSession } from "./session";
import { PublicShell } from "./public";
import { Hours } from "./management";
import { api, Busy, Field, Pick } from "./common";
import { CATEGORIES, HOURS } from "@/lib/types";

const slugify = (value: string) =>
  value
    .toLocaleLowerCase("tr-TR")
    .replace(
      /[ışğüöç]/g,
      (c) => ({ ı: "i", ş: "s", ğ: "g", ü: "u", ö: "o", ç: "c" })[c]!,
    )
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export default function ManualOnboarding() {
  return (
    <PublicShell>
      <main className="onboarding-page">
        <AccountGate returnTo="/kurulum">
          <ManualBusinessWizard />
        </AccountGate>
      </main>
    </PublicShell>
  );
}

function ManualBusinessWizard() {
  const { data } = useSession();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState(() => ({
    name: "",
    slug: "",
    category: CATEGORIES[0],
    city: data?.profile?.city || "",
    address: "",
    phone: data?.profile?.phone || "",
    service_name: "",
    duration: 30,
    price: "",
    staff_name: data?.profile?.name || "",
    staff_title: "Uzman",
    hours: JSON.parse(HOURS),
  }));

  const set = (key: string, value: unknown) =>
    setForm((current) => ({ ...current, [key]: value }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");

    if (step === 0) {
      setStep(1);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (step === 1) {
      if (!Object.keys(form.hours).length) {
        setError("En az bir çalışma günü seçin.");
        return;
      }
      setStep(2);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setBusy(true);
    try {
      const result = await api("manual-onboarding", {
        ref: sessionStorage.getItem("neta-ref") || undefined,
        name: form.name,
        slug: form.slug,
        category: form.category,
        city: form.city,
        address: form.address,
        phone: form.phone,
        starter: {
          service_name: form.service_name,
          duration: Number(form.duration),
          price: Math.round(Number(form.price) * 100),
          staff_name: form.staff_name,
          staff_title: form.staff_title,
          hours: form.hours,
        },
      });
      location.assign("/abonelik?tenant=" + encodeURIComponent(result.id));
    } catch (e: any) {
      setError(e?.message || "İşletme kaydedilemedi.");
      setBusy(false);
    }
  }

  return (
    <>
      <div className="member-heading">
        <div>
          <span className="eyebrow">İŞLETME KURULUMU</span>
          <h1>İşletmenizi oluşturalım.</h1>
          <p>
            Şimdilik online ödeme alınmıyor. İşletmenizi kaydedin; Neta yönetimi
            panel paketinizi açtığında doğrudan kullanmaya başlayın.
          </p>
        </div>
        <span className="badge neutral">{step + 1} / 3 adım</span>
      </div>

      <ol className="setup-progress">
        {["İşletme", "Hizmet ve ekip", "Onaya gönder"].map((label, index) => (
          <li
            key={label}
            className={index === step ? "current" : index < step ? "complete" : ""}
          >
            <span>{index < step ? <Check size={17} /> : index + 1}</span>
            <strong>{label}</strong>
          </li>
        ))}
      </ol>

      <form className="panel wizard-form form-stack" onSubmit={submit}>
        {step === 0 && (
          <>
            <div className="wizard-heading">
              <span className="eyebrow">ADIM 01</span>
              <h2>Önce işletmenizi tanıyalım.</h2>
            </div>
            <Field label="İşletme adı">
              <Input
                required
                minLength={2}
                maxLength={100}
                placeholder="Örn. Ahmet Berber"
                value={form.name}
                onChange={(e) =>
                  setForm((current) => ({
                    ...current,
                    name: e.target.value,
                    slug: slugify(e.target.value),
                  }))
                }
              />
            </Field>
            <Field label="Randevu bağlantısı">
              <div className="slug-input">
                <span>/</span>
                <Input
                  required
                  minLength={3}
                  maxLength={60}
                  pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                  value={form.slug}
                  onChange={(e) => set("slug", e.target.value)}
                />
              </div>
            </Field>
            <div className="form-grid">
              <Field label="Sektör">
                <Pick
                  label="Sektör"
                  value={form.category}
                  onChange={(category) => set("category", category)}
                  options={CATEGORIES.map((value) => ({ value, label: value }))}
                />
              </Field>
              <Field label="Şehir">
                <Input
                  required
                  maxLength={80}
                  value={form.city}
                  onChange={(e) => set("city", e.target.value)}
                />
              </Field>
            </div>
            <Field label="İşletme adresi">
              <Input
                required
                maxLength={300}
                autoComplete="street-address"
                value={form.address}
                onChange={(e) => set("address", e.target.value)}
              />
            </Field>
            <Field label="İşletme telefonu">
              <Input
                required
                type="tel"
                autoComplete="tel"
                maxLength={30}
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
              />
            </Field>
          </>
        )}

        {step === 1 && (
          <>
            <div className="wizard-heading">
              <span className="eyebrow">ADIM 02</span>
              <h2>İlk hizmetinizi ve ekibinizi hazırlayın.</h2>
            </div>
            <div className="wizard-tip">
              <Scissors size={21} />
              <p>
                <strong>Küçük başlayın.</strong> En sık verdiğiniz bir hizmeti ve
                ilk personeli ekleyin. Panel açıldıktan sonra diğerlerini
                ekleyebilirsiniz.
              </p>
            </div>
            <div className="form-grid">
              <Field label="İlk hizmet">
                <Input
                  required
                  minLength={2}
                  maxLength={100}
                  value={form.service_name}
                  onChange={(e) => set("service_name", e.target.value)}
                />
              </Field>
              <Field label="Hizmet fiyatı (₺)">
                <Input
                  required
                  type="number"
                  min={0}
                  max={1000000}
                  step="0.01"
                  value={form.price}
                  onChange={(e) => set("price", e.target.value)}
                />
              </Field>
            </div>
            <div className="form-grid">
              <Field label="Süre (dakika)">
                <Input
                  required
                  type="number"
                  min={15}
                  max={480}
                  step={15}
                  value={form.duration}
                  onChange={(e) => set("duration", Number(e.target.value))}
                />
              </Field>
              <Field label="İlk personel">
                <Input
                  required
                  minLength={2}
                  maxLength={100}
                  value={form.staff_name}
                  onChange={(e) => set("staff_name", e.target.value)}
                />
              </Field>
            </div>
            <Field label="Unvan">
              <Input
                required
                minLength={2}
                maxLength={80}
                value={form.staff_title}
                onChange={(e) => set("staff_title", e.target.value)}
              />
            </Field>
            <div className="wizard-tip">
              <Clock3 size={21} />
              <p>
                Çalışma saatlerini seçin. Daha sonra her personel için ayrı ayrı
                düzenleyebilirsiniz.
              </p>
            </div>
            <Hours value={form.hours} onChange={(hours: any) => set("hours", hours)} />
          </>
        )}

        {step === 2 && (
          <>
            <div className="wizard-heading">
              <span className="eyebrow">ADIM 03</span>
              <h2>Kurulum hazır.</h2>
            </div>
            <div className="wizard-review">
              <div>
                <Store size={21} />
                <span>
                  <strong>{form.name}</strong>
                  <small>{form.category} · {form.city}<br />/{form.slug}</small>
                </span>
              </div>
              <div>
                <Scissors size={21} />
                <span>
                  <strong>{form.service_name}</strong>
                  <small>{form.duration} dakika</small>
                </span>
              </div>
              <div>
                <UserRound size={21} />
                <span>
                  <strong>{form.staff_name}</strong>
                  <small>{form.staff_title}</small>
                </span>
              </div>
            </div>
            <div className="notice">
              <ShieldCheck size={18} />
              <p>
                Kart veya ödeme bilgisi istenmez. Kaydınız Neta yönetim ekranına
                düşer. Yönetici Standart, Pro veya Plus paketini açınca paneliniz
                aktif olur.
              </p>
            </div>
          </>
        )}

        {error && <p className="error-message" role="alert">{error}</p>}
        <div className="button-group">
          {step > 0 && (
            <button type="button" className="button" disabled={busy} onClick={() => setStep((value) => value - 1)}>
              Geri
            </button>
          )}
          <button className="button primary" disabled={busy}>
            {busy ? <Busy /> : step === 2 ? <Check size={17} /> : <ArrowRight size={17} />}
            {step === 2 ? "Onaya gönder" : "Devam et"}
          </button>
        </div>
      </form>
    </>
  );
}
