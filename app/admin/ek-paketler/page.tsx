"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, Building2, CheckCircle2, LockKeyhole, Tag, UsersRound } from "lucide-react";
import { api } from "@/components/product/common";
import { money } from "@/lib/types";
import styles from "./page.module.css";

type Business = { id: string; name: string; slug: string; status: string; demo: number; enabled: number; password_enabled: number; updated_at: string | null };
type Overview = { catalog: { code: string; price: number | null; updated_at: string }[]; businesses: Business[] };
const addonDetails = [
  { code: 'management', name: 'Müdürlük ve şube yönetimi', description: 'Müdür yalnızca atandığı şubeyi, randevuları ve o şubenin tahmini finans özetini görür.' },
  { code: 'branch_password', name: 'Şifreli şube girişi', description: 'Çalışan ve müdür, kişisel hesabına ek olarak şubesinin şifresini girer.' },
] as const;

export default function AddonsAdmin() {
  const [data, setData] = useState<Overview | null>(null);
  const [tenant, setTenant] = useState("");
  const [prices, setPrices] = useState<Record<string,string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  async function load() {
    const next = await api("admin-addons") as Overview;
    setData(next);
    setPrices(Object.fromEntries(next.catalog.map(item => [item.code, item.price === null ? '' : String(item.price / 100)])));
    setTenant(current => next.businesses.some(b => !b.demo && b.id === current)
      ? current : next.businesses.find(b => !b.demo)?.id ?? "");
  }
  useEffect(() => { load().catch((error: Error) => { setMessage(error.message); setIsError(true); }); }, []);

  const businesses = data?.businesses.filter(b => !b.demo) ?? [];
  const selected = businesses.find(b => b.id === tenant);

  async function grant(code: string, enabled: boolean) {
    if (!selected) return;
    setBusy(true); setMessage(""); setIsError(false);
    try {
      await api("admin-manager-addon", { tenant_id: tenant, code, enabled });
      await load();
      setMessage(enabled ? "Bu işletme için ek paket açıldı." : "Bu işletme için ek paket kapatıldı.");
    } catch (error) { setMessage((error as Error).message); setIsError(true); }
    finally { setBusy(false); }
  }
  async function savePrice(event: FormEvent, code: string) {
    event.preventDefault();
    setBusy(true); setMessage(""); setIsError(false);
    try {
      const price = prices[code] || '';
      const value = price.trim() === "" ? null : Math.round(Number(price) * 100);
      if (value !== null && (!Number.isSafeInteger(value) || value < 0)) throw new Error("Geçerli bir fiyat girin.");
      await api("admin-addon-price", { code, price: value });
      await load();
      setMessage("Ek paket fiyatı kaydedildi. Otomatik satış hâlâ kapalı.");
    } catch (error) { setMessage((error as Error).message); setIsError(true); }
    finally { setBusy(false); }
  }

  return <main className={styles.page}>
    <Link href="/admin" className={styles.back}><ArrowLeft size={16} /> Yönetim merkezine dön</Link>
    <header className={styles.header}>
      <div className={styles.headerIcon}><Tag size={23} strokeWidth={1.8} /></div>
      <div><span className={styles.eyebrow}>NETA / PLATFORM YÖNETİMİ</span><h1>Ek paketler</h1>
        <p>Ek paketlerin fiyatlarını ve işletme erişimlerini yönetin.</p></div>
    </header>
    {message && <div role={isError ? "alert" : "status"} className={`${styles.notice} ${isError ? styles.noticeError : ""}`}>
      {!isError && <CheckCircle2 size={17} aria-hidden="true" />}<span>{message}</span></div>}
    {!data ? <div className={styles.loading}>Ek paketler yükleniyor…</div> : <>
      {addonDetails.map(item => <div className={styles.grid} key={item.code} style={{marginBottom:20}}>
        <section className={styles.card} aria-labelledby={`addon-price-${item.code}`}>
          <div className={styles.cardHeading}><span className={styles.cardIcon}><Tag size={19} /></span>
            <div><h2 id={`addon-price-${item.code}`}>{item.name}</h2><p>{item.code === 'branch_password' ? 'Ek şube doğrulaması' : 'Şube bazlı yönetim modülü'}</p></div></div>
          <p className={styles.description}>{item.description}</p>
          <form onSubmit={event => savePrice(event,item.code)} className={styles.priceForm}>
            <label htmlFor={`addon-price-${item.code}-input`}>Aylık ek paket fiyatı</label>
            <div className={styles.priceRow}><div className={styles.priceInput}>
              <input id={`addon-price-${item.code}-input`} type="number" min="0" max="1000000" step="0.01" inputMode="decimal" value={prices[item.code] || ''}
                onChange={event => setPrices(current => ({...current,[item.code]:event.target.value}))} placeholder="Fiyat girin" />
              <span>TL / ay</span></div><button type="submit" className={styles.primaryButton} disabled={busy}>Fiyatı kaydet</button></div>
          </form>
          <div className={styles.infoBox}><strong>{data.catalog.find(row => row.code === item.code)?.price == null ? "Fiyat henüz belirlenmedi" : `${money(data.catalog.find(row => row.code === item.code)!.price!)} / ay`}</strong>
            <span>Ödeme sağlayıcısı doğrulaması bağlanana kadar müşteriler bu paketi satın alamaz.</span></div>
        </section>
        <section className={styles.card} aria-labelledby={`addon-access-${item.code}`}>
          <div className={styles.cardHeading}><span className={styles.cardIcon}><Building2 size={19} /></span>
            <div><h2 id={`addon-access-${item.code}`}>İşletme erişimi</h2><p>{item.name} · pilot erişimi</p></div></div>
          {businesses.length ? <>
            <label htmlFor="addon-business" className={styles.selectLabel}>İşletme seçin</label>
            <select id="addon-business" className={styles.businessSelect} value={tenant} onChange={event => setTenant(event.target.value)}>
              {businesses.map(b => <option key={b.id} value={b.id}>{b.name} · {b.slug}</option>)}
            </select>
            {selected && <div className={styles.businessSummary}><div className={styles.businessAvatar}><Building2 size={19} /></div>
              <div className={styles.businessName}><strong>{selected.name}</strong><span>{selected.slug}</span></div>
              <span className={`${styles.badge} ${(item.code === 'management' ? selected.enabled : selected.password_enabled) ? styles.enabled : styles.disabled}`}>
                {(item.code === 'management' ? selected.enabled : selected.password_enabled) ? "Etkin" : "Kapalı"}</span></div>}
            {selected && <button type="button" className={(item.code === 'management' ? selected.enabled : selected.password_enabled) ? styles.secondaryButton : styles.primaryButton}
              disabled={busy} onClick={() => grant(item.code, !(item.code === 'management' ? selected.enabled : selected.password_enabled))}>{(item.code === 'management' ? selected.enabled : selected.password_enabled) ? "Erişimi kapat" : "Pilot erişimi aç"}</button>}
            <p className={styles.footnote}><LockKeyhole size={15} aria-hidden="true" /> Erişim değişikliği tahsilat kaydı oluşturmaz.</p>
          </> : <p className={styles.empty}>Yönetilecek işletme bulunamadı.</p>}
        </section>
      </div>)}
      <section className={styles.coreCard}><span className={styles.coreIcon}><UsersRound size={20} /></span>
        <div><h2>Çalışan paneli temel sisteme dahil</h2><p>Çalışanların günlük randevu ve müşteri işlemleri ek paket ücreti olmadan kullanılabilir.</p></div>
        <span className={styles.coreBadge}>Temel özellik</span></section>
    </>}
  </main>;
}