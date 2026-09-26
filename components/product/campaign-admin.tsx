"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  CalendarRange,
  Check,
  Edit3,
  Megaphone,
  Pause,
  Plus,
  Search,
  Trash2,
  UserRound,
  Users,
  WalletCards,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PublicShell } from "./public";
import { api, Blank, Busy, Confirm, Field, Modal } from "./common";
import { money } from "@/lib/types";

const planLabels: Record<string, string> = {
  normal: "Starter",
  pro: "Business",
  plus: "Kurumsal",
};
const targetLabels: Record<string, string> = {
  all: "Bütün işletmeler",
  new: "Yeni işletmeler",
  selected: "Seçili işletmeler",
  selected_users: "Seçili kayıtlı kişiler",
  plan: "Belirli paketler",
};

type Campaign = {
  id: string;
  name: string;
  code: string;
  description: string;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  target_type: string;
  applicable_plans: string[];
  starts_at: string;
  ends_at: string;
  total_usage_limit: number | null;
  per_business_limit: number | null;
  first_payment_only: number;
  recurring_enabled: number;
  active: number;
  deleted_at?: string | null;
  usage_count: number;
  acquired_businesses: number;
  total_discount: number;
  net_revenue: number;
  failed_attempts: number;
  selected_businesses?: number;
  selected_users?: number;
  top_plan?: string | null;
};
type Business = {
  id: string;
  name: string;
  owner_name: string;
  owner_email: string;
  current_plan: string;
  subscription_status: string;
  branch_count: number;
};
type RegisteredUser = {
  user_id: string;
  name: string;
  email: string;
  phone?: string;
  city?: string;
  account_type: string;
  disabled: number;
  marketing_consent?: number;
  created_at?: string;
  business_count: number;
  business_names?: string;
  business_plans?: string;
};
type Assignment = { campaign_id: string; business_id: string };
type UserAssignment = { campaign_id: string; user_id: string };
type Redemption = {
  id: string;
  business_name?: string;
  user_name?: string;
  user_email?: string;
  campaign_name: string;
  campaign_code: string;
  original_amount: number;
  discount_amount: number;
  final_amount: number;
  status: string;
  created_at: string;
};
type CampaignData = {
  campaigns: Campaign[];
  businesses: Business[];
  users: RegisteredUser[];
  assignments: Assignment[];
  user_assignments: UserAssignment[];
  redemptions: Redemption[];
  daily: Array<{ day: string; uses: number; discount: number; revenue: number }>;
};
type CampaignAction = {
  action: "toggle" | "delete";
  id: string;
  active?: boolean;
  title?: string;
};

const messageOf = (error: unknown) =>
  error instanceof Error ? error.message : "İşlem tamamlanamadı.";
const localDate = (date: Date) =>
  new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
const emptyForm = () => ({
  id: "",
  name: "",
  code: "",
  description: "",
  discount_type: "percentage",
  discount_value: "10",
  target_type: "all",
  applicable_plans: ["normal", "pro", "plus"],
  starts_at: localDate(new Date()),
  ends_at: localDate(new Date(Date.now() + 30 * 86400000)),
  total_usage_limit: "",
  per_business_limit: "1",
  first_payment_only: true,
  recurring_enabled: false,
  active: true,
  business_ids: [] as string[],
  user_ids: [] as string[],
});

function statusOf(campaign: Campaign) {
  const current = Date.now();
  if (campaign.deleted_at || !campaign.active)
    return { label: "Pasif", tone: "secondary" as const };
  if (new Date(campaign.starts_at).getTime() > current)
    return { label: "Planlandı", tone: "outline" as const };
  if (new Date(campaign.ends_at).getTime() < current)
    return { label: "Süresi doldu", tone: "destructive" as const };
  if (
    campaign.total_usage_limit &&
    campaign.usage_count >= campaign.total_usage_limit
  )
    return { label: "Limit doldu", tone: "destructive" as const };
  return { label: "Aktif", tone: "default" as const };
}

export default function CampaignAdmin() {
  const [data, setData] = useState<CampaignData | null>(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState<ReturnType<typeof emptyForm> | null>(null);
  const [busy, setBusy] = useState(false);
  const [businessSearch, setBusinessSearch] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [planFilter, setPlanFilter] = useState("all");
  const [confirm, setConfirm] = useState<CampaignAction | null>(null);
  const [prefillHandled, setPrefillHandled] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await api("campaigns"));
      setError("");
    } catch (error: unknown) {
      setError(messageOf(error));
    }
  }, []);
  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  useEffect(() => {
    if (!data || prefillHandled) return;
    setPrefillHandled(true);
    const userId = new URLSearchParams(location.search).get("user");
    if (!userId) return;
    const person = data.users.find((item) => item.user_id === userId);
    if (!person) return;
    const next = emptyForm();
    next.name = `Özel teklif · ${person.name}`;
    next.code = `OZEL-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    next.description = `${person.name} hesabına özel indirim.`;
    next.target_type = "selected_users";
    next.user_ids = [person.user_id];
    setForm(next);
    history.replaceState(null, "", location.pathname);
  }, [data, prefillHandled]);

  const businesses = useMemo(() => {
    if (!data) return [];
    const term = businessSearch.toLocaleLowerCase("tr-TR");
    return data.businesses.filter(
      (business) =>
        (planFilter === "all" || business.current_plan === planFilter) &&
        [business.name, business.owner_name, business.owner_email]
          .join(" ")
          .toLocaleLowerCase("tr-TR")
          .includes(term),
    );
  }, [data, businessSearch, planFilter]);

  const users = useMemo(() => {
    if (!data) return [];
    const term = userSearch.toLocaleLowerCase("tr-TR");
    return data.users.filter((person) =>
      [
        person.name,
        person.email,
        person.phone || "",
        person.city || "",
        person.business_names || "",
      ]
        .join(" ")
        .toLocaleLowerCase("tr-TR")
        .includes(term),
    );
  }, [data, userSearch]);

  const edit = (campaign: Campaign) => {
    if (!data) return;
    setForm({
      ...campaign,
      discount_value: String(campaign.discount_value / 100),
      starts_at: localDate(new Date(campaign.starts_at)),
      ends_at: localDate(new Date(campaign.ends_at)),
      total_usage_limit: campaign.total_usage_limit
        ? String(campaign.total_usage_limit)
        : "",
      per_business_limit: campaign.per_business_limit
        ? String(campaign.per_business_limit)
        : "",
      first_payment_only: !!campaign.first_payment_only,
      recurring_enabled: !!campaign.recurring_enabled,
      active: !!campaign.active,
      business_ids: data.assignments
        .filter((item) => item.campaign_id === campaign.id)
        .map((item) => item.business_id),
      user_ids: data.user_assignments
        .filter((item) => item.campaign_id === campaign.id)
        .map((item) => item.user_id),
    });
  };

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!form) return;
    setBusy(true);
    try {
      await api("campaigns", {
        ...form,
        action: form.id ? "update" : "create",
        code: form.code.toUpperCase(),
        discount_value: Math.round(Number(form.discount_value) * 100),
        starts_at: new Date(form.starts_at).toISOString(),
        ends_at: new Date(form.ends_at).toISOString(),
        total_usage_limit: form.total_usage_limit
          ? Number(form.total_usage_limit)
          : null,
        per_business_limit: form.per_business_limit
          ? Number(form.per_business_limit)
          : null,
      });
      toast.success(form.id ? "Kampanya güncellendi." : "Kampanya oluşturuldu.");
      setForm(null);
      await load();
    } catch (error: unknown) {
      toast.error(messageOf(error));
    } finally {
      setBusy(false);
    }
  }

  async function act(action: CampaignAction) {
    setBusy(true);
    try {
      await api("campaigns", action);
      toast.success("Kampanya durumu güncellendi.");
      setConfirm(null);
      await load();
    } catch (error: unknown) {
      toast.error(messageOf(error));
    } finally {
      setBusy(false);
    }
  }

  const totals =
    data?.campaigns.reduce(
      (sum, campaign) => ({
        uses: sum.uses + campaign.usage_count,
        discount: sum.discount + campaign.total_discount,
        revenue: sum.revenue + campaign.net_revenue,
        acquired: sum.acquired + campaign.acquired_businesses,
      }),
      { uses: 0, discount: 0, revenue: 0, acquired: 0 },
    ) || { uses: 0, discount: 0, revenue: 0, acquired: 0 };
  const daily = data ? [...data.daily].reverse().slice(-14) : [];
  const maxDaily = Math.max(1, ...daily.map((item) => item.uses));

  return (
    <PublicShell>
      <main className="admin-page campaign-page">
        <div className="page-heading campaign-heading">
          <div>
            <span className="eyebrow">PLATFORM YÖNETİMİ · KAMPANYALAR</span>
            <h1>İndirimi doğru kişiye verin.</h1>
            <p>
              Genel kampanya, seçili işletme veya yalnızca belirlediğiniz kayıtlı
              hesaplara özel teklif oluşturun; kullanım ve net geliri izleyin.
            </p>
          </div>
          <div className="button-group">
            <Link className="button" href="/admin">
              Ana yönetim
            </Link>
            <button className="button primary" onClick={() => setForm(emptyForm())}>
              <Plus size={17} /> Yeni kampanya
            </button>
          </div>
        </div>

        {error ? (
          <section className="panel">
            <Blank title="Kampanyalar açılamadı" description={error} />
            <button className="button" onClick={load}>Tekrar dene</button>
          </section>
        ) : !data ? (
          <div className="loading-row"><Busy /> Kampanyalar hazırlanıyor…</div>
        ) : (
          <>
            <div className="stats-grid campaign-stats">
              {([
                ["Toplam kullanım", totals.uses, Megaphone],
                ["Kazanılan hesap", totals.acquired, Users],
                ["Toplam indirim", money(totals.discount), WalletCards],
                ["Net gelir", money(totals.revenue), BarChart3],
              ] satisfies Array<[string, string | number, LucideIcon]>).map(([label, value, Icon]) => (
                <section className="stat-card" key={label}>
                  <div className="stat-top">{label}<Icon size={19} /></div>
                  <strong className="stat-value">{value}</strong>
                </section>
              ))}
            </div>

            <section className="panel campaign-list-panel">
              <div className="panel-header">
                <div>
                  <h2>Kampanyalar</h2>
                  <p className="muted">Silinen kampanyaların finansal kullanım geçmişi korunur.</p>
                </div>
                <span className="badge neutral">{data.campaigns.length} kampanya</span>
              </div>
              {!data.campaigns.length ? (
                <Blank title="Henüz kampanya yok" description="İlk kampanyanızı hedef ve kullanım limitleriyle oluşturun." />
              ) : (
                <div className="campaign-card-grid">
                  {data.campaigns.map((campaign) => {
                    const state = statusOf(campaign);
                    return (
                      <article className="campaign-card" key={campaign.id}>
                        <div className="campaign-card-top">
                          <div><code>{campaign.code}</code><h3>{campaign.name}</h3></div>
                          <Badge variant={state.tone}>{state.label}</Badge>
                        </div>
                        <p>{campaign.description || "Açıklama eklenmedi."}</p>
                        <div className="campaign-value">
                          <strong>{campaign.discount_type === "percentage" ? `%${campaign.discount_value / 100}` : money(campaign.discount_value)}</strong>
                          <span>{targetLabels[campaign.target_type] || campaign.target_type}</span>
                        </div>
                        {campaign.target_type === "selected_users" && (
                          <small><UserRound size={14} /> {campaign.selected_users || 0} kayıtlı hesaba özel</small>
                        )}
                        {campaign.target_type === "selected" && (
                          <small><Users size={14} /> {campaign.selected_businesses || 0} işletmeye özel</small>
                        )}
                        <div className="campaign-metrics">
                          <span><b>{campaign.usage_count}</b> kullanım</span>
                          <span><b>{money(campaign.total_discount)}</b> indirim</span>
                          <span><b>{money(campaign.net_revenue)}</b> gelir</span>
                          <span><b>{campaign.failed_attempts}</b> reddedilen</span>
                          <span><b>{campaign.top_plan ? planLabels[campaign.top_plan] || campaign.top_plan : "—"}</b> en çok paket</span>
                        </div>
                        <small><CalendarRange size={14} /> {new Date(campaign.starts_at).toLocaleDateString("tr-TR")} – {new Date(campaign.ends_at).toLocaleDateString("tr-TR")}</small>
                        <div className="button-group campaign-actions">
                          <button className="button small" onClick={() => edit(campaign)}><Edit3 size={14} /> Düzenle</button>
                          <button className="icon-button" aria-label={campaign.active ? "Pasif yap" : "Aktif yap"} onClick={() => act({ action: "toggle", id: campaign.id, active: !campaign.active })}>{campaign.active ? <Pause size={16} /> : <Check size={16} />}</button>
                          <button className="icon-button danger" aria-label="Kampanyayı sil" onClick={() => setConfirm({ action: "delete", id: campaign.id, title: `${campaign.name} silinsin mi?` })}><Trash2 size={16} /></button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="panel margin-top campaign-chart-panel">
              <div className="panel-header"><div><h2>Tarihe göre kullanım</h2><p className="muted">Son 14 gündeki doğrulanmış kampanya tahsilatları.</p></div></div>
              {!daily.length ? (
                <Blank title="Grafik için veri yok" description="Başarılı kampanya ödemeleri günlere göre burada gösterilir." />
              ) : (
                <div className="campaign-chart" role="img" aria-label="Son 14 gün kampanya kullanım grafiği">
                  {daily.map((item) => (
                    <div className="campaign-chart-day" key={item.day} title={`${item.day}: ${item.uses} kullanım, ${money(item.revenue)} gelir`}>
                      <div className="campaign-chart-bar" style={{ height: `${Math.max(8, (item.uses / maxDaily) * 100)}%` }}><span>{item.uses}</span></div>
                      <small>{new Date(item.day + "T12:00:00Z").toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit" })}</small>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="panel margin-top">
              <div className="panel-header"><div><h2>Kampanya kullanımları</h2><p className="muted">Başarılı, bekleyen ve başarısız finansal kayıtlar.</p></div></div>
              {!data.redemptions.length ? (
                <Blank title="Henüz kullanım yok" description="Doğrulanmış kampanya ödemeleri burada görünür." />
              ) : (
                <div className="table-scroll">
                  <Table>
                    <TableHeader><TableRow><TableHead>Hesap / işletme</TableHead><TableHead>Kampanya</TableHead><TableHead>Normal fiyat</TableHead><TableHead>İndirim</TableHead><TableHead>Ödenen</TableHead><TableHead>Durum / tarih</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {data.redemptions.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>{item.business_name || item.user_name || "Kayıtlı kullanıcı"}<small>{item.user_email || ""}</small></TableCell>
                          <TableCell>{item.campaign_name}<small>{item.campaign_code}</small></TableCell>
                          <TableCell>{money(item.original_amount)}</TableCell>
                          <TableCell>-{money(item.discount_amount)}</TableCell>
                          <TableCell>{money(item.final_amount)}</TableCell>
                          <TableCell>{item.status}<small>{new Date(item.created_at).toLocaleString("tr-TR")}</small></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </section>
          </>
        )}

        <Modal
          open={!!form}
          onClose={() => setForm(null)}
          title={form?.id ? "Kampanyayı düzenle" : "Yeni kampanya"}
          description="Hedef ve tutar sunucuda yeniden doğrulanır; kişiye özel kod başka hesapta çalışmaz."
          wide
        >
          {form && (
            <form className="campaign-form form-stack" onSubmit={save}>
              <div className="form-grid">
                <Field label="Kampanya adı"><Input required minLength={2} maxLength={120} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
                <Field label="Benzersiz kod"><Input required minLength={3} maxLength={32} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "") })} /></Field>
              </div>
              <Field label="Müşteriye gösterilecek kısa neden">
                <Textarea
                  maxLength={120}
                  placeholder="Örn. Sezon indirimi"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
                <small>Bu metin kampanya uygulandığında ödeme düğmesinin hemen üstünde gösterilir.</small>
              </Field>
              <div className="notice success" role="status">
                <Megaphone size={18} />
                <span>
                  <strong>{form.description.trim() || "Sezon indirimi"}</strong>
                  <small>
                    {form.discount_type === "percentage"
                      ? `%${form.discount_value || "0"} kampanya avantajı`
                      : `${form.discount_value || "0"} TL kampanya avantajı`} · müşterinin ödeme ekranında böyle görünecek.
                  </small>
                </span>
              </div>
              <div className="form-grid">
                <Field label="İndirim türü"><select className="campaign-select" value={form.discount_type} onChange={(e) => setForm({ ...form, discount_type: e.target.value })}><option value="percentage">Yüzdelik indirim</option><option value="fixed">Sabit tutar indirimi</option></select></Field>
                <Field label={form.discount_type === "percentage" ? "İndirim (%)" : "İndirim (TL)"}><Input required type="number" min="0.01" max={form.discount_type === "percentage" ? "100" : "1000000"} step="0.01" value={form.discount_value} onChange={(e) => setForm({ ...form, discount_value: e.target.value })} /></Field>
              </div>
              <div className="form-grid">
                <Field label="Başlangıç"><Input required type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} /></Field>
                <Field label="Bitiş"><Input required type="datetime-local" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} /></Field>
              </div>
              <Field label="Geçerli paketler"><div className="campaign-checks">{Object.entries(planLabels).map(([code, label]) => <label className="check-row" key={code}><Checkbox checked={form.applicable_plans.includes(code)} onCheckedChange={(checked) => setForm({ ...form, applicable_plans: checked ? [...form.applicable_plans, code] : form.applicable_plans.filter((value: string) => value !== code) })} /><span>{label}</span></label>)}</div></Field>
              <div className="form-grid">
                <Field label="Toplam kullanım limiti"><Input type="number" min="1" placeholder="Sınırsız" value={form.total_usage_limit} onChange={(e) => setForm({ ...form, total_usage_limit: e.target.value })} /></Field>
                <Field label="Hesap / işletme başına limit"><Input type="number" min="1" placeholder="Sınırsız" value={form.per_business_limit} onChange={(e) => setForm({ ...form, per_business_limit: e.target.value })} /></Field>
              </div>
              <Field label="Hedef türü">
                <select
                  className="campaign-select"
                  value={form.target_type}
                  onChange={(e) => {
                    const target = e.target.value;
                    setForm({
                      ...form,
                      target_type: target,
                      business_ids: target === "selected" ? form.business_ids : [],
                      user_ids: target === "selected_users" ? form.user_ids : [],
                    });
                  }}
                >
                  {Object.entries(targetLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </Field>

              {form.target_type === "selected" && (
                <div className="business-picker">
                  <div className="business-picker-tools">
                    <div className="search-box"><Search size={16} /><Input aria-label="İşletme ara" placeholder="İşletme, sahip veya e-posta ara" value={businessSearch} onChange={(e) => setBusinessSearch(e.target.value)} /></div>
                    <select className="campaign-select" aria-label="Paket filtresi" value={planFilter} onChange={(e) => setPlanFilter(e.target.value)}><option value="all">Tüm paketler</option>{Object.entries(planLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
                  </div>
                  <div className="business-picker-list">
                    {businesses.map((business) => (
                      <label className="business-option" key={business.id}>
                        <Checkbox checked={form.business_ids.includes(business.id)} onCheckedChange={(checked) => setForm({ ...form, business_ids: checked ? [...form.business_ids, business.id] : form.business_ids.filter((id: string) => id !== business.id) })} />
                        <span><strong>{business.name}</strong><small>{business.owner_name} · {business.owner_email}</small></span>
                        <span><b>{planLabels[business.current_plan] || business.current_plan}</b><small>{business.subscription_status} · {business.branch_count} şube</small></span>
                      </label>
                    ))}
                  </div>
                  <small>{form.business_ids.length} işletme seçildi.</small>
                </div>
              )}

              {form.target_type === "selected_users" && (
                <div className="business-picker">
                  <div className="notice">
                    <strong>Kişiye özel güvenli hedefleme.</strong> Kod yalnızca seçtiğiniz kayıtlı hesapların oturumunda doğrulanır. Kod başkasına gönderilse bile o hesap kullanamaz.
                  </div>
                  <div className="business-picker-tools">
                    <div className="search-box"><Search size={16} /><Input aria-label="Kayıtlı kullanıcı ara" placeholder="Ad, e-posta, telefon, şehir veya işletme ara" value={userSearch} onChange={(e) => setUserSearch(e.target.value)} /></div>
                  </div>
                  <div className="business-picker-list">
                    {users.map((person) => (
                      <label className="business-option" key={person.user_id}>
                        <Checkbox checked={form.user_ids.includes(person.user_id)} onCheckedChange={(checked) => setForm({ ...form, user_ids: checked ? [...form.user_ids, person.user_id] : form.user_ids.filter((id: string) => id !== person.user_id) })} />
                        <span><strong>{person.name || "İsimsiz hesap"}</strong><small>{person.email}{person.phone ? ` · ${person.phone}` : ""}</small></span>
                        <span><b>{person.account_type === "business" ? "İşletme hesabı" : "Müşteri hesabı"}</b><small>{person.business_names || (person.city || "Henüz işletme yok")}{person.disabled ? " · devre dışı" : ""}</small></span>
                      </label>
                    ))}
                  </div>
                  <small>{form.user_ids.length} kayıtlı hesap seçildi · toplam {data?.users.length || 0} kayıtlı hesap içinden.</small>
                </div>
              )}

              <div className="campaign-checks vertical">
                <label className="check-row"><Checkbox checked={form.first_payment_only} onCheckedChange={(value) => setForm({ ...form, first_payment_only: value === true, recurring_enabled: value === true ? false : form.recurring_enabled })} /><span>Sadece ilk abonelik ödemesinde geçerli</span></label>
                <label className="check-row"><Checkbox checked={form.recurring_enabled} disabled={form.first_payment_only} onCheckedChange={(value) => setForm({ ...form, recurring_enabled: value === true })} /><span>Aylık yenilemelerde geçerli</span></label>
                <label className="check-row"><Checkbox checked={form.active} onCheckedChange={(value) => setForm({ ...form, active: value === true })} /><span>Kampanyayı aktif kaydet</span></label>
              </div>
              <button className="button primary full" disabled={busy || !form.applicable_plans.length}>{busy ? <Busy /> : <Check size={17} />}Kampanyayı kaydet</button>
            </form>
          )}
        </Modal>
        <Confirm open={!!confirm} onClose={() => setConfirm(null)} title={confirm?.title} description="Kampanya kullanıma kapanır; geçmiş finansal kayıtlar ve analitik veriler silinmez." onConfirm={() => confirm && act(confirm)} />
      </main>
    </PublicShell>
  );
}