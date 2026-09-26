import type { Metadata } from "next";

const SITE_URL = "https://netarandevu.com";

export const metadata: Metadata = {
  title: "Neta Randevu Hakkında",
  description:
    "Neta Randevu; randevuyla çalışan işletmeler için online randevu, WhatsApp otomasyonu, ekip, müşteri ve talep yönetimini tek yerde birleştiren işletme yazılımıdır.",
  alternates: { canonical: "/hakkimizda" },
  openGraph: {
    title: "Neta Randevu Hakkında | Neta",
    description:
      "Neta'nın online randevu, WhatsApp otomasyonu ve işletme yönetimi yaklaşımını keşfedin.",
    url: "/hakkimizda",
    type: "website",
    siteName: "Neta",
    locale: "tr_TR",
    images: [
      {
        url: "/neta-logo.png",
        alt: "Neta Randevu",
      },
    ],
  },
};

const aboutSchema = {
  "@context": "https://schema.org",
  "@type": "AboutPage",
  "@id": `${SITE_URL}/hakkimizda#about`,
  url: `${SITE_URL}/hakkimizda`,
  name: "Neta Randevu Hakkında",
  inLanguage: "tr-TR",
  mainEntity: {
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    name: "Neta",
    alternateName: ["Neta Randevu", "Neta Yazılım"],
    url: SITE_URL,
    logo: `${SITE_URL}/neta-logo.png`,
  },
};

export default function HakkimizdaPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(aboutSchema).replace(/</g, "\\u003c"),
        }}
      />
      <main className="neta-home">
        <section className="neta-container neta-section">
          <span className="neta-eyebrow">NETA RANDEVU</span>
          <h1>Neta Randevu nedir?</h1>
          <p>
            Neta, randevuyla çalışan işletmelerin takvimini, ekibini,
            müşterilerini ve gelen talepleri tek yerde yönetmesi için geliştirilen
            online randevu ve işletme yönetim sistemidir.
          </p>
          <p>
            Kuaför, berber, güzellik ve bakım işletmeleri, danışmanlar, özel ders
            verenler ve benzeri randevulu işletmeler Neta üzerinden kendilerine
            özel randevu bağlantısı oluşturabilir; müşteriler uygun saatleri görüp
            online randevu alabilir.
          </p>
          <h2>Neta ne yapar?</h2>
          <p>
            Online randevu yönetimi, WhatsApp randevu otomasyonu, personel ve şube
            yönetimi, müşteri takibi, bekleme listesi, talep analizi ve boş saatleri
            değerlendirmeye yardımcı gelir kurtarma araçlarını aynı sistemde
            birleştirir.
          </p>
          <h2>Neta'nın amacı</h2>
          <p>
            Telefon ve mesaj trafiğini azaltırken işletmenin uygun saatlerini daha
            görünür hale getirmek, randevu sürecini kolaylaştırmak ve işletme
            sahibine gerçek talep verileri sunmaktır.
          </p>
          <h2>Neta çözümlerini inceleyin</h2>
          <ul>
            <li>
              <a href="/online-randevu-sistemi">Online randevu sistemi</a>
            </li>
            <li>
              <a href="/whatsapp-randevu-sistemi">WhatsApp randevu sistemi</a>
            </li>
            <li>
              <a href="/kuafor-randevu-sistemi">Kuaför randevu sistemi</a>
            </li>
            <li>
              <a href="/berber-randevu-sistemi">Berber randevu sistemi</a>
            </li>
            <li>
              <a href="/guzellik-salonu-randevu-sistemi">
                Güzellik salonu randevu sistemi
              </a>
            </li>
          </ul>
          <div className="neta-hero-actions">
            <a className="button primary" href="/">
              Neta'yı incele
            </a>
            <a className="button neta-outline" href="/demo">
              Canlı demoyu aç
            </a>
          </div>
        </section>
      </main>
    </>
  );
}
