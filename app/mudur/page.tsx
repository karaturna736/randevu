"use client";
import { useEffect, useState } from "react";
import { api } from "@/components/product/common";

export default function ManagerPage() {
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [tenant, setTenant] = useState("");
  const [day, setDay] = useState(new Date().toLocaleDateString("en-CA", {timeZone:"Europe/Istanbul"}));
  const [password, setPassword] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [snapshot, setSnapshot] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { api("manager-businesses").then((x:any) => {
    setBusinesses(x.businesses); setTenant(x.businesses[0]?.id || "");
  }).catch((e:any) => setError(e.message)); }, []);

  useEffect(() => {
    setPassword("");
    setUnlocked(false);
    setSnapshot(null);
    setError("");
  }, [tenant]);

  useEffect(() => { if (tenant && businesses.find(b => b.id === tenant && !b.password_required)) void loadSnapshot(day); }, [tenant, businesses]);

  async function loadSnapshot(nextDay = day) {
    if (!tenant || (businesses.find(b => b.id === tenant)?.password_required && !password)) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/manager/dashboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenant_id: tenant, date: nextDay, branch_password: password }),
      });
      const result = await response.json() as any;
      if (!response.ok) throw new Error(result.error || "Şube açılamadı.");
      setSnapshot(result);
      setUnlocked(true);
    } catch (e:any) {
      setSnapshot(null);
      setUnlocked(false);
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function unlock(e:React.FormEvent) {
    e.preventDefault();
    await loadSnapshot();
  }

  async function update(id:string,status:"cancelled"|"completed"|"no_show"){
    setBusy(true);setError("");try{await api("manager-appointment",{tenant_id:tenant,id,status,branch_password:password});
      await loadSnapshot();
    }catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  return <main className="member-page" style={{maxWidth:1100,margin:"40px auto",padding:24}}>
    <a href="/">Neta</a><h1>Müdür paneli</h1>
    <p>Kendi hesabınızla yalnızca size atanan şubenin verilerini görürsünüz. Şifreli giriş paketi etkinse ek şube şifresi istenir.</p>
    {error && <p role="alert" className="error-message">{error}</p>}
    {!businesses.length && !error && <p>Henüz size atanmış etkin bir şube yok.</p>}
    {!!businesses.length && <>
      <div style={{display:"flex",gap:12,flexWrap:"wrap",marginBottom:16}}>
        <label>Şube <select value={tenant} onChange={e=>setTenant(e.target.value)}>{businesses.map(b=><option key={b.id} value={b.id}>{b.name} · {b.branch_name}</option>)}</select></label>
        <label>Gün <input type="date" value={day} onChange={async e=>{const value=e.target.value;setDay(value);if(unlocked) await loadSnapshot(value);}}/></label>
      </div>
      {!unlocked && !!businesses.find(b => b.id === tenant)?.password_required && <form onSubmit={unlock} className="panel" style={{padding:20,maxWidth:520,display:"grid",gap:12,marginBottom:24}}>
        <h2>Şube şifresi</h2>
        <p>Bu şifre işletme sahibi tarafından ilgili şube için belirlenir. Tarayıcıda kalıcı olarak saklanmaz.</p>
        <input type="password" autoComplete="current-password" required minLength={8} maxLength={72} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Şube erişim şifresi"/>
        <button className="button primary" disabled={busy}>{busy?"Kontrol ediliyor…":"Şubeyi aç"}</button>
      </form>}
      {unlocked && <div style={{display:"flex",gap:10,marginBottom:20}}><span className="badge confirmed">Yetkili şube</span>{!!businesses.find(b => b.id === tenant)?.password_required && <button className="text-button" onClick={()=>{setUnlocked(false);setSnapshot(null);setPassword("");}}>Kilitle</button>}</div>}
    </>}
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
        {a.status==="confirmed"&&<div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <button className="button" disabled={!!busy} onClick={()=>update(a.id,"completed")}>Tamamlandı</button>
          <button className="button" disabled={!!busy} onClick={()=>update(a.id,"no_show")}>Gelmedi</button>
          <button className="button" disabled={!!busy} onClick={()=>{if(window.confirm("Randevu iptal edilsin mi?"))update(a.id,"cancelled");}}>İptal et</button>
        </div>}
      </article>)}
    </>}
  </main>;
}
