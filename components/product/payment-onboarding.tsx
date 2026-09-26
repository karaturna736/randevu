"use client";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CreditCard,
  LockKeyhole,
  ShieldCheck,
  Store,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { PublicShell } from "./public";
import { AccountGate, useSession } from "./session";
import { Hours } from "./management";
import { api, Busy, Field, Pick } from "./common";
import { CATEGORIES, HOURS, money } from "@/lib/types";

const plans = [
  {
    code: "normal",
    name: "Neta Standart",
    price: 99000,
    features: ["Ortak takvim", "Randevu linki", "Müşteri ve ekip yönetimi"],
  },
  {
    code: "pro",
    name: "Neta Pro",
    price: 120000,
    features: [
      "Standart özellikleri",
      "Borç ve hizmet yolculuğu",
      "WhatsApp otomasyonu",
    ],
  },
  {
    code: "plus",
    name: "Neta Plus",
    price: 150000,
    features: [
      "Pro özellikleri",
      "Gelişmiş otomasyon",
      "Yüksek AI ve WhatsApp kotası",
    ],
  },
] as const;
const slugify = (s: string) =>
  s
    .toLocaleLowerCase("tr-TR")
    .replace(
      /[ışğüöç]/g,
      (c) => ({ ı: "i", ş: "s", ğ: "g", ü: "u", ö: "o", ç: "c" })[c]!,
    )
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
export default function PaymentOnboarding() {
  return (
    <PublicShell>
      <main className="onboarding-page">
        <AccountGate returnTo="/odeme">
          <PaymentWizard />
        </AccountGate>
      </main>
    </PublicShell>
  );
}
function PaymentWizard() {
  const { data } = useSession(),
    [step, setStep] = useState(0),
    [plan, setPlan] = useState<"normal" | "pro" | "plus">("normal"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [checkout, setCheckout] = useState(""),
    [status, setStatus] = useState<any>(null),
    [referral, setReferral] = useState(""),
    [campaignCode, setCampaignCode] = useState(""),
    [campaign, setCampaign] = useState<any>(null);
  const idempotencyKey = useRef("");
  const [form, setForm] = useState(() => ({
    name: "",
    slug: "",
    category: CATEGORIES[0],
    city: data.profile.city || "",
    address: "",
    phone: data.profile.phone || "",
    service_name: "",
    duration: 30,
    price: "",
    staff_name: data.profile.name,
    staff_title: "Uzman",
    hours: JSON.parse(HOURS),
  }));
  const [buyer, setBuyer] = useState(() => {
    const p = String(data.profile.name || "")
      .trim()
      .split(/\s+/);
    return {
      name: p[0] || "",
      surname: p.slice(1).join(" "),
      identity: "",
      city: data.profile.city || "",
      terms_accepted: false,
      card_storage_accepted: false,
    };
  });
  useEffect(() => {
    queueMicrotask(() =>
      setReferral((sessionStorage.getItem("neta-ref") || "").toUpperCase()),
    );
    const result = new URLSearchParams(location.search).get("durum");
    if (result === "basarisiz")
      setError(
        "Ödeme doğrulanamadı. Kartınız reddedilmiş veya ödeme oturumu sona ermiş olabilir. Bilgilerinizi kontrol edip yeniden deneyin.",
      );
    if (result === "iptal")
      setError(
        "Ödeme işlemi iptal edildi. Panel erişimi açılmadı ve yeniden ücretlendirme yapılmadı.",
      );
    api("payment-status")
      .then((r) => {
        setStatus(r);
        if (r.account.zero_test_mode) {
          setBuyer((x) => ({ ...x, card_storage_accepted: true }));
          return;
        }
        if (r.account.state === "active") location.replace("/panel");
        else if (r.account.state === "payment_processing")
          location.replace("/odeme/bekleniyor");
        else if (r.account.failure_reason) setError(r.account.failure_reason);
      })
      .catch((e: any) => setError(e.message));
  }, []);
  const selected = plans.find((p) => p.code === plan)!;
  const zeroTestMode = !!status?.account?.zero_test_mode;
  const priceFor = (code: string, fallback: number) => {
    if (zeroTestMode) return 0;
    const serverPlan = status?.plans?.find((item: any) => item.code === code);
    return Number.isFinite(Number(serverPlan?.amount))
      ? Number(serverPlan.amount)
      : fallback;
  };
  const selectedPrice = priceFor(selected.code, selected.price);
  const payableAmount = zeroTestMode
    ? 0
    : campaign?.final_amount || selectedPrice;
  async function applyCampaign() {
    if (zeroTestMode) return;
    setBusy(true);
    setError("");
    try {
      const result = await api(
        `campaign-preview?code=${encodeURIComponent(campaignCode)}&plan=${plan}`,
      );
      setCampaign(result);
      setCampaignCode(result.code);
    } catch (e: any) {
      setCampaign(null);
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function next(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (step < 2) {
      if (step === 0 && !Object.keys(form.hours).length) {
        setError("En az bir çalışma günü seçin.");
        return;
      }
      if (step === 0 && referral) {
        try {
          const verified = await api(
            "referral-preview?code=" + encodeURIComponent(referral),
          );
          setReferral(verified.code);
          sessionStorage.setItem("neta-ref", verified.code);
        } catch (e: any) {
          setError(e.message);
          return;
        }
      }
      setStep((v) => v + 1);
      scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setBusy(true);
    try {
      idempotencyKey.current ||= crypto.randomUUID();
      const r = await api("onboarding-payment", {
        idempotency_key: idempotencyKey.current,
        business: {
          name: form.name,
          slug: form.slug,
          category: form.category,
          city: form.city,
          address: form.address,
          phone: form.phone,
          plan,
          ref: referral || undefined,
          starter: {
            service_name: form.service_name,
            duration: Number(form.duration),
            price: Math.round(Number(form.price) * 100),
            staff_name: form.staff_name,
            staff_title: form.staff_title,
            hours: form.hours,
          },
        },
        buyer,
        campaign_code: zeroTestMode ? undefined : campaign?.code || undefined,
      });
      if (r.active) {
        location.replace(
          r.tenant_id
            ? "/panel?tenant=" + encodeURIComponent(r.tenant_id)
            : "/panel",
        );
        return;
      }
      setCheckout(r.form);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  if (checkout)
    return (
      <section className="panel payment-checkout">
        <span className="eyebrow">IYZICO GÜVENLİ ÖDEME</span>
        <h1>Hesabınızı aktifleştirin</h1>
        <div className="payment-total">
          <span>{selected.name}</span>
          <strong>{money(payableAmount)} / ay</strong>
        </div>
        <p>
          İşletmeniz henüz oluşturulmadı. Başarılı tahsilat iyzico API’sinden
          doğrulandıktan sonra hesabınız açılacak.
        </p>
        <iframe
          className="payment-frame"
          title="iyzico güvenli ödeme formu"
          srcDoc={checkout}
          sandbox="allow-forms allow-scripts allow-popups allow-top-navigation-by-user-activation"
          referrerPolicy="no-referrer"
        />
        <div className="notice">
          <LockKeyhole size={18} />
          Kart bilgileriniz Neta sunucusuna gelmez ve Neta veritabanında
          saklanmaz.
        </div>
      </section>
    );
  return (
    <>
      <div className="member-heading">
        <div>
          <span className="eyebrow">GÜVENLİ ÜYELİK</span>
          <h1>Hesabınızı aktifleştirin.</h1>
          <p>
            {zeroTestMode
              ? "Geçici test fiyatı 0 TL. Normal ödeme akışından seçtiğiniz paket gerçek paket yetkileriyle açılır."
              : "Demo ücretsizdir. Gerçek işletme ve panel erişimi yalnızca doğrulanmış aylık ödeme sonrasında açılır."}
          </p>
        </div>
        <span className="badge neutral">{step + 1} / 3</span>
      </div>
      <ol className="setup-progress">
        {["İşletme", "Paket", "Ödeme"].map((x, i) => (
          <li
            key={x}
            className={i === step ? "current" : i < step ? "complete" : ""}
          >
            <span>{i < step ? <Check size={17} /> : i + 1}</span>
            <strong>{x}</strong>
          </li>
        ))}
      </ol>
      <form className="panel payment-form form-stack" onSubmit={next}>
        {step === 0 && (
          <>
            <h2>İşletmenizi hazırlayın</h2>
            <Field label="İşletme adı">
              <Input
                required
                minLength={2}
                maxLength={100}
                value={form.name}
                onChange={(e) =>
                  setForm((v) => ({
                    ...v,
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
                  pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                  minLength={3}
                  maxLength={60}
                  value={form.slug}
                  onChange={(e) =>
                    setForm((v) => ({ ...v, slug: e.target.value }))
                  }
                />
              </div>
            </Field>
            <div className="form-grid">
              <Field label="Sektör">
                <Pick
                  label="Sektör"
                  value={form.category}
                  onChange={(category) => setForm((v) => ({ ...v, category }))}
                  options={CATEGORIES.map((v) => ({ value: v, label: v }))}
                />
              </Field>
              <Field label="Şehir">
                <Input
                  required
                  value={form.city}
                  onChange={(e) =>
                    setForm((v) => ({ ...v, city: e.target.value }))
                  }
                />
              </Field>
            </div>
            <Field label="Adres">
              <Input
                required
                autoComplete="street-address"
                value={form.address}
                onChange={(e) =>
                  setForm((v) => ({ ...v, address: e.target.value }))
                }
              />
            </Field>
            <Field label="Telefon">
              <Input
                required
                type="tel"
                autoComplete="tel"
                value={form.phone}
                onChange={(e) =>
                  setForm((v) => ({ ...v, phone: e.target.value }))
                }
              />
            </Field>
            <Field label="Davet kodu (isteğe bağlı)">
              <Input
                autoComplete="off"
                maxLength={24}
                placeholder="Örn. NETA7K3M9P2Q"
                value={referral}
                onChange={(e) =>
                  setReferral(
                    e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ""),
                  )
                }
              />
              <small>
                Geçerli kod, ödeme ve işletme onayından sonra davet eden
                işletmeye Neta Kredisi kazandırır.
              </small>
            </Field>
            <div className="form-grid">
              <Field label="İlk hizmet">
                <Input
                  required
                  value={form.service_name}
                  onChange={(e) =>
                    setForm((v) => ({ ...v, service_name: e.target.value }))
                  }
                />
              </Field>
              <Field label="Fiyat (₺)">
                <Input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.price}
                  onChange={(e) =>
                    setForm((v) => ({ ...v, price: e.target.value }))
                  }
                />
              </Field>
            </div>
            <div className="form-grid">
              <Field label="Süre (dakika)">
                <Input
                  required
                  type="number"
                  min="15"
                  max="480"
                  step="15"
                  value={form.duration}
                  onChange={(e) =>
                    setForm((v) => ({ ...v, duration: Number(e.target.value) }))
                  }
                />
              </Field>
              <Field label="İlk personel">
                <Input
                  required
                  value={form.staff_name}
                  onChange={(e) =>
                    setForm((v) => ({ ...v, staff_name: e.target.value }))
                  }
                />
              </Field>
            </div>
            <Hours
              value={form.hours}
              onChange={(hours: any) => setForm((v) => ({ ...v, hours }))}
            />
          </>
        )}
        {step === 1 && (
          <>
            <h2>Paketinizi seçin</h2>
            <div
              className="onboarding-plans"
              role="radiogroup"
              aria-label="Abonelik paketi"
            >
              {plans.map((p) => (
                <button
                  type="button"
                  role="radio"
                  aria-checked={plan === p.code}
                  className={
                    "onboarding-plan " + (plan === p.code ? "selected" : "")
                  }
                  onClick={() => {
                    setPlan(p.code);
                    setCampaign(null);
                    setCampaignCode("");
                  }}
                  key={p.code}
                >
                  <span className="onboarding-plan-check">
                    {plan === p.code ? <Check size={16} /> : null}
                  </span>
                  <span>
                    <strong>{p.name}</strong>
                    <small>{p.features.join(" · ")}</small>
                  </span>
                  <b>
                    {money(priceFor(p.code, p.price))}
                    <small> / ay</small>
                  </b>
                </button>
              ))}
            </div>
            <div className="notice">
              <ShieldCheck size={18} />
              {zeroTestMode
                ? "0 TL test işlemi gerçek tahsilat yapmaz; seçilen paketin sunucu tarafındaki gerçek özellik ve limitleri açılır."
                : "Bu ödeme yalnızca Neta aboneliğidir. İşletmenizin müşterilerinden aldığı para Neta’dan geçmez."}
            </div>
          </>
        )}
        {step === 2 && (
          <>
            <h2>Fatura ve onay</h2>
            <div className="payment-summary">
              <Store />
              <div>
                <strong>{form.name}</strong>
                <small>{selected.name} · aylık yenileme</small>
              </div>
              <b>{money(payableAmount)}</b>
            </div>
            {!zeroTestMode && (
              <section className="campaign-payment-card">
                <Field label="İndirim kodu">
                  <div className="campaign-code-row">
                    <Input
                      autoComplete="off"
                      maxLength={32}
                      placeholder="Kampanya kodunuz"
                      value={campaignCode}
                      onChange={(event) => {
                        setCampaignCode(
                          event.target.value
                            .toUpperCase()
                            .replace(/[^A-Z0-9_-]/g, ""),
                        );
                        setCampaign(null);
                      }}
                    />
                    <button
                      className="button"
                      type="button"
                      disabled={busy || campaignCode.length < 3}
                      onClick={applyCampaign}
                    >
                      Uygula
                    </button>
                  </div>
                </Field>
                {campaign && (
                  <div className="campaign-price-lines" role="status">
                    <div><span>Normal paket fiyatı</span><b>{money(campaign.original_amount)}</b></div>
                    <div className="campaign-discount"><span>{campaign.campaign_name}</span><b>-{money(campaign.discount_amount)}</b></div>
                    <div className="campaign-final"><span>Bugün ödenecek</span><b>{money(campaign.final_amount)}</b></div>
                    <p className="campaign-note">
                      {new Date(campaign.ends_at).toLocaleDateString("tr-TR")} tarihine kadar geçerli · {campaign.first_payment_only ? "yalnızca ilk ödeme" : campaign.recurring_enabled ? "aylık yenilemeler dahil" : "tek ödeme"}.
                    </p>
                    {!campaign.checkout_supported && <p className="notice">{campaign.provider_note}</p>}
                  </div>
                )}
              </section>
            )}
            <div className="form-grid">
              <Field label="Ad">
                <Input
                  required
                  autoComplete="given-name"
                  value={buyer.name}
                  onChange={(e) =>
                    setBuyer((v) => ({ ...v, name: e.target.value }))
                  }
                />
              </Field>
              <Field label="Soyad">
                <Input
                  required
                  autoComplete="family-name"
                  value={buyer.surname}
                  onChange={(e) =>
                    setBuyer((v) => ({ ...v, surname: e.target.value }))
                  }
                />
              </Field>
            </div>
            <div className="form-grid">
              <Field label="T.C. / vergi numarası">
                <Input
                  required
                  inputMode="numeric"
                  minLength={10}
                  maxLength={11}
                  value={buyer.identity}
                  onChange={(e) =>
                    setBuyer((v) => ({
                      ...v,
                      identity: e.target.value.replace(/\D/g, ""),
                    }))
                  }
                />
              </Field>
              <Field label="Fatura şehri">
                <Input
                  required
                  value={buyer.city}
                  onChange={(e) =>
                    setBuyer((v) => ({ ...v, city: e.target.value }))
                  }
                />
              </Field>
            </div>
            <Field label="E-posta">
              <Input value={data.profile.email} readOnly />
            </Field>
            <div className="notice">
              <ShieldCheck size={18} />
              <span>
                Kişisel verilerinizin nasıl işlendiği{" "}
                <a href="/kvkk" target="_blank" rel="noopener noreferrer">
                  KVKK Aydınlatma Metni
                </a>{" "}
                içinde açıklanır. Aydınlatma metni bir açık rıza talebi
                değildir.
              </span>
            </div>
            <label className="check-row">
              <Checkbox
                checked={buyer.terms_accepted}
                onCheckedChange={(v) =>
                  setBuyer((x) => ({ ...x, terms_accepted: v === true }))
                }
              />
              <span>
                <a
                  href={status?.terms_url || "/kosullar"}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Abonelik ve kullanım koşullarını
                </a>{" "}
                kabul ediyorum.
              </span>
            </label>
            {!zeroTestMode && (
              <label className="check-row">
                <Checkbox
                  checked={buyer.card_storage_accepted}
                  onCheckedChange={(v) =>
                    setBuyer((x) => ({ ...x, card_storage_accepted: v === true }))
                  }
                />
                <span>
                  Kartımın aylık yenilemeler için iyzico’nun güvenli altyapısında
                  saklanmasını ve plan ücretinin her ay tahsil edilmesini kabul
                  ediyorum. Neta kart numarası veya CVC saklamaz.
                </span>
              </label>
            )}
            <div className="notice">
              <LockKeyhole size={18} />
              {zeroTestMode
                ? "Test tutarı 0 TL'dir. Kart bilgisi istenmez, kaydedilmez ve gerçek tahsilat yapılmaz."
                : "Tutar sunucudaki paketten alınır. Tarayıcıdan fiyat veya ödeme durumu kabul edilmez."}
            </div>
            {campaign && (
              <div className="notice success" role="status">
                <Check size={18} />
                <span>
                  <strong>{String(campaign.description || "").trim() || campaign.campaign_name}</strong>
                  <small>
                    {money(campaign.discount_amount)} kampanya avantajı uygulandı · {money(campaign.final_amount)} ile satın alıyorsunuz.
                  </small>
                </span>
              </div>
            )}
          </>
        )}
        {error && (
          <p className="error-message" role="alert">
            {error}
          </p>
        )}
        <div className="form-footer">
          <button
            type="button"
            className="button"
            disabled={step === 0 || busy}
            onClick={() => setStep((v) => v - 1)}
          >
            <ArrowLeft size={16} />
            Geri
          </button>
          <button
            className="button primary"
            disabled={
              busy ||
              (!zeroTestMode && campaign && !campaign.checkout_supported) ||
              (step === 2 &&
                (!buyer.terms_accepted ||
                  (!zeroTestMode && !buyer.card_storage_accepted)))
            }
          >
            {busy ? (
              <Busy />
            ) : step === 2 ? (
              zeroTestMode ? <Check size={17} /> : <CreditCard size={17} />
            ) : null}
            {step === 2
              ? zeroTestMode
                ? "0 TL ile paketi aktifleştir"
                : "Ödemeyi tamamla"
              : "Devam et"}
            {step < 2 ? <ArrowRight size={16} /> : null}
          </button>
        </div>
      </form>
    </>
  );
}