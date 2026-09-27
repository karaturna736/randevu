'use client';
import {useEffect,useState} from 'react';
import {ArrowRight,LockKeyhole,ShieldCheck,Trash2,UserPlus} from 'lucide-react';
import {Input} from '@/components/ui/input';
import {toast} from 'sonner';
import {api,Field,Pick,Busy,Confirm} from './common';

export function TeamAccessPanel({w}:any){
 const [rows,setRows]=useState<any[]>([]),[staff,setStaff]=useState(w.staff[0]?.id||''),[email,setEmail]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[removing,setRemoving]=useState(''),[branchPassword,setBranchPassword]=useState(''),[message,setMessage]=useState('');
 const selected=w.staff.find((s:any)=>s.id===staff),branchId=selected?.branch_id||w.branches?.[0]?.id||'',branchName=w.branches?.find((b:any)=>b.id===branchId)?.name||'Şube';
 async function refresh(){try{setRows((await api('team-access?tenant='+w.business.id)).members);setError('')}catch(e:any){setError(e.message)}}
 useEffect(()=>{if(!w.preview)refresh()},[w.business.id]);
 useEffect(()=>{setBranchPassword('');setMessage('')},[staff]);
 async function savePassword(){
  if(!branchId)return;setBusy(true);setError('');setMessage('');
  try{
   const r=await fetch('/api/staff/branch-password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tenant_id:w.business.id,branch_id:branchId,password:branchPassword})});
   const x:any=await r.json();
   if(!r.ok)throw new Error(x.error||'Şube şifresi kaydedilemedi.');
   setBranchPassword('');setMessage(branchName+' erişim şifresi kaydedildi.');
  }catch(e:any){setError(e.message)}finally{setBusy(false)}
 }
 if(w.preview)return null;
 return <section className="panel team-access margin-top">
  <div className="section-heading"><div><h2><ShieldCheck size={20}/>Çalışan erişimi</h2><p className="muted">Çalışan; şubesinin randevularını, takvimini, müşterilerini, hizmetlerini, ekibini, Hizmet Yolculuğu ve WhatsApp durumunu görebilir. Ayarlar ve finans kapalıdır.</p></div><a className="text-button" href="/ekibim">Çalışan ekranı <ArrowRight size={15}/></a></div>
  <div className="panel" style={{padding:16,margin:'14px 0'}}><h3><LockKeyhole size={18}/> Şube erişim şifresi</h3><p className="muted">Personel hesabını bağlamadan önce {branchName} için şifre belirleyin. Müdür ve çalışan aynı şubeye ait bu şifreyi kullanır.</p><div className="team-access-form"><Field label="Personel / şube"><Pick label="Personel" value={staff} onChange={setStaff} options={w.staff.map((s:any)=>({value:s.id,label:s.name+(s.branch_name?' · '+s.branch_name:'')}))}/></Field><Field label="Şube şifresi"><Input type="password" autoComplete="new-password" minLength={8} maxLength={72} value={branchPassword} onChange={e=>setBranchPassword(e.target.value)} placeholder="En az 8 karakter, harf ve rakam"/></Field><button type="button" className="button" disabled={busy||!branchId||branchPassword.length<8} onClick={savePassword}>{busy?<Busy/>:<LockKeyhole size={17}/>}Şifreyi belirle / değiştir</button></div></div>
  <form className="team-access-form" onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');setMessage('');try{await api('team-access',{tenant_id:w.business.id,staff_id:staff,email});setEmail('');await refresh();toast.success('Çalışan erişimi tanımlandı.')}catch(e:any){setError(e.message)}finally{setBusy(false)}}}><Field label="Personel"><Pick label="Personel hesabı" value={staff} onChange={setStaff} options={w.staff.map((s:any)=>({value:s.id,label:s.name}))}/></Field><Field label="Üyelik e-postası"><Input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="personel@ornek.com"/></Field><button className="button" disabled={busy||!staff}>{busy?<Busy/>:<UserPlus size={17}/>}Hesabı bağla</button></form>
  {message&&<p className="notice" role="status">{message}</p>}{error&&<p className="error-message">{error}</p>}
  {rows.filter(r=>!r.disabled).map(r=><div className="list-row" key={r.user_id}><div><strong>{r.staff_name||w.staff.find((s:any)=>s.id===r.staff_id)?.name}</strong><small>{r.email} · {r.branch_name||'Şube'} · Çalışan erişimi</small></div><button className="icon-button" aria-label={r.name+' erişimini kaldır'} onClick={()=>setRemoving(r.staff_id)}><Trash2 size={17}/></button></div>)}
  <Confirm open={!!removing} onClose={()=>setRemoving('')} title="Çalışanın erişimi kapatılsın mı?" description="Personel kaydı ve randevuları korunur. Bağlı hesap bu işletmenin çalışan alanına erişemez." onConfirm={async()=>{try{await api('team-access',{tenant_id:w.business.id,staff_id:removing,action:'remove'});setRemoving('');refresh()}catch(e:any){toast.error(e.message)}}}/>
 </section>;
}
