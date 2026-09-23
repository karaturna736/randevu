'use client';
import {useState,useEffect,useRef} from 'react';
import {ClockArrowUp,ArrowRight,Check,RefreshCw,Bell,ChevronRight} from 'lucide-react';
import {Input} from '@/components/ui/input';
import {Switch} from '@/components/ui/switch';
import {toast} from 'sonner';
import {api,Field,Busy} from './common';
import {time,dateLabel} from '@/lib/types';

export function EarlyArrival({data,action,busy,refresh}:any){
 const a=data.appointment,[enabled,setEnabled]=useState(a.early_from!=null),[from,setFrom]=useState(time(a.early_from??Math.max(0,a.minute-60)));
 useEffect(()=>{setEnabled(a.early_from!=null);setFrom(time(a.early_from??Math.max(0,a.minute-60)))},[a.early_from,a.minute]);
 useEffect(()=>{if(a.early_from==null||a.status!=='confirmed')return;const id=setInterval(()=>{if(document.visibilityState==='visible')refresh()},30000);return()=>clearInterval(id)},[a.id,a.early_from,a.status]);
 if(a.status!=='confirmed'||new Date(a.date+'T'+time(a.minute)+':00+03:00').getTime()<=Date.now())return null;
 const offers=data.early_offers||[];
 return <section className="panel early-arrival margin-top"><div className="section-heading"><h2><ClockArrowUp size={20}/>Erken gelirim</h2><Switch aria-label="Erken saat teklifi almak istiyorum" checked={enabled} onCheckedChange={setEnabled}/></div><p>Planınız esnekse aynı gün, aynı personelle daha erken bir saate geçebilirsiniz. Saatiniz siz kabul edene kadar değişmez.</p>{enabled&&<Field label="Bu saatten itibaren gelebilirim"><Input type="time" step={900} max={time(a.minute-15)} value={from} onChange={e=>setFrom(e.target.value)}/></Field>}<div className="early-preference-footer"><small>{a.early_from!=null?time(a.early_from)+' itibarıyla açık':'Erken geliş kapalı'}</small><button className="button" disabled={busy||enabled===(a.early_from!=null)&&from===time(a.early_from??Math.max(0,a.minute-60))} onClick={()=>{const [h,m]=from.split(':').map(Number);action({action:'early_preference',early_from:enabled?h*60+m:null})}}><Check size={15}/>Tercihimi kaydet</button></div>{offers.length>0?<div className="early-offers">{offers.map((o:any)=><div className="early-offer" key={o.id}><div><span className="eyebrow">DAHA ERKEN BİR YER VAR</span><strong>{time(a.minute)} <ArrowRight size={19}/> {time(o.minute)}</strong><p>Hizmetiniz, personeliniz ve fiyatınız aynı kalır.</p></div><div className="button-group"><button className="button primary" disabled={busy} onClick={()=>action({action:'early_accept',offer_id:o.id})}>{time(o.minute)} teklifini kabul et</button><button className="text-button" disabled={busy} onClick={()=>action({action:'early_decline',offer_id:o.id})}>Bu saat olmaz</button></div></div>)}</div>:a.early_from!=null&&<div className="early-waiting"><Bell size={17}/><span>Uygun saatler, bu sayfa açıkken 30 saniyede bir kontrol edilir.</span><button aria-label="Erken saatleri şimdi kontrol et" className="icon-button" onClick={refresh}><RefreshCw size={15}/></button></div>}<p className="helper">Teklif geçicidir ve saati sizin için ayırmaz. Kabul sırasında müsaitlik yeniden kontrol edilir. Bu sürüm uygulama içinde haber verir.</p></section>;
}

export function EarlyOffersInbox({onChanged}:any){
 const [offers,setOffers]=useState<any[]>([]),[busy,setBusy]=useState(''),[error,setError]=useState('');
 async function refresh(){try{setOffers((await api('early-offers')).offers);setError('')}catch(e:any){setError(e.message)}}
 useEffect(()=>{refresh();const id=setInterval(()=>{if(document.visibilityState==='visible')refresh()},30000);return()=>clearInterval(id)},[]);
 if(!offers.length)return error?<p className="helper">Erken saatler kontrol edilemedi. <button className="text-button" onClick={refresh}>Tekrar dene</button></p>:null;
 return <section className="panel early-inbox"><div className="section-heading"><h2><ClockArrowUp size={21}/>Daha erken gelebilirsiniz</h2><span className="badge confirmed">{offers.length} teklif</span></div><p className="muted">Seçtiğiniz erken geliş aralığında yeni yer var. Teklifi kabul ettiğinizde randevunuz taşınır.</p>{offers.map(o=><div className="inbox-offer" key={o.id}><div><strong>{o.business_name} · {o.service_name}</strong><p>{dateLabel(o.date)} · {time(o.original_minute)} yerine <b>{time(o.minute)}</b></p></div><div className="button-group"><a className="text-button" href={'/randevum?id='+o.appointment_id}>Detaylar <ChevronRight size={15}/></a><button className="button primary" disabled={!!busy} onClick={async()=>{setBusy(o.id);try{await api('my-appointment',{id:o.appointment_id,action:'early_accept',offer_id:o.id});toast.success('Randevunuz '+time(o.minute)+' saatine alındı.');await refresh();onChanged?.()}catch(e:any){toast.error(e.message);refresh()}finally{setBusy('')}}}>{busy===o.id?<Busy/>:<ClockArrowUp size={16}/>}{time(o.minute)} saatine al</button></div></div>)}</section>;
}

export function useEarlyNotice(active:boolean){
 const seen=useRef(new Set<string>());
 useEffect(()=>{if(!active)return;let stopped=false;async function refresh(){if(document.visibilityState!=='visible')return;try{const r=await api('early-offers');if(stopped)return;const next=r.offers.find((o:any)=>!seen.current.has(o.id));for(const o of r.offers)seen.current.add(o.id);if(next)toast('Daha erken bir saat açıldı',{description:next.business_name+' · '+time(next.minute),duration:9000,action:{label:'İncele',onClick:()=>location.assign('/randevum?id='+next.appointment_id)}})}catch{}}
  refresh();const id=setInterval(refresh,60000);return()=>{stopped=true;clearInterval(id)};
 },[active]);
}
