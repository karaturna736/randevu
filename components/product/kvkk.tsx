"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Brand, ThemeToggle, api } from "./common";

type PublicPlan = {
  data_controller?: {
    name?: string;
    address?: string;
    email?: string;
    kep?: string;
  };
};

export default function KvkkNotice() {
  const [plan, setPlan] = useState<PublicPlan | null>(null);
  useEffect(() => {
    api("plans")
      .then((value) => setPlan(value as PublicPlan))
      .catch(() => {});
  }, []);
  const c = plan?.data_controller || {};
  return (
    <>
      <header className="public-header">
        <Brand />
        <ThemeToggle />
      </header>
      <article className="legal-page">
        <Link className="text-button" href="/">
          Ana sayfaya dön
        </Link>
        <h1>KVKK Aydınlatma Metni</h1>
        <p>Son güncelleme: 23 Eylül 2026 · Sürüm: KVKK-2026-09</p>
        <p>
          Bu metin, 6698 sayılı Kişisel Verilerin Korunması Kanunu’nun 10.
          maddesi kapsamında Neta Randevu hizmetini kullanan işletme sahiplerini
          bilgilendirmek amacıyla hazırlanmıştır. Aydınlatma metni bir açık rıza
          talebi değildir.
        </p>
        <h2>Veri sorumlusu ve iletişim</h2>
        {c.name ? (
          <p>
            <strong>{c.name}</strong>
            <br />
            {c.address}
            <br />
            {c.email}
            {c.kep ? (
              <>
                <br />
                KEP: {c.kep}
              </>
            ) : null}
          </p>
        ) : (
          <p className="notice">
            Ticari ödeme açılmadan önce veri sorumlusu unvanı, adresi ve başvuru
            e-postası yönetici tarafından doldurulmalıdır.
          </p>
        )}
        <h2>İşlenen kişisel veriler</h2>
        <p>
          Kimlik ve iletişim bilgileri; hesap ve giriş sağlayıcısı kimlikleri;
          işletme, personel, müşteri ve randevu kayıtları; fatura bilgileri;
          abonelik planı, ödeme işlem durumu ve iyzico referansları; güvenlik,
          oturum, denetim ve kötüye kullanım önleme kayıtları işlenebilir. Kart
          numarası, son kullanma tarihi ve CVC Neta veritabanında saklanmaz.
        </p>
        <h2>İşleme amaçları ve hukuki sebepler</h2>
        <p>
          Veriler; üyeliğin kurulması ve yürütülmesi, randevu hizmetinin
          sunulması, abonelik tahsilatı, destek, dolandırıcılık ve yetkisiz
          erişimin önlenmesi, hata inceleme, mevzuattan doğan saklama ve ispat
          yükümlülüklerinin yerine getirilmesi amaçlarıyla; sözleşmenin
          kurulması veya ifası, hukuki yükümlülük, bir hakkın
          tesisi/kullanılması/korunması ve meşru menfaat hukuki sebeplerine
          dayanılarak işlenir. Pazarlama iletişimi ayrıca ve isteğe bağlı izinle
          yürütülür.
        </p>
        <h2>Aktarım yapılan taraflar</h2>
        <p>
          Hizmetin gerektirdiği ölçüde barındırma ve altyapı sağlayıcıları,
          kimlik doğrulama sağlayıcısı, iyzico, WhatsApp/Meta entegrasyonu
          etkinse Meta, yetkili destek hizmetleri ve kanunen yetkili kamu
          kurumlarıyla veri paylaşılabilir. Aktarımlar amaçla sınırlı ve gerekli
          veriyle ölçülü tutulur.
        </p>
        <h2>Toplama yöntemi ve güvenlik</h2>
        <p>
          Veriler web formları, güvenli oturumlar, randevu işlemleri, sağlayıcı
          API’leri ve imzalı webhook bildirimleri üzerinden elektronik olarak
          elde edilir. Erişim yetkilendirmesi, işletme ayrımı, hız sınırlama,
          denetim kayıtları, şifreli bağlantı ve gizli anahtar yönetimi
          uygulanır. Kart verisi Neta sistemine alınmaz.
        </p>
        <h2>Saklama ve silme</h2>
        <p>
          Veriler işleme amacı ve ilgili yasal süre boyunca saklanır; süre
          sonunda silinir, yok edilir veya anonimleştirilir. Güvenlik ve mali
          işlem kayıtları, uyuşmazlık ve mevzuat yükümlülükleri nedeniyle hesap
          kapatıldıktan sonra da gerekli süreyle tutulabilir.
        </p>
        <h2>Haklarınız</h2>
        <p>
          KVKK’nın 11. maddesi kapsamındaki bilgi alma, düzeltme, silme/yok
          etme, aktarılan tarafları öğrenme, otomatik işleme itiraz ve zararın
          giderilmesini talep haklarınızı yukarıdaki veri sorumlusu iletişim
          kanalına kimliğinizi doğrulayarak iletebilirsiniz.
        </p>
        <p className="notice">
          Bu metindeki veri sorumlusu ve saklama süreleri, ticari faaliyetin
          gerçek şirket bilgileri ve süreçleriyle hukuk danışmanı tarafından son
          kez doğrulanmalıdır.
        </p>
        <p>
          <Link href="/gizlilik" className="text-button">
            Gizlilik politikasını görüntüle
          </Link>
        </p>
      </article>
    </>
  );
}
