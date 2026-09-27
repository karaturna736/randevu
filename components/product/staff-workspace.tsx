'use client';
import {useEffect,useState} from 'react';
import {CalendarDays,Check,UserRound,Clock,Scissors,ShieldCheck,Users,MessageSquare,LockKeyhole,ListChecks} from 'lucide-react';
import {Input} from '@/components/ui/input';
import {toast} from 'sonner';
import {api,Field,Pick,Busy,Blank,Confirm} from './common';
import {PublicShell} from './public';
import {AccountGate,useSession} from './session';
import {today,time,STATUS} from '@/lib/types';

type View='appointments'|'calendar'|'customers'|'services'|'staff'|'journeys'|'whatsapp';
const menu:[View,string,any][]=[
 ['appointments','Randevular',CalendarDays],
 ['calendar','Takvim',Clock],
 ['customers','Müşteriler',UserRound],
 ['services','Hizmetler',Scissors],
 ['staff','Ekip',Users],
 ['journeys','Hizmet Yolculuğu',ListChecks],
 ['whatsapp','WhatsApp',MessageSquare],
];

export default function TeamPage(){
 return <PublicShell><main className="member-page"><AccountGate returnTo="/ekibim"><TeamDesk/></AccountGate></main></PublicShell>;
}

function TeamDesk(){
 const {data:session}=useSession();
 const memberships:any[]=session?.staff_memberships||[];
 const [tenant,setTenant]=useState(''),[date,setDate]=useState(today()),[password,setPassword]=useState(''),[workspace,setWorkspace]=useState<any>(null),[error,setError]=useState(''),[busy,setBusy]=useState(''),[unlocked,setUnlocked]=useState(false),[view,setView]=useState<View>('appointments'),[noShow,setNoShow]=useState<any>(null);
 useEffect(()=>{if(!tenant&&memberships[0]?.id)setTenant(memberships[0].id)},[memberships,tenant]);
 useEffect(()=>{setPassword('');setWorkspace(null);setUnlocked(false);setError('');setView('appointments')},[tenant]);
 async function load(nextDate=date,nextPassword=password){
  if(!tenant||!nextPassword)return;
  setBusy('load');setError('');
  try{
   const r=await fetch('/api/staff/workspace',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tenant_id:tenant,date:nextDate,branch_password:nextPassword})});
   const x:any=await r.json();
   if(!r.ok)throw new Error(x.error||'Çalışan alanı açılamadı.');
   setWorkspace(x);setUnlocked(true);
  }catch(e:any){setWorkspace(null);setUnlocked(false);setError(e.message)}finally{setBusy('')}
 }
 async function unlock(e:React.FormEvent){e.preventDefault();await load()}
 async function finish(a:any,status:'completed'|'no_show'){
  if(!workspace)return;setBusy(a.id);
  try{await api('team-jobs',{tenant_id:workspace.business.id,id:a.id,status,branch_password:password});setNoShow(null);await load();toast.success('Randevu sonucu kaydedildi.')}catch(e:any){toast.error(e.message)}finally{setBusy('')}
 }
 const activeMembership=memberships.find((m:any)=>m.id===tenant)||memberships[0];
 const counts:Record<View,number>={appointments:workspace?.appointments?.length||0,calendar:workspace?.appointments?.length||0,customers:workspace?.customers?.length||0,services:workspace?.services?.length||0,staff:workspace?.staff?.length||0,journeys:workspace?.journeys?.rows?.length||0,whatsapp:workspace?.whatsapp?.messages?.length||0};
 if(!memberships.length)return <section className="panel"><Blank title="Henüz çalışan erişiminiz yok" description="İşletme sahibi sizi bir personel ve şubeye bağladığında çalışan paneliniz burada açılır."/></section>;
 return <>
  <div className="member-heading"><div><span className="eyebrow">ÇALIŞAN ALANI</span><h1>{activeMembership?.name||'İşletme'} · {activeMembership?.branch_name||'Şube'}</h1><p>Önce şube şifresini doğrulayın. Ayarlar ve finans kapalıdır; yalnızca size atanmış randevuların sonucunu işaretleyebilirsiniz.</p></div>{memberships.length>1&&<Pick label="Çalıştığınız işletme" value={tenant} onChange={setTenant} options={memberships.map((b:any)=>({value:b.id,label:b.name+(b.branch_name?' · '+b.branch_name:'')}))}/>}</div>
  {error&&<p role="alert" className="error-message">{error}</p>}
  {!unlocked&&<form onSubmit={unlock} className="panel form-stack" style={{maxWidth:560}}><div className="section-heading"><h2><LockKeyhole size={20}/>Şube şifresi gerekli</h2><span className="badge neutral">2 aşamalı erişim</span></div><p className="muted">Google hesabınız doğrulandı. Şimdi işletme sahibinin {activeMembership?.branch_name||'bu şube'} için verdiği şifreyi girin.</p><Field label="Şube erişim şifresi"><Input type="password" autoComplete="current-password" required minLength={8} maxLength={72} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Şube şifresi"/></Field><button className="button primary" disabled={busy==='load'}>{busy==='load'?<Busy/>:<LockKeyhole size={17}/>}Çalışan panelini aç</button><small>Şifre tarayıcıda kalıcı olarak saklanmaz.</small></form>}
  {unlocked&&workspace&&<><div className="toolbar"><div className="button-group"><span className="badge confirmed"><ShieldCheck size={14}/>Şube doğrulandı</span><button className="text-button" onClick={()=>{setUnlocked(false);setWorkspace(null);setPassword('')}}>Kilitle</button></div><Input aria-label="İş günü" type="date" value={date} onChange={async e=>{const next=e.target.value;setDate(next);await load(next)}} className="date-input"/></div>
   <div style={{display:'grid',gridTemplateColumns:'minmax(190px,230px) minmax(0,1fr)',gap:20,alignItems:'start'}} className="staff-workspace-layout">
    <aside className="panel" style={{padding:10,display:'grid',gap:5}}>{menu.map(([id,label,Icon])=><button key={id} className={view===id?'button primary':'text-button'} style={{justifyContent:'flex-start',width:'100%',padding:'10px 12px'}} onClick={()=>setView(id)}><Icon size={17}/>{label}<span style={{marginLeft:'auto'}}>{counts[id]}</span></button>)}<div style={{borderTop:'1px solid var(--border)',marginTop:6,padding:'10px 8px 4px'}}><small className="muted"><LockKeyhole size={13}/> Ayarlar, paket, fiyatlar, finans ve yetkilendirme bu hesapta kapalıdır.</small></div></aside>
    <section style={{minWidth:0}}>{view==='appointments'&&<AppointmentsView workspace={workspace} busy={busy} onFinish={finish} onNoShow={setNoShow}/>} {view==='calendar'&&<CalendarView workspace={workspace}/>} {view==='customers'&&<CustomersView workspace={workspace}/>} {view==='services'&&<ServicesView workspace={workspace}/>} {view==='staff'&&<StaffView workspace={workspace}/>} {view==='journeys'&&<JourneysView workspace={workspace}/>} {view==='whatsapp'&&<WhatsAppView workspace={workspace}/>}</section>
   </div>
   <Confirm open={!!noShow} onClose={()=>setNoShow(null)} title="Müşteri gelmedi mi?" description="Yalnızca size atanmış bu randevu gelmedi olarak işaretlenecek." onConfirm={()=>noShow&&finish(noShow,'no_show')}/>
  </>}
 </>;
}

function AppointmentsView({workspace,busy,onFinish,onNoShow}:any){
 return <div className="operations-stack"><div className="section-heading"><div><span className="eyebrow">RANDEVULAR</span><h2>Şubenin günlük randevuları</h2></div><span className="badge neutral">Salt okunur · kendi işlemin hariç</span></div>{!workspace.appointments.length?<section className="panel"><Blank title="Bu gün randevu yok" description="Başka bir tarih seçebilirsiniz."/></section>:workspace.appointments.map((a:any)=>{const own=a.staff_id===workspace.business.staff_id;const ended=new Date(a.date+'T'+time(a.minute+a.duration)+':00+03:00').getTime()<=Date.now();return <article className="panel" style={{padding:16}} key={a.id}><div className="section-heading"><div><strong>{time(a.minute)} – {time(a.minute+a.duration)} · {a.customer_name}</strong><p className="muted">{a.service_name} · {a.staff_name} · {a.customer_phone}</p></div><span className={'badge '+a.status}>{STATUS[a.status]||a.status}</span></div>{own&&a.status==='confirmed'&&<div className="button-group"><button className="button primary" disabled={!ended||!!busy} onClick={()=>onFinish(a,'completed')}>{busy===a.id?<Busy/>:<Check size={16}/>}Tamamlandı</button><button className="text-button danger" disabled={!ended||!!busy} onClick={()=>onNoShow(a)}>Gelmedi</button>{!ended&&<small className="muted">Sonuç planlanan bitişten sonra girilebilir.</small>}</div>}{!own&&<small className="muted"><ShieldCheck size={13}/>Bu randevu başka bir çalışana ait; yalnız görüntüleyebilirsiniz.</small>}</article>})}</div>;
}
function CalendarView({workspace}:any){return <div className="operations-stack"><div><span className="eyebrow">TAKVİM</span><h2>{workspace.date} · Şube takvimi</h2></div>{workspace.appointments.map((a:any)=><div className="panel" style={{padding:14,display:'grid',gridTemplateColumns:'90px minmax(0,1fr) auto',gap:12,alignItems:'center'}} key={a.id}><strong>{time(a.minute)}</strong><div><b>{a.service_name}</b><p className="muted">{a.customer_name} · {a.staff_name}</p></div><span className={'badge '+a.status}>{STATUS[a.status]||a.status}</span></div>)}{!workspace.appointments.length&&<section className="panel"><Blank title="Takvim boş" description="Seçilen gün için bu şubede randevu yok."/></section>}</div>}
function CustomersView({workspace}:any){return <div><div className="section-heading"><div><span className="eyebrow">MÜŞTERİLER</span><h2>Bu şubede işlem gören müşteriler</h2></div><span className="badge neutral">Düzenleme kapalı</span></div><div className="collection-list">{workspace.customers.map((c:any)=><div className="collection-row" key={c.id}><div><strong>{c.name}</strong><small>{c.phone} · Son ziyaret {c.last_visit||'—'}</small></div><span>{c.appointment_count} randevu</span></div>)}</div>{!workspace.customers.length&&<Blank title="Müşteri kaydı yok" description="Bu şubede henüz randevu geçmişi oluşmamış."/>}</div>}
function ServicesView({workspace}:any){return <div><div className="section-heading"><div><span className="eyebrow">HİZMETLER</span><h2>Aktif hizmetler</h2></div><span className="badge neutral">Fiyat ve ayar değişikliği kapalı</span></div><div className="collection-list">{workspace.services.map((s:any)=><div className="collection-row" key={s.id}><div><strong>{s.name}</strong><small>{s.duration} dakika</small></div><span className="badge confirmed">Aktif</span></div>)}</div></div>}
function StaffView({workspace}:any){return <div><div className="section-heading"><div><span className="eyebrow">EKİP</span><h2>{workspace.business.branch_name||'Şube'} ekibi</h2></div><span className="badge neutral">Yetkilendirme kapalı</span></div><div className="collection-list">{workspace.staff.map((s:any)=><div className="collection-row" key={s.id}><div><strong>{s.name}</strong><small>{s.title}</small></div>{s.id===workspace.business.staff_id&&<span className="badge confirmed">Siz</span>}</div>)}</div></div>}
function JourneysView({workspace}:any){if(!workspace.journeys.enabled)return <section className="panel"><Blank title="Hizmet Yolculuğu bu pakette kapalı" description="Çalışan yetkisi özelliği açamaz; paket ve ayarlar işletme yöneticisi tarafından yönetilir."/></section>;return <div><div className="section-heading"><div><span className="eyebrow">HİZMET YOLCULUĞU</span><h2>Şube müşterilerinin süreçleri</h2></div><span className="badge neutral">Salt okunur</span></div><div className="operations-stack">{workspace.journeys.rows.map((j:any)=>{const steps=workspace.journeys.steps.filter((s:any)=>s.journey_id===j.id);return <article className="panel" style={{padding:16}} key={j.id}><div className="section-heading"><div><strong>{j.title}</strong><p className="muted">{j.customer_name}</p></div><span className="badge neutral">{j.status}</span></div>{steps.map((s:any)=><div key={s.id} style={{display:'flex',gap:8,padding:'5px 0'}}><span>{s.completed_at?'✓':'○'}</span><span>{s.title}</span></div>)}</article>})}</div>{!workspace.journeys.rows.length&&<Blank title="Hizmet yolculuğu yok" description="Bu şubedeki müşteriler için henüz süreç oluşturulmamış."/>}</div>}
function WhatsAppView({workspace}:any){if(!workspace.whatsapp.enabled)return <section className="panel"><Blank title="WhatsApp bu pakette kapalı" description="Bağlantı ve paket ayarlarını çalışan değiştiremez; işletme yöneticisi yönetir."/></section>;return <div><div className="section-heading"><div><span className="eyebrow">WHATSAPP</span><h2>Şubenin WhatsApp görünümü</h2><p className="muted">Mesaj gönderme ve bağlantı ayarları kapalıdır.</p></div><span className={'badge '+(workspace.whatsapp.connected?'confirmed':'neutral')}>{workspace.whatsapp.connected?'Bağlı':'Bağlantı bekleniyor'}</span></div><section className="panel" style={{padding:16,marginBottom:14}}><div className="detail-facts"><div><span>İşletme numarası</span><b>{workspace.whatsapp.number||'Henüz bağlanmadı'}</b></div><div><span>Yetki</span><b>Yalnız görüntüleme</b></div></div></section><div className="collection-list">{workspace.whatsapp.messages.map((m:any)=><div className="collection-row" key={m.id}><div><strong>{m.phone}</strong><small>{new Date(m.created_at).toLocaleString('tr-TR')}</small></div><span className="badge neutral">{m.status}</span></div>)}</div>{!workspace.whatsapp.messages.length&&<Blank title="Mesaj kaydı yok" description="Bu şubedeki randevularla eşleşen son WhatsApp kayıtları burada görünür."/>}</div>}
