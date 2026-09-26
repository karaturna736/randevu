export type HelpArticle = {
  id: string;
  category: string;
  title: string;
  keywords: string;
  view: string;
  body: string;
  steps?: string[];
};

export const HELP_ARTICLES: HelpArticle[] = [
  {
    id: 'appointment-create',
    category: 'Randevular',
    title: 'Yeni randevu nasıl eklerim?',
    keywords: 'randevu ekle oluştur yeni rezervasyon müşteri saat takvim',
    view: 'appointments',
    body: 'Panelin sağ üstündeki Yeni randevu düğmesini kullanın. Hizmeti, müşteriyi, personeli ve uygun saati seçip kaydedin.',
    steps: ['Yeni randevu düğmesine basın.', 'Hizmeti ve müşteriyi seçin.', 'Personel ile uygun tarih/saat seçin.', 'Bilgileri kontrol edip randevuyu kaydedin.'],
  },
  {
    id: 'appointment-change',
    category: 'Randevular',
    title: 'Randevuyu nasıl değiştirir veya iptal ederim?',
    keywords: 'randevu değiştir taşı ertele saat değişiklik iptal sil düzenle',
    view: 'appointments',
    body: 'Randevular veya Takvim bölümünden ilgili randevuyu açın. Randevu ayrıntılarından tarih/saat değişikliği veya iptal işlemini yapabilirsiniz.',
    steps: ['Randevular veya Takvim bölümünü açın.', 'Değiştirmek istediğiniz randevuya dokunun.', 'Yeni tarih/saat seçin veya iptal seçeneğini kullanın.', 'Değişikliği onaylayın.'],
  },
  {
    id: 'link',
    category: 'Randevu bağlantısı',
    title: 'Randevu linkimi nasıl paylaşırım?',
    keywords: 'link bağlantı paylaş instagram qr whatsapp müşteri sayfası',
    view: 'share',
    body: 'Randevu linkim bölümünü açın. Bağlantıyı kopyalayabilir, WhatsApp’ta paylaşabilir veya QR kodunu kullanabilirsiniz. Müşteriniz üye olmadan randevu alabilir.',
    steps: ['Randevu linkim bölümünü açın.', 'Bağlantıyı kopyalayın veya QR kodunu indirin.', 'Instagram, Google işletme profili veya WhatsApp üzerinden paylaşın.'],
  },
  {
    id: 'staff-add',
    category: 'Ekip',
    title: 'Yeni personel nasıl eklerim?',
    keywords: 'personel çalışan ekip berber uzman ekle yeni personel',
    view: 'staff',
    body: 'Ekip bölümünden yeni personel ekleyebilir; adını, görevini, çalışma saatlerini ve verebildiği hizmetleri belirleyebilirsiniz.',
    steps: ['Ekip bölümünü açın.', 'Yeni personel ekle seçeneğini kullanın.', 'Personel bilgilerini ve çalışma saatlerini girin.', 'Verebildiği hizmetleri seçip kaydedin.'],
  },
  {
    id: 'staff-hours',
    category: 'Ekip',
    title: 'Personelin çalışma saatlerini veya izin gününü nasıl değiştiririm?',
    keywords: 'çalışma saat saatleri mesai izin tatil kapalı personel müsaitlik',
    view: 'staff',
    body: 'Ekip bölümünde ilgili personeli açın. Çalışma saatlerini düzenleyebilir ve izin/kapalı gün tanımlayabilirsiniz. Müsait saatler bu ayarlara göre hesaplanır.',
    steps: ['Ekip bölümünü açın.', 'Personeli seçin.', 'Çalışma saatleri veya izin alanını düzenleyin.', 'Kaydedin ve Takvim bölümünden sonucu kontrol edin.'],
  },
  {
    id: 'service-add',
    category: 'Hizmetler',
    title: 'Yeni hizmet, fiyat veya süre nasıl eklerim?',
    keywords: 'hizmet işlem fiyat ücret süre dakika ekle düzenle saç kesimi bakım',
    view: 'services',
    body: 'Hizmetler bölümünden yeni hizmet oluşturabilir; hizmet adı, süre ve fiyat bilgilerini düzenleyebilirsiniz.',
    steps: ['Hizmetler bölümünü açın.', 'Yeni hizmet ekleyin.', 'Ad, süre ve fiyat bilgilerini girin.', 'Hizmeti kaydedin ve gerekiyorsa personele atayın.'],
  },
  {
    id: 'availability',
    category: 'Randevular',
    title: 'Müsait saatler neden görünmüyor?',
    keywords: 'müsait saat görünmüyor boş saat izin çalışma personel kapalı uygunluk',
    view: 'staff',
    body: 'İşletme ve personelin çalışma saatlerini, izin günlerini ve hizmet süresini kontrol edin. Randevu iki çalışma aralığının kesişimine sığmalı ve saat dolu olmamalıdır.',
    steps: ['Ekip bölümünden personelin çalışma saatlerini kontrol edin.', 'İzin veya kapalı gün olup olmadığını kontrol edin.', 'Hizmet süresinin çalışma aralığına sığdığını doğrulayın.', 'Takvimde aynı saatte başka randevu olup olmadığını kontrol edin.'],
  },
  {
    id: 'customer',
    category: 'Müşteriler',
    title: 'Müşteri geçmişini nereden görürüm?',
    keywords: 'müşteri geçmiş ziyaret telefon harcama kayıt profil',
    view: 'customers',
    body: 'Müşteriler bölümünden müşteriyi açarak ziyaret geçmişi, randevu bilgileri ve sistemde bulunan müşteri özetini görebilirsiniz.',
    steps: ['Müşteriler bölümünü açın.', 'İsim veya telefon ile müşteriyi bulun.', 'Müşteri kartını açın.', 'Ziyaret ve randevu geçmişini inceleyin.'],
  },
  {
    id: 'debt',
    category: 'Borç / Veresiye',
    title: 'Veresiye ve kısmi tahsilat nasıl çalışır?',
    keywords: 'borç veresiye tahsilat ödeme alacak kısmi para',
    view: 'receivables',
    body: 'Borç / Veresiye bölümünde müşteri ve ödenmemiş tutarı girin. Müşteriden para aldığınızda Tahsilat kaydet seçeneğini kullanın. Kısmi ödeme yapılırsa kalan tutar otomatik hesaplanır.',
    steps: ['Borç / Veresiye bölümünü açın.', 'Müşteriyi ve borç tutarını kaydedin.', 'Ödeme geldiğinde ilgili borcu açın.', 'Tahsilat kaydet ile alınan tutarı girin.'],
  },
  {
    id: 'journey',
    category: 'Hizmet yolculuğu',
    title: 'Hizmet yolculuğunu nasıl kullanırım?',
    keywords: 'yolculuk süreç aşama seans paket ilerleme danışan müşteri',
    view: 'journeys',
    body: 'Hizmet yolculuğu bölümünde müşteri, süreç adı ve aşamalarını belirleyin. Tamamlanan aşamaları işaretleyebilir ve paylaşım açıksa müşteriye özel bağlantı oluşturabilirsiniz.',
    steps: ['Hizmet yolculuğu bölümünü açın.', 'Müşteri ve süreç başlığını seçin.', 'Aşamaları oluşturun.', 'İlerledikçe sıradaki aşamayı tamamlayın.'],
  },
  {
    id: 'wa',
    category: 'WhatsApp',
    title: 'WhatsApp’tan alınan randevu takvime düşer mi?',
    keywords: 'whatsapp bot otomasyon ortak takvim mesaj randevu',
    view: 'whatsapp',
    body: 'Meta Cloud API bağlantısı tamamlandığında WhatsApp ve web randevuları aynı takvimi kullanır. Müşteri son onayı verdiğinde saat hâlâ uygunsa randevu kaydedilir.',
    steps: ['WhatsApp bölümünü açın.', 'Bağlantı durumunu kontrol edin.', 'Meta Cloud API kurulumu tamamlandıktan sonra test mesajı akışını doğrulayın.', 'Oluşan randevuyu Takvim bölümünde kontrol edin.'],
  },
  {
    id: 'recall',
    category: 'Pazarlama',
    title: 'Müşterileri otomatik geri çağırabilir miyim?',
    keywords: 'pazarlama geri kazanma otopilot çağırma kampanya eski müşteri',
    view: 'growth',
    body: 'Pazarlama ve büyüme bölümünden geri çağırma ayarlarını yönetebilirsiniz. Yalnızca gerekli bağlantılar hazır olduğunda ve iletişim izni bulunan uygun müşteriler için çalışır.',
    steps: ['Pazarlama ve büyüme bölümünü açın.', 'Geri çağırma aralığını belirleyin.', 'WhatsApp bağlantısı ve mesaj şablonunun hazır olduğunu doğrulayın.', 'Uygun müşteri listesini kontrol edin.'],
  },
  {
    id: 'recovery',
    category: 'Gelir kurtarma',
    title: 'Boşalan bir saati bekleme listesindeki müşteriye nasıl sunarım?',
    keywords: 'gelir kurtarma bekleme listesi boş saat iptal teklif müşteri doldur',
    view: 'recovery',
    body: 'Gelir kurtarma bölümünde bekleme listesi ve uygun boşlukları görebilirsiniz. Özellik bağlantıları hazır olduğunda uygun müşterilere sırayla teklif akışı kullanılabilir.',
    steps: ['Gelir kurtarma bölümünü açın.', 'Boşalan saat ve uygun bekleme kayıtlarını kontrol edin.', 'Uygun teklif akışını başlatın.', 'Saat dolduğunda randevunun takvime işlendiğini doğrulayın.'],
  },
  {
    id: 'demand',
    category: 'Analiz',
    title: 'Kaçan talep ve gelir tahmini ne anlama geliyor?',
    keywords: 'kaçan gelir talep fırsat analiz yoğun saat kapasite',
    view: 'demand',
    body: 'Talep fırsatları, uygun saat bulamayan aramaları ve hizmet fiyatlarından hesaplanan potansiyeli gösterir. Bu değer gerçekleşmiş veya garanti edilmiş gelir değildir.',
    steps: ['Talep fırsatları bölümünü açın.', 'En çok aranan saatleri ve hizmetleri inceleyin.', 'Mevcut kapasiteyle karşılaştırın.', 'Ek personel veya çalışma saati kararını bu verilerle değerlendirin.'],
  },
  {
    id: 'reports',
    category: 'Raporlar',
    title: 'Gelir ve işlem raporlarını nereden görürüm?',
    keywords: 'rapor gelir ciro işlem analiz kazanç istatistik',
    view: 'reports',
    body: 'Gelir raporu ve İşlem analizi bölümlerinden tamamlanan randevulara dayalı özetleri inceleyebilirsiniz.',
    steps: ['Gelir raporu bölümünü açın.', 'İlgili dönem verilerini inceleyin.', 'Hizmet bazlı karşılaştırma için İşlem analizi bölümünü kullanın.'],
  },
  {
    id: 'branches',
    category: 'Şubeler',
    title: 'Şube kârlılığını nasıl takip ederim?',
    keywords: 'şube karlılık kâr zarar gider gelir masraf mağaza lokasyon',
    view: 'branches',
    body: 'Şube kârlılığı bölümünde şubelerin gelir, gider ve net sonuçlarını karşılaştırabilirsiniz. Sonucun doğru olması için gider kayıtlarının düzenli tutulması gerekir.',
    steps: ['Şube kârlılığı bölümünü açın.', 'İncelemek istediğiniz dönemi seçin.', 'Gelir ve gider kalemlerini kontrol edin.', 'Şubelerin net sonucunu karşılaştırın.'],
  },
  {
    id: 'subscription',
    category: 'Abonelik',
    title: 'Abonelik ve ödeme bilgilerimi nereden yönetirim?',
    keywords: 'abonelik ödeme paytr iyzico banka kart fiyat starter business kurumsal pro plus paket',
    view: 'billing',
    body: 'Abonelik ve ödemeler ekranından aktif planı ve mevcut ödeme durumunu yönetebilirsiniz. Kart bilgileri Neta panelinde saklanmaz; ödeme sağlayıcısının güvenli akışı kullanılır.',
    steps: ['Abonelik ve ödemeler ekranını açın.', 'Aktif planınızı kontrol edin.', 'Plan değişikliği veya ödeme adımlarını sağlayıcının güvenli ekranından tamamlayın.'],
  },
  {
    id: 'theme',
    category: 'Ayarlar',
    title: 'Müşteri randevu sayfasının görünümünü nasıl değiştiririm?',
    keywords: 'sektör tema tasarım görünüm kuaför diyetisyen spor danışman marka',
    view: 'growth',
    body: 'Pazarlama ve büyüme bölümünden müşteri randevu sayfasının sektör görünümünü seçebilirsiniz. Otomatik seçenek işletme kategorisine göre uygun görünümü kullanır.',
    steps: ['Pazarlama ve büyüme bölümünü açın.', 'Sayfa markası alanını bulun.', 'İstediğiniz görünümü seçin.', 'Ayarları kaydedin.'],
  },
  {
    id: 'settings',
    category: 'Ayarlar',
    title: 'İşletme bilgilerimi veya randevu kurallarını nasıl değiştiririm?',
    keywords: 'ayarlar işletme profil ad telefon şehir kural randevu değiştir düzenle',
    view: 'settings',
    body: 'Ayarlar bölümünden işletme profilini ve desteklenen randevu kurallarını düzenleyebilirsiniz.',
    steps: ['Ayarlar bölümünü açın.', 'Değiştirmek istediğiniz alanı düzenleyin.', 'Bilgileri kontrol edip kaydedin.'],
  },
];

function normalize(value: string) {
  return value
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .replace(/[^a-z0-9ğüşöç\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function helpMatches(message: string) {
  const q = normalize(message);
  const words = q.split(' ').filter((w) => w.length > 2);
  if (!words.length) return [];
  return HELP_ARTICLES.map((article) => {
    const title = normalize(article.title);
    const haystack = normalize([article.title, article.keywords, article.category, article.body].join(' '));
    let score = 0;
    if (title.includes(q) || q.includes(title)) score += 8;
    for (const word of words) {
      if (title.includes(word)) score += 3;
      else if (haystack.includes(word)) score += 1;
    }
    return { ...article, score };
  })
    .filter((article) => article.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}
