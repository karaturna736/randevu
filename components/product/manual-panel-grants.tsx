"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, KeyRound, RefreshCw, ShieldCheck, Store, UserRound, XCircle } from "lucide-react";
import { toast } from "sonner";
import { api, Busy } from "./common";

type Plan = "normal" | "pro" | "plus";

const planNames: Record<Plan, string> = {
  normal: "Standart",
  pro: "Pro",
  plus: "Plus",
};

export default function ManualPanelGrants() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [plans, setPlans] = useState<Record<string, Plan>>({});

  const refresh = useCallback(async () => {
    try {
      const result = await api("admin-access");
      setData(result);
      setError("");
      setPlans((current) => {
        const next = { ...current };
        for (const business of result.businesses || []) {
          if (!next[business.id])
            next[business.id] = (business.manual_plan || business.recurring_plan || business.selected_plan || "normal") as Plan;
        }
        return next;
      });
    } catch (e: any) {
      setError(e?.message || "Panel erişimleri yüklenemedi.");
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function grant(business: any) {
    setBusyId(business.id);
    try {
      const result = await api("admin-access", {
        action: "grant",
        id: business.id,
        plan: plans[business.id] || "normal",
      });
      toast.success(result.message || "Panel erişimi açıldı.");
      await refresh();
    } catch (e: any) {
      toast.error(e?.message || "Panel erişimi açılamadı.");
    } finally {
      setBusyId("");
    }
  }

  async function revoke(business: any) {
    if (!confirm(`${business.name} için manuel panel erişimi kapatılsın mı?`)) return;
    setBusyId(business.id);
    try {
      const result = await api("admin-access", { action: "revoke", id: business.id });
      toast.success(result.message || "Panel erişimi kapatıldı.");
      await refresh();
    } catch (e: any) {
      toast.error(e?.message || "Panel erişimi kapatılamadı.");
    } finally {
      setBusyId("");
    }
  }

  const pendingUsers = useMemo(
    () => (data?.users || []).filter((user: any) => Number(user.businesses || 0) === 0),
    [data],
  );
  const waitingBusinesses = useMemo(
    () => (data?.businesses || []).filter((business: any) => !business.manual_plan && !business.recurring_plan),
    [data],
  );

  return (
    <section className="admin-page" style={{ paddingBottom: 0 }}>
      <div className="page-heading">
        <div>
          <span className="eyebrow">GEÇİCİ MANUEL AKTİVASYON</span>
          <h1>Panel erişimini siz açın.</h1>
          <p>
            Kullanıcı işletmesini kaydeder; Standart, Pro veya Plus paketini siz seçip paneli açarsınız.
            Bu işlem tahsilat veya fatura kaydı oluşturmaz.
          </p>
        </div>
        <span className="badge neutral"><ShieldCheck size={14} /> Yalnızca yönetici</span>
      </div>

      {error ? (
        <section className="panel">
          <p className="error-message">{error}</p>
          <button className="button" onClick={refresh}><RefreshCw size={15} /> Tekrar dene</button>
        </section>
      ) : !data ? (
        <div className="loading-row"><Busy /> Kayıtlar hazırlanıyor…</div>
      ) : (
        <>
          <div className="stats-grid">
            <section className="stat-card">
              <div className="stat-top">Panel bekleyen <KeyRound size={19} /></div>
              <strong className="stat-value">{waitingBusinesses.length}</strong>
            </section>
            <section className="stat-card">
              <div className="stat-top">İşletme kurmamış üyeler <UserRound size={19} /></div>
              <strong className="stat-value">{pendingUsers.length}</strong>
            </section>
            <section className="stat-card">
              <div className="stat-top">Toplam işletme hesabı <Store size={19} /></div>
              <strong className="stat-value">{data.businesses.length}</strong>
            </section>
          </div>

          <section className="panel">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">PANEL VER</span>
                <h2>İşletme erişimleri</h2>
                <p className="muted">Paketi seçin ve tek tuşla gerçek paket yetkilerini açın.</p>
              </div>
              <button className="button small" onClick={refresh}><RefreshCw size={14} /> Yenile</button>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>İşletme / kullanıcı</th>
                    <th>Durum</th>
                    <th>Paket</th>
                    <th style={{ textAlign: "right" }}>İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {data.businesses.map((business: any) => {
                    const currentPlan = business.manual_plan || business.recurring_plan;
                    const isProviderPlan = !!business.recurring_plan && !business.manual_plan;
                    const working = busyId === business.id;
                    return (
                      <tr key={business.id}>
                        <td>
                          <strong>{business.name}</strong>
                          <small style={{ display: "block" }}>
                            {business.owner_name || "İşletme sahibi"} · {business.owner_email || "E-posta yok"}
                          </small>
                          <small style={{ display: "block", fontFamily: "monospace" }}>/{business.slug}</small>
                        </td>
                        <td>
                          {currentPlan ? (
                            <span className="badge neutral"><Check size={13} /> Panel açık · {planNames[currentPlan as Plan] || currentPlan}</span>
                          ) : (
                            <span className="badge neutral">Onay bekliyor</span>
                          )}
                        </td>
                        <td>
                          <select
                            className="input"
                            aria-label={`${business.name} paketi`}
                            value={plans[business.id] || "normal"}
                            disabled={working || isProviderPlan}
                            onChange={(event) =>
                              setPlans((current) => ({ ...current, [business.id]: event.target.value as Plan }))
                            }
                          >
                            <option value="normal">Standart</option>
                            <option value="pro">Pro</option>
                            <option value="plus">Plus</option>
                          </select>
                        </td>
                        <td>
                          <div className="button-group right-group">
                            <button
                              className="button small primary"
                              disabled={working || isProviderPlan}
                              onClick={() => grant(business)}
                            >
                              {working ? <Busy /> : <KeyRound size={14} />}
                              {business.manual_plan ? "Paketi güncelle" : isProviderPlan ? "Sağlayıcı aboneliği" : "Panel ver"}
                            </button>
                            {business.manual_plan && (
                              <button
                                className="button small"
                                disabled={working}
                                onClick={() => revoke(business)}
                              >
                                <XCircle size={14} /> Paneli kapat
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {!data.businesses.length && (
                    <tr><td colSpan={4}>Henüz işletme kaydı yok.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {pendingUsers.length > 0 && (
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">YENİ KAYITLAR</span>
                  <h2>İşletmesini henüz oluşturmamış kullanıcılar</h2>
                  <p className="muted">Bu kullanıcılar kayıt oldu ancak işletme kurulum formunu henüz tamamlamadı.</p>
                </div>
              </div>
              <div className="moderation-list">
                {pendingUsers.map((registered: any) => (
                  <div className="moderation-row" key={registered.user_id}>
                    <div>
                      <strong>{registered.name}</strong>
                      <p>{registered.email}</p>
                      <small>İşletme kurulumu bekleniyor</small>
                    </div>
                    <span className="badge neutral">Kayıtlı kullanıcı</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </section>
  );
}
