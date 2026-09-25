"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Gift, RefreshCw, Shield, Users } from "lucide-react";
import { toast } from "sonner";
import { PublicShell } from "./public";
import { api, Blank, Busy } from "./common";
import { dateLabel, money } from "@/lib/types";

type Referral = {
  referred_tenant: string;
  referrer_tenant: string;
  referred_name: string;
  referrer_name: string;
  status: string;
  reward: number;
  created_at: string;
};

type Data = {
  referrals: Referral[];
  enabled: boolean;
};

const labels: Record<string, string> = {
  pending: "Bekliyor",
  earned: "Kazanıldı",
  rejected: "Reddedildi",
};

export default function ReferralAdmin() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      setData(await api("platform-growth"));
    } catch (e: any) {
      setError(e.message || "Referans kayıtları açılamadı.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function review(id: string) {
    setBusy(id);
    try {
      await api("platform-growth", { id });
      toast.success("Referans koşulları yeniden kontrol edildi.");
      await load();
    } catch (e: any) {
      toast.error(e.message || "İşlem tamamlanamadı.");
    } finally {
      setBusy("");
    }
  }

  if (error) {
    return (
      <PublicShell>
        <main className="admin-page">
          <section className="panel">
            <Blank title="Referans yönetimi açılamadı" description={error} />
            <div className="button-group margin-top">
              <Link className="button" href="/admin">Yönetim merkezine dön</Link>
              <button className="button" onClick={load}>Tekrar dene</button>
            </div>
          </section>
        </main>
      </PublicShell>
    );
  }

  if (!data) {
    return (
      <PublicShell>
        <main className="admin-page">
          <div className="loading-row"><Busy /> Referanslar yükleniyor…</div>
        </main>
      </PublicShell>
    );
  }

  const pending = data.referrals.filter((r) => r.status === "pending");
  const earned = data.referrals.filter((r) => r.status === "earned");
  const reward = earned.reduce((sum, r) => sum + Number(r.reward || 0), 0);

  return (
    <PublicShell>
      <main className="admin-page">
        <div className="page-heading">
          <div>
            <span className="eyebrow">PLATFORM YÖNETİMİ · REFERANSLAR</span>
            <h1>Davet ve kredi kontrolü.</h1>
            <p>İşletme referanslarının durumunu ve doğrulanmış kredi kazanımlarını izleyin.</p>
          </div>
          <div className="button-group">
            <Link className="button" href="/admin"><ArrowLeft size={16} /> Yönetim merkezi</Link>
            <button className="button" onClick={load}><RefreshCw size={16} /> Yenile</button>
          </div>
        </div>

        <div className="stats-grid">
          <section className="stat-card">
            <div className="stat-top">Program durumu <Shield size={19} /></div>
            <strong className="stat-value">{data.enabled ? "Aktif" : "Kapalı"}</strong>
          </section>
          <section className="stat-card">
            <div className="stat-top">Bekleyen <Users size={19} /></div>
            <strong className="stat-value">{pending.length}</strong>
          </section>
          <section className="stat-card">
            <div className="stat-top">Kazanılan <Check size={19} /></div>
            <strong className="stat-value">{earned.length}</strong>
          </section>
          <section className="stat-card">
            <div className="stat-top">Oluşan kredi <Gift size={19} /></div>
            <strong className="stat-value">{money(reward)}</strong>
          </section>
        </div>

        <section className="panel margin-top">
          <div className="panel-header">
            <div>
              <h2>Referans kayıtları</h2>
              <p className="muted">Kredi, yalnızca sunucuda doğrulanan gerçek abonelik ve ödeme şartları sağlandığında oluşur.</p>
            </div>
            <span className="badge neutral">{data.referrals.length} kayıt</span>
          </div>

          {!data.referrals.length ? (
            <Blank title="Henüz referans yok" description="İşletme davetleri oluştukça burada görünecek." />
          ) : (
            <div className="table-scroll margin-top">
              <table className="billing-table">
                <thead>
                  <tr>
                    <th>Davet eden</th>
                    <th>Davet edilen</th>
                    <th>Kredi</th>
                    <th>Durum</th>
                    <th>Tarih</th>
                    <th>İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {data.referrals.map((r) => (
                    <tr key={`${r.referred_tenant}-${r.referrer_tenant}`}>
                      <td>{r.referrer_name}</td>
                      <td>{r.referred_name}</td>
                      <td>{money(Number(r.reward || 0))}</td>
                      <td><span className="badge neutral">{labels[r.status] || r.status}</span></td>
                      <td>{dateLabel(r.created_at.slice(0, 10))}</td>
                      <td>
                        {r.status === "pending" ? (
                          <button
                            className="button small"
                            disabled={busy === r.referred_tenant}
                            onClick={() => review(r.referred_tenant)}
                          >
                            {busy === r.referred_tenant ? <Busy /> : <Check size={14} />}
                            Koşulları kontrol et
                          </button>
                        ) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </PublicShell>
  );
}
