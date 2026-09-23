"use client";
import { useEffect, useState, useCallback } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CreditCard,
  ExternalLink,
  Landmark,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  Store,
  Wallet,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { api, Brand, ThemeToggle, Field, Busy } from "./common";
import { AccountGate, AccountMenu, useSession } from "./session";
import { money } from "@/lib/types";

import { RecurringPlans, PlatformRecurring } from "./recurring";
const statuses: Record<string, string> = {
  creating: "Hazırlanıyor",
  pending: "Doğrulama bekleniyor",
  paid: "Tahsil edildi",
  test_paid: "Test tamamlandı",
  failed: "Tamamlanamadı",
};
const dates = (v: string) =>
  new Date(v).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
function Header() {
  return (
    <header className="public-header">
      <Brand />
      <nav>
        <a className="text-button" href="/panel">
          <ArrowLeft size={15} />
          İşletme paneli
        </a>
        <ThemeToggle />
        <AccountMenu />
      </nav>
    </header>
  );
}
export default function BillingPage({
  platform = false,
}: {
  platform?: boolean;
}) {
  return (
    <>
      <Header />
      <main className="billing-page">
        <AccountGate returnTo={platform ? "/yonetim/odemeler" : "/abonelik"}>
          {platform ? <PlatformBilling /> : <BusinessBilling />}
        </AccountGate>
      </main>
    </>
  );
}
function History({
  orders,
  platform = false,
}: {
  orders: any[];
  platform?: boolean;
}) {
  return (
    <section className="panel billing-history">
      <div className="panel-header">
        <h2>{platform ? "Platform tahsilatları" : "Ödeme geçmişi"}</h2>
        <span className="billing-state">{orders.length} işlem</span>
      </div>
      {!orders.length ? (
        <div className="billing-empty">
          <Wallet size={28} />
          <h3>Henüz ödeme işlemi yok</h3>
          <p>Oluşan işlemler ve sağlayıcıdan gelen sonuçlar burada görünür.</p>
        </div>
      ) : (
        <div className="table-scroll">
          <table className="billing-table">
            <thead>
              <tr>
                <th>İşlem</th>
                {platform && <th>İşletme</th>}
                <th>Tarih</th>
                <th>Tutar</th>
                <th>Durum</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td title={o.id}>
                    {o.id.slice(0, 12)}…
                    {o.test_mode === 1 && (
                      <small className="billing-test">Test işlemi</small>
                    )}
                  </td>
                  {platform && <td>{o.business_name}</td>}
                  <td>{dates(o.created_at)}</td>
                  <td>{money(o.amount)}</td>
                  <td>
                    <span
                      className={
                        "billing-state " +
                        (o.status === "paid" ? "billing-paid" : "")
                      }
                    >
                      {statuses[o.status] || o.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="billing-footnote">
        Bu liste ödeme kaydıdır; mali belge yerine geçmez. İade ve banka
        mutabakatının yetkili satıcı tarafından sağlayıcı panelinde doğrulanması
        gerekir.
      </p>
    </section>
  );
}
function SecurePaytrCheckout({
  data,
  beforeCheckout,
}: {
  data: any;
  beforeCheckout: () => Promise<void>;
}) {
  const [accepted, setAccepted] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [checkoutUrl, setCheckoutUrl] = useState("");
  const available = !!data.checkout_available;
  async function begin() {
    setBusy(true);
    setError("");
    try {
      await beforeCheckout();
      const result = await api("checkout", {
        tenant_id: data.business.id,
        idempotency_key: crypto.randomUUID(),
        terms_accepted: true,
      });
      const target = new URL(result.checkout_url);
      if (
        target.origin !== "https://www.paytr.com" ||
        !target.pathname.startsWith("/odeme/guvenli/")
      )
        throw new Error("Güvenli ödeme adresi doğrulanamadı.");
      setCheckoutUrl(target.toString());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel secure-checkout margin-top">
      <div className="secure-checkout-title">
        <div>
          <span className="eyebrow">PAYTR GÜVENLİ ÖDEME</span>
          <h2>Kartla ödeme adımı hazır.</h2>
          <p>
            Kart alanları yalnızca PayTR’nin güvenli ödeme ekranında etkinleşir.
          </p>
        </div>
        <span className="secure-provider">
          <ShieldCheck size={17} />
          PayTR
        </span>
      </div>
      {checkoutUrl ? (
        <div className="paytr-frame-wrap">
          <div>
            <LockKeyhole size={16} />
            <span>
              Kart bilgilerinizi aşağıdaki PayTR ekranına girin. Bu alan Neta’ya
              ait değildir.
            </span>
            <button
              className="text-button"
              type="button"
              onClick={() => setCheckoutUrl("")}
            >
              Özete dön
            </button>
          </div>
          <iframe
            className="paytr-secure-frame"
            src={checkoutUrl}
            title="PayTR güvenli kart ödeme ekranı"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
      ) : (
        <div className="secure-checkout-grid">
          <div
            className="secure-card-preview"
            aria-label="PayTR kart ekranı önizlemesi"
          >
            <div className="secure-card-head">
              <CreditCard size={23} />
              <span>
                <LockKeyhole size={14} />
                Güvenli ödeme önizlemesi
              </span>
            </div>
            <label>
              Kart üzerindeki ad
              <input disabled tabIndex={-1} placeholder="AD SOYAD" />
            </label>
            <label>
              Kart numarası
              <input
                disabled
                tabIndex={-1}
                inputMode="none"
                placeholder="••••  ••••  ••••  ••••"
              />
            </label>
            <div className="secure-card-fields">
              <label>
                Son kullanma
                <input disabled tabIndex={-1} placeholder="AA / YY" />
              </label>
              <label>
                CVV / CVC
                <input disabled tabIndex={-1} placeholder="•••" />
              </label>
            </div>
            <small>
              <LockKeyhole size={13} />
              Bu alan bir önizlemedir; Neta kart numarası veya CVV toplamaz.
            </small>
          </div>
          <aside className="paytr-summary">
            <h3>Ödeme özeti</h3>
            <div>
              <span>İşletme</span>
              <strong>{data.business.name}</strong>
            </div>
            <div>
              <span>Sağlayıcı</span>
              <strong>PayTR iFrame</strong>
            </div>
            <div>
              <span>Tahsilat</span>
              <strong>
                {data.plan?.amount
                  ? money(data.plan.amount)
                  : "Bağlantı bekleniyor"}
              </strong>
            </div>
            <p>
              {available
                ? "Fatura bilgilerinizi kaydedip PayTR ekranını güvenli biçimde açabilirsiniz."
                : "PayTR mağaza bilgileri ve canlı site ayarı tamamlanınca buton otomatik olarak açılır."}
            </p>
            {available && (
              <label className="check-row">
                <Checkbox
                  checked={accepted}
                  onCheckedChange={(v) => setAccepted(v === true)}
                />
                <span>
                  <a
                    href={data.plan.terms_url || "/kosullar"}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Satış ve kullanım koşullarını
                  </a>{" "}
                  okudum, ödemeyi onaylıyorum.
                </span>
              </label>
            )}
            {error && (
              <p className="error-message" role="alert">
                {error}
              </p>
            )}
            <button
              type="button"
              className="button primary full"
              disabled={!available || !accepted || busy}
              onClick={begin}
            >
              {busy ? <Busy /> : <LockKeyhole size={16} />}{" "}
              {available
                ? "Güvenli kart ekranını aç"
                : "PayTR bağlantısı bekleniyor"}
            </button>
            <small>
              Kart verisi Neta sunucusuna gönderilmez ve Neta veritabanına
              kaydedilmez.
            </small>
          </aside>
        </div>
      )}
    </section>
  );
}
function BusinessBilling() {
  const { data: session } = useSession();
  const [data, setData] = useState<any>(null),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [profile, setProfile] = useState({
      name: "",
      email: "",
      phone: "",
      address: "",
    });
  const requestedPlan =
    typeof location === "undefined"
      ? null
      : new URLSearchParams(location.search).get("plan");
  const initialPlan = ["normal", "pro", "plus"].includes(requestedPlan || "")
    ? requestedPlan
    : null;
  async function load(id?: string) {
    setError("");
    try {
      const d = await api(
        "billing" + (id ? "?tenant=" + encodeURIComponent(id) : ""),
      );
      setData(d);
      setProfile(
        d.profile
          ? {
              name: d.profile.name,
              email: d.profile.email,
              phone: d.profile.phone,
              address: d.profile.address,
            }
          : {
              name: session?.profile?.name || "",
              email: session?.user?.email || "",
              phone: "",
              address: "",
            },
      );
    } catch (e: any) {
      setError(e.message);
    }
  }
  useEffect(() => {
    load(new URLSearchParams(location.search).get("tenant") || undefined);
  }, []);
  async function saveProfile() {
    await api("billing-profile", { tenant_id: data.business.id, ...profile });
  }
  if (!data)
    return error ? (
      <p className="error-message">{error}</p>
    ) : (
      <div className="loading-row">
        <Busy />
        Aboneliğiniz yükleniyor…
      </div>
    );
  if (!data.business)
    return (
      <section className="panel">
        <h1>Önce işletmenizi oluşturun.</h1>
        <a className="button primary" href="/kurulum">
          İşletme oluştur
        </a>
      </section>
    );
  return (
    <>
      <div className="billing-heading">
        <div>
          <span className="eyebrow">ABONELİK VE ÖDEMELER</span>
          <h1>Planınız, kontrolünüzde.</h1>
          <p>{data.business.name} · Kartınız ödeme kuruluşunda yönetilir.</p>
        </div>
        <span className="badge neutral">
          <Store size={15} />
          Bu işletmeye özel abonelik
        </span>
      </div>
      {new URLSearchParams(location.search).get("onboarding") === "1" && (
        <p className="notice" role="status">
          İşletmeniz oluşturuldu. Seçtiğiniz paketi güvenli ödeme sağlayıcısında
          tamamlayabilirsiniz.
        </p>
      )}
      <RecurringPlans
        key={data.business.id}
        tenantId={data.business.id}
        beforeCheckout={saveProfile}
        initialPlan={initialPlan || data.business.selected_plan}
      />
      <section className="panel margin-top">
        <h2>Fatura iletişim bilgileri</h2>
        <p className="muted">
          Abonelik başlatmadan önce tamamlayın. Kart bilgisi istenmez.
        </p>
        <form
          className="form-stack margin-top"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              await saveProfile();
              setMessage("Fatura iletişim bilgileri kaydedildi.");
            } catch (e: any) {
              setError(e.message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="form-grid">
            <Field label="Ad / unvan">
              <Input
                required
                minLength={2}
                maxLength={100}
                value={profile.name}
                onChange={(e) =>
                  setProfile({ ...profile, name: e.target.value })
                }
              />
            </Field>
            <Field label="E-posta">
              <Input
                type="email"
                required
                value={profile.email}
                onChange={(e) =>
                  setProfile({ ...profile, email: e.target.value })
                }
              />
            </Field>
            <Field label="Telefon">
              <Input
                type="tel"
                required
                value={profile.phone}
                onChange={(e) =>
                  setProfile({ ...profile, phone: e.target.value })
                }
              />
            </Field>
            <Field label="Fatura adresi">
              <Input
                required
                minLength={10}
                maxLength={350}
                value={profile.address}
                onChange={(e) =>
                  setProfile({ ...profile, address: e.target.value })
                }
              />
            </Field>
          </div>
          {error && <p className="error-message">{error}</p>}
          {message && <p className="notice">{message}</p>}
          <button className="button" disabled={busy}>
            {busy ? <Busy /> : <Check size={16} />}Bilgileri kaydet
          </button>
        </form>
      </section>
      <SecurePaytrCheckout data={data} beforeCheckout={saveProfile} />
      <section className="panel margin-top">
        <h2>Neta kredisi</h2>
        <p className="muted">
          Referans kredileri pazarlama panelinizde görünür. Sağlayıcıda kredi
          mahsup akışı onaylanmadan kart yenileme tutarı azaltılmaz veya
          bakiyenizden abonelik tutarı düşülmez.
        </p>
        <a
          className="text-button margin-top"
          href={"/panel/pazarlama?tenant=" + data.business.id}
        >
          Kredi hareketlerim <ArrowRight size={16} />
        </a>
      </section>
      {data.orders.length > 0 && (
        <details className="legacy-billing">
          <summary>Önceki tek seferlik PayTR işlemleri</summary>
          <History orders={data.orders} />
        </details>
      )}
    </>
  );
}
function PlatformBilling() {
  const { data: session } = useSession();
  const [data, setData] = useState<any>(null),
    [form, setForm] = useState<any>(null),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const reload = useCallback(async () => {
    const d = await api("platform-billing");
    setData(d);
    return d;
  }, []);
  useEffect(() => {
    reload()
      .then((d) =>
        setForm({
          ...d.settings,
          price: d.settings.amount ? String(d.settings.amount / 100) : "",
          active: !!d.settings.active,
        }),
      )
      .catch((e) => setError(e.message));
  }, [reload]);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const amount = Math.round(Number(form.price) * 100);
      await api("platform-billing", { ...form, amount });
      await reload();
      setMessage(
        "Plan ve satıcı bilgileri kaydedildi. Geçmiş işlemlerin fiyatı değişmedi.",
      );
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  if (!session?.isAdmin)
    return (
      <section className="panel account-gate">
        <ShieldCheck size={30} />
        <h1>Platform yöneticisi alanı</h1>
        <p>Bu alan yalnızca Neta Randevu yöneticisine açıktır.</p>
        <a className="button" href="/abonelik">
          İşletmemin aboneliği
        </a>
      </section>
    );
  if (!data || !form)
    return error ? (
      <p className="error-message">{error}</p>
    ) : (
      <div className="loading-row">
        <Busy />
        Tahsilatlar hazırlanıyor…
      </div>
    );
  const c = data.connection;
  return (
    <>
      <div className="billing-heading">
        <div>
          <span className="eyebrow">NETA RANDEVU · PLATFORM YÖNETİMİ</span>
          <h1>Tahsilatın kontrolü sizde.</h1>
          <p>
            İşletme aboneliklerini ve ödeme bağlantısını tek yerden izleyin.
          </p>
        </div>
        <a className="button" href="/admin">
          İşletmeleri yönet
          <ArrowRight size={16} />
        </a>
      </div>
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      <div className="billing-stats">
        <article className="panel">
          <span>Tahsil edilen brüt tutar</span>
          <strong>{money(data.totals.paid_amount)}</strong>
          <small>{data.totals.paid_count} doğrulanmış gerçek ödeme</small>
        </article>
        <article className="panel">
          <span>Doğrulama bekleyen</span>
          <strong>{data.totals.pending_count}</strong>
          <small>Test işlemleri dahil değil</small>
        </article>
        <article className="panel">
          <span>Bankaya aktarılan</span>
          <strong className="billing-no-value">Doğrulama gerekli</strong>
          <small>PayTR banka aktarımı verisi bağlı değil</small>
        </article>
      </div>
      <PlatformRecurring />
      <div className="billing-grid">
        <section className="panel">
          <h2>Ödeme bağlantısı</h2>
          <div className="billing-check">
            <ShieldCheck size={20} />
            <div>
              <strong>
                {c.credentials
                  ? "Sağlayıcı bilgileri tanımlı"
                  : "PayTR henüz bağlı değil"}
              </strong>
              <small>
                Gizli anahtarlar yalnızca sunucunun korumalı ayarlarında
                tutulur.
              </small>
            </div>
          </div>
          <div className="billing-check">
            <CreditCard size={20} />
            <div>
              <strong>{c.test_mode ? "Test modu" : "Gerçek ödeme modu"}</strong>
              <small>
                {c.test_mode
                  ? "Test işlemleri ciroya ve abonelik süresine eklenmez."
                  : "Yalnızca imzası ve tutarı doğrulanmış bildirimler aboneliği uzatır."}
              </small>
            </div>
          </div>
          <div className="billing-check">
            <Store size={20} />
            <div>
              <strong>
                {c.public_site
                  ? "Dış erişim yapılandırılmış"
                  : "Dış erişim kurulumu bekleniyor"}
              </strong>
              <small>
                İşletmelerin ve ödeme sağlayıcısının siteye erişebilmesi
                gerekir.
              </small>
            </div>
          </div>
          <div className="billing-check">
            <LockKeyhole size={20} />
            <div>
              <strong>
                {data.auth.google
                  ? "Google giriş bağlantısı tanımlı"
                  : "Google girişi henüz bağlı değil"}
              </strong>
              <small>
                Sağlayıcı ayarları tamamlanmadan Google girişi başlatılmaz.
              </small>
            </div>
          </div>
          <div className="billing-check">
            <Landmark size={20} />
            <div>
              <strong>Alıcı banka hesabı</strong>
              <small>
                {c.bank_label}. Hesap doğrulaması ve değişiklikleri yetkili
                satıcının PayTR hesabında yönetilir.
              </small>
            </div>
          </div>
          <div className="billing-flow">
            <span>İşletmenin ödemesi</span>
            <ArrowRight size={16} />
            <span>PayTR tahsilatı</span>
            <ArrowRight size={16} />
            <span>Doğrulanmış satıcı hesabı</span>
          </div>
          <p className="helper">
            Banka aktarım günü, kesintiler ve net tutar sağlayıcı sözleşmesine
            bağlıdır. Yukarıdaki brüt tahsilat, banka bakiyesi değildir. İade ve
            mutabakat PayTR panelinden yönetilir.
          </p>
          <a
            className="text-button"
            href="https://www.paytr.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            PayTR web sitesi
            <ExternalLink size={15} />
          </a>
        </section>
        <section className="panel">
          <h2>Abonelik planı</h2>
          <p className="helper">
            Fiyatı siz belirlersiniz. Satışa açılmadan önce plan taslak olarak
            kalır.
          </p>
          <form className="form-stack" onSubmit={save}>
            <Field label="30 günlük toplam fiyat (TL)">
              <Input
                type="number"
                min="1"
                max="1000000"
                step="0.01"
                required
                placeholder="Henüz belirlenmedi"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
              />
            </Field>
            <Field label="Satıcı unvanı">
              <Input
                required
                minLength={2}
                maxLength={150}
                value={form.seller_name}
                onChange={(e) =>
                  setForm({ ...form, seller_name: e.target.value })
                }
              />
            </Field>
            <Field label="Destek e-postası">
              <Input
                required
                type="email"
                maxLength={254}
                value={form.support_email}
                onChange={(e) =>
                  setForm({ ...form, support_email: e.target.value })
                }
              />
            </Field>
            <Field label="Satıcı adresi">
              <textarea
                className="billing-address"
                required
                minLength={10}
                maxLength={350}
                value={form.seller_address}
                onChange={(e) =>
                  setForm({ ...form, seller_address: e.target.value })
                }
              />
            </Field>
            <Field label="Satış, iptal ve iade koşulları bağlantısı">
              <Input
                required
                type="url"
                placeholder="https://…"
                maxLength={500}
                value={form.terms_url}
                onChange={(e) =>
                  setForm({ ...form, terms_url: e.target.value })
                }
              />
            </Field>
            <label className="check-row">
              <Checkbox
                checked={form.active}
                disabled={!c.credentials || !c.public_site || !c.origin}
                onCheckedChange={(v) =>
                  setForm({ ...form, active: v === true })
                }
              />
              <span>Planı satışa aç</span>
            </label>
            {(!c.credentials || !c.public_site || !c.origin) && (
              <p className="helper">
                Ödeme bağlantısı ve dış erişim tamamlanınca satış açılabilir.
              </p>
            )}
            <button className="button primary full" disabled={busy}>
              {busy ? <Busy /> : <Check size={16} />}Planı kaydet
            </button>
          </form>
        </section>
      </div>
      <div className="billing-toolbar">
        <button
          className="button"
          onClick={() => reload().catch((e) => setError(e.message))}
        >
          <RefreshCw size={16} />
          İşlemleri yenile
        </button>
        <span className="helper">
          Abonelik süresi bulunan {data.subscriptions.length} işletme
        </span>
      </div>
      <History orders={data.orders} platform />
    </>
  );
}
