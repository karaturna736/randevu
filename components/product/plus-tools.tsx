"use client";
import { useEffect, useState } from "react";
import { Copy, ExternalLink, KeyRound, Plus, RefreshCw, Route, Trash2, Globe2 } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { api, Busy, Field, Pick } from "./common";

export function PlusBusinessTools({ w }: any) {
  const tenant = w.business.id;
  const [data, setData] = useState<any>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [token, setToken] = useState("");
  async function refresh() {
    setError("");
    try {
      setData(await api("plus-tools?tenant=" + encodeURIComponent(tenant)));
    } catch (e: any) {
      setError(e.message);
    }
  }
  useEffect(() => {
    void refresh();
  }, [tenant]);
  async function act(body: any) {
    setBusy(true);
    setError("");
    try {
      const r = await api("plus-tools?tenant=" + encodeURIComponent(tenant), body);
      if (r.token) setToken(r.token);
      await refresh();
      toast.success("Kaydedildi.");
      return r;
    } catch (e: any) {
      setError(e.message);
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }
  if (!data && !error) return <Busy />;
  if (!data) return <p className="error-message">{error}</p>;
  return (
    <div className="form-stack">
      {error && <p className="error-message">{error}</p>}
      <WebsitePanel data={data} busy={busy} act={act} />
      <ApiPanel data={data} busy={busy} token={token} setToken={setToken} act={act} />
      <AutomationPanel data={data} busy={busy} act={act} />
    </div>
  );
}

function WebsitePanel({ data, busy, act }: any) {
  const [form, setForm] = useState<any>(data.website);
  useEffect(() => setForm(data.website), [data.website?.updated_at]);
  return (
    <section className="panel form-stack">
      <div className="section-heading">
        <div><span className="eyebrow">PLUS · İŞLETME WEB SİTESİ</span><h2>Markanıza ait randevu vitrini</h2></div>
        <Globe2 />
      </div>
      <p className="muted">İşletme sayfanızda başlık, tanıtım, telefon, Instagram ve kapak görselini yönetin. Yayına aldığınız içerik doğrudan /{data.business.slug} sayfasında görünür.</p>
      <Field label="Ana başlık"><Input value={form.headline || ""} onChange={(e) => setForm({ ...form, headline: e.target.value })} placeholder={data.business.name} /></Field>
      <Field label="Kısa tanıtım"><Textarea value={form.intro || ""} onChange={(e) => setForm({ ...form, intro: e.target.value })} placeholder="İşletmenizi ve farkınızı anlatın." /></Field>
      <div className="form-grid two">
        <Field label="Telefon"><Input value={form.contact_phone || ""} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} /></Field>
        <Field label="Instagram bağlantısı"><Input value={form.instagram_url || ""} onChange={(e) => setForm({ ...form, instagram_url: e.target.value })} placeholder="https://instagram.com/..." /></Field>
      </div>
      <Field label="Kapak görseli URL"><Input value={form.cover_url || ""} onChange={(e) => setForm({ ...form, cover_url: e.target.value })} placeholder="https://..." /></Field>
      <label className="switch-row"><span><strong>Web sitesini yayınla</strong><small>Müşterileriniz işletme sayfanızda bu vitrini görsün.</small></span><Switch checked={!!form.published} onCheckedChange={(v) => setForm({ ...form, published: v })} /></label>
      <div className="button-group">
        <button className="button primary" disabled={busy} onClick={() => act({ action: "save-website", ...form })}>Kaydet ve uygula</button>
        <a className="button" href={"/" + data.business.slug} target="_blank" rel="noopener noreferrer"><ExternalLink size={16} />Sayfayı aç</a>
      </div>
    </section>
  );
}

function ApiPanel({ data, busy, token, setToken, act }: any) {
  const [name, setName] = useState("Ana entegrasyon");
  return (
    <section className="panel form-stack">
      <div className="section-heading"><div><span className="eyebrow">PLUS · YÖNETİM API'Sİ</span><h2>Dış sistemleri Neta'ya bağlayın</h2></div><KeyRound /></div>
      <p className="muted">Bearer API anahtarıyla işletme, müşteri ve randevu verilerini okuyabilir; dış sistemden yeni randevu oluşturabilirsiniz.</p>
      <div className="form-grid two"><Field label="Anahtar adı"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field><div className="field"><span>&nbsp;</span><button className="button primary" disabled={busy || name.trim().length < 2} onClick={() => act({ action: "create-api-key", name })}><Plus size={16} />Yeni API anahtarı</button></div></div>
      {token && <div className="notice form-stack"><strong>Yeni anahtarınız yalnızca şimdi gösteriliyor.</strong><code style={{overflowWrap:"anywhere"}}>{token}</code><button className="button" onClick={async () => { await navigator.clipboard.writeText(token); toast.success("API anahtarı kopyalandı."); }}><Copy size={15} />Kopyala</button><button className="text-button" onClick={() => setToken("")}>Gizle</button></div>}
      <div className="form-stack">
        {data.api_keys.map((k: any) => <div className="summary-strip" key={k.id}><KeyRound size={18} /><div><strong>{k.name}</strong><small>{k.prefix}… · {k.last_used_at ? "Son kullanım: " + k.last_used_at : "Henüz kullanılmadı"}</small></div>{k.revoked_at ? <span className="badge">İptal</span> : <button className="icon-button" aria-label="API anahtarını iptal et" disabled={busy} onClick={() => act({ action: "revoke-api-key", id: k.id })}><Trash2 size={15} /></button>}</div>)}
      </div>
      <div className="notice"><strong>Uç noktalar</strong><span>GET /api/management/v1/business · GET /appointments · GET /customers · POST /appointments</span></div>
    </section>
  );
}

function AutomationPanel({ data, busy, act }: any) {
  const branches = data.branches || [];
  const [source, setSource] = useState(branches[0]?.id || ""),
    [target, setTarget] = useState(branches[1]?.id || "");
  useEffect(() => { if (!source && branches[0]) setSource(branches[0].id); if (!target && branches[1]) setTarget(branches[1].id); }, [branches.length]);
  return (
    <section className="panel form-stack">
      <div className="section-heading"><div><span className="eyebrow">PLUS · ŞUBELER ARASI OTOMASYON</span><h2>Boş saat kaybolmasın</h2></div><Route /></div>
      <p className="muted">Bir şubede seçilen gün için boş saat kalmazsa, belirlediğiniz hedef şubenin uygun saatleri müşteriye otomatik alternatif olarak gösterilir.</p>
      {branches.length < 2 ? <div className="notice">Otomasyon için en az iki aktif şube gerekir.</div> : <>
        <div className="form-grid two"><Pick label="Dolarsa bu şube" value={source} onChange={setSource} options={branches.map((b:any)=>({value:b.id,label:b.name}))}/><Pick label="Şuraya yönlendir" value={target} onChange={setTarget} options={branches.map((b:any)=>({value:b.id,label:b.name}))}/></div>
        <button className="button primary" disabled={busy || !source || !target || source===target} onClick={()=>act({action:"save-overflow",source_branch_id:source,target_branch_id:target,enabled:true})}><RefreshCw size={16}/>Otomasyonu etkinleştir</button>
      </>}
      <div className="form-stack">{data.automations.map((a:any)=><div className="summary-strip" key={a.id}><Route size={18}/><div><strong>{a.source_branch_name} → {a.target_branch_name}</strong><small>{a.enabled ? "Aktif · boş saat kalmadığında otomatik önerir" : "Pasif"}</small></div><button className="icon-button" aria-label="Otomasyonu sil" disabled={busy} onClick={()=>act({action:"delete-overflow",id:a.id})}><Trash2 size={15}/></button></div>)}</div>
    </section>
  );
}
