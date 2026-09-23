# Neta Randevu

Neta, kuaför, berber, klinik, danışman, eğitmen ve benzeri işletmeler için
çok işletmeli randevu ve müşteri operasyon platformudur.

## Bu depoda ne var?

Temel randevu takvimi, işletme/personel/hizmet yönetimi, misafir rezervasyonu,
müşteri geçmişi, yönetici paneli, borç/veresiye takibi, Hizmet Yolculuğu,
paylaşılabilir randevu linki, kayıp talep analitiği, müşteri geri kazanımı,
sektör temaları, tavsiye kredisi, WhatsApp konuşma adaptörü, yardım merkezi ve
Neta aylık abonelik adaptörü, çoklu şube yönetimi ve şube kâr/zarar analizi
birlikte bulunur.

Randevu oluşturma/taşıma/iptal/hatırlatma olayları güvenli bir outbox işçisine
bağlıdır (`/api/automation/outbox`). İşletme sahibi numarası tanımlanırsa yeni
randevu bildirimi alır; müşteri mesajları aynı D1 takvimindeki kilitlerle
çakışmaz. AI ve WhatsApp kullanımı paket kotasıyla sınırlıdır; dış sağlayıcı
kullanımı hiçbir pakette kontrolsüz biçimde sınırsız değildir.

## Paketler ve çoklu şube

- **Starter — 600 TL/ay:** 1 işletme, 1 şube, en fazla 5 personel ve temel
  web randevu yönetimi.
- **Business — 999 TL/ay:** 5 şubeye kadar, sınırsız personel, gelir kurtarma,
  AI, çift yönlü WhatsApp, online ödeme ve şube kâr/zarar takibi.
- **Kurumsal — 2.500 TL/ay:** sınırsız şube ve personel, yüksek kullanım
  limitleri, API, şubeler arası otomasyon ve gelişmiş raporlama.

Her hesap tek bir yasal işletme/tenant oluşturur; şubeler bu işletmenin altında
yer alır. Personel ve randevular `branch_id` ile şubeye bağlanır. Şube raporu,
yalnızca tamamlanmış randevuların kayıtlı fiyatlarını gelir; işletmenin girdiği
giderleri maliyet kabul eder. Ay giderleri onaylanmadıysa net sonuç açıkça
“tahmini” gösterilir ve rapor muhasebe belgesi olarak sunulmaz.

ZIP'ten gelen fikirlerin ve örneklerin nasıl değerlendirildiği için
[ZIP entegrasyon notlarına](docs/neta-zip-review.md) bakın. Ham ZIP'teki eski
mock ödeme ve güvensiz örnekler canlı koda kopyalanmamıştır.

## Yerel geliştirme

```sh
pnpm install
pnpm exec tsc --noEmit
pnpm build
node tests/scheduling.mjs
node tests/opportunities.mjs
node tests/identity-billing.mjs
node tests/customer-operations.mjs
node tests/recovery-setup.mjs
```

Testler izole bir D1 veritabanı ve sentetik kullanıcılarla çalışır. Üretimde
Google, Meta WhatsApp, AI ve iyzico/PayTR bağlantıları için sunucu ortam
değişkenleri, sağlayıcı doğrulaması ve işletme sahibinin yasal hesap bilgileri
gerekir. Neta, işletmenin kendi müşterilerinden aldığı hizmet ödemelerine
aracılık etmez.

## Mimari ve sınırlar

### İşletme türü yapılandırması

`lib/business-config.ts`, sektör farklılıklarını koşullu ekran kopyaları yerine
tek bir tip güvenli yapılandırma katmanında toplar. Kuaför, güzellik salonu,
klinik, danışmanlık, özel ders, spor, diyetisyen, psikolog ve oto servis için
terimler, başlangıç rolleri, kaynak türleri, kapasite/buffer kuralları, müşteri
formu, bildirim metinleri ve gösterge bileşenleri burada tanımlıdır.

`GET /api/v1/business-types` katalogu döndürür. `workspace` ve `public` API
yanıtları seçili işletmenin çözülmüş `configuration` nesnesini içerir. Panel
başlıkları bu nesneden üretildiği için sektör dili tek merkezden değişir. Oda,
ekipman ve kapasite bayrakları bu sürümde sonraki rezervasyon motoru aşamasının
sözleşmesidir; henüz var olmayan bir özelliği kullanıcıya çalışıyormuş gibi
göstermez.

Uygulama Vinext/React, Cloudflare Worker ve Cloudflare D1 üzerinde çalışır.
`drizzle/` altındaki migration dosyaları üretim şemasını yönetir; migration
başarısız olursa Worker yayınlanmaz. Railway'e taşımak için Worker/D1
bağımlılıklarının ayrıca uyarlanması gerekir.

Dosya haritası, güvenlik yaklaşımı, tenant izolasyonu ve mevcut sınırlar için
[GELISTIRME.md](GELISTIRME.md) ve [NETA-YAYIN-NOTLARI.md](NETA-YAYIN-NOTLARI.md)
dosyalarına bakın.
