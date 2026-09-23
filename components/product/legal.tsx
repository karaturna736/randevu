"use client";
import { useEffect, useState } from "react";
import { Brand, ThemeToggle, api } from "./common";
export default function Legal({ privacy = false }: { privacy?: boolean }) {
  const [plan, setPlan] = useState<any>(null);
  useEffect(() => {
    api("plans")
      .then(setPlan)
      .catch(() => {});
  }, []);
  return (
    <>
      <header className="public-header">
        <Brand />
        <ThemeToggle />
      </header>
      <article className="legal-page">
        <a className="text-button" href="/">
          Ana sayfaya dön
        </a>
        <h1>
          {privacy
            ? "Gizlilik ve verileriniz"
            : "Kullanım ve abonelik bilgileri"}
        </h1>
        <p>Son güncelleme: 22 Eylül 2026</p>
        {privacy ? (
          <>
            <h2>Hangi bilgiler kullanılır?</h2>
            <p>
              Hesabınız için ad, doğrulanmış e-posta ve giriş sağlayıcısındaki
              kullanıcı kimliği; randevular için seçtiğiniz hizmet, personel,
              tarih, telefon ve ilettiğiniz notlar kullanılır. İsteğe bağlı
              iletişim izninizi hesap sayfanızdan değiştirebilirsiniz.
            </p>
            <h2>İşletmeye özel erişim</h2>
            <p>
              İşletme sahipleri kendi işletmelerinin kayıtlarını görür.
              Yetkilendirilen personel, kendisine atanmış işlere erişir.
              Platform yöneticisi destek ve yönetim amacıyla platform
              kayıtlarına erişebilir. Özel randevu yönetim bağlantınızı
              paylaşmayın; bağlantı randevunuzu yönetme yetkisi verir.
            </p>
            <h2>Oturum ve ölçüm</h2>
            <p>
              Oturumu sürdürmek için güvenli oturum çerezi kullanılır. Tema
              tercihi tarayıcıda saklanır. Randevu sayfasında tekrar eden
              aramaları ayırt etmek için tarayıcıda rastgele bir ziyaretçi
              anahtarı tutulur; talep kayıtları işletmenin müsaitlik analizinde
              kullanılır. Bu ölçüm birebir kişi sayısı anlamına gelmez.
            </p>
            <h2>Giriş ve ödeme sağlayıcıları</h2>
            <p>
              Google bağlantısı açıldığında kimlik doğrulaması Google tarafından
              yapılır. Aylık abonelik kart bilgileri doğrudan iyzico tarafından
              işlenir ve güvenli kart saklama iyzico ortamında gerçekleştirilir.
              Neta Randevu kart numarası veya güvenlik kodu saklamaz; yalnızca
              sağlayıcı referansları, işlem durumu ve onay kayıtları tutulur.
            </p>
            <h2>Talepleriniz</h2>
            <p>
              Hesap bilgilerinizin düzeltilmesi, dışa aktarılması veya silinmesi
              talepleri için aşağıdaki destek adresini kullanabilirsiniz.
              Randevuya ilişkin taleplerde ilgili işletmeyle de iletişime
              geçebilirsiniz.
            </p>
          </>
        ) : (
          <>
            <h2>Hizmetin kapsamı</h2>
            <p>
              Neta Randevu işletmelere randevu, ekip ve müşteri yönetimi sunar.
              Hizmetin fiyatını, süresini, personelini ve randevu iptal
              kurallarını ilgili işletme belirler. Talep analizlerindeki
              tutarlar tahmindir; gerçekleşmiş veya garanti edilmiş gelir
              değildir.
            </p>
            <h2>Üyelik ve işletme kurulumu</h2>
            <p>
              İşletme sahibi doğrulanmış hesabıyla profilini tamamlar,
              işletmesini oluşturur ve hizmetlerini ekler. İşletme
              onaylandığında kendine özel randevu sayfası açılır. Müşteriler,
              işletmenin uygun saatlerinden üyelik zorunluluğu olmadan randevu
              oluşturabilir.
            </p>
            <h2>Abonelik ve ödeme</h2>
            <p>
              Ücretli plan satışa açıldığında fiyat, süre ve satıcı bilgileri
              ödeme öncesinde gösterilir. Aylık abonelik, kullanıcı onayıyla
              iyzico tarafından otomatik yenilenir. Erişim yalnızca ödeme
              sağlayıcısından doğrulanan başarılı tahsilatla açılır; test
              işlemleri gerçek erişim süresi kazandırmaz.
            </p>
            <h2>İptal, iade ve destek</h2>
            <p>
              Satın almadan önce ödeme ekranındaki satıcıya ait satış, iptal ve
              iade koşullarını inceleyin. Ödeme ekranını kapatmak, tamamlanan
              ödemeyi iptal etmez. İade talepleri satıcının destek kanalı
              üzerinden değerlendirilir. Bu sayfa satıcıya özel satış
              sözleşmesinin yerine geçmez.
            </p>
          </>
        )}
        <h2>Satıcı ve iletişim</h2>
        {plan?.seller_name ? (
          <p>
            {plan.seller_name}
            <br />
            {plan.seller_address}
            <br />
            {plan.support_email}
          </p>
        ) : (
          <p className="notice">
            Pilot sürümdeyiz. Ticari satış açılmadan önce satıcı iletişimi ve
            satıcıya özel koşullar tamamlanacaktır. Şu anda bu platformdan
            abonelik ödemesi alınmıyor.
          </p>
        )}
        <p>
          <a href={privacy ? "/kosullar" : "/gizlilik"} className="text-button">
            {privacy
              ? "Kullanım bilgilerini görüntüle"
              : "Gizlilik bilgisini görüntüle"}
          </a>
        </p>
      </article>
    </>
  );
}
