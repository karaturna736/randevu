"use client";
import { useEffect, useState } from "react";
import { api } from "@/components/product/common";

export default function ManagerPage() {
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [tenant, setTenant] = useState("");
  const [day, setDay] = useState(new Date().toLocaleDateString("en-CA", {timeZone:"Europe/Istanbul"}));
  const [snapshot, setSnapshot] = useState<any>(null);
  const [error, setError] = useState("");
  useEffect(() => { api("manager-businesses").then((x:any) => {
    setBusinesses(x.businesses); setTenant(x.businesses[0]?.id || "");
  }).catch((e:any) => setError(e.message)); }, []);
  useEffect(() => { if (!tenant) return; setSnapshot(null);
    api("manager-dashboard?tenant=" + encodeURIComponent(tenant) + "&date=" + day)
      .then((x:any) => { setSnapshot(x); setError(""); }).catch((e:any) => setError(e.message));
  }, [tenant, day]);
  return <main className="member-page" style={{maxWidth:1100,margin:"40px auto",padding:24}}>
    <a href="/">Neta</a><h1>Müdür paneli</h1>
    <p>Yalnızca yetkili olduğunuz şubenin kayıtları gösterilir.</p>
    {error && <p role="alert" className="error-message">{error}</p>}
    {!businesses.length && !error && <p>Henüz size atanmış etkin bir şube yok.</p>}
    {!!businesses.length && <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
      <label>Şube <select value={tenant} onChange={e=>setTenant(e.target.value)}>{businesses.map(b=><option key={b.id} value={b.id}>{b.name} · {b.branch_name}</option>)}</select></label>
      <label>Gün <input type="date" value={day} onChange={e=>setDay(e.target.value)}/></label>
    </div>}
    {snapshot && <><h2>{snapshot.access.business_name} · {snapshot.access.branch_name}</h2>
      <section className="panel" style={{padding:20,marginBottom:20}}><h3>Şube finans özeti · {snapshot.finance.month}</h3>
        <p>Tamamlanan işlem tutarı: {(snapshot.finance.revenue/100).toLocaleString("tr-TR")} TL</p>
        <p>Girilen gider: {(snapshot.finance.expenses/100).toLocaleString("tr-TR")} TL</p>
        <strong>Tahmini fark: {(snapshot.finance.estimate/100).toLocaleString("tr-TR")} TL</strong>
        <p>Giderler eksikse sonuç kesin kâr değildir.</p></section>
      <h3>Günün randevuları ({snapshot.appointments.length})</h3>
      {snapshot.appointments.map((a:any)=><article className="panel" style={{padding:16,marginBottom:8}} key={a.id}>
        <strong>{String(Math.floor(a.minute/60)).padStart(2,"0")}:{String(a.minute%60).padStart(2,"0")} · {a.customer_name}</strong>
        <p>{a.customer_phone} · {a.service_name} · {a.staff_name} · {a.status}</p>
      </article>)}
    </>}
  </main>;
}
