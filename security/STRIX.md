# Neta Strix güvenlik incelemesi

Strix taraması bu değişiklik hazırlanırken çalıştırılmadı. Geliştirme ortamında
Docker ve model kimliği yoktu. Kod incelemesi bulguları Strix bulgusu değildir.

## Çalıştırma

GitHub → Settings → Secrets and variables → Actions içinde şu repository
secret'larını tanımlayın:

- `STRIX_LLM`: sağlayıcının model kimliği; örneğin `openai/gpt-5.4`.
- `LLM_API_KEY`: aynı sağlayıcının API anahtarı. Anahtarı koda veya sohbetlere yazmayın.

Workflow varsayılan dala eklendikten sonra Actions → **Strix repository assessment**
→ **Run workflow** ile incelemek istediğiniz dalı seçin. Başlangıç harcama sınırı
5 USD'dir; bu sınır eksiksiz inceleme garantisi değildir. Standart tarama yalnızca
commit'in izole kopyasını inceler. Canlı site ve gerçek sağlayıcılar kapsam dışıdır.
Raporlar ilgili koşunun artifact'ında 7 gün saklanır. Strix açık bulursa koşu hata
verir; rapor yine yüklenir. Kurulum hatası, eksik rapor ve bütçeyle kesilen tarama
başarılı inceleme sayılmaz. Tamamlandı durumu da tüm özelliklerin test edildiğini
kanıtlamaz; rapor kapsamı ayrıca okunmalıdır.

Yerel kullanım için çalışan Docker, Python 3.12+ ve aynı iki ortam değişkeni gerekir:

```bash
python3 -m venv /tmp/neta-strix-cli
/tmp/neta-strix-cli/bin/pip install 'strix-agent==1.6.2'
git archive HEAD | tar -x -C /path/to/empty/test-checkout
/tmp/neta-strix-cli/bin/strix -n \
  --target /path/to/empty/test-checkout \
  --scan-mode standard --scope-mode full --max-budget 5 \
  --instruction-file security/strix-scope.txt
```

## 1 Ekim 2026 kod incelemesi

Başlangıç commit'i: `26b403c`.

1. **IP başlığı güven sınırı (orta):** `lib/server.ts` uygulama limitinin anahtarını
   `CF-Connecting-IP` ile oluşturuyor. VDS Nginx yapılandırması bu başlığı
   değiştirmediği için istemci farklı başlıklarla farklı limit kovaları seçebiliyor.
   Nginx'in genel trafik limiti bunu tamamen kapatmıyor. Aynı başlık PayTR ve
   Turnstile'a gönderilen IP için de kullanılıyor. Tüm proxy konumlarında başlık
   artık `$remote_addr` ile değiştiriliyor. Bu yapılandırma doğrudan VDS ingress'i
   içindir; ileride CDN eklenirse yalnızca doğrulanmış CDN kaynaklarından gerçek
   IP kabul edecek ayrıca bir `real_ip` yapılandırması gerekir.
2. **JSON gövdesi bellek tüketimi (orta, çalışma ortamına bağlı):** `body()`
   bildirilen uzunluk yoksa tüm gövdeyi `req.text()` ile belleğe alıyor, sonra
   sınırı kontrol ediyordu. Artık gelen baytlar sayılıyor; 16.000 baytı aşan akış
   iptal edilip HTTP 413 dönüyor. UTF-8 parçaları doğru birleştiriliyor. VDS'deki
   Nginx 2 MB genel sınırı etkiyi azaltır; uygulama seviyesinde yine gereksiz
   bellek tahsisi vardı. Bu düzeltme JSON yollarını kapsar; dosya yüklemeleri ve
   sağlayıcı callback'leri için tam gövde denetimi iddiasında bulunulmaz.

Doğrulama:

```bash
node --experimental-strip-types tests/request-body.mjs
python3 tests/proxy-ip.py  # nginx kurulmuş olmalı
pnpm exec tsc --noEmit
pnpm test
pnpm build:vps
```

`tests/proxy-ip.py`, üretim yapılandırmasındaki üç proxy konumunu yerel Nginx'te
çalıştırarak sahte ve eksik IP başlıklarının upstream'e taşınmadığını kontrol eder.
Canlı yapılandırmanın yüklendiğini doğrulamaz. Düzeltmeler deploy edilene kadar
canlı sistemde uygulanmış sayılmaz.
