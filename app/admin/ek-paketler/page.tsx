"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/components/product/common";
import { money } from "@/lib/types";

type Business = { id:string; name:string; slug:string; status:string; demo:number; enabled:number; updated_at:string|null };
type Overview = { catalog:{ code:string; price:number|null; updated_at:string }; businesses:Business[] };

export default function AddonsAdmin() {
  const [data, setData] = useState<Overview|null>(null);
  const [tenant, setTenant] = useState("");
  const [price, setPrice] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const load = async () => { const next=await api("admin-addons") as Overview; setData(next); setPrice(next.catalog.price===null?"":String(next.catalog.price/100)); setTenant(current=>current||next.businesses.find(b=>!b.demo)?.id||""); };
  useEffect(()=>{load().catch((e:Error)=>setMessage(e.message));},[]);
  const selected=data?.businesses.find(b=>b.id===tenant);
  async function grant(enabled:boolean){if(!selected)return;setBusy(true);setMessage("");try{await api("admin-manager-addon",{tenant_id:tenant,enabled});await load();setMessage(enabled?"Müdürlük erişimi açıldı.":"Müdürlük erişimi kapatıldı.");}catch(e){setMessage((e as Error).message);}finally{setBusy(false);}}
  async function savePrice(e:React.FormEvent){e.preventDefault();setBusy(true);setMessage("");try{const value=price.trim()===""?null:Math.round(Number(price)*100);if(value!==null&&(!Number.isSafeInteger(value)||value<0))throw new Error("Geçerli bir fiyat girin.");await api("admin-addon-price",{price:value});await load();setMessage("Ek paket fiyatı kaydedildi. Otomatik satış hâlâ kapalı.");}catch(e){setMessage((e as Error).message);}finally{setBusy(false);}}
  return <main className="admin-page" style={{maxWidth:950,margin:"40px auto",padding:24}}><Link href="/admin">← Yönetim merkezi</Link>
    <span className="eyebrow" style={{display:"block",marginTop:25}}>NETA · PLATFORM YÖNETİMİ</span><h1>Ek paketler</h1>
    <p>Modüllerin fiyatını ve işletme erişimini buradan yönetirsiniz. Manuel erişim açma işlemi tahsilat kaydı oluşturmaz.</p>
    {message&&<p role="status" className="notice">{message}</p>}
    {!data?<p>Ek paketler yükleniyor…</p>:<>
      <section className="panel" style={{padding:24,marginTop:24}}><h2>Müdürlük ve şube yönetimi</h2>
        <p>Müdür yalnızca atandığı şubeyi, randevuları ve o şubenin tahmini finans özetini görür.</p>
        <form onSubmit={savePrice} className="form-stack" style={{maxWidth:350}}><label>Aylık ek paket fiyatı (TL)
          <input type="number" min="0" max="1000000" step="0.01" value={price} onChange={e=>setPrice(e.target.value)} placeholder="Henüz belirlenmedi"/>
        </label><button className="button" disabled={busy}>Fiyatı kaydet</button></form>
        <p className="helper">{data.catalog.price===null?"Satış fiyatı belirlenmedi.":`Katalog fiyatı: ${money(data.catalog.price)}`} Ödeme sağlayıcısı doğrulaması bağlanana kadar müşteri satın alma düğmesi açılmaz.</p>
      </section>
      <section className="panel" style={{padding:24,marginTop:16}}><h2>İşletme erişimi</h2>
        <label>İşletme seçin <select value={tenant} onChange={e=>setTenant(e.target.value)} style={{display:"block",marginTop:8,maxWidth:"100%"}}>{data.businesses.filter(b=>!b.demo).map(b=><option key={b.id} value={b.id}>{b.name} · {b.slug}</option>)}</select></label>
        {selected&&<><p><strong>{selected.name}</strong> · Müdürlük: {selected.enabled?"Etkin":"Kapalı"}</p>
          <button className="button primary" disabled={busy} onClick={()=>grant(!selected.enabled)}>{selected.enabled?"Erişimi kapat":"Pilot erişimi aç"}</button>
          <p className="helper">Bu işlem yalnızca modül yetkisini değiştirir. Ödeme yapılmış olarak işaretlemez.</p></>}
      </section>
      <section className="panel" style={{padding:24,marginTop:16}}><h2>Temel sistem</h2><p>Çalışan paneli tüm paketlere dahildir ve ek ücretle satılmaz.</p></section>
    </>}
  </main>;
}
