'use client';
import {useState,useEffect,useRef} from 'react';
import {Clock,Search,CheckCircle2} from 'lucide-react';
import {Input} from '@/components/ui/input';
import {api,Field,Busy} from './common';
import {bookingVisit} from '@/lib/demand-client';
import {today,time} from '@/lib/types';

const minute=(s:string)=>{const [h,m]=s.split(':').map(Number);return h*60+m};
function istanbulMinute(){
 const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Istanbul',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date()).split(':').map(Number);
 return parts[0]*60+parts[1];
}
function initialWindow(date:string){
 if(date!==today())return ['18:00','21:00'];
 const next=Math.ceil((istanbulMinute()+5)/15)*15;
 if(next>1410)return ['23:30','23:45'];
 const end=Math.min(1425,next+180);
 return [time(next),time(Math.max(next+15,end))];
}
const reasonText:Record<string,string>={
 closed_hours:'Seçtiğiniz aralık işletmenin çalışma saatleri dışında.',
 staff_hours:'Seçtiğiniz aralıkta uygun personelin çalışma saati yok.',
 leave:'Seçili gün için izin veya kapalı gün kaydı var.',
 fully_booked:'Bu saat aralığındaki uygun personeller dolu.',
};

export default function DemandSearch({business,service,person,date,demo,demoSlots=[],onResult,onReset,filtered,disabled=false}:any){
 const initial=initialWindow(date);
 const [from,setFrom]=useState(initial[0]),[to,setTo]=useState(initial[1]),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const active=useRef(true);useEffect(()=>{active.current=true;return()=>{active.current=false}},[]);
 async function search(e:React.FormEvent){
  e.preventDefault();if(disabled||busy)return;setError('');
  const start=minute(from),end=minute(to);
  if(start>=end||end-start>360||start%15||end%15){setError('15 dakikalık adımlarla, en fazla 6 saatlik bir aralık seçin.');return}
  if(date===today()&&new Date(date+'T'+time(end-15)+':00+03:00').getTime()<Date.now()+300000){setError('Bu saat aralığı artık geçti. Bugün için ileri bir saat veya başka bir tarih seçin.');return}
  setBusy(true);
  try{
   let r;
   if(demo)r={slots:demoSlots.filter((slot:any)=>slot.minute>=start&&slot.minute<end),alternatives:[],reason:'demo',recorded:false};
   else{const visit=await bookingVisit(business.slug);r=await api('demand-search',{...visit,slug:business.slug,service_id:service,staff_id:person,date,minute_from:start,minute_to:end})}
   if(active.current)onResult({...r,from,to});
  }catch(e:any){setError(e.message)}finally{setBusy(false)}
 }
 const resultMessage=filtered?.slots?.length
  ?'Uygun saatler aşağıda.'
  :demo
   ?'Örnek: bu aralıkta yer bulunamadı.'
   :(reasonText[filtered?.reason]||'Yer bulunamadı. Saat tercihiniz işletmenin talep raporuna eklendi.');
 return <section className="wanted-time"><div className="section-heading"><h3><Clock size={17}/>Aklınızdaki saat hangisi?</h3>{filtered&&<button className="text-button" disabled={busy||disabled} onClick={onReset}>Tüm saatler</button>}</div><p>Kapalı saatler dahil istediğiniz aralığı kontrol edin. Bulunamayan saatler işletmenin planlamasına yardımcı olur.</p><form className="wanted-time-form" onSubmit={search}><Field label="En erken"><Input type="time" required step={900} value={from} onChange={e=>setFrom(e.target.value)}/></Field><Field label="En geç başlangıç"><Input type="time" required step={900} value={to} onChange={e=>setTo(e.target.value)}/></Field><button className="button" disabled={busy||disabled}>{busy?<Busy/>:<Search size={16}/>}Kontrol et</button></form><small>Bitiş saati aralığa dahil değildir. Hizmetiniz seçtiğiniz başlangıçtan sonra devam edebilir.</small>{filtered&&<div className={'demand-result '+(filtered.slots.length?'found':'')}><CheckCircle2 size={17}/><span>{filtered.from}–{filtered.to}: {resultMessage}</span></div>}{error&&<p className="error-message">{error}</p>}</section>;
}
