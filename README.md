# Randevu

Türkçe, çok işletmeli randevu platformu MVP.

ChatGPT ile güvenli üyelik, kişisel randevular/favoriler, profil ayarları, dört adımlı işletme kurulumu, işletme paneli, üyelik gerektirmeyen rezervasyon ve yönetici moderasyonu içerir. WhatsApp, ödeme ve harici AI bağlantıları henüz etkin değildir.

Kurulum, dosya haritası, güvenlik yaklaşımı, testler ve mevcut sınırlar için [GELISTIRME.md](GELISTIRME.md) dosyasına bakın.

```sh
pnpm install
pnpm build
node tests/scheduling.mjs
node tests/opportunities.mjs
```

Testler geçici bir D1 veritabanında ve sentetik kullanıcılarla çalışır.
