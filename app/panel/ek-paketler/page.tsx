"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Building2, CalendarDays, Check, LockKeyhole, UsersRound } from "lucide-react";
import { api } from "@/components/product/common";
import { money } from "@/lib/types";
import styles from "./page.module.css";

type Addon = { code: string; name: string; description: string; price: number | null; enabled: boolean };
type Addons = { addons: Addon[]; employee: { name: string } };
type Workspace = { business?: { id?: string } };

export default function BusinessAddons() {
  const [data, setData] = useState<Addons | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api("workspace").then((workspace: Workspace) => {
      if (!workspace.business?.id) throw new Error("Önce işletmenizi ve aboneliğinizi açın.");
      return api("business-addons?tenant=" + encodeURIComponent(workspace.business.id));
    }).then((result: Addons) => setData(result)).catch((reason: Error) => setError(reason.message));
  }, []);

  return <main className={styles.page}>
    <Link href="/panel" className={styles.back}><ArrowLeft size={16} /> Panele dön</Link>
    <header className={styles.header}>
      <span className={styles.eyebrow}>İŞLETMENİZ / MODÜLLER</span>
      <h1>Ek paketler</h1>
      <p>İşletmenize açık modülleri ve temel özellikleri tek yerden görün.</p>
    </header>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {!data && !error && <p className={styles.loading}>Paketler yükleniyor…</p>}
    {data && <div className={styles.cards}>
      {data.addons.map(item => <section className={styles.addonCard} key={item.code}>
        <div className={styles.addonTop}><span className={styles.icon}><Building2 size={23} strokeWidth={1.8} /></span>
          <span className={item.enabled ? styles.activeBadge : styles.inactiveBadge}>
            {item.enabled ? <><Check size={14} /> İşletmenizde etkin</> : <><LockKeyhole size={13} /> Henüz etkin değil</>}</span></div>
        <h2>{item.name}</h2>
        <p className={styles.description}>{item.description}</p>
        <div className={styles.features}>
          <span><Building2 size={16} /> Şube bazlı yönetim</span>
          <span><CalendarDays size={16} /> Randevu görünümü</span>
          <span><UsersRound size={16} /> Müdür erişimi</span>
        </div>
        <div className={styles.addonBottom}><div><span className={styles.priceLabel}>AYLIK PAKET FİYATI</span>
          <strong>{item.price === null ? "Henüz belirlenmedi" : money(item.price) + " / ay"}</strong></div>
          {item.enabled && <Link className={styles.action} href="/panel/mudurler">Müdürleri yönet <ArrowUpRight size={17} /></Link>}</div>
        {!item.enabled && <p className={styles.note}>Satın alma henüz açılmadı. Bu modülün erişimi Neta yöneticisi tarafından açılır.</p>}
      </section>)}
      <section className={styles.baseCard}><div className={styles.baseIcon}><UsersRound size={23} strokeWidth={1.8} /></div>
        <div className={styles.baseContent}><span className={styles.eyebrow}>TÜM İŞLETMELERDE DAHİL</span><h2>{data.employee.name}</h2>
          <p>Çalışanlar günlük randevu ve müşteri işlerini kendi panellerinden yürütür. Bu özellik için ek paket ücreti yoktur.</p></div>
        <span className={styles.included}><Check size={14} /> Dahil</span></section>
    </div>}
  </main>;
}
