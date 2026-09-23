# Neta ZIP inceleme ve entegrasyon notu

Bu dosya, projeye verilen `neta.zip` paketindeki fikirlerin ve örneklerin hangi
şekilde Neta Randevu'ya aktarıldığını açıklar. ZIP'teki statik demolar doğrudan
canlı arayüze kopyalanmadı; çalışan uygulamanın mevcut çok işletmeli yapısına
uyarlandı.

## Entegre edilen planlar

- Borç/veresiye defteri: müşteri bazlı alacak, kısmi tahsilat, ters kayıt,
  kapatma, idempotency ve tenant sınırları.
- Neta Hizmet Yolculuğu: danışmanlık, bakım, koçluk ve özel şablonlarla adım,
  tarih, ilerleme ve süreli paylaşım bağlantısı.
- Çift taraflı WhatsApp akışı: gelen mesajdan hizmet/gün/saat bulma, aynı
  takvim kilitleriyle randevu oluşturma, onay ve gizlilik adımları.
- Neta aboneliği: işletmenin Neta lisans ücretine odaklanan aylık sağlayıcı
  adaptörü. İşletmenin kendi müşterisinden aldığı hizmet ödemeleri bu akışa
  dahil edilmez.
- Pazarlama ve büyüme: geri kazanım adayları, kayıp talep/ghost demand,
  tavsiye kredisi, sektör temaları, paylaşılabilir randevu linki ve QR kodu.
- Yardım merkezi: yerel rehber içerikleri ve anahtar sağlandığında açıkça
  etkinleştirilen Gemini/OpenAI yardım adaptörü.

## ZIP'ten özellikle taşınmayan parçalar

`demo3.html` içindeki ham kart alanları ve sahte ödeme başarı ekranı,
`demo6.txt` içindeki kimlik doğrulamasız cüzdan/ödeme örnekleri ve eski
Prisma/Postgres/Vercel kurulum notları canlı ürüne alınmadı. Bunlar güvenli bir
ödeme veya muhasebe entegrasyonu değildir. Sağlayıcılar yalnızca sunucu tarafı
anahtarları, imzalı webhook doğrulaması, idempotency ve manuel mutabakat akışı
tamamlandıktan sonra etkinleştirilmelidir.

## Canlıya çıkmadan önce yapılacaklar

1. D1 production migration'larının her ortamda uygulanması ve `SQLITE_ERROR`
   durumunun doğrulanması.
2. Meta Business/WhatsApp webhook, onaylı şablonlar ve periyodik recall worker
   kurulumu.
3. iyzico/PayTR hesabı, şirket/satıcı bilgileri, sözleşme ve aylık abonelik
   webhook testleri.
4. Google OAuth, AI sağlayıcısı ve gizli ortam değişkenlerinin yetkili hesap
   sahibi tarafından eklenmesi.
5. Railway'e taşınacaksa Cloudflare Worker + D1 bağımlılıklarının Railway'e
   uygun Worker/Node ve kalıcı veritabanı mimarisine dönüştürülmesi. GitHub
   deposunun public olması tek başına bu dönüşümü yapmaz.

## Kaynak haritası

- `lib/receivables.ts`: borç ve tahsilat kuralları
- `lib/journeys.ts`: hizmet yolculukları ve paylaşım token'ları
- `lib/whatsapp.ts`: WhatsApp webhook ve aynı takvim rezervasyonu
- `lib/recurring.ts`: Neta aylık abonelik sağlayıcı adaptörü
- `lib/growth.ts`: recall, tavsiye ve tema ayarları
- `lib/help.ts`: rehber ve opsiyonel AI adaptörü
- `drizzle/0005_customer_operations.sql`: müşteri operasyonları şeması
- `drizzle/0006_growth_and_connections.sql`: büyüme ve bağlantı şeması
