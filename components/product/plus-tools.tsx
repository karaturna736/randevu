"use client";
import { useCallback, useEffect, useState } from "react";
import { Globe2, KeyRound, Network, Copy, ExternalLink, Save, Trash2, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { api, Busy, Field } from "./common";

export function PlusTools({ w }: any) {
  const tenantId = w.business.id;
  const [data, setData] = useState<any>(null), [error, setError] = useState(""), [busy, setBusy] = useState("");
  const [site, setSite] = useState<any>(null), [automation, setAutomation] = useState<any>(null);
  const [keyName, setKeyName] = useState("Entegrasyon"), [newKey, setNewKey] = useState("");
  const refresh = useCallback(async () => {
    setError("");
    try {
      const d = await api(`plus-tools?tenant=${tenantId}`);
      setData(d); setSite(d.website); setAutomation(d.branch_automation);
    } catch (e: any) { setError(e.message); }
  }, [tenantId]);
  useEffect(() => { refresh(); }, [refresh]);

  async function saveWebsite(e: any) {
    e.preventDefault(); setBusy("website"); setError("");
    try { await api("plus-tools", { tenant_id: tenantId, action: "website", ...site }); await refresh(); }
    catch (e: any) { setError(e.message); } finally { setBusy(""); }
  }
  async function saveAutomation(e: any) {
    e.preventDefault(); setBusy("automation"); setError("");
    try { await api("plus-tools", { tenant_id: tenantId, action: "branch-automation", ...automation }); await refresh(); }
    catch (e: any) { setError(e.message); } finally { setBusy(""); }
  }
  async function createKey(e: any) {
    e.preventDefault(); setBusy("key"); setError(""); setNewKey("");
    try {
      const r = await api("plus-tools", { tenant_id: tenantId, action: "create-api-key", name: keyName });
      setNewKey(r.key); await refresh();
    } catch (e: any) { setError(e.message); } finally { setBusy(""); }
  }
  async function revokeKey(id: string) {
    if (!confirm("Bu API anahtarını iptal etmek istiyor musunuz? Bu işlem geri alınamaz.")) return;
    setBusy(id); setError("");
    try { await api("plus-tools", { tenant_id: tenantId, action: "revoke-api-key", id }); await refresh(); }
    catch (e: any) { setError(e.message); } finally { setBusy(""); }
  }
  async function copyKey() {
    if (newKey) await navigator.clipboard.writeText(newKey);
  }

  if (!data || !site || !automation) return <div className="panel form-stack"><Busy /><span>Plus araçları hazırlanıyor…</span>{error && <p className="error">{error}</p>}</div>;
  const keys = data.management_api?.keys || [];
  return <div className="operations-stack">
    <div className="section-heading"><div><span className="eyebrow">NETA PLUS</span><h2>Web sitesi, Yönetim API’si ve şube otomasyonu</h2><p className="muted">Plus’a özel üç altyapıyı tek yerden yönetin.</p></div></div>
    {error && <div className="panel"><p className="error">{error}</p></div>}

    <form className="panel form-stack" onSubmit={saveWebsite}>
      <div className="section-heading"><div><h2><Globe2 size={20}/> İşletme web sitesi</h2><p>Mevcut randevu sayfanızı markanıza göre düzenleyin; başlık, açıklama, iletişim ve SEO alanlarını yönetin.</p></div><a className="button" href={site.page_path} target="_blank" rel="noreferrer">Önizle <ExternalLink size={16}/></a></div>
      <div className="growth-grid">
        <Field label="Üst etiket"><Input maxLength={80} value={site.eyebrow || ""} onChange={e=>setSite({...site,eyebrow:e.target.value})}/></Field>
        <Field label="Ana başlık"><Input maxLength={120} value={site.hero_title || ""} onChange={e=>setSite({...site,hero_title:e.target.value})}/></Field>
      </div>
      <Field label="Ana açıklama"><Textarea maxLength={500} value={site.hero_text || ""} onChange={e=>setSite({...site,hero_text:e.target.value})}/></Field>
      <Field label="Hakkımızda"><Textarea maxLength={1200} value={site.about_text || ""} onChange={e=>setSite({...site,about_text:e.target.value})}/></Field>
      <div className="growth-grid">
        <Field label="İletişim telefonu"><Input maxLength={40} value={site.contact_phone || ""} onChange={e=>setSite({...site,contact_phone:e.target.value})}/></Field>
        <Field label="Instagram bağlantısı"><Input type="url" maxLength={300} placeholder="https://instagram.com/..." value={site.instagram_url || ""} onChange={e=>setSite({...site,instagram_url:e.target.value})}/></Field>
        <Field label="SEO başlığı"><Input maxLength={70} value={site.seo_title || ""} onChange={e=>setSite({...site,seo_title:e.target.value})}/></Field>
        <Field label="SEO açıklaması"><Input maxLength={170} value={site.seo_description || ""} onChange={e=>setSite({...site,seo_description:e.target.value})}/></Field>
      </div>
      <div className="setting-switch-row"><div><strong>Yorumları göster</strong><p>Yayınlanmış müşteri yorumları web sayfasında görünsün.</p></div><Switch checked={!!site.show_reviews} onCheckedChange={v=>setSite({...site,show_reviews:v})}/></div>
      <button className="button primary" disabled={busy==="website"}>{busy==="website"?<Busy/>:<Save size={17}/>} Web sitesini kaydet</button>
    </form>

    <section className="panel form-stack">
      <div className="section-heading"><div><h2><KeyRound size={20}/> Yönetim API’si</h2><p>ERP, CRM, muhasebe veya kendi otomasyonunuz Neta’daki işletme, şube, hizmet, personel, müsaitlik ve randevularla güvenli biçimde çalışabilir.</p></div></div>
      <form className="growth-grid" onSubmit={createKey}>
        <Field label="Anahtar adı"><Input minLength={2} maxLength={60} required value={keyName} onChange={e=>setKeyName(e.target.value)}/></Field>
        <div className="field"><span>&nbsp;</span><button className="button primary" disabled={busy==="key"}>{busy==="key"?<Busy/>:<Plus size={17}/>} API anahtarı oluştur</button></div>
      </form>
      {newKey && <div className="notice success"><strong>Yeni anahtarınız — yalnızca şimdi gösteriliyor</strong><code style={{wordBreak:"break-all"}}>{newKey}</code><button type="button" className="button" onClick={copyKey}><Copy size={16}/> Kopyala</button><small>Bu anahtarı sohbetlere, ekran görüntülerine veya herkese açık kodlara koymayın.</small></div>}
      <div className="table-wrap"><table><thead><tr><th>Ad</th><th>Anahtar</th><th>Oluşturuldu</th><th>Son kullanım</th><th>Durum</th><th></th></tr></thead><tbody>{keys.map((k:any)=><tr key={k.id}><td>{k.name}</td><td><code>{k.key_prefix}…</code></td><td>{String(k.created_at||"").slice(0,16).replace("T"," ")}</td><td>{k.last_used_at?String(k.last_used_at).slice(0,16).replace("T"," "):"—"}</td><td>{k.revoked_at?"İptal":"Aktif"}</td><td>{!k.revoked_at&&<button type="button" className="button" onClick={()=>revokeKey(k.id)} disabled={busy===k.id}>{busy===k.id?<Busy/>:<Trash2 size={15}/>} İptal</button>}</td></tr>)}</tbody></table></div>
      <p className="helper">API kökü: <code>{data.management_api.base_path}</code>. Anahtarlar veritabanında düz metin olarak saklanmaz; iptal edilen anahtar tekrar kullanılamaz.</p>
    </section>

    <form className="panel form-stack" onSubmit={saveAutomation}>
      <div className="section-heading"><div><h2><Network size={20}/> Şubeler arası otomasyon</h2><p>Müşterinin seçtiği şubede boş saat yoksa Neta diğer aktif şubeleri otomatik tarar ve uygun alternatifleri gösterir.</p></div></div>
      <div className="setting-switch-row"><div><strong>Otomatik alternatif şube bul</strong><p>Seçilen şube doluysa müşteriye diğer şubelerdeki uygun saatleri öner.</p></div><Switch checked={!!automation.fallback_enabled} onCheckedChange={v=>setAutomation({...automation,fallback_enabled:v})}/></div>
      <Field label="Gösterilecek en fazla alternatif şube"><Input type="number" min={1} max={5} value={automation.max_alternatives} onChange={e=>setAutomation({...automation,max_alternatives:Number(e.target.value)})}/></Field>
      <button className="button primary" disabled={busy==="automation"}>{busy==="automation"?<Busy/>:<Save size={17}/>} Otomasyonu kaydet</button>
    </form>
  </div>;
}
