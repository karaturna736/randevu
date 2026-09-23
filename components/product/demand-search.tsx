'use client';
import {useState,useEffect,useRef} from 'react';
import {Clock,Search,CheckCircle2} from 'lucide-react';
import {Input} from '@/components/ui/input';
import {api,Field,Busy} from './common';
import {bookingVisit} from '@/lib/demand-client';
export default function DemandSearch({business,service,person,date,demo,onResult,onReset,filtered,disabled=false}:any){
 const [from,setFrom]=useState('18:00'),[to,setTo]=useState('21:00'),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const active=useRef(true);useEffect(()=>{active.current=true;return()=>{active.current=false}},[]);
 const minute=(s:string)=>{const [h,m]=s.split(':').map(Number);return h*60+m};
 async function search(e:React.FormEvent){e.preventDefault();if(disabled||busy)return;setError('');const start=minute(from),end=minute(to);if(start>=end||end-start>360||start%15||end%15){setError('15 dakikalık adımlarla, en fazla 6 saatlik bir aralık seçin.');return}setBusy(true);try{let r;if(demo){r={slots:[],alternatives:[],reason:'closed_hours',recorded:false}}else{const visit=await bookingVisit(business.slug);r=await api('demand-search',{...visit,slug:business.slug,service_id:service,staff_id:person,date,minute_from:start,minute_to:end})}if(active.current)onResult({...r,from,to})}catch(e:any){setError(e.message)}finally{setBusy(false)}}
 return <section className="wanted-time"><div className="section-heading"><h3><Clock size={17}/>Aklınızdaki saat hangisi?</h3>{filtered&&<button className="text-button" disabled={busy||disabled} onClick={onReset}>Tüm saatler</button>}</div><p>Kapalı saatler dahil istediğiniz aralığı kontrol edin. Bulunamayan saatler işletmenin planlamasına yardımcı olur.</p><form className="wanted-time-form" onSubmit={search}><Field label="En erken"><Input type="time" required step={900} value={from} onChange={e=>setFrom(e.target.value)}/></Field><Field label="En geç başlangıç"><Input type="time" required step={900} value={to} onChange={e=>setTo(e.target.value)}/></Field><button className="button" disabled={busy||disabled}>{busy?<Busy/>:<Search size={16}/>}Kontrol et</button></form><small>Bitiş saati aralığa dahil değildir. Hizmetiniz seçtiğiniz başlangıçtan sonra devam edebilir.</small>{filtered&&<div className={'demand-result '+(filtered.slots.length?'found':'')}><CheckCircle2 size={17}/><span>{filtered.from}–{filtered.to}: {filtered.slots.length?'Uygun saatler aşağıda.':demo?'Örnek: bu aralıkta yer bulunamadı.':'Yer bulunamadı. Saat tercihiniz işletmenin talep raporuna eklendi.'}</span></div>}{error&&<p className="error-message">{error}</p>}</section>;
}
