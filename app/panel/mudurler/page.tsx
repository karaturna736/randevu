"use client";
import { useEffect, useState } from "react";
import { api } from "@/components/product/common";

export default function ManagersPage() {
  const [tenant, setTenant] = useState("");
  const [data, setData] = useState<any>(null);
  const [email, setEmail] = useState("");
  const [branch, setBranch] = useState("");
  const [branchPassword, setBranchPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = (id:string) => api("managers?tenant="+encodeURIComponent(id)).then((x:any)=>{
    setData(x);
    setBranch((current:string)=>current&&x.branches.some((b:any)=>b.id===current)?current:(x.branches[0]?.id||""));
  }).catch((e:any)=>setError(e.message));

  useEffect(()=>{api("workspace").then((x:any)=>{if(x.business?.id){setTenant(x.business.id);load(x.business.id);}}).catch((e:any)=>setError(e.message));},[]);

  const selectedBranch = data?.branches?.find((b:any)=>b.id===branch);

  async function saveBranchPassword(e:React.FormEvent){
    e.preventDefault();
    setBusy(true);setError("");setMessage("");
    try{
      const response=await fetch("/api/manager/branch-password",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({tenant_id:tenant,branch_id:branch,password:branchPassword})});
      const result=await response.json() as any;
      if(!response.ok)throw new Error(result.error||"Şube şifresi kaydedilemedi.");
      setBranchPassword("");
      setMessage("Şube erişim şifresi kaydedildi.");
      await load(tenant);
    }catch(e:any){setError(e.message);}finally{setBusy(false);}
  }

  async function assign(e:React.FormEvent){
    e.preventDefault();setBusy(true);setError("");setMessage("");
    try{
      if(!selectedBranch?.password_configured)throw new Error("Önce bu şube için erişim şifresi belirleyin.");
      await api("managers",{tenant_id:tenant,action:"assign",email,branch_id:branch});
      setEmail("");setMessage("Müdür şubeye atandı.");await load(tenant);
    }catch(e:any){setError(e.message);}finally{setBusy(false);}
  }

  return <main style={{maxWidth:780,margin:"40px auto",padding:24}}><a href="/panel">← Panele dön</a><h1>Müdürler</h1>
    <p>Her müdür kendi Google hesabıyla girer; ayrıca sadece atandığı şubenin manuel belirlediğiniz erişim şifresini kullanır.</p>
    {error&&<p role="alert" className="error-message">{error}</p>}
    {message&&<p role="status" className="notice">{message}</p>}
    {data && (!data.enabled ? <p>Müdürlük ek paketi bu işletme için etkin değil.</p> : <>
      <section className="panel" style={{padding:18,marginBottom:20}}>
        <h2>Şube erişim şifresi</h2>
        <p>Her şubenin şifresi ayrıdır. İlk müdürü atamadan önce şifreyi siz manuel belirlersiniz. Şifre düz metin olarak saklanmaz.</p>
        <form onSubmit={saveBranchPassword} style={{display:"grid",gap:12}}>
          <label>Şube <select value={branch} onChange={e=>{setBranch(e.target.value);setBranchPassword("");}}>{data.branches.map((b:any)=><option key={b.id} value={b.id}>{b.name}{b.password_configured?" · şifre hazır":" · şifre gerekli"}</option>)}</select></label>
          <label>{selectedBranch?.password_configured?"Yeni şube şifresi (değiştirir)":"İlk şube şifresi"}<input type="password" autoComplete="new-password" required minLength={8} maxLength={72} value={branchPassword} onChange={e=>setBranchPassword(e.target.value)} placeholder="En az 8 karakter, harf ve rakam"/></label>
          <small>Şifre en az 8 karakter olmalı ve en az bir harf ile bir rakam içermeli.</small>
          <button className="button" disabled={!branch||busy}>{selectedBranch?.password_configured?"Şifreyi değiştir":"Şifreyi belirle"}</button>
        </form>
      </section>

      <form onSubmit={assign} className="panel" style={{display:"grid",gap:12,padding:18}}>
        <h2>Müdür ata</h2>
        <label>Müdürün üyelik e-postası <input type="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label>
        <label>Şube <select value={branch} onChange={e=>setBranch(e.target.value)}>{data.branches.map((b:any)=><option key={b.id} value={b.id}>{b.name}{b.password_configured?"":" · önce şifre belirleyin"}</option>)}</select></label>
        <button className="button primary" disabled={!branch||busy||!selectedBranch?.password_configured}>Müdür ata</button>
      </form>

      <h2>Atanan müdürler</h2>{data.members.filter((m:any)=>!m.disabled).map((m:any)=><div className="panel" style={{padding:12,marginBottom:8}} key={m.user_id}>
        {m.name} · {m.email} · {data.branches.find((b:any)=>b.id===m.branch_id)?.name}
        <button onClick={async()=>{try{await api("managers",{tenant_id:tenant,action:"remove",user_id:m.user_id});await load(tenant);}catch(e:any){setError(e.message);}}}>Erişimi kaldır</button></div>)}
    </>)}
  </main>;
}
