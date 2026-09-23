# Neta Randevu — yeni giriş ve abonelik sürümü

## İşletmeye hangi bağlantıyı vereceksin?

Ana sayfa `https://randevu-studio.ahmettahais736.chatgpt.site` adresinde. Yeni sürüm doğrudan panel yerine Neta Randevu tanıtım sayfasını açar.

İşletme sahibi **İşletmemi oluştur** düğmesine basar, hesabıyla giriş yapar, profilini tamamlar ve işletme kurulumuna geçer. Hizmetlerini, fiyatlarını, personelini ve saatlerini ekler. Platform yöneticisi işletmeyi onayladığında kendi randevu bağlantısı kullanıma açılır. Müşteri randevusu ile işletmenin Neta aboneliği ayrı kayıtlardır.

**Mevcut yayın yalnızca site sahibine açık.** Dışarıdaki bir kuaföre kullanılabilir üyelik bağlantısı vermeden önce herkese açık erişim ve sağlayıcı bağlantıları tamamlanmalı. Sadece kodda bir ayarı değiştirmek, barındırma platformunun erişim iznini değiştirmez.

## Sayfalar

| Adres | Ne işe yarar? |
| --- | --- |
| `/` | Neta ana sayfası, ürün özellikleri, plan bilgisi |
| `/kayit?rol=business` | İşletme üyeliği |
| `/giris?rol=business` | Giriş |
| `/kurulum` | Hesaba bağlı işletme kurulum adımları |
| `/panel` | İşletmenin gerçek çalışma alanı |
| `/panel?demo=1` | Giriş yapmamış ziyaretçi için açıkça etiketlenmiş örnek panel |
| `/abonelik` | İşletmenin planı, ödeme iletişim bilgileri ve işlem geçmişi |
| `/yonetim/odemeler` | Sadece platform yöneticisinin tahsilat ve plan alanı |
| `/admin` | İşletme onayı, kullanıcı ve değerlendirme yönetimi |
| `/gizlilik`, `/kosullar` | Pilot sürümün veri kullanımı ve hizmet bilgileri |

## Hangi dosyalar oluşturuldu veya değişti?

| Dosya | Basit açıklaması |
| --- | --- |
| `components/product/landing.tsx` | Yeni ana sayfa ve çalışan örnek saat seçimi |
| `public/neta-symbol.svg`, `public/favicon.svg` | Neta için yeni N simgesi ve tarayıcı ikonu |
| `app/neta.css`, `app/globals.css` | Koyu lacivert/mor görünüm; açık tema ve mobil düzen |
| `app/page.tsx`, `app/panel/page.tsx` | Ana sayfa ile yönetim panelini ayırır |
| `components/product/auth.tsx` | İşletme odaklı giriş/üyelik ekranı ve sağlayıcı durumu |
| `components/product/session.tsx` | Hesap menüsü, giriş kapıları, abonelik bağlantıları |
| `lib/identity.ts` | Google kimlik doğrulaması ve güvenli oturum yönetimi; mevcut ChatGPT girişini korur |
| `lib/security.ts` | Güvenli rastgele anahtar, özet ve imza yardımcıları |
| `app/api/auth/google/*` | Google'a yönlendirme ve doğrulanmış dönüş işlemi |
| `app/api/auth/signout/route.ts`, `app/cikis/page.tsx` | Oturumu sunucuda iptal eden çıkış |
| `lib/billing.ts` | Sunucudaki fiyat, yetki, ödeme isteği ve bildirim doğrulaması |
| `components/product/billing.tsx` | İşletme aboneliği ve ayrı platform tahsilat ekranı |
| `app/api/payments/paytr/callback/route.ts` | PayTR'nin imzalı sonucunu alır |
| `app/api/v1/[...path]/route.ts` | Yeni ekranların sunucu işlemlerini bağlar |
| `db/schema.ts`, `drizzle/0004_neta_identity_billing.sql` | Oturum, plan, sipariş ve erişim kayıtları; mevcut veriyi silmeyen ek tablolar |
| `tests/identity-billing.mjs` | Sahte bildirim, tekrar işlem, işletmeler arası erişim ve Google kimlik denetimleri |
| `.env.example` | Gerekli ayarların boş şablonu; gerçek gizli anahtar içermez |

## Google girişinin gerçek durumu

Google bağlantısının kodu var; sağlayıcı hesabı henüz bağlanmadı. Bu nedenle ekranda Google düğmesi devre dışı ve mevcut ChatGPT girişi kullanılabilir. Yapılmamış e-posta veya kod gönderimi yapılmış gibi gösterilmez.

Yetkili teknik yönetici Google OAuth web istemcisini ve izin verilen dönüş adresini yapılandırmalıdır. Dönüş adresi, gerçek yayın kök adresinin sonuna `/api/auth/google/callback` eklenerek oluşur. Bu projede:

`https://randevu-studio.ahmettahais736.chatgpt.site/api/auth/google/callback`

`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` korumalı sunucu ayarlarına girilmeli; bağlantı doğrulanınca `GOOGLE_AUTH_ENABLED=true` yapılmalıdır. Anahtarları sohbet veya kaynak koduna yapıştırmayın. Google'ın kendi hesabında kod/ek onay isteyip istememesi Google tarafından belirlenir; uygulama her girişte Google'ın kod göndereceğini garanti etmez.

Kod; state, tarayıcıya bağlı çerez, PKCE, tek kullanımlık işlem ve nonce kontrolü kullanır. JWT imzası Google anahtarlarıyla doğrulanır; yayıncı, hedef uygulama, zaman ve doğrulanmış e-posta kontrol edilir. Kimlik Google `sub` değerine bağlıdır; aynı e-postaya sahip başka bir giriş sağlayıcısının işletmesini otomatik devralmaz. Mevcut işletmesi olan kişi mevcut giriş yöntemini kullanmalıdır. Google oturumu yedi gün sürer; yalnızca rastgele oturum anahtarının özeti saklanır.

## Para hangi yoldan gelir?

Bu sürüm işletmenin **Neta kullanım ücretini** almak için tasarlandı. İşletmenin kendi müşterisinden aldığı hizmet bedeli bu ödeme akışına girmez.

İşletme → PayTR ödeme ekranı → sağlayıcının doğruladığı satıcı hesabı → sözleşmedeki vadeye göre satıcının banka hesabı.

Kod içine IBAN yazmak banka aktarımı oluşturmaz. Sağlayıcı hesabının yetkili satıcı adına doğrulanması, banka hesabının sağlayıcı tarafından kabul edilmesi ve sözleşmenin tamamlanması gerekir. PayTR'nin resmi açıklamasına göre banka hesabı başvurudaki kişi/işletme unvanıyla eşleşmelidir; aktarım vadesi sözleşmeye bağlıdır. Bu çalışma bir finansal hesap açmaz, sözleşme kabul etmez ve para transferi yapmaz.

Ödeme bağlantısı kurulurken teknik ayarlar:

- `PAYTR_MERCHANT_ID`, `PAYTR_MERCHANT_KEY`, `PAYTR_MERCHANT_SALT`: korumalı sunucu ayarları; arayüzde gösterilmez.
- `PAYTR_TEST_MODE=1`: ilk bağlantı için test modu. Test tahsilatları gerçek ciro veya erişim süresi oluşturmaz.
- Bildirim adresi: `https://randevu-studio.ahmettahais736.chatgpt.site/api/payments/paytr/callback`.
- `PUBLIC_APP_URL`: doğrulanmış HTTPS yayın kökü. Ödeme dönüşleri ve Google dönüşü bu sabit adrese gider.
- `PUBLIC_SITE_READY`: dış erişim gerçekten tamamlandıktan sonra teknik yönetici tarafından açılır; erişim izinlerini kendi başına değiştirmez.
- Satıcı unvanı, destek adresi, satıcı adresi, 30 günlük fiyat ve satıcıya ait satış/iade koşulları yönetici panelinden tamamlanır.

Gerçek ödeme henüz açık değil. Planın varsayılanı taslaktır; fiyat uydurulmaz. Banka hareketi API'si bağlı olmadığından **bankaya aktarılan tutar** yerine **doğrulama gerekli** gösterilir. Brüt tahsilat ile banka bakiyesi birbirine karıştırılmaz.

## Ödeme güvenliği ve sınırlar

- Kart numarası veya güvenlik kodu Neta ekranında toplanmaz; sağlayıcının formu kullanılır.
- Fiyat ve para birimi sunucuda seçilir. Tarayıcının yolladığı fiyat dikkate alınmaz.
- İşletme sahibi yalnızca yetkili olduğu işletmenin ödeme kayıtlarını görür.
- Yönetici tahsilat ve fiyat ayarlarına sunucuda ayrıca yetki kontrolü uygulanır.
- Ödeme sonrasında sayfaya dönmek aboneliği açmaz. Doğru imzalı ve doğru tutarlı sağlayıcı bildirimi gerekir.
- Tekrarlanan/eşzamanlı bildirim aynı siparişi sadece bir kez işler. Veri tabanı tetikleyicisi, başka işletmenin ödemesiyle erişim oluşturmayı reddeder.
- Gizli sağlayıcı anahtarları, kart bilgileri ve Google token'ları istemciye veya ödeme geçmişine yazılmaz.
- Hassas işlemlerde kaynak kontrolü ve deneme sınırı uygulanır. Dış sağlayıcı yönlendirmeleri otomatik takip edilmez.

Bu sürüm **30 günlük erişimi kullanıcının onayıyla yeniler**. Daha önce konuşulan aylık otomatik tahsilat hedefi henüz uygulanmadı. Bunun için sağlayıcının düzenli ödeme yetkisi, kartı sağlayıcıda saklama izni, açık abonelik onayı, yenilemeyi durdurma, başarısız çekim denemeleri ve mutabakat ayrıca tamamlanmalı. Mevcut kod sessizce tekrarlayan çekim yapmaz.

İade ve banka mutabakatı şu anda sağlayıcı panelindedir; otomatik iade senkronu ve muhasebe/e-fatura entegrasyonu yoktur. Ticari satıştan önce satıcıya özel sözleşmeler, gizlilik metni, saklama/silme süreçleri ve gerçek sağlayıcı testleri tamamlanmalıdır. Otomatik testler bağımsız güvenlik denetimi veya kusursuz güvenlik garantisi değildir.

## Doğrulama

Randevu/üyelik için 74, talep/erken geliş/personel için 47, yeni kimlik/ödeme akışları için 53 kontrol başarılı: toplam 174. Yeni testler geçici veri tabanında, sahte sağlayıcı yanıtlarıyla ve dış ağ erişimi olmadan çalışır. Gerçek Google hesabına giriş veya gerçek kart tahsilatı yapılmadı. Ana sayfa, üyelik geçişi, örnek panel, mobil yerleşim ve tema tarayıcıda ayrıca kontrol edildi.

## Resmi teknik kaynaklar

- Google OpenID Connect: https://developers.google.com/identity/openid-connect/openid-connect
- Google kimlik doğrulama: https://developers.google.com/identity/gsi/web/guides/verify-google-id-token
- PayTR iframe başlangıcı: https://dev.paytr.com/en/iframe-api/iframe-api-1-adim
- PayTR imzalı bildirim: https://dev.paytr.com/en/iframe-api/iframe-api-2-adim
- PayTR banka aktarım açıklamaları: https://www.paytr.com/destek-merkezi/odemeler
