"use client";
import { useCallback, useEffect, useState } from "react";
import {
  Building2,
  Plus,
  ReceiptText,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Trash2,
  LibraryBig,
  BarChart3,
  Crown,
  Gauge,
  Layers3,
  ArrowRight,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { api, Busy, Blank, Field, Modal, Pick } from "./common";
import { money } from "@/lib/types";
import { toast } from "sonner";

const categories = [
  ["kira", "Kira"],
  ["personel", "Personel"],
  ["malzeme", "Malzeme"],
  ["fatura", "Fatura"],
  ["pazarlama", "Pazarlama"],
  ["vergi", "Vergi"],
  ["diger", "Diğer"],
];

function signedMoney(value: number) {
  return `${value > 0 ? "+" : ""}${money(value)}`;
}

function factorValues(factor: any) {
  if (factor.leader_value === null || factor.target_value === null) return "";
  if (factor.unit === "money")
    return `${money(factor.leader_value)} / ${money(factor.target_value)}`;
  return `${factor.leader_value} / ${factor.target_value} ${factor.unit || ""}`;
}

export function BranchProfitability({ w }: any) {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7)),
    [data, setData] = useState<any>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [branch, setBranch] = useState<any>(null),
    [expense, setExpense] = useState<any>(null),
    [catalogItem, setCatalogItem] = useState<any>(null);

  const load = useCallback(() => {
    setError("");
    return api(`branches?tenant=${w.business.id}&month=${month}`)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [w.business.id, month]);

  useEffect(() => {
    setData(null);
    load();
  }, [load]);

  async function post(path: string, payload: any) {
    setBusy(true);
    setError("");
    try {
      await api(path, { tenant_id: w.business.id, ...payload });
      setBranch(null);
      setExpense(null);
      setCatalogItem(null);
      await load();
      toast.success("Kaydedildi.");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (!data) return error ? <p className="error-message">{error}</p> : <Busy />;

  const isPlus = data.plan === "plus",
    isPro = data.plan === "pro",
    best = [...data.branches].sort((a, b) => b.net - a.net)[0],
    worst = [...data.branches].sort((a, b) => a.net - b.net)[0],
    canAdd =
      data.limits.branches === null ||
      data.branches.filter((b: any) => b.active).length < data.limits.branches,
    companyMargin = data.summary.revenue
      ? Math.round((data.summary.net / data.summary.revenue) * 1000) / 10
      : 0,
    expenseBreakdown = categories
      .map(([key, label]) => ({
        key,
        label,
        amount: data.expenses
          .filter((row: any) => row.category === key)
          .reduce((sum: number, row: any) => sum + Number(row.amount || 0), 0),
      }))
      .filter((row) => row.amount > 0)
      .sort((a, b) => b.amount - a.amount);

  return (
    <div className="operations-stack">
      <section className="panel branch-summary">
        <div className="section-heading">
          <div>
            <span className="eyebrow">ŞUBELER ARASI ANALİZ</span>
            <h2>Hangi şube kârda, hangisi zararda?</h2>
            <p className="muted">
              Tamamlanan randevu cirosunu kaydettiğiniz giderlerle karşılaştırın.
            </p>
          </div>
          <Input
            aria-label="Rapor ayı"
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </div>

        <div className="operations-metrics">
          <div className="operation-metric">
            <span>Toplam ciro</span>
            <strong>{money(data.summary.revenue)}</strong>
          </div>
          <div className="operation-metric">
            <span>Kaydedilen gider</span>
            <strong>{money(data.summary.expenses)}</strong>
          </div>
          <div className="operation-metric">
            <span>
              {data.summary.net >= 0 ? "Net kâr" : "Net zarar"}
              {data.summary.estimated ? " · tahmini" : ""}
            </span>
            <strong
              className={
                data.summary.net < 0 ? "profit-negative" : "profit-positive"
              }
            >
              {money(Math.abs(data.summary.net))}
            </strong>
          </div>
        </div>

        <div className="notice margin-top">
          <b>Gelir otomatik hesaplanır.</b> Randevu “Tamamlandı” olduğunda hizmetin
          kayıtlı fiyatı ilgili şubenin cirosuna eklenir. Net sonuç, bu cirodan
          kaydettiğiniz giderler düşülerek hesaplanır.
        </div>

        {data.branches.length > 1 && best && (
          <div className="branch-insight">
            <TrendingUp size={18} />
            <span>
              <b>En yüksek net sonuç:</b> {best.name} · {money(best.net)}
            </span>
            {worst?.net < 0 && (
              <>
                <TrendingDown size={18} />
                <span>
                  <b>Zararda görünen şube:</b> {worst.name} ·{" "}
                  {money(Math.abs(worst.net))}
                </span>
              </>
            )}
          </div>
        )}
        <p className="helper">
          Gideri onaylanmayan şubelerde sonuç tahminidir. Bu rapor muhasebe veya
          vergi beyannamesi yerine geçmez.
        </p>
      </section>

      {isPlus && (
        <section
          className="panel"
          style={{
            border: "1px solid color-mix(in srgb, var(--primary) 44%, var(--border))",
            background:
              "linear-gradient(135deg, color-mix(in srgb, var(--primary) 11%, var(--card)), var(--card) 52%, color-mix(in srgb, var(--accent) 45%, var(--card)))",
          }}
        >
          <div className="section-heading">
            <div>
              <span className="eyebrow">PLUS FİNANS MERKEZİ</span>
              <h2><Crown size={20} /> Şube yönetiminin finans kokpiti</h2>
              <p className="muted">
                Şube performansını, gider yapısını ve kârın neden oluştuğunu tek
                ekranda izleyin. Hesaplamalar doğrudan kayıtlı verilerden üretilir.
              </p>
            </div>
            <span className="badge confirmed">Plus aktif</span>
          </div>

          <div
            className="operations-metrics margin-top"
            style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}
          >
            <div className="operation-metric">
              <Crown size={19} />
              <span>En güçlü şube</span>
              <strong style={{ fontSize: 20 }}>{best?.name || "—"}</strong>
              <small>{best ? money(best.net) + " net sonuç" : "Veri bekleniyor"}</small>
            </div>
            <div className="operation-metric">
              <Gauge size={19} />
              <span>Toplam net marj</span>
              <strong>%{companyMargin}</strong>
              <small>Ciroya göre net sonuç</small>
            </div>
            <div className="operation-metric">
              <Layers3 size={19} />
              <span>Kayıtlı gider kalemi</span>
              <strong>{data.catalog.length}</strong>
              <small>Tekrar kullanılabilir şablon</small>
            </div>
            <div className="operation-metric">
              <ReceiptText size={19} />
              <span>Bu ay gider kaydı</span>
              <strong>{data.expenses.length}</strong>
              <small>{money(data.summary.expenses)} toplam</small>
            </div>
          </div>
        </section>
      )}

      {isPlus && data.analysis?.comparisons?.length > 0 && (
        <section className="panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">NEDEN DAHA KÂRLI?</span>
              <h2>Şube kâr farkının matematiksel açıklaması</h2>
              <p className="muted">
                Yapay zekâ kullanılmaz. Neta; tamamlanan işlem sayısı, ortalama
                işlem tutarı ve gerçek gider farklarını doğrudan veriden hesaplar.
              </p>
            </div>
            <span className="badge confirmed">Plus · Sistemsel analiz</span>
          </div>

          <div className="operations-stack margin-top">
            {data.analysis.comparisons.map((comparison: any) => (
              <article className="panel branch-card" key={comparison.target.id}>
                <div className="section-heading">
                  <div>
                    <h3>
                      {comparison.leader.name} neden {comparison.target.name}
                      {"'"}den daha yüksek net sonuç üretti?
                    </h3>
                    <p className="muted">
                      Net sonuç farkı: <b>{money(comparison.net_difference)}</b>
                    </p>
                  </div>
                  <BarChart3 size={20} />
                </div>

                <div className="collection-list">
                  {comparison.factors.map((factor: any) => (
                    <div className="collection-row" key={factor.key}>
                      <div>
                        <strong>{factor.label}</strong>
                        {factorValues(factor) && (
                          <small>
                            {comparison.leader.name} / {comparison.target.name}: {" "}
                            {factorValues(factor)}
                          </small>
                        )}
                      </div>
                      <b
                        className={
                          factor.amount >= 0
                            ? "profit-positive"
                            : "profit-negative"
                        }
                      >
                        {signedMoney(factor.amount)}
                      </b>
                    </div>
                  ))}
                </div>

                {comparison.signals?.length > 0 && (
                  <div className="notice margin-top">
                    <b>Destekleyici göstergeler</b>
                    {comparison.signals.map((signal: string) => (
                      <p className="helper" key={signal}>
                        {signal}
                      </p>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </div>
          <p className="helper margin-top">
            Pozitif tutar, önde olan şubenin net sonuç farkına katkıyı; negatif
            tutar ise avantajını azaltan kalemi gösterir. Göstergeler korelasyon
            bilgisidir; para farkı hesabına ikinci kez eklenmez.
          </p>
        </section>
      )}

      {isPro && (
        <section
          className="panel"
          style={{
            borderStyle: "dashed",
            background: "color-mix(in srgb, var(--primary) 4%, var(--card))",
          }}
        >
          <div className="section-heading">
            <div>
              <span className="eyebrow">
                {w.business.selected_plan === "plus" ? "PAKET DURUMU" : "PLUS İLE DAHA DERİN ANALİZ"}
              </span>
              <h2><Crown size={19} /> Kârın nedenini kalem kalem görün</h2>
              <p className="muted">
                {w.business.selected_plan === "plus"
                  ? "Plus seçilmiş görünüyor; ancak bu işletme için etkin Plus ödeme veya yönetici onayı bulunamadı. Abonelik durumunuzu kontrol edin."
                  : "Pro temel ciro, gider ve net sonucu gösterir. Plus; ortalama işlem tutarı, saat başı ciro, net marj, geri dönen müşteri, no-show, hizmet karması ve şubeler arası kâr farkının nedenlerini açar."}
              </p>
            </div>
            <a className="button primary" href={`/abonelik?tenant=${w.business.id}`}>
              {w.business.selected_plan === "plus" ? "Aboneliği kontrol et" : "Plus özelliklerini gör"} <ArrowRight size={16} />
            </a>
          </div>
        </section>
      )}

      <div className="toolbar">
        <p className="muted">
          {data.branches.length} şube ·{" "}
          {data.limits.branches === null
            ? "Plus sınırsız şube"
            : `Paket sınırı ${data.limits.branches}`}
        </p>
        <div className="button-group">
          <button
            className="button"
            onClick={() =>
              setExpense({
                branch_id: data.branches[0]?.id || "",
                month,
                category: "kira",
                amount: "",
                quantity: 1,
                unit: "adet",
                catalog_item_id: "manual",
                note: "",
              })
            }
            disabled={data.plan === "normal"}
          >
            <ReceiptText size={16} /> Gider ekle
          </button>
          {isPlus && (
            <button
              className="button"
              onClick={() =>
                setCatalogItem({
                  name: "",
                  category: "malzeme",
                  unit: "adet",
                  default_unit_amount: "",
                  apply_to_branch_id: data.branches[0]?.id || "",
                  apply_month: month,
                  quantity: 1,
                  note: "",
                })
              }
            >
              <LibraryBig size={16} /> Gider kalemi kaydet
            </button>
          )}
          <button
            className="button primary"
            onClick={() =>
              setBranch({ name: "", city: "", address: "", phone: "", active: 1 })
            }
            disabled={!canAdd}
          >
            <Plus size={16} /> Şube ekle
          </button>
        </div>
      </div>

      <div className="branch-grid">
        {data.branches.map((b: any) => (
          <article className="panel branch-card" key={b.id}>
            <div className="section-heading">
              <span className="module-icon">
                <Building2 />
              </span>
              <span className={"badge " + (b.net < 0 ? "cancelled" : "confirmed")}>
                {b.net < 0 ? "Zararda" : "Kârda"}
              </span>
            </div>
            <h3>{b.name}</h3>
            <p className="muted">
              {b.city || "Konum girilmedi"} · {b.completed} tamamlanan işlem
            </p>

            <div className="branch-finance">
              <span>Ciro <b>{money(b.revenue)}</b></span>
              <span>Gider <b>{money(b.expenses)}</b></span>
              <span>
                Net sonuç{" "}
                <b className={b.net < 0 ? "profit-negative" : "profit-positive"}>
                  {money(b.net)}
                </b>
              </span>
            </div>

            {isPlus && (
              <>
                <div className="branch-finance">
                  <span>Ort. işlem <b>{money(b.avg_ticket)}</b></span>
                  <span>Hizmet saati başı <b>{money(b.revenue_per_hour)}</b></span>
                  <span>Net marj <b>%{b.net_margin}</b></span>
                </div>
                <p className="helper">
                  Gelmeme: %{b.no_show_rate} · Geri dönen müşteri: %{b.returning_rate}
                  {b.top_service
                    ? ` · En çok ciro: ${b.top_service.name} (%${b.top_service.revenue_share})`
                    : ""}
                </p>
              </>
            )}

            <div className="button-group">
              <button className="button" onClick={() => setBranch({ ...b })}>
                Düzenle
              </button>
              <button
                className="button"
                onClick={() =>
                  setExpense({
                    branch_id: b.id,
                    month,
                    category: "kira",
                    amount: "",
                    quantity: 1,
                    unit: "adet",
                    catalog_item_id: "manual",
                    note: "",
                  })
                }
                disabled={data.plan === "normal"}
              >
                Gider gir
              </button>
              {b.estimated ? (
                <button
                  className="button"
                  onClick={() =>
                    post("branches", {
                      action: "confirm-expenses",
                      branch_id: b.id,
                      month,
                    })
                  }
                >
                  <CheckCircle2 size={15} /> Giderleri onayla
                </button>
              ) : (
                <span className="badge neutral">Giderler onaylı</span>
              )}
            </div>
          </article>
        ))}
      </div>

      {!data.branches.length && <Blank title="İlk şubenizi oluşturun" />}

      {data.plan === "normal" && (
        <div className="notice">
          Standart pakette 1 şube ve temel randevu yönetimi bulunur. Şube gideri
          ve kâr/zarar karşılaştırması Pro pakette, sınırsız şube ise Plus
          pakettedir.
        </div>
      )}

      {isPlus && (
        <section
          className="panel expense-catalog-panel"
          style={{
            border: "1px solid color-mix(in srgb, var(--primary) 32%, var(--border))",
          }}
        >
          <div className="section-heading">
            <div>
              <span className="eyebrow">PLUS · GİDER KÜTÜPHANESİ</span>
              <h2><LibraryBig size={20} /> Kayıtlı gider kalemleri</h2>
              <p className="muted">
                Makas, krem, masaj aleti, kira veya düzenli hizmet giderlerini bir
                kez tanımlayın; sonraki aylarda tekrar yazmadan kullanın.
              </p>
            </div>
            <button
              className="button primary"
              onClick={() =>
                setCatalogItem({
                  name: "",
                  category: "malzeme",
                  unit: "adet",
                  default_unit_amount: "",
                  apply_to_branch_id: data.branches[0]?.id || "",
                  apply_month: month,
                  quantity: 1,
                  note: "",
                })
              }
            >
              <Plus size={16} /> Yeni gider kalemi
            </button>
          </div>

          {expenseBreakdown.length > 0 && (
            <div className="collection-list">
              <div className="collection-row">
                <div>
                  <strong>Bu ay gider dağılımı</strong>
                  <small>Şubelerde kaydedilen giderlerin kategori bazlı özeti</small>
                </div>
                <b>{money(data.summary.expenses)}</b>
              </div>
              {expenseBreakdown.map((row) => (
                <div className="collection-row" key={row.key}>
                  <div><strong>{row.label}</strong></div>
                  <b>{money(row.amount)}</b>
                </div>
              ))}
            </div>
          )}

          {data.catalog.length ? (
            <div className="catalog-grid margin-top">
              {data.catalog.map((item: any) => (
                <button
                  type="button"
                  className="catalog-item"
                  key={item.id}
                  onClick={() =>
                    setCatalogItem({
                      ...item,
                      default_unit_amount: item.default_unit_amount / 100,
                    })
                  }
                >
                  <strong>{item.name}</strong>
                  <small>
                    {categories.find((c) => c[0] === item.category)?.[1]} ·{" "}
                    {money(item.default_unit_amount)} / {item.unit}
                  </small>
                </button>
              ))}
            </div>
          ) : (
            <Blank
              title="Kayıtlı gider kalemi yok"
              description="İlk kalemi ekleyin; gelecek aylarda tekrar yazmanız gerekmesin."
            />
          )}
        </section>
      )}

      {data.expenses.length > 0 && (
        <section className="panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">AYLIK GİDER DEFTERİ</span>
              <h2>Bu ayın gider kayıtları</h2>
            </div>
            {isPlus && <span className="badge neutral">{data.expenses.length} kayıt</span>}
          </div>
          {data.expenses.map((e: any) => (
            <div className="collection-row" key={e.id}>
              <div>
                <strong>
                  {e.branch_name} · {e.catalog_name || "Manuel gider"} ·{" "}
                  {categories.find((c) => c[0] === e.category)?.[1]}
                </strong>
                <small>
                  {Number(e.quantity || 1)} {e.unit || "adet"} ·{" "}
                  {e.note || "Açıklama yok"}
                </small>
              </div>
              <b>{money(e.amount)}</b>
              <button
                className="icon-button"
                aria-label="Gideri sil"
                onClick={() => post("branches", { action: "delete-expense", id: e.id })}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </section>
      )}

      <Modal
        open={!!branch}
        onClose={() => setBranch(null)}
        title={branch?.id ? "Şubeyi düzenle" : "Yeni şube"}
      >
        {branch && (
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              post("branches", branch);
            }}
          >
            <Field label="Şube adı">
              <Input
                required
                minLength={2}
                value={branch.name}
                onChange={(e) => setBranch({ ...branch, name: e.target.value })}
              />
            </Field>
            <div className="form-grid">
              <Field label="Şehir">
                <Input
                  value={branch.city || ""}
                  onChange={(e) => setBranch({ ...branch, city: e.target.value })}
                />
              </Field>
              <Field label="Telefon">
                <Input
                  value={branch.phone || ""}
                  onChange={(e) => setBranch({ ...branch, phone: e.target.value })}
                />
              </Field>
            </div>
            <Field label="Adres">
              <Input
                value={branch.address || ""}
                onChange={(e) => setBranch({ ...branch, address: e.target.value })}
              />
            </Field>
            {error && <p className="error-message">{error}</p>}
            <button className="button primary full" disabled={busy}>
              Şubeyi kaydet
            </button>
          </form>
        )}
      </Modal>

      <Modal open={!!expense} onClose={() => setExpense(null)} title="Şube gideri ekle">
        {expense && (
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              post("branch-expenses", {
                ...expense,
                catalog_item_id:
                  expense.catalog_item_id === "manual" ? null : expense.catalog_item_id,
                amount: Math.round(
                  Number(expense.amount) * Number(expense.quantity || 1) * 100,
                ),
              });
            }}
          >
            <Field label="Şube">
              <Pick
                label="Şube"
                value={expense.branch_id}
                onChange={(branch_id) => setExpense({ ...expense, branch_id })}
                options={data.branches.map((b: any) => ({ value: b.id, label: b.name }))}
              />
            </Field>

            {isPlus && (
              <Field label="Kayıtlı gider kalemi">
                <Pick
                  label="Gider kalemi"
                  value={expense.catalog_item_id || "manual"}
                  onChange={(catalog_item_id) => {
                    const item = data.catalog.find((x: any) => x.id === catalog_item_id);
                    setExpense(
                      item
                        ? {
                            ...expense,
                            catalog_item_id,
                            category: item.category,
                            unit: item.unit,
                            amount: item.default_unit_amount / 100,
                            note: item.name,
                          }
                        : { ...expense, catalog_item_id: "manual" },
                    );
                  }}
                  options={[
                    { value: "manual", label: "Manuel gider" },
                    ...data.catalog.map((x: any) => ({
                      value: x.id,
                      label: `${x.name} · ${money(x.default_unit_amount)}/${x.unit}`,
                    })),
                  ]}
                />
              </Field>
            )}

            <div className="form-grid">
              <Field label="Ay">
                <Input
                  type="month"
                  required
                  value={expense.month}
                  onChange={(e) => setExpense({ ...expense, month: e.target.value })}
                />
              </Field>
              <Field label="Gider türü">
                <Pick
                  label="Gider türü"
                  value={expense.category}
                  onChange={(category) => setExpense({ ...expense, category })}
                  options={categories.map((c) => ({ value: c[0], label: c[1] }))}
                />
              </Field>
            </div>

            <div className="form-grid">
              <Field label="Adet / miktar">
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  value={expense.quantity || 1}
                  onChange={(e) => setExpense({ ...expense, quantity: e.target.value })}
                />
              </Field>
              <Field label="Birim">
                <Input
                  maxLength={20}
                  required
                  value={expense.unit || "adet"}
                  onChange={(e) => setExpense({ ...expense, unit: e.target.value })}
                />
              </Field>
            </div>

            <Field label="Birim tutarı (₺)">
              <Input
                type="number"
                min="0.01"
                step="0.01"
                required
                value={expense.amount}
                onChange={(e) => setExpense({ ...expense, amount: e.target.value })}
              />
            </Field>
            <Field label="Açıklama">
              <Input
                maxLength={300}
                value={expense.note}
                onChange={(e) => setExpense({ ...expense, note: e.target.value })}
              />
            </Field>
            {error && <p className="error-message">{error}</p>}
            <button className="button primary full" disabled={busy}>
              Gideri kaydet
            </button>
          </form>
        )}
      </Modal>

      <Modal
        open={!!catalogItem}
        onClose={() => setCatalogItem(null)}
        title={catalogItem?.id ? "Gider kalemini düzenle" : "Gider kalemi kaydet"}
      >
        {catalogItem && (
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              post("expense-catalog", {
                ...catalogItem,
                default_unit_amount: Math.round(
                  Number(catalogItem.default_unit_amount) * 100,
                ),
              });
            }}
          >
            <Field label="Kalem adı">
              <Input
                required
                minLength={2}
                placeholder="Örn. Saç kremi"
                value={catalogItem.name}
                onChange={(e) => setCatalogItem({ ...catalogItem, name: e.target.value })}
              />
            </Field>

            <div className="form-grid">
              <Field label="Gider türü">
                <Pick
                  label="Gider türü"
                  value={catalogItem.category}
                  onChange={(category) => setCatalogItem({ ...catalogItem, category })}
                  options={categories.map((c) => ({ value: c[0], label: c[1] }))}
                />
              </Field>
              <Field label="Birim">
                <Input
                  required
                  placeholder="adet, kutu, ay"
                  value={catalogItem.unit}
                  onChange={(e) => setCatalogItem({ ...catalogItem, unit: e.target.value })}
                />
              </Field>
            </div>

            <Field label="Varsayılan birim fiyatı (₺)">
              <Input
                required
                type="number"
                min="0"
                step="0.01"
                value={catalogItem.default_unit_amount}
                onChange={(e) =>
                  setCatalogItem({ ...catalogItem, default_unit_amount: e.target.value })
                }
              />
            </Field>

            {!catalogItem.id && (
              <div className="form-grid">
                <Field label="Giderin işleneceği şube">
                  <Pick
                    label="Şube"
                    value={catalogItem.apply_to_branch_id}
                    onChange={(apply_to_branch_id) =>
                      setCatalogItem({ ...catalogItem, apply_to_branch_id })
                    }
                    options={data.branches.map((item: any) => ({
                      value: item.id,
                      label: item.name,
                    }))}
                  />
                </Field>
                <Field label="Miktar">
                  <Input
                    required
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={catalogItem.quantity}
                    onChange={(e) =>
                      setCatalogItem({ ...catalogItem, quantity: e.target.value })
                    }
                  />
                </Field>
              </div>
            )}

            {!catalogItem.id && (
              <p className="helper">
                Kaydettiğinizde bu kalem {month} ayı için seçilen şubenin gider
                toplamına otomatik eklenir.
              </p>
            )}

            <Field label="Not">
              <Input
                maxLength={300}
                value={catalogItem.note || ""}
                onChange={(e) => setCatalogItem({ ...catalogItem, note: e.target.value })}
              />
            </Field>
            {error && <p className="error-message">{error}</p>}
            <button className="button primary full" disabled={busy}>
              Kalemi kaydet
            </button>
          </form>
        )}
      </Modal>
    </div>
  );
}
