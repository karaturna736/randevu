"use client";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronDown,
  Clock,
  Scissors,
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
    [slot, setSlot] = useState("13:30"),
    [plan, setPlan] = useState<any>(null);
  useEffect(() => {
    api("plans")
      .then((p) => setPlan({ ...p, amount: 200000 }))
      .catch(() => setPlan({ amount: 200000 }));
  }, []);
  const start = "/kayit?rol=business&sonra=%2Fkurulum",
    signed = !!data?.profile;
  return (
    <div className="neta-home">
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
        <section className="neta-container neta-hero">
          <div className="neta-hero-copy">
            <span className="neta-eyebrow">
              <span />
              İŞİNİZİN YENİ RİTMİ
            </span>
            <h1>
              Her boş saati
              <br />
              dolu bir <em>randevuya</em>
              <br />
              çevirin.
            </h1>
            <p>
              Takviminizi düzenleyin, ekibinizi yönetin, kaçırdığınız talebi
              fark edin. İşletmenize özel randevu sistemi, tek bir bağlantıda.
            </p>
            <div className="neta-hero-actions">
              <a className="button primary" href={start}>
                İşletmemi oluştur <ArrowRight size={18} />
              </a>
              <a className="button neta-outline" href="/panel?demo=1">
                <Play size={16} />
                Canlı demoyu incele
              </a>
            </div>
            <div className="neta-trust">
              <span>
                <Check size={15} />
                Kurulumda kart gerekmez
              </span>
              <span>
                <Check size={15} />
                Size özel randevu linki
              </span>
            </div>
          </div>
          <div className="neta-hero-visual">
            <div className="neta-orbit-caption">
              <span className="neta-mini-logo">n</span>Atölye Studio{" "}
              <span>Örnek görünüm</span>
            </div>
            <div className="neta-booking-example">
              <div className="neta-example-head">
                <span>
                  <CalendarDays size={18} />
                  Cumartesi, 26 Eylül
                </span>
                <span>3 uygun saat</span>
              </div>
              <div className="neta-example-service">
                <span>
                  <Scissors size={23} />
                </span>
                <div>
                  <strong>Saç kesimi</strong>
                  <small>45 dakika · Ahmet Yılmaz</small>
                </div>
                <b>₺650</b>
              </div>
              <div className="neta-example-times">
                {["09:30", "10:15", "11:00", "11:45", "13:30", "15:00"].map(
                  (s, i) => (
                    <button
                      key={s}
                      disabled={[0, 1, 3].includes(i)}
                      onClick={() => setSlot(s)}
                      aria-pressed={slot === s}
                      className={slot === s ? "selected" : ""}
                    >
                      {s}
                      {[0, 1, 3].includes(i) && <small>Dolu</small>}
                    </button>
                  ),
                )}
              </div>
              <a href="/atolye-studio" className="button primary full">
                {slot} için örnek akışı aç <ArrowRight size={16} />
              </a>
              <p>
                <ShieldCheck size={13} />
                Bu kart gerçek rezervasyon oluşturmaz.
              </p>
            </div>
            <div className="neta-demand-float">
              <span>
                <Radar size={22} />
              </span>
              <div>
                <small>TALEP FIRSATI · ÖRNEK</small>
                <strong>Cumartesi akşamına talep var.</strong>
                <p>Kapalı saatlerdeki aramaları keşfedin.</p>
              </div>
              <ArrowUpRight size={18} />
            </div>
            <div className="neta-visual-note">
              <span />
              Planlı günler. Daha az telefon trafiği.
            </div>
          </div>
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
            <a className="text-button" href="/panel?demo=1">
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
              Starter 600 TL, Business 999 TL, Kurumsal 2.500 TL/ay. Müşteri
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
              <span className="neta-mini-logo">n</span>
              <h3>Neta Business</h3>
              <span>İşletme büyüme paketi</span>
            </div>
            <div className="neta-price">
              <strong>{money(plan?.amount || 99900)}</strong>
              <span>/ ay</span>
            </div>
            <ul>
              {[
                "5 şubeye kadar · sınırsız personel",
                "AI, çift yönlü WhatsApp ve online ödeme",
                "Gelir kurtarma motoru",
                "Şube kâr/zarar karşılaştırması",
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
