"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {api} from "@/components/product/common";
import {money} from "@/lib/types";

export default function BusinessAddons(){
 const [data,setData]=useState<any>(null),[error,setError]=useState("");
 useEffect(()=>{api("workspace").then((w:any)=>{
  if(!w.business?.id)throw new Error("Önce işletmenizi ve aboneliğinizi açın.");
  return api("business-addons?tenant="+encodeURIComponent(w.business.id));
 }).then(setData).catch((e:Error)=>setError(e.message));},[]);
 return <main style={{maxWidth:850,margin:"40px auto",padding:24}}><Link href="/panel">← Panele dön</Link>
  <span className="eyebrow" style={{display:"block",marginTop:24}}>İŞLETMENİZ</span><h1>Ek paketler</h1>
  <p>İşletmenizin kullanımına açık modülleri görün.</p>{error&&<p role="alert" className="error-message">{error}</p>}
  {!data&&!error&&<p>Yükleniyor…</p>}
  {data?.addons.map((item:any)=><section className="panel" style={{padding:24,marginTop:20}} key={item.code}>
   <h2>{item.name}</h2><p>{item.description}</p>
   <p><strong>{item.price===null?"Fiyat henüz belirlenmedi":money(item.price)+" / ay"}</strong> · {item.enabled?"İşletmenizde etkin":"İşletmenizde kapalı"}</p>
   {item.enabled?<Link className="button primary" href="/panel/mudurler">Müdürleri yönet</Link>:<p className="helper">Satın alma akışı henüz açılmadı. Yetki yalnızca Neta yöneticisi tarafından kontrollü verilir.</p>}
  </section>)}
  {data&&<section className="panel" style={{padding:24,marginTop:16}}><h2>{data.employee.name}</h2><p>Çalışanların kendi randevularını görmesi temel sisteme dahildir; ek paket ücreti yoktur.</p></section>}
 </main>;
}
