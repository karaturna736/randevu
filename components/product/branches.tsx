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
export function BranchProfitability({ w }: any) {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7)),
    [data, setData] = useState<any>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [branch, setBranch] = useState<any>(null),
    [expense, setExpense] = useState<any>(null);
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
      await load();
      toast.success("Kaydedildi.");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  if (!data) return error ? <p className="error-message">{error}</p> : <Busy />;
  const best = [...data.branches].sort((a, b) => b.net - a.net)[0],
    worst = [...data.branches].sort((a, b) => a.net - b.net)[0],
    canAdd =
      data.limits.branches === null ||
      data.branches.filter((b: any) => b.active).length < data.limits.branches;
  return (
    <div className="operations-stack">
      <section className="panel branch-summary">
        <div className="section-heading">
          <div>
            <span className="eyebrow">ŞUBELER ARASI ANALİZ</span>
            <h2>Hangi şube kârda, hangisi zararda?</h2>
            <p className="muted">
              Tamamlanan randevu cirosunu kaydettiğiniz giderlerle
              karşılaştırın.
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
        {data.branches.length > 1 && (
          <div className="branch-insight">
            <TrendingUp size={18} />
            <span>
              <b>En yüksek net sonuç:</b> {best.name} · {money(best.net)}
            </span>
            {worst.net < 0 && (
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
      <div className="toolbar">
        <p className="muted">
          {data.branches.length} şube ·{" "}
          {data.limits.branches === null
            ? "Kurumsal sınırsız şube"
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
                note: "",
              })
            }
            disabled={data.plan === "normal"}
          >
            <ReceiptText size={16} />
            Gider ekle
          </button>
          <button
            className="button primary"
            onClick={() =>
              setBranch({
                name: "",
                city: "",
                address: "",
                phone: "",
                active: 1,
              })
            }
            disabled={!canAdd}
          >
            <Plus size={16} />
            Şube ekle
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
              <span
                className={"badge " + (b.net < 0 ? "cancelled" : "confirmed")}
              >
                {b.net < 0 ? "Zararda" : "Kârda"}
              </span>
            </div>
            <h3>{b.name}</h3>
            <p className="muted">
              {b.city || "Konum girilmedi"} · {b.completed} tamamlanan işlem
            </p>
            <div className="branch-finance">
              <span>
                Ciro <b>{money(b.revenue)}</b>
              </span>
              <span>
                Gider <b>{money(b.expenses)}</b>
              </span>
              <span>
                Net sonuç{" "}
                <b
                  className={b.net < 0 ? "profit-negative" : "profit-positive"}
                >
                  {money(b.net)}
                </b>
              </span>
            </div>
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
                  <CheckCircle2 size={15} />
                  Giderleri onayla
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
          Starter pakette 1 şube ve temel randevu yönetimi bulunur. Şube gideri,
          kâr/zarar karşılaştırması ve yeni şubeler için Business paketine
          geçin.
        </div>
      )}
      {data.expenses.length > 0 && (
        <section className="panel">
          <h2>Bu ayın gider kayıtları</h2>
          {data.expenses.map((e: any) => (
            <div className="collection-row" key={e.id}>
              <div>
                <strong>
                  {e.branch_name} ·{" "}
                  {categories.find((c) => c[0] === e.category)?.[1]}
                </strong>
                <small>{e.note || "Açıklama yok"}</small>
              </div>
              <b>{money(e.amount)}</b>
              <button
                className="icon-button"
                aria-label="Gideri sil"
                onClick={() =>
                  post("branches", { action: "delete-expense", id: e.id })
                }
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
                  onChange={(e) =>
                    setBranch({ ...branch, city: e.target.value })
                  }
                />
              </Field>
              <Field label="Telefon">
                <Input
                  value={branch.phone || ""}
                  onChange={(e) =>
                    setBranch({ ...branch, phone: e.target.value })
                  }
                />
              </Field>
            </div>
            <Field label="Adres">
              <Input
                value={branch.address || ""}
                onChange={(e) =>
                  setBranch({ ...branch, address: e.target.value })
                }
              />
            </Field>
            {error && <p className="error-message">{error}</p>}
            <button className="button primary full" disabled={busy}>
              Şubeyi kaydet
            </button>
          </form>
        )}
      </Modal>
      <Modal
        open={!!expense}
        onClose={() => setExpense(null)}
        title="Şube gideri ekle"
      >
        {expense && (
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              post("branch-expenses", {
                ...expense,
                amount: Math.round(Number(expense.amount) * 100),
              });
            }}
          >
            <Field label="Şube">
              <Pick
                label="Şube"
                value={expense.branch_id}
                onChange={(branch_id) => setExpense({ ...expense, branch_id })}
                options={data.branches.map((b: any) => ({
                  value: b.id,
                  label: b.name,
                }))}
              />
            </Field>
            <div className="form-grid">
              <Field label="Ay">
                <Input
                  type="month"
                  required
                  value={expense.month}
                  onChange={(e) =>
                    setExpense({ ...expense, month: e.target.value })
                  }
                />
              </Field>
              <Field label="Gider türü">
                <Pick
                  label="Gider türü"
                  value={expense.category}
                  onChange={(category) => setExpense({ ...expense, category })}
                  options={categories.map((c) => ({
                    value: c[0],
                    label: c[1],
                  }))}
                />
              </Field>
            </div>
            <Field label="Tutar (₺)">
              <Input
                type="number"
                min="0.01"
                step="0.01"
                required
                value={expense.amount}
                onChange={(e) =>
                  setExpense({ ...expense, amount: e.target.value })
                }
              />
            </Field>
            <Field label="Açıklama">
              <Input
                maxLength={300}
                value={expense.note}
                onChange={(e) =>
                  setExpense({ ...expense, note: e.target.value })
                }
              />
            </Field>
            {error && <p className="error-message">{error}</p>}
            <button className="button primary full" disabled={busy}>
              Gideri kaydet
            </button>
          </form>
        )}
      </Modal>
    </div>
  );
}
