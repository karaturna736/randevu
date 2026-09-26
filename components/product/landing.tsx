"use client";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronDown,
  Clock,
  ShieldCheck,
  Users,
  Radar,
  Menu,
  X,
  Wallet,
  Play,
} from "lucide-react";
import { Brand, ThemeToggle, api } from "./common";
import { useSession } from "./session";
import { money } from "@/lib/types";
import { LandingDashboardPreview } from "./landing-dashboard-preview";

const features = [
  {
    icon: CalendarDays,
    n: "01",
    title: "Gününüz tek bakışta.",
    text: "Kim, hangi işlem için, ne zaman gelecek? Takviminiz ve ekibiniz aynı yerde.",
    label: "Randevu & ekip",
  },
  {
    icon: Radar,
    n: "02",
    title: "Görmediğiniz talebi görün.",
    text: "Uygun saat bulamayan aramalar ve kapalı saatlerdeki talep, bir sonraki planınıza yön versin.",
    label: "Talep fırsatları",
  },
  {
    icon: Users,
    n: "03",
    title: "Her ziyaretin bir hafızası var.",
    text: "Önceki işlemler, müşteri tercihleri ve uzun süredir gelmeyenler elinizin altında.",
    label: "Müşteri hafızası",
  },
];
export default function Landing() {
  const { data } = useSession();
  const [menu, setMenu] = useState(false),
    [plan, setPlan] = useState<any>(null);
  useEffect(() => {
    api("plans")
      .then((p) => setPlan({ ...p, amount: 200000 }))
      .catch(() => setPlan({ amount: 200000 }));
  }, []);
  const start = "/kayit?rol=business&sonra=%2Fkurulum",
    signed = !!data?.profile;
  return (
    <div className="neta-home neta-home-premium">
      <header className="neta-header">
        <div className="neta-container neta-nav">
          <Brand />
          <nav
            className={menu ? "neta-links open" : "neta-links"}
            aria-label="Ana menü"
          >
            <a href="#ozellikler" onClick={() => setMenu(false)}>
              Neler yapar?
            </a>
            <a href="#nasil-calisir" onClick={() => setMenu(false)}>
              Nasıl çalışır?
            </a>
            <a href="#fiyatlar" onClick={() => setMenu(false)}>
              Fiyatlandırma
            </a>
            <a href="/kesfet">Randevu al</a>
          </nav>
          <div className="neta-nav-actions">
            <ThemeToggle />
            <a
              className="neta-login"
              href={signed ? "/panel" : "/giris?rol=business"}
            >
              {signed ? "Panelime git" : "Giriş yap"}
            </a>
            <a className="button primary" href={start}>
              Hemen başla <ArrowRight size={16} />
            </a>
            <button
              className="icon-button neta-menu"
              aria-label="Gezinme menüsü"
              aria-expanded={menu}
              onClick={() => setMenu(!menu)}
            >
              {menu ? <X /> : <Menu />}
            </button>
          </div>
        </div>
      </header>
      <main>
        <section className="neta-container neta-hero neta-hero-premium">
          <div className="neta-hero-copy">
            <span className="neta-eyebrow">
              <span />
              İŞİNİZİN YENİ RİTMİ
            </span>
            <h1>
              Takvim dolsun.
              <br />
              İşletmeniz <em>aksın.</em>
            </h1>
            <p>
              Randevu, ekip, müşteri ve talep yönetimini tek yerde toplayın.
              Neta boş saatleri fırsata, yoğunluğu düzene çevirir.
            </p>
            <div className="neta-hero-actions">
              <a className="button primary" href={start}>
                İşletmemi oluştur <ArrowRight size={18} />
              </a>
              <a className="button neta-outline" href="/demo">
                <Play size={16} />
                Canlı demoyu incele
              </a>
            </div>
            <div className="neta-trust neta-trust-premium">
              <span><Check size={15} /> Kurulumda kart gerekmez</span>
              <span><Check size={15} /> Size özel randevu linki</span>
              <span><Check size={15} /> WhatsApp'tan randevu</span>
            </div>
            <div className="neta-proof-row" aria-label="Neta ürün özeti">
              <div><strong>Randevu</strong><small>Online & WhatsApp</small></div>
              <div><strong>Ekip</strong><small>Personel yönetimi</small></div>
              <div><strong>Müşteri</strong><small>Geçmiş & notlar</small></div>
              <div><strong>Talep</strong><small>Tek yerden yönetim</small></div>
            </div>
          </div>
          <LandingDashboardPreview />
        </section>
        <section className="neta-sectors">
          <div className="neta-container">
            <span>RANDEVUYLA ÇALIŞAN HER İŞLETMEYE</span>
            <div>
              Kuaför & berber
              <i />
              Güzellik & bakım
              <i />
              Danışmanlık
              <i />
              Özel ders
              <i />
              Oto servis
            </div>
          </div>
        </section>
        <section className="neta-container neta-section" id="ozellikler">
          <div className="neta-section-heading">
            <div>
              <span className="neta-eyebrow">TAKVİMDEN DAHA FAZLASI</span>
              <h2>
                İşletmenizi yönetmek
                <br />
                bu kadar net olabilir.
              </h2>
            </div>
            <a className="text-button" href="/demo">
              Paneli keşfet <ArrowUpRight size={18} />
            </a>
          </div>
          <div className="neta-feature-grid">
            {features.map((f) => (
              <article key={f.n}>
                <div className="neta-feature-top">
                  <f.icon size={26} />
                  <span>{f.n}</span>
                </div>
                <small>{f.label}</small>
                <h3>{f.title}</h3>
                <p>{f.text}</p>
              </article>
            ))}
          </div>
          <div className="neta-early-strip">
            <div className="neta-early-icon">
              <Clock size={25} />
            </div>
            <div>
              <span>“ERKEN GELİRİM”</span>
              <h3>Bir iptal, başka bir müşteriye fırsat olsun.</h3>
              <p>
                Daha erken müsait olan müşteriye yeni saati teklif edin.
                Randevu, yalnızca kabul ederse değişsin.
              </p>
            </div>
            <a href="/atolye-studio" className="button">
              Nasıl görünüyor? <ArrowRight size={16} />
            </a>
          </div>
        </section>
        <section className="neta-how" id="nasil-calisir">
          <div className="neta-container">
            <div className="neta-section-heading">
              <div>
                <span className="neta-eyebrow">İLK RANDEVUNUZA DOĞRU</span>
                <h2>Tanışın. Kurun. Paylaşın.</h2>
              </div>
              <p>
                Karmaşık bir kurulumla uğraşmadan,
                <br />
                işletmenizin çalışma şeklini tanımlayın.
              </p>
            </div>
            <div className="neta-steps">
              {[
                {
                  n: "1",
                  t: "Hesabınızı açın",
                  p: "Kimliğinizi doğrulayın ve işletme sahibi olarak üyeliğinizi tamamlayın.",
                },
                {
                  n: "2",
                  t: "İşletmenizi hazırlayın",
                  p: "Hizmet, fiyat, personel ve çalışma saatlerinizi adım adım ekleyin.",
                },
                {
                  n: "3",
                  t: "Bağlantınızı paylaşın",
                  p: "İşletmeniz onaylanınca müşterileriniz size özel sayfadan randevu alsın.",
                },
              ].map((s) => (
                <article key={s.n}>
                  <span>{s.n}</span>
                  <h3>{s.t}</h3>
                  <p>{s.p}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
        <section
          className="neta-container neta-section neta-pricing"
          id="fiyatlar"
        >
          <div>
            <span className="neta-eyebrow">NET KAPSAM. NET FİYAT.</span>
            <h2>İşletmenize yer açın.</h2>
            <p>
              Standart 600 TL, Pro 999 TL, Plus 2.500 TL/ay. Müşteri
              tahsilatlarınıza Neta karışmaz.
            </p>
            <div className="neta-price-note">
              <ShieldCheck size={21} />
              <p>
                Ödeme sağlayıcısı kart bilgilerini yönetir; Neta kart numarası
                saklamaz. Paket ve kota bilgisi ödeme öncesi açıkça gösterilir.
              </p>
            </div>
          </div>
          <article className="neta-plan">
            <div className="neta-plan-title">
              <span className="neta-mini-logo">
                <img src="/neta-logo.png" alt="" />
              </span>
              <h3>Neta Pro</h3>
              <span>İşletme büyüme paketi</span>
            </div>
            <div className="neta-price">
              <strong>{money(plan?.amount || 99900)}</strong>
              <span>/ ay</span>
            </div>
            <ul>
              {[
                "3 şubeye kadar · sınırsız personel",
                "Borç / Veresiye ve tahsilat takibi",
                "Neta Hizmet Yolculuğu",
                "Pazarlama ve büyüme araçları",
                "Gelir kurtarma ve bekleme listesi",
                "Talep fırsatları ve kaçan gelir analizi",
                "İşlem analizi ve gelir raporu",
                "Şube kârlılığı · 3 şubeye kadar",
                "Çift yönlü WhatsApp ve AI / randevu asistanı",
                "Günde 50 AI sorusu · ayda 1.000 WhatsApp mesajı",
              ].map((f) => (
                <li key={f}>
                  <Check size={17} />
                  {f}
                </li>
              ))}
            </ul>
            <a className="button primary full" href={start}>
              İşletmemi hazırlamaya başla <ArrowRight size={17} />
            </a>
            <small>
              Ödeme sağlayıcısı bağlanınca abonelik güvenli biçimde açılır
            </small>
          </article>
        </section>
        <section className="neta-container neta-faq">
          <div>
            <span className="neta-eyebrow">AKLINIZDAKİLER</span>
            <h2>Birkaç net cevap.</h2>
          </div>
          <div>
            {[
              {
                q: "Müşterilerimin üye olması gerekir mi?",
                a: "Hayır. Müşteriniz hizmeti ve uygun saati seçip iletişim bilgileriyle randevu alabilir. Üyelik, randevularını tek yerde takip etmek isteyenler içindir.",
              },
              {
                q: "Çalışanlarım hangi bilgileri görür?",
                a: "Personel hesabı, işletme sahibinin verdiği erişimle yalnızca kendisine atanmış randevuları ve işlem tercihlerini görür.",
              },
              {
                q: "Kaçan talep gerçekten nasıl ölçülür?",
                a: "Müşterinin özellikle aradığı ancak bulamadığı saatler kaydedilir. Sayfadan çıkan herkes kayıp müşteri sayılmaz. Gösterilen ciro potansiyeli, varsayımları açık bir tahmindir.",
              },
              {
                q: "Randevularımı başka bir işletme görebilir mi?",
                a: "Her işletmenin kayıtları kendi erişim yetkisiyle sınırlandırılır. Personel ve işletme yetkileri sunucuda kontrol edilir.",
              },
            ].map((f) => (
              <details key={f.q}>
                <summary>
                  {f.q}
                  <ChevronDown size={18} />
                </summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </section>
        <section className="neta-container neta-final-cta">
          <div>
            <h2>
              Bir sonraki randevunuz
              <br />
              daha iyi bir başlangıç olsun.
            </h2>
            <p>İşletmenizin yeni ritmini Neta ile kurun.</p>
          </div>
          <a className="button primary" href={start}>
            Hemen başla <ArrowRight size={18} />
          </a>
        </section>
      </main>
      <footer className="neta-footer neta-container">
        <Brand />
        <p>Randevunuz net. İşiniz yolunda.</p>
        <nav>
          <a href="/giris?rol=business">İşletme girişi</a>
          <a href="/kesfet">Randevu al</a>
          <a href="/gizlilik">Gizlilik</a>
          <a href="/kosullar">Kullanım koşulları</a>
        </nav>
        <small>© {new Date().getFullYear()} Neta Randevu</small>
      </footer>
    </div>
  );
}
