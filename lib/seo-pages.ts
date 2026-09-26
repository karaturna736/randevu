import type { Metadata } from "next";

const SITE_URL = "https://netarandevu.com";

export type SeoPageConfig = {
  slug: string;
  title: string;
  description: string;
  breadcrumb: string;
  eyebrow: string;
  h1: string;
  intro: string;
  sections: Array<{
    heading: string;
    body: string;
    items?: string[];
  }>;
  faqs: Array<{ question: string; answer: string }>;
  related: Array<{ href: string; label: string }>;
};

export function metadataForSeoPage(page: SeoPageConfig): Metadata {
  return {
    title: page.title,
    description: page.description,
    alternates: { canonical: `/${page.slug}` },
    openGraph: {
      title: page.title,
      description: page.description,
      url: `/${page.slug}`,
      siteName: "Neta",
      locale: "tr_TR",
      type: "website",
      images: [{ url: "/neta-logo.png", alt: "Neta Randevu" }],
    },
    twitter: {
      card: "summary_large_image",
      title: page.title,
      description: page.description,
      images: ["/neta-logo.png"],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    },
  };
}

export const seoPages: Record<string, SeoPageConfig> = {
  "online-randevu-sistemi": {
    slug: "online-randevu-sistemi",
    title: "Online Randevu Sistemi | Neta",
    description:
      "Neta online randevu sistemi ile hizmet, personel ve uygun saatlerinizi tek takvimde yönetin; müşterileriniz size özel bağlantıdan randevu alabilsin.",
    breadcrumb: "Online Randevu Sistemi",
    eyebrow: "ONLINE RANDEVU SİSTEMİ",
    h1: "İşletmeniz için online randevu sistemi",
    intro:
      "Neta, randevuyla çalışan işletmelerin hizmetlerini, personelini, çalışma saatlerini ve müşteri randevularını tek yerde yönetmesine yardımcı olur. Müşteriler size özel randevu bağlantısından uygun saatleri görüp işlem seçebilir.",
    sections: [
      {
        heading: "Online randevu sistemi ne sağlar?",
        body:
          "Telefon ve mesaj üzerinden tek tek saat kontrol etmek yerine işletmenin güncel takvimi müşteriye doğrudan gösterilir. Müşteri hizmeti, personeli ve uygun saati kendi seçebilir; işletme ise aynı takvimden süreci takip eder.",
        items: [
          "Hizmet, fiyat ve süre tanımlama",
          "Personel ve şube bazlı çalışma saatleri",
          "Müşteriye özel randevu bağlantısı",
          "İptal, değişiklik ve bekleme listesi akışları",
          "Talep ve boş saatleri takip etmeye yardımcı raporlar",
        ],
      },
      {
        heading: "Web ve WhatsApp aynı takvimi kullanabilir",
        body:
          "Neta'nın web randevu akışı ile WhatsApp üzerinden gelen randevu talepleri aynı işletme takvimini kullanacak şekilde çalışabilir. Böylece farklı kanallardan gelen talepler aynı personel ve uygunluk verisi üzerinden yönetilir.",
      },
      {
        heading: "Kimler kullanabilir?",
        body:
          "Kuaförler, berberler, güzellik ve bakım işletmeleri, danışmanlar, özel ders verenler ve zaman bazlı hizmet sunan ekipler Neta'yı kendi çalışma düzenlerine göre yapılandırabilir.",
      },
    ],
    faqs: [
      {
        question: "Müşterinin üye olması gerekir mi?",
        answer:
          "Hayır. İşletmenin randevu sayfasında hizmet ve saat seçilerek üyelik zorunluluğu olmadan randevu akışı tamamlanabilir.",
      },
      {
        question: "Birden fazla personelin takvimi ayrı tutulabilir mi?",
        answer:
          "Evet. Hizmet, personel ve çalışma saatleri ayrı tanımlanabildiği için uygunluk personel bazında hesaplanabilir.",
      },
    ],
    related: [
      { href: "/kuafor-randevu-sistemi", label: "Kuaför randevu sistemi" },
      { href: "/berber-randevu-sistemi", label: "Berber randevu sistemi" },
      { href: "/whatsapp-randevu-sistemi", label: "WhatsApp randevu sistemi" },
      {
        href: "/guzellik-salonu-randevu-sistemi",
        label: "Güzellik salonu randevu sistemi",
      },
    ],
  },
  "kuafor-randevu-sistemi": {
    slug: "kuafor-randevu-sistemi",
    title: "Kuaför Randevu Sistemi | Neta",
    description:
      "Kuaförler için Neta randevu sistemi: hizmet, personel, çalışma saati, müşteri ve WhatsApp randevularını aynı takvimden yönetin.",
    breadcrumb: "Kuaför Randevu Sistemi",
    eyebrow: "KUAFÖRLER İÇİN NETA",
    h1: "Kuaför randevu sistemi",
    intro:
      "Saç kesimi, boya, bakım ve benzeri işlemlerde hizmet süreleri ve personel uygunluğu farklı olabilir. Neta, kuaförlerin bu değişkenleri tek randevu akışında yönetmesine yardımcı olacak şekilde tasarlanmıştır.",
    sections: [
      {
        heading: "Hizmet süresi ve personel uygunluğu birlikte yönetilir",
        body:
          "Her hizmet için fiyat ve süre tanımlanabilir. Müşteri hizmet seçtiğinde sistem uygun personel ve saatleri işletmenin çalışma düzenine göre gösterebilir.",
        items: [
          "Saç kesimi, boya ve bakım gibi hizmetleri ayrı tanımlama",
          "Personel bazlı uygunluk",
          "Şube bazlı takvim yönetimi",
          "Müşteri geçmişi ve işlem notları",
        ],
      },
      {
        heading: "Boş saatleri değerlendirmek için talep görünürlüğü",
        body:
          "Müşterinin aradığı ancak bulamadığı saatleri takip etmek yoğun dönemleri anlamaya yardımcı olabilir. Bekleme listesi ve gelir kurtarma akışları iptal edilen saatlerin yeniden değerlendirilmesini destekler.",
      },
      {
        heading: "WhatsApp alışkanlığını randevu sistemine bağlayın",
        body:
          "Müşteri alıştığı gibi WhatsApp'tan randevu sorabilir. Bağlı WhatsApp otomasyonu, Neta takvimindeki hizmet ve uygunluk verisini kullanarak müşteriyi randevu akışına yönlendirebilir.",
      },
    ],
    faqs: [
      {
        question: "Kuaför müşterisi internetten randevu alabilir mi?",
        answer:
          "Evet. İşletmenin kendine özel Neta bağlantısından hizmet, personel ve uygun saat seçilerek randevu alınabilir.",
      },
      {
        question: "Birden fazla şube yönetilebilir mi?",
        answer:
          "Uygun Neta planında şubeler ayrı takvim ve personel yapısıyla yönetilebilir.",
      },
    ],
    related: [
      { href: "/online-randevu-sistemi", label: "Online randevu sistemi" },
      { href: "/berber-randevu-sistemi", label: "Berber randevu sistemi" },
      { href: "/whatsapp-randevu-sistemi", label: "WhatsApp randevu sistemi" },
    ],
  },
  "berber-randevu-sistemi": {
    slug: "berber-randevu-sistemi",
    title: "Berber Randevu Sistemi | Neta",
    description:
      "Berberler için online randevu sistemi. Neta ile personel, hizmet, uygun saat, müşteri takibi ve WhatsApp randevu akışlarını tek yerde yönetin.",
    breadcrumb: "Berber Randevu Sistemi",
    eyebrow: "BERBERLER İÇİN NETA",
    h1: "Berber randevu sistemi",
    intro:
      "Yoğun saatlerde telefon ve WhatsApp üzerinden aynı uygunluk sorusuna tekrar tekrar cevap vermek yerine Neta, berberin güncel takvimini tek yerde toplar ve müşteriye uygun saatleri gösterebilir.",
    sections: [
      {
        heading: "Hizmete göre süre, personele göre uygunluk",
        body:
          "Saç kesimi, sakal, bakım veya paket hizmetleri farklı sürelerde tanımlanabilir. Personelin çalışma saatleri ve mevcut randevuları dikkate alınarak müşteriye uygun seçenekler sunulabilir.",
        items: [
          "Personel bazlı takvim",
          "Hizmet bazlı süre ve fiyat",
          "Müşteriye özel rezervasyon bağlantısı",
          "Bekleme listesi ve iptal sonrası boşluk yönetimi",
        ],
      },
      {
        heading: "Yoğun saatleri görün",
        body:
          "Talep fırsatları ekranı, müşterilerin özellikle aradığı ancak uygunluk bulamadığı zamanları görmeye yardımcı olur. İşletme bu veriyi çalışma saatlerini veya personel planını değerlendirirken kullanabilir.",
      },
      {
        heading: "WhatsApp'tan gelen müşteri de aynı takvime bağlanır",
        body:
          "WhatsApp otomasyonu kullanıldığında gelen randevu soruları Neta'daki hizmet ve uygunluk bilgisiyle yanıtlanabilir. Böylece web ve WhatsApp kanalları birbirinden kopuk çalışmaz.",
      },
    ],
    faqs: [
      {
        question: "Müşteri randevu için uygulama indirmek zorunda mı?",
        answer:
          "Hayır. Neta web tabanlı randevu bağlantısı üzerinden çalışabilir; müşteri bağlantıyı tarayıcıdan açabilir.",
      },
      {
        question: "Randevusuz gelen müşterilerle birlikte kullanılabilir mi?",
        answer:
          "Evet. Sistem planlı randevuları takip ederken işletme kendi operasyonunda randevusuz müşteriler için de takvim düzenini yönetebilir.",
      },
    ],
    related: [
      { href: "/online-randevu-sistemi", label: "Online randevu sistemi" },
      { href: "/kuafor-randevu-sistemi", label: "Kuaför randevu sistemi" },
      { href: "/whatsapp-randevu-sistemi", label: "WhatsApp randevu sistemi" },
    ],
  },
  "whatsapp-randevu-sistemi": {
    slug: "whatsapp-randevu-sistemi",
    title: "WhatsApp Randevu Sistemi ve Otomasyonu | Neta",
    description:
      "Neta WhatsApp randevu otomasyonu, müşterinin mesajdan uygun saat sormasını ve aynı işletme takvimi üzerinden randevu akışına yönlenmesini sağlar.",
    breadcrumb: "WhatsApp Randevu Sistemi",
    eyebrow: "WHATSAPP RANDEVU OTOMASYONU",
    h1: "WhatsApp randevu sistemi",
    intro:
      "Müşteriler birçok işletmeye hâlâ WhatsApp'tan 'yarın saat 18:00 uygun musunuz?' diye yazıyor. Neta'nın WhatsApp randevu otomasyonu bu alışkanlığı korurken talebi işletmenin gerçek randevu takvimiyle buluşturmayı amaçlar.",
    sections: [
      {
        heading: "Mesajdan uygun saat kontrolüne",
        body:
          "Bağlı WhatsApp numarasına gelen randevu talebi, işletmenin Neta'daki hizmet, personel ve çalışma saati verisiyle değerlendirilebilir. Uygun saatler müşteriye mesajla sunulabilir ve Neta randevu bağlantısı paylaşılabilir.",
        items: [
          "Gelen mesajı randevu talebi olarak algılama",
          "Takvimden gerçek uygun saatleri kontrol etme",
          "Müşteriye uygun seçenekleri gönderme",
          "Neta online randevu bağlantısını paylaşma",
          "Onaylanan randevuyu ortak takvime kaydetme",
        ],
      },
      {
        heading: "Web randevusu ile WhatsApp randevusu ayrı kalmaz",
        body:
          "Aynı işletmenin web sayfasından ve WhatsApp kanalından gelen talepler ortak uygunluk verisini kullanır. Amaç çift rezervasyon riskini azaltmak ve işletmenin tek takvim üzerinden ilerlemesini sağlamaktır.",
      },
      {
        heading: "Sık yazılan kelimelerden hızlı yönlendirme",
        body:
          "İşletme, 'randevu', 'link' veya 'online randevu' gibi belirli ifadeler geldiğinde müşteriye doğrudan kendi Neta randevu bağlantısını gönderecek otomasyonlar kullanabilir.",
      },
    ],
    faqs: [
      {
        question: "Müşteri WhatsApp'tan randevu alabilir mi?",
        answer:
          "Bağlantı ve otomasyon yapılandırıldığında müşteri WhatsApp üzerinden uygunluk sorabilir, seçenekleri görebilir ve randevu akışına devam edebilir.",
      },
      {
        question: "WhatsApp ve web aynı takvimi kullanır mı?",
        answer:
          "Neta'nın tasarımında iki kanal aynı işletmenin hizmet, personel ve uygunluk verisini kullanacak şekilde birleştirilir.",
      },
    ],
    related: [
      { href: "/online-randevu-sistemi", label: "Online randevu sistemi" },
      { href: "/kuafor-randevu-sistemi", label: "Kuaför randevu sistemi" },
      { href: "/berber-randevu-sistemi", label: "Berber randevu sistemi" },
    ],
  },
  "guzellik-salonu-randevu-sistemi": {
    slug: "guzellik-salonu-randevu-sistemi",
    title: "Güzellik Salonu Randevu Sistemi | Neta",
    description:
      "Güzellik salonları için Neta: hizmet süresi, uzman, şube, müşteri ve online randevu takibini tek sistemde yönetin; WhatsApp taleplerini takvime bağlayın.",
    breadcrumb: "Güzellik Salonu Randevu Sistemi",
    eyebrow: "GÜZELLİK SALONLARI İÇİN NETA",
    h1: "Güzellik salonu randevu sistemi",
    intro:
      "Bakım, cilt uygulamaları, kirpik, tırnak veya benzeri hizmetlerin süreleri ve uzmanları farklı olabilir. Neta, hizmeti doğru uzman ve uygun saatle eşleştiren düzenli bir rezervasyon akışı kurmaya yardımcı olur.",
    sections: [
      {
        heading: "Hizmet ve uzman bazlı planlama",
        body:
          "Her hizmetin süresi, fiyatı ve hizmeti verebilen personel ayrı tanımlanabilir. Müşteriye yalnızca uygun seçeneklerin gösterilmesi planlamayı kolaylaştırır.",
        items: [
          "Hizmet ve süre yönetimi",
          "Uzman/personel bazlı uygunluk",
          "Şube bazlı çalışma düzeni",
          "Müşteri geçmişi ve hizmet yolculuğu",
        ],
      },
      {
        heading: "İptal edilen saatleri yeniden değerlendirin",
        body:
          "Bekleme listesi ve gelir kurtarma araçları, boşalan bir saat için uygun müşterileri tekrar randevuya yönlendirmeye yardımcı olabilir.",
      },
      {
        heading: "Online bağlantı ve WhatsApp birlikte çalışabilir",
        body:
          "Müşteri doğrudan salonun Neta sayfasından randevu alabilir veya WhatsApp'tan uygunluk sorabilir. Her iki kanal da aynı işletme takvimine bağlanabilir.",
      },
    ],
    faqs: [
      {
        question: "Her hizmet için farklı süre tanımlanabilir mi?",
        answer:
          "Evet. Hizmet süresi ve fiyatı ayrı tanımlanabilir; uygun saat hesaplaması hizmet süresine göre yapılabilir.",
      },
      {
        question: "Salonun birden fazla uzmanı varsa kullanılabilir mi?",
        answer:
          "Evet. Personeller ve çalışma saatleri ayrı tutulabilir ve hizmetler uygun personele bağlanabilir.",
      },
    ],
    related: [
      { href: "/online-randevu-sistemi", label: "Online randevu sistemi" },
      { href: "/whatsapp-randevu-sistemi", label: "WhatsApp randevu sistemi" },
      { href: "/kuafor-randevu-sistemi", label: "Kuaför randevu sistemi" },
    ],
  },
};

export function seoPageUrl(slug: string) {
  return `${SITE_URL}/${slug}`;
}
