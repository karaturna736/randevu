# Randevu — MVP kullanım ve geliştirme rehberi

Bu sürüm, çok işletmeli bir randevu platformunun çalışan çekirdeğidir. İşletme kayıtları, hizmetler, personeller, müşteriler ve randevular veritabanında saklanır. İlk açılıştaki **Atölye Studio** verileri örnektir; örnek akış gerçek randevu oluşturmaz.

## İlk kullanım

1. **Üye ol** veya **Giriş yap** seçeneğini açın. Müşteri ya da işletme sahibi olarak devam edin. Kimliğiniz ChatGPT ile doğrulanır; site için ayrı şifre oluşturulmaz.
2. İlk girişte adınızı ve isteğe bağlı telefon/şehir bilgilerinizi girerek profilinizi tamamlayın.
3. İşletme için **İşletmemi oluştur** akışında işletme bilgisi, özel bağlantı, ilk hizmet/süre/fiyat, ilk personel ve çalışma saatlerini belirleyin. Son kontrolden sonra hepsi birlikte kaydedilir.
4. Daha fazla hizmet ve personeli panelden ekleyin. **Ayarlar** ile programı düzenleyin; uygun saatler işletme ve personelin ortak çalışma aralığına göre hesaplanır.
5. Platform sahibi **/admin** sayfasından işletmeyi onaylar. Yönetici yetkisi doğrulanmış sahip hesabıyla sınırlandırılmıştır; ilk üye otomatik yönetici olmaz.
6. Müşteriler **/isletme-baglantiniz** üzerinden üyelik zorunluluğu olmadan randevu alabilir. Profili tamamlanmış bir üye giriş yapmışsa yeni kişisel randevusu otomatik olarak hesabına kaydedilir.
7. **Randevularım** alanında yaklaşan/geçmiş randevular, detaylar ve favori işletmeler bulunur. Geçmiş randevudaki **Tekrar al**, hizmet ve personel tercihini yeni forma taşır; yeni saat ayrıca seçilir.
8. Üyeliksiz alınan randevu için özel yönetim bağlantısını saklayın. **Eski randevumu ekle** ile bu bağlantıyı hesabınıza bağlayabilirsiniz. Telefon eşleşmesi geçmiş kayıtları otomatik taşımaz.
9. **Hesabım** ekranında profil ve iletişim tercihini düzenleyin. **Takvime ekle**, kişisel takviminize aktarabileceğiniz bir `.ics` kaydı indirir. Bu kayıt sonraki iptal veya değişikliklerde kendiliğinden güncellenmez.

İlk yayın yalnızca proje sahibine açıktır. Dış müşterilerin erişebilmesi için sitenin paylaşım ayarının ayrıca herkese açık hale getirilmesi gerekir. Bu barındırma ayarı, işletme onayı ve uygulamadaki yetki kontrollerinden ayrıdır.

## Dosyalar ne yapıyor?

| Dosya | Basit açıklama |
|---|---|
| `app/page.tsx` | İşletme panelini açar. |
| `components/product/dashboard.tsx` | Menü, takvim, müşteri listesi ve ekranlar arasındaki geçişi yönetir. |
| `components/product/overview.tsx` | Günlük randevuları, gelir grafiğini, doluluğu ve geri kazanma kartını gösterir. |
| `components/product/management.tsx` | Hizmet/personel düzenleme, çalışma saatleri, izinler ve entegrasyon ekranları. |
| `components/product/booking-form.tsx` | Üç adımda hizmet, saat ve müşteri bilgilerini toplar. |
| `components/product/appointment-sheet.tsx` | Randevu detayını, taşıma, iptal, tamamlandı ve gelmedi işlemlerini gösterir. |
| `components/product/public.tsx` | Müşterinin işletme keşfetmesini, randevu almasını ve özel bağlantıyla yönetmesini sağlar. |
| `components/product/admin.tsx` | Yetkili yöneticiye işletme/kullanıcı yönetimi, değerlendirmeler, şikâyetler ve ödeme kayıtlarını sunar. |
| `components/product/assistant.tsx` | Doğal dilde saat arama arayüzü. Sonuç seçildiğinde randevu formunu açar. |
| `components/product/auth.tsx` | Müşteri/işletme seçimi, gerçek giriş sağlayıcısına yönlendirme ve profil tamamlama. |
| `components/product/session.tsx` | Hesap menüsü, oturum bilgisi ve giriş gerektiren ekranlar. |
| `components/product/account.tsx` | Profil, iletişim tercihi, kişisel randevular ve favoriler. |
| `components/product/onboarding.tsx` | Dört adımlı işletme kurulumu, başlangıç listesi ve sonuç bekleyen randevular. |
| `app/giris`, `app/kayit`, `app/hesabim`, `app/randevularim`, `app/kurulum` | Üyelik ve kurulum sayfalarının adresleri. |
| `app/membership.css` | Üyelik ekranlarının masaüstü/mobil düzeni, hesap kartları ve kurulum görünümü. |
| `lib/accounts.ts` | Profilleri kaydeder, randevu sahipliğini denetler ve favorileri kişiye özel tutar. |
| `lib/calendar.ts` | Takvim dosyasını üretir ve giriş sonrası dönüş adresini site içi yollarla sınırlar. |
| `drizzle/0002_membership.sql` | Eski verileri silmeden profil, randevu sahipliği ve favori tablolarını ekler. |
| `components/product/common.tsx` | Tekrar kullanılan pencereler, seçim kutuları ve sunucu bağlantıları. |
| `components/product/webmcp.ts` | Destekleyen tarayıcılarda yetkili işletmeye müsaitlik arama ve form açma araçları ekler. |
| `app/globals.css` | Responsive yerleşimler ve açık/koyu temanın görünümü. |
| `app/api/v1/[...path]/route.ts` | Ekranlardan gelen talepleri doğru sunucu işlemine yönlendirir. |
| `lib/server.ts` | Giriş, işletme üyeliği, yönetici yetkisi, istek kaynağı, giriş doğrulama ve hız sınırları. |
| `lib/booking.ts` | Gerçek uygunluk hesabı, çakışma koruması, oluşturma/taşıma/iptal ve temel asistan. |
| `lib/workspace.ts` | Yalnızca yetkili işletmenin panel verilerini okur; işletme/hizmet/personel ayarlarını kaydeder. |
| `db/schema.ts` | Veritabanı tabloları, ilişkiler ve indeksler. |
| `drizzle/0000_typical_deathbird.sql` | İlk veritabanı şemasını oluşturur. |
| `drizzle/0001_booking_guards.sql` | Aynı gün izin ve rezervasyonun eşzamanlı çakışmasını veritabanında engeller. |
| `lib/integrations.ts` | WhatsApp, ödeme ve harici AI sağlayıcıları için değiştirilebilir bağlantı sözleşmeleri. |
| `lib/demo.ts` | Gerçek verilerden ayrı, açıkça etiketlenmiş örnek işletme verileri. |
| `tests/scheduling.mjs` | İzole test veritabanında yetki ve randevu kurallarını sınar. |

## İşletmelerin verileri nasıl ayrılıyor?

Her işletmenin kalıcı bir `tenant_id` değeri vardır. İsteklerde gönderilen bu değere tek başına güvenilmez; sunucu giriş yapan kullanıcının işletmedeki etkin üyeliğini doğrular. Müşteri, hizmet, personel ve randevu sorguları işletmeyle sınırlandırılır. Bileşik yabancı anahtarlar, başka işletmeye ait personelin veya hizmetin yanlışlıkla bir randevuya bağlanmasını da engeller.

Platform yöneticisinin ayrı, açıkça yetkilendirilmiş erişimi bulunur. Yönetim işlemleri işlem günlüğüne yazılır. İşletme silme, erişimi kapatan bir yumuşak silmedir; ilişkili geçmiş kayıtları korunur.

Randevular 15 dakikalık zaman bloklarını tek işlemde ayırır. Personel/tarih/saat için benzersiz veritabanı anahtarı aynı saatlerin iki kez satılmasını engeller. Bir işlem başarısızsa müşteri, randevu ve saat blokları birlikte geri alınır. Taşıma ve iptal işlemlerinde sürüm kontrolü eşzamanlı güncelleme çakışmasını yakalar. İzin ve rezervasyonun aynı anda kaydedilmesine karşı veritabanı tetikleyicileri vardır.

Müşterinin yönetim bağlantısı 256 bit rastgele bir anahtar taşır. Veritabanında anahtarın kendisi yerine özeti tutulur; bağlantı randevu tarihinden 90 gün sonra geçersiz olur. Anahtar URL'nin `#` bölümünde bulunur ve isteklerde yetkilendirme başlığıyla iletilir. Bu bağlantıyı bilen kişi randevuyu yönetebilir; otomatik mesaj servisi bağlı olmadığından müşteri bunu kendisi saklamalıdır.

## Üyelikte güvenlik ve kullanım ayrımı

Üyelikte kararlı giriş kimliği esas alınır. E-posta, isim veya telefondan hesap sahipliği çıkarılmaz. `profiles` kişisel profil ve tercihi; `account_bookings` randevunun hangi hesaba bağlı olduğunu; `favorites` kişisel favorileri tutar. İşletme sahipliği ise ayrı `members` tablosunda doğrulanır. Profilde “işletme sahibi” seçmek başka işletmeye erişim veya yönetici yetkisi vermez.

Müşteri yalnızca kendi hesabına bağlı randevuları okuyabilir ve değiştirebilir. Üyeliksiz eski bir randevuyu bağlamak özel anahtarını gerektirir; bir randevu aynı anda iki farklı hesaba bağlanamaz. Randevu listelerinde özel anahtar veya özeti gönderilmez. İşletme sahibinin panelden bir müşteri için eklediği randevu, sahibin kişisel randevularına eklenmez.

Profil tamamlandıktan sonra müşteri formları ad, telefon ve e-postayı önceden doldurur. İşletme panelindeki manuel müşteri formu işletme sahibinin bilgileriyle doldurulmaz. Kampanya tercihi isteğe bağlıdır; kendi başına mesaj göndermez. Platform ve işletmeye verilen kampanya tercihleri ayrıdır.

Platform yöneticisi müşteri üyeliklerini ve işletme kullanıcılarını askıya alabilir. Askıya alınan bir üye profilini düzenleyerek hesabını yeniden açamaz. Oturum açma ve kapatma ChatGPT giriş sağlayıcısıyla yürür. **Bağımsız e-posta/şifre, SMS doğrulama veya sitede şifre sıfırlama bu sürümde yoktur.**

## Bu sürümde çalışanlar

- Müşteri/işletme giriş akışı, profil tamamlama, hesap ayarları ve güvenli oturum kapatma.
- Kişisel yaklaşan/geçmiş randevular, favoriler, özel bağlantıyla eski randevu ekleme ve tekrar rezervasyon.
- Takvime `.ics` aktarımı; otomatik takvim eşitlemesi değildir.
- Bir hesap altında ayrı işletmeler ve işletmeler arası geçiş.
- İşletmenin ilk hizmet, personel ve programını birlikte oluşturan kurulum akışı.
- Panelde eksik başlangıç adımları ve zamanı geçmiş, sonucu henüz işaretlenmemiş randevular.
- İşletme profili, hizmet/süre/fiyat, personel, çalışma saatleri ve tam gün izinler.
- Üyeliksiz rezervasyon, uygun saat bulma, çakışma engelleme, iptal ve taşıma.
- Günlük personel takvimi, durum ve müşteri araması, tamamlandı/gelmedi takibi.
- Müşteri geçmişi, tamamlanan ziyaret sayısı, hizmet toplamı, tercih edilen personel ve 90 günlük geri kazanma listesi.
- Tamamlanan hizmetlerden gelir ve doluluk grafikleri. Bunlar banka tahsilatı değildir.
- Tamamlanmış randevudan tek değerlendirme, yönetici moderasyonu ve müşteri şikâyeti.
- İşletme onayı/askıya alma/silme, kullanıcı erişimini kapatma/açma ve yönetim işlem günlüğü.
- Açık/koyu tema ve telefon genişliğine uyarlanan ekranlar.

## Entegrasyonların gerçek durumu

**WhatsApp:** Oluşturma, iptal, taşıma ve gelecekteki 24 saat öncesi hatırlatma olayları veritabanındaki outbox tablosuna kaydedilir. Mesaj gönderilmez. Sağlayıcı, onaylı şablonlar, izin yönetimi, tekrarı engelleyen bir gönderim işçisi ve zamanlayıcı sonraki aşamada bağlanmalıdır.

**Ödeme/kapora:** Ödeme tablosu ve sağlayıcı sözleşmesi hazırdır. Kart bilgisi alınmaz, kapora tahsil edilmez. Ödeme/iade akışı ve doğrulanmış webhook uygulanmalıdır. Yönetici ödeme ekranı mevcut gerçek kayıtları okur; örnek gelir tahsilat gibi gösterilmez.

**Asistan:** Kural tabanlı Türkçe hizmet/gün/sabah/öğleden sonra/akşam araması gerçek müsaitliğe bağlanmıştır. Harici büyük dil modeli yoktur. Yazılan her cümleyi anlamaz. Örnek: “Cumartesi öğleden sonra saç kesimi”. Sonuçtan sonra müşteri bilgileri ve son onay gerekir.

**Marketplace:** İşletme keşfi kategori, şehir/isim araması ve onaylı işletmeleri listeleme seviyesindedir. Komisyon, gelişmiş sıralama, harita ve reklam sistemi yoktur.

## MVP sınırları ve sonraki geliştirmeler

- Saat dilimi Türkiye; randevu ufku 90 gün; başlangıçlar 15 dakikalık aralıklar.
- Tüm aktif personeller tüm aktif hizmetleri sunabilir. Personel-hizmet yetkinlik eşlemesi eklenmelidir.
- Ekip bölümünden, üyeliğini tamamlamış bir hesabın doğrulanmış e-postası personel kaydına bağlanabilir. Personel yalnızca kendisine atanmış işleri görür ve sonuçlandırır. Otomatik e-posta daveti gönderilmez.
- İzinler tam gündür. Mola, bölünmüş vardiya, oda/cihaz kapasitesi, tekrarlayan randevu ve bekleme listesi sonraki aşamadır.
- Kişisel randevu ekranı en fazla 200 kayıt, favoriler en fazla 100 işletme gösterir. Daha büyük geçmiş için sayfalama eklenmelidir.
- Panel son 3.000 randevuyu ve en fazla 3.000 müşteriyi yükler. Yönetici tablolarının da belirtilen görüntüleme sınırları vardır. Büyük hacim için sunucuda sayfalama ve rapor özetleri eklenmelidir.
- İşletme başına veri ayrımı uygulama yetkilendirmesi ve ilişkisel kısıtlarla sağlanır; ayrı fiziksel veritabanı veya veritabanı düzeyinde RLS kullanılmaz.
- Kamuya açık rezervasyon için SMS/telefon doğrulaması, bot koruması ve kapasiteye göre hız sınırları değerlendirilmelidir. Mevcut hız sınırları IP bazında temel düzeydedir.
- Ticari müşteri kullanımından önce işletmeye uygun gizlilik metinleri, veri saklama/silme süreçleri, yedekleme ve izleme tamamlanmalıdır. Kliniklere özel tıbbi kayıt veya sağlık verisi alanı yoktur.
- Bağımsız sızma testi, yüksek trafik yük testi ve tüm cihaz tarayıcılarını kapsayan test yapılmamıştır. Bu bir doğrulanmış MVP başlangıcıdır; sınırsız ölçek iddiası değildir.

## Doğrulama

`node tests/scheduling.mjs`, önce derlenmiş Worker'ı geçici bir D1 veritabanında çalıştırır. Gerçek hesap veya müşteri verisi kullanmaz. 74 kontrol; üyelik kimliği, rol yükseltme girişimleri, profil/favori ayrımı, randevu sahipliği, eşzamanlı sahiplenme, üyelik askıya alma, atomik işletme kurulumu, işletme ayrımı, yetkisiz erişim, çift rezervasyon, işlem geri alma, eşzamanlı izin/rezervasyon, yabancı anahtarlar, özel bağlantı, iptal/taşıma, değerlendirme moderasyonu, şikâyet, müşteri istatistikleri ve asistan müsaitliğini kapsar.

TypeScript kontrolü ve üretim derlemesi başarılıdır. Yeni giriş/kayıt ekranı, müşteri/işletme tercihi, doğru dönüş adresi, mobil giriş kapıları ve koyu tema tarayıcıda kontrol edilmiştir. Üyelik ekranları 390 pikselde yatay taşma olmadan görüntülenmiştir. Gerçek ChatGPT girişini tamamlayan uçtan uca bir oturum testi yapılmamıştır; hesap sonrası veri işlemleri yukarıdaki izole sunucu testleriyle doğrulanmıştır.

İlk MVP'de: Masaüstü tarayıcıda örnek randevu akışı son ekrana kadar kontrol edilmiştir. Açık/koyu tema ve 390 piksel çerçevede mobil panel, menü ve rezervasyon formu incelenmiştir; rezervasyon sayfasında yatay taşma görülmemiştir. Bu tarayıcıdaki WebMCP çağrısı `modelContext is unavailable` sonucu verdi; bu nedenle WebMCP araçları uçtan uca doğrulanamadı. Standart ekran akışları bu desteğe bağlı değildir.

## Geliştirici için çalıştırma

Kaynak: React + TypeScript, Sites/vinext, Cloudflare Worker ve D1 SQLite; Drizzle şeması; shadcn bileşenleri.

- Bağımlılıklar: `pnpm install`
- Tip kontrolü: `node node_modules/typescript/bin/tsc --noEmit`
- Yerel geliştirme: `pnpm dev`
- Derleme: `pnpm build`
- Entegrasyon testi: `node tests/scheduling.mjs` (önce derleme gerekir)

Veritabanı bağlantısı mantıksal `DB` binding'idir. Şema değişiklikleri Drizzle ile yeni migration olarak eklenmelidir; uygulanmış migration dosyaları değiştirilmemelidir. Üretim verisi migration içine yazılmaz. Kaynak kodda gerçek müşteri verisi, sağlayıcı anahtarı veya yönetici parolası bulunmaz.

`PLATFORM_OWNER_EMAIL`, yalnızca doğrulanmış platform sahibinin e-postasını içerir ve çalışma zamanı sırrıdır. Doğrulanmış oturumda bu hesap kalıcı kullanıcı kimliğiyle yönetici tablosuna bağlanır. İsteğe bağlı `PLATFORM_ADMIN_USER_IDS`, açıkça yetkilendirilmiş kararlı kullanıcı kimliklerinin listesini kabul eder. İstemcinin gönderdiği yönetici rolü kabul edilmez.


## Talep fırsatları, işlem analizi ve erken gelme güncellemesi

Sol menüdeki **Talep fırsatları** ekranı 7, 30 veya 90 günlük ziyaret oturumlarını, açık saat aramalarını, uygun saat bulamayan oturumları ve kapalı saatlerdeki talebi gösterir. Müşterinin rezervasyon ekranındaki **Aklınızdaki saat hangisi?** alanında yaptığı bilinçli arama ölçülür; varsayılan takvim yüklenmesi talep sayılmaz.

Aynı tarayıcı oturumunun dönemdeki son araması esas alınır. Sonrasında uygun saat bulan veya randevu alan oturum karşılanamayan talepten çıkarılır. Oturum sayısı doğrulanmış insan sayısı değildir. Ciro potansiyeli, sunucuda kayıtlı hizmet fiyatı ile değiştirilebilir dönüşüm varsayımından hesaplanır. Varsayılan oran %30'dur; gelir veya kâr garantisi değildir. Sayfadan çıkan kişinin neden çıktığı tahmin edilmez. Ölçüm bu sürümün kullanımından itibaren başlar; eski ziyaretler geriye dönük üretilmez.

Kapasite önerisi için en az 5 oturum, 2 farklı istenen tarih ve belirli bir personel seçilmemiş olması gerekir. Öneri gözlem süresi, hizmet süresi ve bir ek personelin yapabileceği işlem sayısıyla sınırlandırılır. Kapalı saatlerin toplam tutarı tüm sonuçlardan hesaplanır; ayrıntı görünümünde en yoğun 100 aralık, tabloda ilk 20 gösterilir. Örnek işletmedeki senaryolar temsilidir ve açıkça etiketlenir. Bu öneriler açıklanabilir hesap kurallarıdır; harici AI modeli bağlı değildir.

**İşlem analizi** tamamlanan işlemleri adet, hizmet bedeli, planlanan süre ve personel dağılımıyla gösterir. Hizmet açıklaması ve fiyatı rezervasyon öncesinde görünür. Rezervasyonda hizmet adı, açıklaması, fiyatı ve süresi saklanır; sonradan fiyat değişmesi eski kaydı değiştirmez. Müşteri isteğe bağlı işlem tercihi yazabilir. İşletme sahibi ve ilgili personel bu notu görebilir.

**Erken gelirim** rezervasyon sırasında veya randevu yönetiminde açılır. Müşteri en erken gelebileceği saati seçer. Aynı gün, aynı personel ve aynı hizmet için daha erken yer açılırsa teklif gösterilir. Teklif saati ayırmaz; müşteri kabul ettiğinde uygunluk yeniden denetlenir ve taşıma tek işlemde yapılır. Başarısız taşıma eski randevuyu korur. Teklif normalde 10 dakika geçerlidir ve randevu başlangıcından en geç 5 dakika önce biter. Kabul, normal iptal süresinden bağımsız yalnızca bu doğrulanmış erken teklif için mümkündür. Sistem kendiliğinden taşıma yapmaz.

Teklifler randevu yönetimi ve kişisel randevular ekranında görünür sayfa açıkken yaklaşık 30 saniyede, hesap menüsü bildiriminde yaklaşık 60 saniyede kontrol edilir. Sekme kapalıyken arka planda bildirim, WhatsApp, SMS veya e-posta gönderilmez.

**Ekip alanım** (`/ekibim`) personelin kendi işlerini gösterir. İşletme sahibi **Ekip → Personel erişimi** alanından hesabı bağlar veya yetkisini kaldırır. Personel işletmenin talep/gelir raporlarına, diğer personelin randevularına ve işletme ayarlarına erişemez. Tamamlandı veya gelmedi kaydı planlanan bitişten önce girilemez.

### Eklenen dosyalar

| Dosya | Görevi |
|---|---|
| `lib/demand.ts` | Ziyaret/saat arama kayıtları ve işletmeye özel talep/işlem raporları. |
| `lib/demand-client.ts` | Tarayıcı oturumu için rastgele ölçüm anahtarı; tekrarların tekilleştirilmesi. |
| `lib/insight-model.ts` | Kapasiteyle sınırlı vardiya ve ciro senaryosu hesabı. |
| `lib/early.ts` | Erken gelme tercihleri, geçici teklifler ve çakışmadan kabul. |
| `lib/team.ts` | Personel hesabı eşleme, görev listesi ve yetki denetimi. |
| `components/product/insights.tsx` | Talep fırsatları, yoğunluk haritası, Ghost Demand ve işlem analizi ekranları. |
| `components/product/demand-search.tsx` | Müşterinin kapalı saatleri de arayabilmesi. |
| `components/product/early-arrival.tsx` | Erken gelme tercihi ve uygulama içi teklifler. |
| `components/product/team.tsx`, `app/ekibim/page.tsx` | Personel erişimini yönetme ve personelin kendi paneli. |
| `app/insights.css` | Yeni ekranların masaüstü ve mobil düzenleri. |
| `drizzle/0003_demand_early_team.sql` | Talep/teklif tabloları, hizmet bilgisi anlık kaydı ve personel rolü. Eski işletme sahipliği korunur. |
| `tests/opportunities.mjs` | Talep doğruluğu, personel yetkileri, erken teklif yarışı ve gelir senaryosu kontrolleri. |

Yeni özelliklerde 47 kontrol; tekrarların tekilleştirilmesi, yabancı işletme erişiminin reddi, sunucu fiyatının kullanılması, kayıtlı hizmet bilgisinin korunması, personel kısıtları, iptalle açılan yer, teklif süresi, aynı saati iki kişinin kabul etmesi ve kapasite sınırlarını kapsar. Önceki 74 kontrol ile toplam 121 kontrol geçmiştir. Masaüstü tarayıcıda dönem filtresi, dönüşüm kaydırıcısı, yoğunluk haritası filtresi ve işlem analizi ayrıca denenmiştir. Gerçek kullanıcıyla tüm cihazlarda uçtan uca test veya yüksek trafik testi yapıldığı iddia edilmez.
