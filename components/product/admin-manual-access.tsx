"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, KeyRound, RefreshCw, ShieldOff } from "lucide-react";
import { toast } from "sonner";

const planLabels: Record<string, string> = {
  normal: "Standart",
  pro: "Pro",
  plus: "Plus",
};

export default function AdminManualAccess() {
  const [data, setData] = useState<any>(null);
  const [busy, setBusy] = useState<string>("");
  const [plans, setPlans] = useState<Record<string, string>>({});
  const [error, setError] = useState("");

  async function load() {
    try {
      setError("");
      const r = await fetch("/api/admin/manual-access", { cache: "no-store" });
      const body = await r.json();
      if (!r.ok) throw new Error(body?.error || "Kayıtlar yüklenemedi.");
      setData(body);
    } catch (e: any) {
      setError(e.message || "Kayıtlar yüklenemedi.");
    }
  }

  useEffect(() => {
    load();
  }, []);

  const users = useMemo(() => {
    const rows = data?.users || [];
    const map = new Map<string, any>();
    for (const row of rows) {
      const current = map.get(row.user_id);
      if (!current || (!current.active && row.active)) map.set(row.user_id, row);
    }
    return Array.from(map.values());
  }, [data]);

  async function grant(user: any) {
    const plan = plans[user.user_id] || user.plan || user.selected_plan || "normal";
    setBusy(user.user_id);
    try {
      const r = await fetch("/api/admin/manual-access", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "grant", user_id: user.user_id, plan }),
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body?.error || "Panel erişimi verilemedi.");
      toast.success(`${user.name || user.email} için ${planLabels[plan]} paneli açıldı.`);
      await load();
    } catch (e: any) {
      toast.error(e.message || "Panel erişimi verilemedi.");
    } finally {
      setBusy("");
    }
  }

  async function revoke(user: any) {
    setBusy(user.user_id);
    try {
      const r = await fetch("/api/admin/manual-access", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "revoke", user_id: user.user_id }),
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body?.error || "Panel erişimi kapatılamadı.");
      toast.success("Panel erişimi kapatıldı.");
      await load();
    } catch (e: any) {
      toast.error(e.message || "Panel erişimi kapatılamadı.");
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="panel" style={{ marginTop: 24 }}>
      <div className="page-heading" style={{ marginBottom: 18 }}>
        <div>
          <span className="eyebrow">GEÇİCİ MANUEL YETKİLENDİRME</span>
          <h2>Panel ver</h2>
          <p>Kayıt olan işletme kullanıcılarına ödeme alınmış gibi paket erişimi aç.</p>
        </div>
        <button className="button small" onClick={load} disabled={!!busy}>
          <RefreshCw size={15} /> Yenile
        </button>
      </div>

      <div className="notice" style={{ marginBottom: 16 }}>
        Bu geçici akış gerçek tahsilat veya fatura oluşturmaz. Yetki verdiğin hesap 365 gün aktif görünür; paket özellikleri Standart / Pro / Plus kurallarına göre açılır.
      </div>

      {error ? (
        <p className="error-message">{error}</p>
      ) : !data ? (
        <div className="loading-row">Kullanıcılar yükleniyor…</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="data-table" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th>Kullanıcı</th>
                <th>İşletme</th>
                <th>Mevcut durum</th>
                <th>Paket</th>
                <th style={{ textAlign: "right" }}>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u: any) => (
                <tr key={u.user_id}>
                  <td>
                    <strong>{u.name || "İsimsiz kullanıcı"}</strong>
                    <small style={{ display: "block" }}>{u.email}</small>
                  </td>
                  <td>
                    {u.business_name || <span className="muted">Henüz işletme yok</span>}
                  </td>
                  <td>
                    {u.active ? (
                      <span className="badge success"><CheckCircle2 size={13} /> {planLabels[u.plan] || u.plan} aktif</span>
                    ) : (
                      <span className="badge neutral">Panel bekliyor</span>
                    )}
                    {u.paid_until ? <small style={{ display: "block", marginTop: 4 }}>Bitiş: {new Date(u.paid_until).toLocaleDateString("tr-TR")}</small> : null}
                  </td>
                  <td>
                    <select
                      className="input"
                      value={plans[u.user_id] || u.plan || u.selected_plan || "normal"}
                      onChange={(e) => setPlans((p) => ({ ...p, [u.user_id]: e.target.value }))}
                      disabled={busy === u.user_id}
                    >
                      <option value="normal">Standart</option>
                      <option value="pro">Pro</option>
                      <option value="plus">Plus</option>
                    </select>
                  </td>
                  <td>
                    <div className="button-group right-group">
                      <button className="button primary small" onClick={() => grant(u)} disabled={busy === u.user_id}>
                        <KeyRound size={14} /> {u.active ? "Paketi değiştir" : "Panel ver"}
                      </button>
                      {u.active ? (
                        <button className="button small" onClick={() => revoke(u)} disabled={busy === u.user_id}>
                          <ShieldOff size={14} /> Kapat
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
              {!users.length ? (
                <tr><td colSpan={5}>Henüz kayıtlı kullanıcı yok.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
