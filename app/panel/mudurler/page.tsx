"use client";
import { useEffect, useState } from "react";
import { api } from "@/components/product/common";

export default function ManagersPage() {
  const [tenant, setTenant] = useState("");
  const [data, setData] = useState<any>(null);
  const [email, setEmail] = useState("");
  const [branch, setBranch] = useState("");
  const [error, setError] = useState("");
  const load = (id:string) => api("managers?tenant="+encodeURIComponent(id)).then((x:any)=>{setData(x);setBranch(x.branches[0]?.id||"");}).catch((e:any)=>setError(e.message));
  useEffect(()=>{api("workspace").then((x:any)=>{if(x.business?.id){setTenant(x.business.id);load(x.business.id);}}).catch((e:any)=>setError(e.message));},[]);
  async function assign(e:React.FormEvent){e.preventDefault();try{await api("managers",{tenant_id:tenant,action:"assign",email,branch_id:branch});setEmail("");await load(tenant);setError("");}catch(e:any){setError(e.message);}}
  return <main style={{maxWidth:780,margin:"40px auto",padding:24}}><a href="/panel">← Panele dön</a><h1>Müdürler</h1>
    <p>Her müdür kendi Google hesabıyla girer ve yalnızca atanan şubeyi görür.</p>
    {error&&<p role="alert" className="error-message">{error}</p>}
    {data && (!data.enabled ? <p>Müdürlük ek paketi bu işletme için etkin değil.</p> : <>
      <form onSubmit={assign} style={{display:"grid",gap:12}}><label>Müdürün üyelik e-postası <input type="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label>
        <label>Şube <select value={branch} onChange={e=>setBranch(e.target.value)}>{data.branches.map((b:any)=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
        <button className="button primary" disabled={!branch}>Müdür ata</button></form>
      <h2>Atanan müdürler</h2>{data.members.filter((m:any)=>!m.disabled).map((m:any)=><div className="panel" style={{padding:12,marginBottom:8}} key={m.user_id}>
        {m.name} · {m.email} · {data.branches.find((b:any)=>b.id===m.branch_id)?.name}
        <button onClick={async()=>{try{await api("managers",{tenant_id:tenant,action:"remove",user_id:m.user_id});await load(tenant);}catch(e:any){setError(e.message);}}}>Erişimi kaldır</button></div>)}
    </>)}
  </main>;
}
