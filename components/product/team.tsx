'use client';
import {useState,useEffect} from 'react';
import {Check,UserRound,Clock,Scissors,ShieldCheck,UserPlus,Trash2,ArrowRight,KeyRound} from 'lucide-react';
import {Input} from '@/components/ui/input';
import {toast} from 'sonner';
import {api,Field,Pick,Busy,Blank,Confirm,Modal} from './common';
import {PublicShell} from './public';
import {AccountGate} from './session';
import {today,time,money,STATUS} from '@/lib/types';

export function TeamAccessPanel({w}:any){
 const [data,setData]=useState<any>({members:[],branches:[],access:null});
 const [form,setForm]=useState({name:'',email:'',password:'',role:'employee',branch_id:'',staff_id:''});
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[removing,setRemoving]=useState<any>(null),[resetting,setResetting]=useState<any>(null),[resetPassword,setResetPassword]=useState('');
 async function refresh(){try{const next=await api('team-access?tenant='+w.business.id);setData(next);setError('');setForm(f=>({...f,role:next.access?.can_create_manager?f.role:'employee',branch_id:f.branch_id||next.branches?.[0]?.id||''}))}catch(e:any){setError(e.message)}}
 useEffect(()=>{if(!w.preview)refresh()},[w.business.id]);
 if(w.preview)return null;
 const roleOptions=data.access?.can_create_manager?[{value:'manager',label:'Müdür / Sorumlu'},{value:'employee',label:'Çalışan'}]:[{value:'employee',label:'Çalışan'}];
 const staffOptions=[{value:'',label:'Personel kaydına bağlama (isteğe bağlı)'},...w.staff.filter((s:any)=>!form.branch_id||!s.branch_id||s.branch_id===form.branch_id).map((s:any)=>({value:s.id,label:s.name}))];
 return <section className="panel team-access margin-top">
  <div className="section-heading"><h2><ShieldCheck size={20}/>Panel erişimleri</h2><a className="text-button" href="/panel-giris">Giriş ekranı <ArrowRight size={15}/></a></div>
  <p className="muted">Her müdür ve çalışan kendi e-posta ve şifresiyle giriş yapar. Müdür yalnızca atandığı şubeyi görür; çalışan finans ve kârlılık ekranlarını göremez.</p>
  <form className="team-access-form" onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');try{await api('team-access',{tenant_id:w.business.id,...form,staff_id:form.staff_id||null});setForm(f=>({name:'',email:'',password:'',role:'employee',branch_id:f.branch_id,staff_id:''}));await refresh();toast.success('Panel hesabı oluşturuldu.')}catch(e:any){setError(e.message)}finally{setBusy(false)}}}>
   <Field label="Ad soyad"><Input required minLength={2} maxLength={100} value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Ad Soyad"/></Field>
   <Field label="Rol"><Pick label="Rol seçin" value={form.role} onChange={role=>setForm({...form,role})} options={roleOptions}/></Field>
   <Field label="Şube"><Pick label="Şube seçin" value={form.branch_id} onChange={branch_id=>setForm({...form,branch_id,staff_id:''})} options={(data.branches||[]).map((b:any)=>({value:b.id,label:b.name}))}/></Field>
   <Field label="E-posta"><Input type="email" required value={form.email} onChange={e=>setForm({...form,email:e.target.value})} placeholder="personel@ornek.com"/></Field>
   <Field label="İlk şifre"><Input type="password" autoComplete="new-password" required minLength={10} maxLength={128} value={form.password} onChange={e=>setForm({...form,password:e.target.value})} placeholder="En az 10 karakter"/></Field>
   {form.role==='employee'&&<Field label="Personel kaydı (isteğe bağlı)"><Pick label="Personel kaydı" value={form.staff_id} onChange={staff_id=>setForm({...form,staff_id})} options={staffOptions}/></Field>}
   <button className="button" disabled={busy||!form.branch_id}>{busy?<Busy/>:<UserPlus size={17}/>}Hesap oluştur</button>
  </form>
  <p className="helper">Şifre en az 10 karakter olmalı ve en az bir harf ile bir rakam içermelidir.</p>
  {error&&<p className="error-message">{error}</p>}
  {(data.members||[]).filter((r:any)=>!r.disabled).map((r:any)=><div className="list-row" key={r.user_id}>
   <div><strong>{r.name}</strong><small>{r.role==='manager'?'Müdür / Sorumlu':'Çalışan'} · {r.branch_name||'Şube'} · {r.email}{r.staff_name?' · '+r.staff_name:''}</small></div>
   <div className="button-group"><button className="icon-button" aria-label="Şifreyi yenile" onClick={()=>{setResetting(r);setResetPassword('')}}><KeyRound size={17}/></button><button className="icon-button" aria-label={r.name+' erişimini kaldır'} onClick={()=>setRemoving(r)}><Trash2 size={17}/></button></div>
  </div>)}
  {!(data.members||[]).filter((r:any)=>!r.disabled).length&&<Blank title="Henüz ek panel hesabı yok" description="Müdür veya çalışan hesabı oluşturduğunuzda burada görünecek."/>}
  <Confirm open={!!removing} onClose={()=>setRemoving(null)} title="Panel erişimi kapatılsın mı?" description="Hesabın işletme erişimi kapanır; randevu ve personel kayıtları korunur." onConfirm={async()=>{try{await api('team-access',{tenant_id:w.business.id,user_id:removing.user_id,action:'remove'});setRemoving(null);await refresh();toast.success('Erişim kapatıldı.')}catch(e:any){toast.error(e.message)}}}/>
  <Modal open={!!resetting} onClose={()=>setResetting(null)} title="Şifreyi yenile">
   <div className="form-stack"><p className="muted">{resetting?.name} için yeni bir panel şifresi belirleyin.</p><Field label="Yeni şifre"><Input type="password" autoComplete="new-password" minLength={10} maxLength={128} value={resetPassword} onChange={e=>setResetPassword(e.target.value)}/></Field><button className="button primary" disabled={resetPassword.length<10} onClick={async()=>{try{await api('team-access',{tenant_id:w.business.id,user_id:resetting.user_id,action:'reset_password',password:resetPassword});setResetting(null);setResetPassword('');toast.success('Şifre yenilendi.')}catch(e:any){toast.error(e.message)}}}><KeyRound size={17}/>Şifreyi kaydet</button></div>
  </Modal>
 </section>;
}
export default function TeamPage(){return <PublicShell><main className="member-page"><AccountGate returnTo="/ekibim"><TeamDesk/></AccountGate></main></PublicShell>}
function TeamDesk(){
 const [data,setData]=useState<any>(null),[date,setDate]=useState(today()),[tenant,setTenant]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(''),[noShow,setNoShow]=useState<any>(null);
 async function refresh(){try{setData(await api('team-jobs?date='+date+'&tenant='+tenant));setError('')}catch(e:any){setError(e.message)}}
 useEffect(()=>{refresh()},[date,tenant]);
 async function finish(a:any,status:string){setBusy(a.id);try{await api('team-jobs',{tenant_id:data.business.id,id:a.id,status});setNoShow(null);await refresh();toast.success('İşlem sonucu kaydedildi.')}catch(e:any){toast.error(e.message)}finally{setBusy('')}}
 return <><div className="member-heading"><div><span className="eyebrow">EKİP ALANINIZ</span><h1>Bugün, sizin ellerinizde.</h1><p>{data?.business?data.business.name+' · '+data.business.staff_name:'Size atanan randevular ve yapılacak işlemler.'}</p></div><div className="button-group">{data?.businesses?.length>1&&<Pick label="Çalıştığınız işletme" value={tenant||data.business.id} onChange={setTenant} options={data.businesses.map((b:any)=>({value:b.id,label:b.name}))}/>}<Input aria-label="İş günü" type="date" value={date} onChange={e=>setDate(e.target.value)} className="date-input"/></div></div>{error?<p className="error-message">{error}</p>:!data?<div className="loading-row"><Busy/>İş listeniz hazırlanıyor…</div>:!data.business?<section className="panel"><Blank title="Henüz bağlı bir işletmeniz yok" description="İşletme yöneticiniz size panel erişimi tanımladığında iş listeniz burada açılır."/></section>:!data.appointments.length?<section className="panel"><Blank title="Bu gün için atanmış randevu yok" description="Başka bir tarih seçebilirsiniz."/></section>:<div className="team-job-grid">{data.appointments.map((a:any)=>{const ended=new Date(a.date+'T'+time(a.minute)+':00+03:00').getTime()+a.duration*60000<=Date.now();return <article className="panel team-job" key={a.id}><div className="section-heading"><strong className="team-job-time">{time(a.minute)} <span>– {time(a.minute+a.duration)}</span></strong><span className={'badge '+a.status}>{STATUS[a.status]}</span></div><div className="team-job-customer"><UserRound size={19}/><strong>{a.customer_name}</strong><span>{a.customer_phone}</span></div><div className="team-job-service"><Scissors size={23}/><div><h2>{a.service_name}</h2><p>{a.duration} dakika · {money(a.price)}</p></div></div>{a.service_description&&<p className="service-description">{a.service_description}</p>}{a.customer_note&&<div className="customer-note"><strong>Müşteri tercihi</strong><p>{a.customer_note}</p></div>}{a.early_from!=null&&<small className="early-tag"><Clock size={14}/>{time(a.early_from)} itibarıyla erken gelebilir</small>}{a.status==='confirmed'&&<div className="team-job-footer"><button className="button primary" disabled={!ended||!!busy} onClick={()=>finish(a,'completed')}>{busy===a.id?<Busy/>:<Check size={16}/>}İşlem tamamlandı</button><button className="text-button danger" disabled={!ended||!!busy} onClick={()=>setNoShow(a)}>Gelmedi</button>{!ended&&<small>Sonuç, planlanan bitişten sonra işaretlenebilir.</small>}</div>}</article>})}</div>}<Confirm open={!!noShow} onClose={()=>setNoShow(null)} title="Müşteri gelmedi mi?" description="Bu randevu gelmedi olarak işaretlenecek ve tamamlanan işlem gelirine eklenmeyecek." onConfirm={()=>noShow&&finish(noShow,'no_show')}/></>;
}
