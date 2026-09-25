# Neta Randevu

Neta, kuaför, berber, güzellik salonu, klinik, danışman, eğitmen ve benzeri
randevuyla çalışan işletmeler için çok işletmeli randevu ve müşteri operasyon
platformudur.

## Ürün amacı

Neta'nın amacı yalnızca çevrim içi randevu vermek değildir. İşletme sahibinin
randevu, ekip, müşteri geçmişi, kaçan talep, bekleme listesi, gelir kurtarma,
borç/veresiye, hizmet yolculuğu, şube yönetimi ve otomasyonlarını tek çalışma
alanında toplamak; telefon ve dağınık mesaj trafiğini azaltırken işletmenin gününü
daha düzenli ve ölçülebilir hale getirmektir.

Müşteriler işletmeye özel bağlantıdan uygun hizmet, personel ve saati seçebilir.
İşletme tarafında ise günlük takvim, ekip yönetimi, müşteri hafızası, talep
fırsatları, geri kazanım ve raporlama aynı tenant güvenlik modeli altında çalışır.

## Bu depoda ne var?

Temel randevu takvimi, işletme/personel/hizmet yönetimi, misafir rezervasyonu,
müşteri geçmişi, yönetici paneli, borç/veresiye takibi, Hizmet Yolculuğu,
paylaşılabilir randevu linki, kayıp talep analitiği, müşteri geri kazanımı,
sektör temaları, tavsiye kredisi, WhatsApp konuşma adaptörü, yardım merkezi,
Neta aylık abonelik adaptörü, çoklu şube yönetimi ve şube kâr/zarar analizi
birlikte bulunur.

Randevu oluşturma/taşıma/iptal/hatırlatma olayları güvenli bir outbox işçisine
bağlıdır (`/api/automation/outbox`). İşletme sahibi numarası tanımlanırsa yeni
randevu bildirimi alır. AI ve WhatsApp kullanımı paket kotasıyla sınırlıdır;
dış sağlayıcı kullanımı hiçbir pakette kontrolsüz biçimde sınırsız değildir.

## Kimlik doğrulama

Production hedefi Google ile kayıt ve Google ile giriş akışıdır. Google OAuth
PKCE, state, nonce, güvenli oturum çerezi ve sunucu tarafı token doğrulamasıyla
çalışır. Production ortamında eski ChatGPT kimlik fallback'i kapatılmalıdır.

Google callback adresi:

```text
https://netarandevu.com/api/auth/google/callback
```

Production ortamında `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` ve
`GOOGLE_AUTH_ENABLED=true` sunucu ortamında tanımlanmalıdır. Bu değerler kaynak
koda yazılmamalıdır.

## Paketler ve çoklu şube

- **Neta Standart — 600 TL/ay:** 1 işletme, 1 şube, en fazla 5 personel; randevu, müşteri, hizmet, ekip ve işlem analizi.
- **Neta Pro — 999 TL/ay:** 3 şubeye kadar, sınırsız personel; borç/veresiye, Hizmet Yolculuğu, pazarlama, gelir kurtarma, talep fırsatları, gelir/şube raporları; ayda 1.000 WhatsApp ve günde 50 AI/randevu asistanı kullanımı.
- **Neta Plus — 2.500 TL/ay:** sınırsız şube ve personel; Pro kapsamına ek olarak 90 günlük gelişmiş talep analizi, tekrar kullanılabilir gider kataloğu, Neta ortaklık programı ve kurulum/veri taşıma merkezi; ayda 5.000 WhatsApp ve günde 200 AI/randevu asistanı kullanımı.

Her hesap tek bir yasal işletme/tenant oluşturur; şubeler bu işletmenin altında
yer alır. Personel ve randevular `branch_id` ile şubeye bağlanır. Şube raporu,
yalnızca tamamlanmış randevuların kayıtlı fiyatlarını gelir; işletmenin girdiği
giderleri maliyet kabul eder. Ay giderleri onaylanmadıysa net sonuç açıkça
“tahmini” gösterilir ve rapor muhasebe belgesi olarak sunulmaz.

## Yerel geliştirme

```sh
pnpm install
pnpm exec tsc --noEmit
pnpm build
pnpm test
```

VDS production build'i:

```sh
pnpm build:vps
```

## Production mimarisi

Canlı Neta, Ubuntu VDS üzerinde Nginx arkasında Next.js standalone build olarak
çalışacak şekilde hazırlanmıştır. Uygulama yalnızca `127.0.0.1:3000` üzerinde
dinler; dış trafik HTTPS üzerinden Nginx'e gelir. Kalıcı veritabanı VDS uyumluluk
katmanı üzerinden SQLite/better-sqlite3 ile çalışır ve migration'lar sıralı,
transactional olarak uygulanır. Günlük otomatik yedekleme ve health-check tabanlı
rollback bulunur.

GitHub Actions production akışı TypeScript, testler, VDS build'i ve release
paketini doğrular; başarılıysa release'i VDS'e gönderir ve
`https://netarandevu.com/api/health` ile canlı doğrulama yapar.

## Güvenlik yaklaşımı

Her işletmenin kalıcı bir `tenant_id` değeri vardır. İsteklerde gelen tenant
bilgisine tek başına güvenilmez; kullanıcının etkin üyeliği sunucuda doğrulanır.
Müşteri, hizmet, personel, randevu ve ödeme kayıtları işletme sınırları içinde
okunur ve yazılır. Kritik ödeme ve kimlik akışlarında frontend fiyatına veya
istemci tarafından gönderilen yetkiye güvenilmez.

Production secret'ları repoya yazılmaz. Google, Meta WhatsApp, AI ve iyzico/PayTR
bağlantıları için gerçek sağlayıcı hesapları ve sunucu ortam değişkenleri
gerekir. Neta, işletmenin kendi müşterilerinden aldığı hizmet ödemelerine aracılık
etmez.

Dosya haritası, güvenlik yaklaşımı, tenant izolasyonu ve mevcut sınırlar için
[GELISTIRME.md](GELISTIRME.md) ve [NETA-YAYIN-NOTLARI.md](NETA-YAYIN-NOTLARI.md)
dosyalarına bakın.
