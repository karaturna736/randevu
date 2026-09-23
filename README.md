# Neta Randevu

Neta, kuaför, berber, klinik, danışman, eğitmen ve benzeri işletmeler için
çok işletmeli randevu ve müşteri operasyon platformudur.

## Bu depoda ne var?

Temel randevu takvimi, işletme/personel/hizmet yönetimi, misafir rezervasyonu,
müşteri geçmişi, yönetici paneli, borç/veresiye takibi, Hizmet Yolculuğu,
paylaşılabilir randevu linki, kayıp talep analitiği, müşteri geri kazanımı,
sektör temaları, tavsiye kredisi, WhatsApp konuşma adaptörü, yardım merkezi ve
Neta aylık abonelik adaptörü birlikte bulunur.

Randevu oluşturma/taşıma/iptal/hatırlatma olayları güvenli bir outbox işçisine
bağlıdır (`/api/automation/outbox`). İşletme sahibi numarası tanımlanırsa yeni
randevu bildirimi alır; müşteri mesajları aynı D1 takvimindeki kilitlerle
çakışmaz. AI ve WhatsApp kullanımı paket kotasıyla sınırlıdır: Pro hedef fiyatı
2.000 TL/aydır ve sınırsız kullanım değildir.

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
```

Testler izole bir D1 veritabanı ve sentetik kullanıcılarla çalışır. Üretimde
Google, Meta WhatsApp, AI ve iyzico/PayTR bağlantıları için sunucu ortam
değişkenleri, sağlayıcı doğrulaması ve işletme sahibinin yasal hesap bilgileri
gerekir. Neta, işletmenin kendi müşterilerinden aldığı hizmet ödemelerine
aracılık etmez.

## Mimari ve sınırlar

Uygulama Vinext/React, Cloudflare Worker ve Cloudflare D1 üzerinde çalışır.
`drizzle/` altındaki migration dosyaları üretim şemasını yönetir; migration
başarısız olursa Worker yayınlanmaz. Railway'e taşımak için Worker/D1
bağımlılıklarının ayrıca uyarlanması gerekir.

Dosya haritası, güvenlik yaklaşımı, tenant izolasyonu ve mevcut sınırlar için
[GELISTIRME.md](GELISTIRME.md) ve [NETA-YAYIN-NOTLARI.md](NETA-YAYIN-NOTLARI.md)
dosyalarına bakın.
