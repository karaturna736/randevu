"use client";
import { useState } from "react";
import { api } from "@/components/product/common";

export default function AddonsAdmin() {
  const [tenant, setTenant] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [message, setMessage] = useState("");
  return <main style={{maxWidth:700,margin:"40px auto",padding:24}}><a href="/admin">← Yönetici paneli</a>
    <h1>Ek paket yetkileri</h1><p>Müdürlük modülünün işletme erişimini açın veya kapatın. Bu ekran ödeme almaz.</p>
    <form onSubmit={async e=>{e.preventDefault();try{const x=await api("admin-manager-addon",{tenant_id:tenant,enabled});setMessage(x.enabled?"Modül etkinleştirildi.":"Modül kapatıldı.");}catch(e:any){setMessage(e.message);}}} style={{display:"grid",gap:12}}>
      <label>İşletme kimliği <input required value={tenant} onChange={e=>setTenant(e.target.value)}/></label>
      <label><input type="checkbox" checked={enabled} onChange={e=>setEnabled(e.target.checked)}/> Müdürlük etkin</label>
      <button className="button primary">Kaydet</button>
    </form>{message&&<p role="status">{message}</p>}
  </main>;
}
