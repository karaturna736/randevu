"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, PhoneCall, Radio, MessageCircle, BarChart3 } from "lucide-react";
import { api } from "@/components/product/common";

const defaults = {
  inbound_number: "",
  provider: "demo",
  greeting: "Merhaba. Bilgi almak için 1’e, randevu almak için 2’ye basın.",
  info_transfer_number: "",
  timeout_seconds: 15,
  appointment_message: "Randevu bağlantınız WhatsApp üzerinden gönderilecektir.",
};

export default function PhoneOperatorPage() {
  const [tenant, setTenant] = useState("");
  const [data, setData] = useState<any>(null);
  const [form, setForm] = useState<any>(defaults);
  const [caller, setCaller] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load(id = tenant) {
    const next = await api("phone-operator?tenant=" + encodeURIComponent(id));
    setData(next);
    setForm({ ...defaults, ...next.settings });
  }
  useEffect(() => {
    api("workspace").then((w: any) => {
      const id = w.business?.id || "";
      if (!id) throw new Error("Önce işletmenizi açın.");
      setTenant(id);
      return load(id);
    }).catch((e: Error) => setError(e.message));
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(""); setMessage("");
    try { await api("phone-operator", { tenant_id: tenant, ...form, timeout_seconds: Number(form.timeout_seconds) }); await load(); setMessage("Telefon operatörü ayarları kaydedildi."); }
    catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }
  async function simulate(digit: "1" | "2" | "timeout") {
    setBusy(true); setError(""); setMessage("");
    try { const result = await api("phone-operator", { tenant_id: tenant, action: "simulate", digit, caller_phone: caller, duration_seconds: 8 }); setMessage(result.message + (result.appointment_link ? ` ${result.appointment_link}` : "")); await load(); }
    catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }
  const set = (key: string, value: any) => setForm((current: any) => ({ ...current, [key]: value }));

  return <main style={{ maxWidth: 1000, margin: "40px auto 80px", padding: "0 22px" }}>
    <Link href="/panel/ek-paketler" className="text-button"><ArrowLeft size={16} /> Ek paketlere dön</Link>
    <header className="member-heading" style={{ marginTop: 26 }}><div><span className="eyebrow">EK PAKET / TELEFON</span><h1>Akıllı telefon operatörü</h1><p>Arayan müşteriyi randevuya veya işletme hattına yönlendirin.</p></div></header>
    {error && <p role="alert" className="error-message">{error}</p>}{message && <p role="status" className="notice"><CheckCircle2 size={16} /> {message}</p>}
    {data && <>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 20, alignItems: "start" }}>
        <form className="panel form-stack" style={{ padding: 22 }} onSubmit={save}>
          <h2><PhoneCall size={19} /> Operatör ayarları</h2>
          <label className="field"><span>Bağlanacak mevcut numara</span><input value={form.inbound_number} onChange={e => set("inbound_number", e.target.value)} placeholder="0850 veya işletme numarası" /></label>
          <label className="field"><span>Karşılama metni</span><textarea rows={3} value={form.greeting} onChange={e => set("greeting", e.target.value)} /></label>
          <label className="field"><span>1’e basınca aktarılacak işletme hattı</span><input value={form.info_transfer_number} onChange={e => set("info_transfer_number", e.target.value)} placeholder="Mevcut GSM veya sabit numara" /></label>
          <label className="field"><span>Seçim bekleme süresi: {form.timeout_seconds} saniye</span><input type="range" min="5" max="60" value={form.timeout_seconds} onChange={e => set("timeout_seconds", e.target.value)} /></label>
          <label className="field"><span>2’ye basınca gönderilecek mesaj</span><textarea rows={2} value={form.appointment_message} onChange={e => set("appointment_message", e.target.value)} /></label>
          <button className="button primary" disabled={busy}>Ayarları kaydet</button>
        </form>
        <section className="panel form-stack" style={{ padding: 22 }}>
          <h2><Radio size={19} /> Demo çağrı akışı</h2>
          <p className="muted">Gerçek sağlayıcı bağlanmadan menüyü burada deneyin.</p>
          <label className="field"><span>Arayan numarası</span><input value={caller} onChange={e => setCaller(e.target.value)} placeholder="0555 000 00 00" /></label>
          <div style={{ display: "grid", gap: 9 }}><button className="button" disabled={busy} onClick={() => simulate("1")}><PhoneCall size={16} /> 1 · Bilgi için işletmeye aktar</button><button className="button" disabled={busy} onClick={() => simulate("2")}><MessageCircle size={16} /> 2 · WhatsApp randevu bağlantısı</button><button className="button" disabled={busy} onClick={() => simulate("timeout")}>Seçim yok · Çağrıyı kapat</button></div>
          <p className="muted" style={{ fontSize: 12 }}>Demo bağlantısı: {data.demo.appointment_link}</p>
        </section>
      </div>
      <section className="panel" style={{ marginTop: 20, padding: 22 }}><div className="section-heading"><h2><BarChart3 size={19} /> Çağrı özeti</h2><span className="badge confirmed">{data.demo.provider_status}</span></div><div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 12, margin: "18px 0" }}><div className="panel" style={{ padding: 14 }}><small>Toplam çağrı</small><strong style={{ display: "block", fontSize: 23 }}>{data.totals.calls}</strong></div><div className="panel" style={{ padding: 14 }}><small>Bilgi talebi</small><strong style={{ display: "block", fontSize: 23 }}>{data.totals.info_requests}</strong></div><div className="panel" style={{ padding: 14 }}><small>Randevu talebi</small><strong style={{ display: "block", fontSize: 23 }}>{data.totals.appointment_requests}</strong></div></div>{data.calls.length ? <div className="collection-list">{data.calls.slice(0, 20).map((c: any) => <div className="collection-row" key={c.id}><strong>{c.digit === "1" ? "Bilgi" : c.digit === "2" ? "Randevu" : "Süre doldu"}</strong><span>{c.caller_phone || "Numara yok"} · {c.duration_seconds} sn</span></div>)}</div> : <p className="muted">Henüz çağrı kaydı yok.</p>}</section>
    </>}
  </main>;
}
