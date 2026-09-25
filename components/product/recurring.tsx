"use client";
import { useState, useEffect, useCallback } from "react";
import {
  Check,
  ShieldCheck,
  RefreshCw,
  CreditCard,
  Wallet,
  ArrowRight,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { api, Field, Busy, Modal, Confirm, Blank } from "./common";
import { money } from "@/lib/types";
const states: Record<string, string> = {
  creating: "Ödeme hazırlanıyor",
  checkout: "Sağlayıcı onayı bekleniyor",
  review: "Sağlayıcıdan kontrol edilmeli",
  ACTIVE: "Aktif",
  PENDING: "Başlatılmayı bekliyor",
  UNPAID: "Ödeme bekleniyor",
  CANCELED: "Yenileme iptal edildi",
  EXPIRED: "Süresi bitti",
  UPGRADED: "Paket değişti",
  failed: "Tamamlanmadı",
};
const cards = [
  {
    code: "normal",
    name: "Neta Standart",
    badge: "TEMEL RANDEVU DÜZENİ",
    description:
      "Tek şubenizde dağınık randevuları tek takvimde toplayın ve işletmenizi dijitalleştirin.",
    outcome: "Randevu defterinden profesyonel dijital takvime geçin.",
    features: [
      "1 işletme · 1 şube · 5 personele kadar",
      "7/24 açık kişisel randevu bağlantısı",
      "Web, panel ve personel için ortak takvim",
      "Hizmet, fiyat ve süre yönetimi",
      "Müşteri kartları ve ziyaret geçmişi",
      "Personel çalışma saatleri ve izin günleri",
      "Randevu iptal ve değişiklik yönetimi",
      "İşlem analizi",
    ],
  },
  {
    code: "pro",
    name: "Neta Pro",
    badge: "EN ÇOK TERCİH EDİLEN",
    description:
      "Sadece randevu yönetmeyin; boş saatleri, unutulan alacakları ve geri dönmeyen müşterileri kazanca çevirin.",
    outcome:
      "Daha az boş saat, daha düzenli tahsilat, daha çok geri dönen müşteri.",
    features: [
      "Standart'taki tüm özellikler",
      "1 işletme · 3 şubeye kadar · sınırsız personel",
      "Borç / Veresiye takibi ve tahsilat geçmişi",
      "Neta Hizmet Yolculuğu ile süreç takibi",
      "Pazarlama ve büyüme araçları",
      "Gelir Kurtarma Motoru ve bekleme listesi",
      "Talep fırsatları · son 30 güne kadar standart rapor",
      "İşlem analizi ve gelir raporu",
      "Şube kârlılığı · 3 şubeye kadar",
      "Çift yönlü WhatsApp randevu · ayda 1.000 işlem",
      "AI / randevu asistanı · günde 50 kullanım",
      "Erken gelirim modu",
    ],
  },
  {
    code: "plus",
    name: "Neta Plus",
    badge: "TAM KONTROL · EN KAPSAMLI",
    description:
      "Her şubenin cirosunu, giderini, talebini ve müşteri dönüşünü tek merkezden yöneten büyüme paketi.",
    outcome:
      "₺2.500 ile yalnızca yazılım değil, tüm şubeleriniz için kontrol merkezi alın.",
    features: [
      "Pro'daki her şey · daha yüksek kullanım limitleri",
      "Sınırsız şube ve sınırsız personel",
      "Borç / Veresiye ve tahsilat takibine tam erişim",
      "Hizmet Yolculuğuna tam erişim",
      "Talep fırsatları · 90 güne kadar gelişmiş analiz",
      "Şubeler arası performans karşılaştırması",
      "Şube bazlı ciro, gider, net kâr ve zarar raporu",
      "Muhasebe paneli: tekrar kullanılabilir gider kalemleri",
      "Makas, krem, cihaz, kira ve personel giderlerini aylara taşıma",
      "Neta ortaklık programı",
      "AI / randevu asistanı · günde 200 kullanım",
      "Çift yönlü WhatsApp · ayda 5.000 işlem",
      "Kurulum merkezi, veri taşıma ve eğitim talebi",
    ],
  },
];
export function RecurringPlans({ tenantId, beforeCheckout, initialPlan }: any) {
  const [data, setData] = useState<any>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [plan, setPlan] = useState<any>(null),
    [form, setForm] = useState({
      name: "",
      surname: "",
      identity: "",
      city: "",
    }),
    [accepted, setAccepted] = useState(false),
    [html, setHtml] = useState(""),
    [cancel, setCancel] = useState(false),
    [dismissedInitial, setDismissedInitial] = useState(false);
  const refresh = useCallback(
    () =>
      api("recurring?tenant=" + encodeURIComponent(tenantId))
        .then(setData)
        .catch((e) => setError(e.message)),
    [tenantId],
  );
  useEffect(() => {
    setData(null);
    setHtml("");
    setPlan(null);
    refresh();
  }, [refresh]);
  async function act(action: string) {
    setBusy(true);
    setError("");
    try {
      await api("recurring", {
        tenant_id: tenantId,
        action,
        confirmed: action === "cancel",
      });
      setCancel(false);
      await refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  if (!data) return error ? <p className="error-message">{error}</p> : <Busy />;
  const sub = data.subscription,
    checkoutPlan =
      plan ||
      (!dismissedInitial && data.available && !sub && initialPlan
        ? data.plans.find((p: any) => p.code === initialPlan)
        : null);
  return (
    <section className="recurring-section">
      <div className="section-heading">
        <div>
          <h2>Aylık Neta aboneliği</h2>
          <p className="muted">
            Yazılım aboneliğiniz için. Müşteri hizmet ödemeleriniz işletmenizde
            kalır.
          </p>
        </div>
        <span className="badge neutral">
          {data.available
            ? data.connection.live
              ? "iyzico bağlantısı hazır"
              : "iyzico test modu"
            : "Satışa açılmadı"}
        </span>
      </div>
      <div className="notice subscription-disclosure">
        <b>Şeffaf abonelik:</b> Paket ücreti yalnızca Neta yazılımı içindir.
        Salonunuzun müşterilerinden aldığı hizmet ödemelerine Neta karışmaz. Her
        işletme ayrı planlanır; kart verisi Neta sunucularında saklanmaz ve
        güvenli ödeme kuruluşu tarafından işlenir.
      </div>
      {initialPlan && !data.available && (
        <p className="notice">
          {cards.find((c) => c.code === initialPlan)?.name} seçiminiz hazır.
          Ödeme sağlayıcısı satışa açılınca buradan güvenli ödeme
          başlatılabilir; şu anda kart bilgisi alınmıyor.
        </p>
      )}
      <div className="plan-cards">
        {cards.map((card) => {
          const p = data.plans.find((p: any) => p.code === card.code);
          return (
            <article
              className={
                "panel plan-card " +
                (card.code === "pro" ? "featured " : "") +
                (card.code === "plus" ? "premium " : "") +
                (card.code === initialPlan ? "selected" : "")
              }
              key={card.code}
            >
              <span className="eyebrow">
                {card.code === initialPlan ? "KURULUMDA SEÇTİNİZ" : card.badge}
              </span>
              <h3>{card.name}</h3>
              <p className="plan-card-description">{card.description}</p>
              <div className="plan-card-price">
                {p ? money(p.amount) : "Fiyat belirlenecek"}
                {p && <small> / ay</small>}
              </div>
              <ul>
                {card.features.map((f) => (
                  <li key={f}>
                    <Check size={16} />
                    {f}
                  </li>
                ))}
              </ul>
              <div className="plan-outcome">
                <ShieldCheck size={17} />
                <span>{card.outcome}</span>
              </div>
              <button
                className="button primary full"
                disabled={
                  !data.available ||
                  !p ||
                  (sub &&
                    !["CANCELED", "EXPIRED", "failed"].includes(sub.state))
                }
                onClick={() => {
                  setError("");
                  setAccepted(false);
                  setDismissedInitial(true);
                  setPlan(p);
                }}
              >
                {!data.available
                  ? "Bağlantı bekleniyor"
                  : sub?.plan === card.code && sub.state === "ACTIVE"
                    ? "Mevcut paket"
                    : "Paketi seç"}
              </button>
            </article>
          );
        })}
      </div>
      <p className="helper">
        “Sınırsız” ifadeleri Neta içindeki kayıt ve kullanıcı sayılarını
        belirtir. WhatsApp ve AI dış sağlayıcıya bağlı olduğu için güvenli
        kullanım kotasıyla sunulur; ek kullanım koşulları satış sözleşmesinde
        açıkça gösterilir.
      </p>
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
      {sub && (
        <section className="panel margin-top">
          <div className="section-heading">
            <h3>Aboneliğiniz</h3>
            <span className="badge neutral">
              {sub.test_mode ? "Test · " : ""}
              {states[sub.state] || sub.state}
            </span>
          </div>
          <p className="muted">
            {cards.find((c) => c.code === sub.plan)?.name} · {money(sub.amount)}{" "}
            / ay
          </p>
          {sub.paid_until && (
            <p>
              Doğrulanmış dönem sonu:{" "}
              {new Date(sub.paid_until).toLocaleDateString("tr-TR")}
            </p>
          )}
          <div className="button-group margin-top">
            <button
              className="button"
              disabled={busy}
              onClick={() => act("refresh")}
            >
              <RefreshCw size={16} />
              Sağlayıcıdan yenile
            </button>
            {["ACTIVE", "PENDING", "UNPAID"].includes(sub.state) && (
              <button
                className="button danger"
                disabled={busy}
                onClick={() => setCancel(true)}
              >
                Otomatik yenilemeyi iptal et
              </button>
            )}
          </div>
        </section>
      )}
      {html && (
        <section className="panel margin-top">
          <h3>iyzico ödeme formu</h3>
          <p className="helper">
            Kart alanları ödeme sağlayıcısı tarafından sunulur. Sonucu
            yukarıdaki düğmeyle yenileyin.
          </p>
          <iframe
            className="billing-iframe"
            title="iyzico abonelik ödeme formu"
            sandbox="allow-scripts allow-forms allow-popups allow-top-navigation-by-user-activation"
            referrerPolicy="no-referrer"
            srcDoc={
              '<!doctype html><html lang="tr"><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"></head><body><div id="iyzipay-checkout-form" class="responsive"></div>' +
              html +
              "</body></html>"
            }
          />
        </section>
      )}
      <details className="panel margin-top">
        <summary>Abonelik ödeme geçmişi</summary>
        {data.payments.length ? (
          data.payments.map((p: any) => (
            <div className="collection-row" key={p.reference}>
              <span>
                {new Date(p.period_start).toLocaleDateString("tr-TR")} –{" "}
                {new Date(p.period_end).toLocaleDateString("tr-TR")}
              </span>
              <b>{money(p.amount)}</b>
              <span>{p.test_mode ? "Test" : "Doğrulandı"}</span>
            </div>
          ))
        ) : (
          <p className="muted margin-top">
            Henüz sağlayıcı tarafından doğrulanmış aylık ödeme yok.
          </p>
        )}
      </details>
      <Modal
        open={!!checkoutPlan}
        onClose={() => {
          if (!busy) {
            setPlan(null);
            setDismissedInitial(true);
          }
        }}
        title="Aylık aboneliği başlat"
        description="Kart bilgilerini bir sonraki adımda iyzico formuna gireceksiniz."
      >
        <form
          className="form-stack"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              await beforeCheckout();
              const r = await api("recurring", {
                tenant_id: tenantId,
                plan: checkoutPlan.code,
                terms_accepted: accepted,
                ...form,
              });
              setHtml(r.form);
              setForm({ ...form, identity: "" });
              setPlan(null);
              setDismissedInitial(true);
              await refresh();
            } catch (e: any) {
              setError(e.message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <p>
            <strong>
              {checkoutPlan?.name} · {money(checkoutPlan?.amount || 0)} / ay
            </strong>
          </p>
          <div className="form-grid">
            <Field label="Ad">
              <Input
                required
                minLength={2}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </Field>
            <Field label="Soyad">
              <Input
                required
                minLength={2}
                value={form.surname}
                onChange={(e) => setForm({ ...form, surname: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Şehir">
            <Input
              required
              minLength={2}
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
            />
          </Field>
          <Field label="Sağlayıcının istediği kimlik / vergi numarası">
            <Input
              required
              inputMode="numeric"
              autoComplete="off"
              pattern="[0-9]{10,11}"
              maxLength={11}
              value={form.identity}
              onChange={(e) => setForm({ ...form, identity: e.target.value })}
            />
            <small>
              Neta veritabanına kaydedilmez; abonelik başlatma isteğinde
              iyzico’ya iletilir.
            </small>
          </Field>
          <label className="consent-row">
            <Checkbox
              checked={accepted}
              onCheckedChange={(v) => setAccepted(v === true)}
            />
            <span>
              <a
                href={data.seller.terms_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                Abonelik, iptal ve iade koşullarını
              </a>{" "}
              okudum. {money(checkoutPlan?.amount || 0)} tutarın her ay otomatik
              tahsil edilmesini kabul ediyorum.
            </span>
          </label>
          {error && <p className="error-message">{error}</p>}
          <button className="button primary" disabled={!accepted || busy}>
            {busy ? <Busy /> : <ShieldCheck size={17} />}iyzico formunu aç
          </button>
        </form>
      </Modal>
      <Confirm
        open={cancel}
        onClose={() => setCancel(false)}
        title="Otomatik yenileme iptal edilsin mi?"
        description="Gelecekteki otomatik tahsilatlar durdurulur. Daha önce doğrulanmış ücretli döneminiz korunur."
        onConfirm={() => act("cancel")}
      />
    </section>
  );
}
export function PlatformRecurring() {
  const [d, setD] = useState<any>(null),
    [e, setE] = useState("");
  useEffect(() => {
    api("platform-recurring")
      .then(setD)
      .catch((e) => setE(e.message));
  }, []);
  return (
    <section className="panel margin-top">
      <h2>iyzico aylık abonelikleri</h2>
      {e ? (
        <p className="error-message">{e}</p>
      ) : !d ? (
        <Busy />
      ) : (
        <>
          <div className="billing-flow">
            <span>İşletme aboneliği</span>
            <ArrowRight size={16} />
            <span>iyzico</span>
            <ArrowRight size={16} />
            <span>Doğrulanmış şirket banka hesabı</span>
          </div>
          <p>
            {d.connection.configured
              ? "Sağlayıcı bilgileri tanımlı"
              : "Sağlayıcı hesabı bağlanmadı"}{" "}
            · {d.connection.live ? "Gerçek mod" : "Test modu"}
          </p>
          <div className="operations-metrics">
            <div className="operation-metric">
              <span>Doğrulanmış brüt tahsilat</span>
              <strong>{money(d.totals.amount)}</strong>
            </div>
            <div className="operation-metric">
              <span>Gerçek ödeme adedi</span>
              <strong>{d.totals.payments}</strong>
            </div>
          </div>
          <p className="helper">
            Banka aktarımı ve net kesinti verisi henüz bağlı değil. Brüt
            tahsilat banka bakiyesi değildir. Ödeme kuruluşunun mutabakat
            ekranından doğrulayın.
          </p>
          {d.subscriptions.map((s: any) => (
            <div className="collection-row" key={s.tenant_id}>
              <strong>{s.business_name}</strong>
              <span>
                {s.plan} · {money(s.amount)}
              </span>
              <span>
                {s.test_mode ? "Test · " : ""}
                {states[s.state] || s.state}
              </span>
            </div>
          ))}
        </>
      )}
    </section>
  );
}
