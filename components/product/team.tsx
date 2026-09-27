'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { CalendarDays, CalendarRange, Check, UserRound, Scissors, ShieldCheck, UserPlus, Trash2, ArrowRight, Users, Route, MessageSquare, LockKeyhole } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { api, Field, Pick, Busy, Blank, Confirm } from './common';
import { PublicShell } from './public';
import { AccountGate } from './session';
import { today, time, STATUS, money } from '@/lib/types';

export function TeamAccessPanel({ w }: any) {
  const [rows, setRows] = useState<any[]>([]), [staff, setStaff] = useState(w.staff[0]?.id || ''), [email, setEmail] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState(''), [removing, setRemoving] = useState('');
  async function refresh() { try { setRows((await api('team-access?tenant=' + w.business.id)).members); setError(''); } catch (e: any) { setError(e.message); } }
  useEffect(() => { if (!w.preview) refresh(); }, [w.business.id]);
  if (w.preview) return null;
  return <section className="panel team-access margin-top"><div className="section-heading"><h2><ShieldCheck size={20} /> Personelin kendi ekranı</h2><a className="text-button" href="/panel/mudurler">Şube şifresini yönet <ArrowRight size={15} /></a></div><p className="muted">Çalışan, kendi hesabıyla giriş yaptıktan sonra bağlı olduğu şubenin erişim şifresini de girmek zorundadır. Ayar değiştiremez; operasyon ekranlarını salt okunur görür.</p><form className="team-access-form" onSubmit={async e => { e.preventDefault(); setBusy(true); setError(''); try { await api('team-access', { tenant_id: w.business.id, staff_id: staff, email }); setEmail(''); await refresh(); toast.success('Çalışan erişimi tanımlandı.'); } catch (e: any) { setError(e.message); } finally { setBusy(false); } }}><Field label="Personel"><Pick label="Personel hesabı" value={staff} onChange={setStaff} options={w.staff.map((s: any) => ({ value: s.id, label: s.name }))} /></Field><Field label="Üyelik e-postası"><Input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="personel@ornek.com" /></Field><button className="button" disabled={busy || !staff}>{busy ? <Busy /> : <UserPlus size={17} />}Hesabı bağla</button></form>{error && <p className="error-message">{error}</p>}{rows.filter(r => !r.disabled).map(r => <div className="list-row" key={r.user_id}><div><strong>{w.staff.find((s: any) => s.id === r.staff_id)?.name}</strong><small>{r.email} · {r.branch_name || 'Şube yok'} · {r.password_configured ? 'Şifre korumalı' : 'Şifre bekliyor'}</small></div><button className="icon-button" aria-label={r.name + ' erişimini kaldır'} onClick={() => setRemoving(r.staff_id)}><Trash2 size={17} /></button></div>)}<Confirm open={!!removing} onClose={() => setRemoving('')} title="Personelin erişimi kapatılsın mı?" description="Personel kaydı ve randevuları korunur. Bağlı hesap bu işletmenin çalışan alanına erişemez." onConfirm={async () => { try { await api('team-access', { tenant_id: w.business.id, staff_id: removing, action: 'remove' }); setRemoving(''); refresh(); } catch (e: any) { toast.error(e.message); } }} /></section>;
}

export default function TeamPage() { return <PublicShell><main className="member-page"><AccountGate returnTo="/ekibim"><TeamDesk /></AccountGate></main></PublicShell>; }

const staffNav = [
  ['appointments', 'Randevular', CalendarDays],
  ['calendar', 'Takvim', CalendarRange],
  ['customers', 'Müşteriler', Users],
  ['services', 'Hizmetler', Scissors],
  ['staff', 'Ekip', UserRound],
  ['journeys', 'Hizmet yolculuğu', Route],
  ['whatsapp', 'WhatsApp', MessageSquare],
] as const;

async function secureWorkspace(payload: any) {
  const r = await fetch('/api/team/workspace', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  const data: any = await r.json().catch(() => ({}));
  if (!r.ok) { const e: any = new Error(data.error || 'Çalışan alanı açılamadı.'); e.status = r.status; throw e; }
  return data;
}

function TeamDesk() {
  const [memberships, setMemberships] = useState<any[]>([]), [tenant, setTenant] = useState(''), [password, setPassword] = useState(''), [date, setDate] = useState(today()), [data, setData] = useState<any>(null), [view, setView] = useState('appointments'), [error, setError] = useState(''), [busy, setBusy] = useState(false), [jobBusy, setJobBusy] = useState(''), [noShow, setNoShow] = useState<any>(null);
  useEffect(() => { api('account').then((x: any) => { const rows = x.staff_memberships || []; setMemberships(rows); setTenant(rows[0]?.id || ''); }).catch((e: any) => setError(e.message)); }, []);
  useEffect(() => { setData(null); setPassword(''); setError(''); }, [tenant]);
  async function unlock(e?: FormEvent) { e?.preventDefault(); if (!tenant) return; setBusy(true); setError(''); try { setData(await secureWorkspace({ tenant_id: tenant, date, branch_password: password })); } catch (e: any) { setData(null); setError(e.message); } finally { setBusy(false); } }
  async function refreshForDate(nextDate: string) { setDate(nextDate); if (!data || !password) return; setBusy(true); try { setData(await secureWorkspace({ tenant_id: tenant, date: nextDate, branch_password: password })); setError(''); } catch (e: any) { setData(null); setError(e.message); } finally { setBusy(false); } }
  async function finish(a: any, status: string) { setJobBusy(a.id); try { await api('team-jobs', { tenant_id: data.business.id, id: a.id, status, branch_password: password }); setNoShow(null); await unlock(); toast.success('İşlem sonucu kaydedildi.'); } catch (e: any) { toast.error(e.message); } finally { setJobBusy(''); } }

  if (!memberships.length && !tenant) return <section className="panel"><Blank title="Çalışan erişiminiz yok" description="İşletme sahibi, Ekip bölümünden üyelik e-postanızı bir personel kaydına bağlamalı." /></section>;
  if (!data) return <><div className="member-heading"><div><span className="eyebrow">ÇALIŞAN GİRİŞİ</span><h1>Şubenizi doğrulayın.</h1><p>Hesabınız doğrulandı. Şube verileri açılmadan önce işletme sahibinin belirlediği şifre gerekir.</p></div></div><section className="panel form-stack" style={{ maxWidth: 520 }}><Field label="İşletme / şube"><Pick label="Çalıştığınız şube" value={tenant} onChange={setTenant} options={memberships.map((b: any) => ({ value: b.id, label: b.name }))} /></Field><form className="form-stack" onSubmit={unlock}><Field label="Şube erişim şifresi"><Input type="password" required minLength={8} maxLength={72} autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Şube şifresi" /></Field>{error && <p role="alert" className="error-message">{error}</p>}<button className="button primary full" disabled={busy || !tenant}>{busy ? <Busy /> : <LockKeyhole size={17} />}Çalışan panelini aç</button></form></section></>;

  return <div style={{ display: 'grid', gridTemplateColumns: '220px minmax(0,1fr)', gap: 24, alignItems: 'start' }}>
    <aside className="panel" style={{ position: 'sticky', top: 20, padding: 12 }}><div style={{ padding: 10 }}><strong>{data.business.name}</strong><small style={{ display: 'block' }}>{data.business.branch_name} · {data.business.staff_name}</small></div><div className="form-stack" style={{ gap: 4 }}>{staffNav.map(([id, label, Icon]) => <button key={id} className={'button ' + (view === id ? 'primary' : '')} style={{ justifyContent: 'flex-start' }} onClick={() => setView(id)}><Icon size={17} />{label}{id === 'appointments' && <span style={{ marginLeft: 'auto' }}>{data.appointments.length}</span>}</button>)}</div><hr /><small>Ayarlar ve yönetim değişiklikleri çalışan hesabında kapalıdır.</small><button className="text-button" onClick={() => { setData(null); setPassword(''); }}>Şubeyi kilitle</button></aside>
    <section><div className="member-heading"><div><span className="eyebrow">ÇALIŞAN ALANI</span><h1>{staffNav.find(x => x[0] === view)?.[1]}</h1><p>{data.business.branch_name} şubesinin operasyon görünümü. Değişiklik yetkisi müdür/yönetici tarafındadır.</p></div>{['appointments', 'calendar'].includes(view) && <Input aria-label="İş günü" type="date" value={date} onChange={e => refreshForDate(e.target.value)} className="date-input" />}</div>{error && <p className="error-message">{error}</p>}{busy && <div className="loading-row"><Busy />Güncelleniyor…</div>}
      {view === 'appointments' && (!data.appointments.length ? <Blank title="Randevu yok" description="Bu şube için seçili günde randevu bulunmuyor." /> : <div className="team-job-grid">{data.appointments.map((a: any) => <article className="panel team-job" key={a.id}><div className="section-heading"><strong className="team-job-time">{time(a.minute)} <span>– {time(a.minute + a.duration)}</span></strong><span className={'badge ' + a.status}>{STATUS[a.status]}</span></div><div className="team-job-customer"><UserRound size={19} /><strong>{a.customer_name}</strong><span>{a.customer_phone}</span></div><div className="team-job-service"><Scissors size={23} /><div><h2>{a.service_name}</h2><p>{a.staff_name} · {a.duration} dakika</p></div></div>{a.staff_id === data.business.staff_id && a.status === 'confirmed' && <div className="team-job-footer"><button className="button primary" disabled={!!jobBusy} onClick={() => finish(a, 'completed')}>{jobBusy === a.id ? <Busy /> : <Check size={16} />}İşlem tamamlandı</button><button className="text-button danger" disabled={!!jobBusy} onClick={() => setNoShow(a)}>Gelmedi</button></div>}</article>)}</div>)}
      {view === 'calendar' && <div className="collection-list">{data.appointments.map((a: any) => <div className="collection-row" key={a.id}><strong>{time(a.minute)} · {a.customer_name}</strong><span>{a.service_name} · {a.staff_name}</span></div>)}{!data.appointments.length && <Blank title="Takvim boş" description="Seçili gün için kayıt yok." />}</div>}
      {view === 'customers' && <div className="collection-list">{data.customers.map((c: any) => <div className="collection-row" key={c.id}><div><strong>{c.name}</strong><small>{c.phone}{c.email ? ` · ${c.email}` : ''}</small></div><small>Son ziyaret: {c.last_visit || '—'}</small></div>)}</div>}
      {view === 'services' && <div className="collection-list">{data.services.map((s: any) => <div className="collection-row" key={s.id}><div><strong>{s.name}</strong><small>{s.description || 'Açıklama yok'}</small></div><span>{s.duration} dk · {money(s.price)}</span></div>)}</div>}
      {view === 'staff' && <div className="collection-list">{data.staff.map((s: any) => <div className="collection-row" key={s.id}><strong>{s.name}</strong><span>{s.title}</span></div>)}</div>}
      {view === 'journeys' && (!data.journeys.length ? <Blank title="Hizmet yolculuğu yok" description="Bu şubedeki müşterilere bağlı aktif bir yolculuk bulunmuyor veya paketinizde özellik kapalı." /> : <div className="collection-list">{data.journeys.map((j: any) => <div className="panel" style={{ padding: 16 }} key={j.id}><strong>{j.customer_name} · {j.title}</strong><p className="muted">Durum: {j.status}</p>{data.journey_steps.filter((s: any) => s.journey_id === j.id).map((s: any) => <div key={s.id}>• {s.completed_at ? '✓ ' : ''}{s.title}</div>)}</div>)}</div>)}
      {view === 'whatsapp' && <section className="panel"><h2><MessageSquare size={20} /> WhatsApp</h2>{!data.whatsapp.enabled ? <p>Bu işletmenin paketinde WhatsApp modülü aktif değil.</p> : <><p><b>Bağlantı:</b> {data.whatsapp.connected ? 'Aktif' : 'Hazır değil'}{data.whatsapp.number ? ` · ${data.whatsapp.number}` : ''}</p><p className="muted">Çalışan yalnızca kendi şubesine ait WhatsApp kaynaklı randevuları görür; entegrasyon ayarlarını değiştiremez.</p><div className="collection-list">{data.whatsapp.appointments.map((a: any) => <div className="collection-row" key={a.id}><strong>{a.date} {time(a.minute)} · {a.customer_name}</strong><span>{a.status}</span></div>)}</div></>}</section>}
      <Confirm open={!!noShow} onClose={() => setNoShow(null)} title="Müşteri gelmedi mi?" description="Yalnızca size atanmış randevu gelmedi olarak işaretlenecek." onConfirm={() => noShow && finish(noShow, 'no_show')} />
    </section>
  </div>;
}
