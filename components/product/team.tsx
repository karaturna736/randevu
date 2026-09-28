'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { CalendarDays, CalendarRange, Check, UserRound, Scissors, ShieldCheck, UserPlus, Trash2, ArrowRight, Users, Route, MessageSquare, LockKeyhole, Copy, ExternalLink, Phone } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { api, Field, Pick, Busy, Blank, Confirm } from './common';
import { PublicShell } from './public';
import { AccountGate } from './session';
import { today, time, STATUS, money } from '@/lib/types';

export function TeamAccessPanel({ w }: any) {
  const [rows, setRows] = useState<any[]>([]), [passwordEnabled, setPasswordEnabled] = useState(false), [staff, setStaff] = useState(w.staff[0]?.id || ''), [email, setEmail] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState(''), [removing, setRemoving] = useState('');
  async function refresh() { try { const result = await api('team-access?tenant=' + w.business.id); setRows(result.members); setPasswordEnabled(result.password_enabled); setError(''); } catch (e: any) { setError(e.message); } }
  useEffect(() => { if (!w.preview) refresh(); }, [w.business.id]);
  if (w.preview) return null;
  return <section className="panel team-access margin-top"><div className="section-heading"><h2><ShieldCheck size={20} /> Personelin kendi ekranı</h2><a className="text-button" href={passwordEnabled ? '/panel/mudurler' : '/panel/ek-paketler'}>{passwordEnabled ? 'Şube şifresini yönet' : 'Şifreli giriş ek paketi'} <ArrowRight size={15} /></a></div><p className="muted">Çalışan kendi hesabıyla yalnızca bağlı olduğu şubenin operasyon ekranına girer. {passwordEnabled ? 'Şifreli giriş paketi etkin; ayrıca şube şifresi gerekir.' : 'Ek şube şifresi kapalıdır.'} Yönetim ve finans erişimi yoktur.</p><form className="team-access-form" onSubmit={async e => { e.preventDefault(); setBusy(true); setError(''); try { await api('team-access', { tenant_id: w.business.id, staff_id: staff, email }); setEmail(''); await refresh(); toast.success('Çalışan erişimi tanımlandı.'); } catch (e: any) { setError(e.message); } finally { setBusy(false); } }}><Field label="Personel"><Pick label="Personel hesabı" value={staff} onChange={setStaff} options={w.staff.map((s: any) => ({ value: s.id, label: s.name }))} /></Field><Field label="Üyelik e-postası"><Input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="personel@ornek.com" /></Field><button className="button" disabled={busy || !staff}>{busy ? <Busy /> : <UserPlus size={17} />}Hesabı bağla</button></form>{error && <p className="error-message">{error}</p>}{rows.filter(r => !r.disabled).map(r => <div className="list-row" key={r.user_id}><div><strong>{w.staff.find((s: any) => s.id === r.staff_id)?.name}</strong><small>{r.email} · {r.branch_name || 'Şube yok'} · {passwordEnabled ? (r.password_configured ? 'Şifre korumalı' : 'Şifre bekliyor') : 'Kişisel hesapla giriş'}</small></div><button className="icon-button" aria-label={r.name + ' erişimini kaldır'} onClick={() => setRemoving(r.staff_id)}><Trash2 size={17} /></button></div>)}<Confirm open={!!removing} onClose={() => setRemoving('')} title="Personelin erişimi kapatılsın mı?" description="Personel kaydı ve randevuları korunur. Bağlı hesap bu işletmenin çalışan alanına erişemez." onConfirm={async () => { try { await api('team-access', { tenant_id: w.business.id, staff_id: removing, action: 'remove' }); setRemoving(''); refresh(); } catch (e: any) { toast.error(e.message); } }} /></section>;
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

function whatsappPhone(raw: string) {
  let digits = String(raw || '').replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) digits = '90' + digits.slice(1);
  else if (digits.length === 10 && digits.startsWith('5')) digits = '90' + digits;
  return digits;
}

function TeamDesk() {
  const [memberships, setMemberships] = useState<any[]>([]), [tenant, setTenant] = useState(''), [passwordRequired, setPasswordRequired] = useState(false), [password, setPassword] = useState(''), [date, setDate] = useState(today()), [data, setData] = useState<any>(null), [view, setView] = useState('appointments'), [jobScope, setJobScope] = useState<'mine' | 'branch'>('mine'), [error, setError] = useState(''), [busy, setBusy] = useState(false), [jobBusy, setJobBusy] = useState(''), [journeyBusy, setJourneyBusy] = useState(''), [noShow, setNoShow] = useState<any>(null);
  useEffect(() => { api('account').then((x: any) => { const rows = x.staff_memberships || []; setMemberships(rows); setTenant(rows[0]?.id || ''); }).catch((e: any) => setError(e.message)); }, []);
  useEffect(() => { setData(null); setPassword(''); setError(''); }, [tenant]);
  useEffect(() => { if (!tenant) return; let cancelled = false; api('team-jobs?tenant=' + encodeURIComponent(tenant)).then((x: any) => { if (cancelled) return; setPasswordRequired(x.password_required); if (!x.password_required) secureWorkspace({ tenant_id: tenant, date }).then((result: any) => { if (!cancelled) setData(result); }).catch((e: Error) => { if (!cancelled) setError(e.message); }); }).catch((e: Error) => { if (!cancelled) setError(e.message); }); return () => { cancelled = true; }; }, [tenant]);
  async function unlock(e?: FormEvent) { e?.preventDefault(); if (!tenant) return; setBusy(true); setError(''); try { setData(await secureWorkspace({ tenant_id: tenant, date, branch_password: password })); } catch (e: any) { setData(null); setError(e.message); } finally { setBusy(false); } }
  async function refreshForDate(nextDate: string) { setDate(nextDate); if (!data) return; setBusy(true); try { setData(await secureWorkspace({ tenant_id: tenant, date: nextDate, branch_password: password })); setError(''); } catch (e: any) { setData(null); setError(e.message); } finally { setBusy(false); } }
  async function finish(a: any, status: string) { setJobBusy(a.id); try { await api('team-jobs', { tenant_id: data.business.id, id: a.id, status, branch_password: password }); setNoShow(null); await unlock(); toast.success('İşlem sonucu kaydedildi.'); } catch (e: any) { toast.error(e.message); } finally { setJobBusy(''); } }
  async function advanceJourney(j: any) {
    setJourneyBusy(j.id);
    try {
      const r = await fetch('/api/team/journey', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tenant_id: data.business.id, journey_id: j.id, version: j.version, branch_password: password }) });
      const x: any = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(x.error || 'Hizmet yolculuğu güncellenemedi.');
      await unlock();
      toast.success('Hizmet yolculuğunda sıradaki aşama tamamlandı.');
    } catch (e: any) { toast.error(e.message); } finally { setJourneyBusy(''); }
  }
  function bookingUrl() { return typeof window === 'undefined' ? `/${data?.business?.slug || ''}` : `${window.location.origin}/${data?.business?.slug || ''}`; }
  async function copyBookingLink() {
    try { await navigator.clipboard.writeText(bookingUrl()); toast.success('Randevu linki kopyalandı.'); } catch { toast.error('Randevu linki kopyalanamadı.'); }
  }
  function shareBookingLink() {
    const text = encodeURIComponent(`${data.business.name} için online randevu: ${bookingUrl()}`);
    window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener,noreferrer');
  }

  if (!memberships.length && !tenant) return <section className="panel"><Blank title="Çalışan erişiminiz yok" description="İşletme sahibi, Ekip bölümünden üyelik e-postanızı bir personel kaydına bağlamalı." /></section>;
  if (!data) return <><div className="member-heading"><div><span className="eyebrow">ÇALIŞAN GİRİŞİ</span><h1>{passwordRequired ? 'Şubenizi doğrulayın.' : 'Çalışan alanı'}</h1><p>{passwordRequired ? 'Şifreli giriş paketi etkin. İşletme sahibinin belirlediği şube şifresi gerekir.' : 'Kişisel hesabınızla şubeniz açılıyor.'}</p></div></div><section className="panel form-stack" style={{ maxWidth: 520 }}><Field label="İşletme / şube"><Pick label="Çalıştığınız şube" value={tenant} onChange={setTenant} options={memberships.map((b: any) => ({ value: b.id, label: b.name }))} /></Field>{passwordRequired ? <form className="form-stack" onSubmit={unlock}><Field label="Şube erişim şifresi"><Input type="password" required minLength={8} maxLength={72} autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Şube şifresi" /></Field>{error && <p role="alert" className="error-message">{error}</p>}<button className="button primary full" disabled={busy || !tenant}>{busy ? <Busy /> : <LockKeyhole size={17} />}Çalışan panelini aç</button></form> : error ? <p role="alert" className="error-message">{error}</p> : <p>Yükleniyor…</p>}</section></>;

  const myJobs = data.appointments.filter((a: any) => a.staff_id === data.business.staff_id);
  const visibleJobs = jobScope === 'mine' ? myJobs : data.appointments;
  const [hour, minute] = new Date().toLocaleTimeString('en-GB', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit', hour12: false }).split(':').map(Number);
  const nextJob = date === today() ? myJobs.find((a: any) => a.status === 'confirmed' && a.minute + a.duration > hour * 60 + minute) : undefined;

  return <div className="team-desk">
    <aside className="panel" style={{ position: 'sticky', top: 20, padding: 12 }}><div style={{ padding: 10 }}><strong>{data.business.name}</strong><small style={{ display: 'block' }}>{data.business.branch_name} · {data.business.staff_name}</small></div><div className="form-stack" style={{ gap: 4 }}>{staffNav.map(([id, label, Icon]) => <button key={id} className={'button ' + (view === id ? 'primary' : '')} style={{ justifyContent: 'flex-start' }} onClick={() => setView(id)}><Icon size={17} />{label}{id === 'appointments' && <span style={{ marginLeft: 'auto' }}>{data.appointments.length}</span>}</button>)}</div><hr /><small>Günlük operasyon işlemleri açıktır. Ayarlar, finans ve yönetim değişiklikleri çalışan hesabında kapalıdır.</small>{passwordRequired && <button className="text-button" onClick={() => { setData(null); setPassword(''); }}>Şubeyi kilitle</button>}</aside>
