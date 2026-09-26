"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  GitBranch,
  RefreshCw,
  Search,
  UserRound,
  Users,
} from "lucide-react";
import { PublicShell } from "./public";
import { Blank, Busy } from "./common";
import { money } from "@/lib/types";

type Membership = {
  tenant_id: string;
  user_id: string;
  customer_id: string;
  joined_at: string;
  updated_at: string;
  business_name: string;
  business_slug: string;
  business_category: string;
  business_city: string;
  business_status: string;
  account_name: string;
  account_email: string;
  account_phone: string;
  account_disabled: number;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  appointment_count: number;
  linked_booking_count: number;
  last_appointment_date: string | null;
  completed_revenue: number;
};

function includes(row: Membership, query: string) {
  if (!query.trim()) return true;
  const q = query.toLocaleLowerCase("tr-TR");
  return [
    row.account_name,
    row.account_email,
    row.account_phone,
    row.customer_name,
    row.customer_email,
    row.customer_phone,
    row.business_name,
    row.business_category,
    row.business_city,
    row.user_id,
    row.customer_id,
  ]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase("tr-TR")
    .includes(q);
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const parsed = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  return Number.isNaN(+parsed) ? value : parsed.toLocaleDateString("tr-TR");
}

export default function AdminCustomerMemberships() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [multiOnly, setMultiOnly] = useState(false);

  async function load() {
    setError("");
    try {
      const response = await fetch("/api/customer-memberships", { cache: "no-store" });
      const result: any = await response.json();
      if (!response.ok) throw new Error(result.error || "Üyelikler yüklenemedi.");
      setData(result);
    } catch (e: any) {
      setError(e.message || "Üyelikler yüklenemedi.");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const groups = useMemo(() => {
    const rows: Membership[] = (data?.memberships || []).filter((row: Membership) =>
      includes(row, search),
    );
    const map = new Map<string, Membership[]>();
    for (const row of rows) {
      const current = map.get(row.user_id) || [];
      current.push(row);
      map.set(row.user_id, current);
    }
    return Array.from(map.entries())
      .map(([userId, memberships]) => ({ userId, memberships }))
      .filter((group) => !multiOnly || group.memberships.length > 1)
      .sort((a, b) =>
        a.memberships[0].account_name.localeCompare(b.memberships[0].account_name, "tr"),
      );
  }, [data, search, multiOnly]);

  return (
    <PublicShell>
      <main className="admin-page">
        <div className="page-heading">
          <div>
            <span className="eyebrow">NETA · MÜŞTERİ ÜYELİKLERİ</span>
            <h1>Hesap tek, işletme üyelikleri ayrı.</h1>
            <p>
              Aynı Neta hesabının farklı işletmelerdeki müşteri üyeliklerini birbirinden
              bağımsız dallar halinde görün.
            </p>
          </div>
          <div className="button-group">
            <Link className="button" href="/admin">
              <ArrowLeft size={16} /> Admin
            </Link>
            <Link className="button" href="/admin/sistem">
              Sistem kontrolü
            </Link>
            <button className="button primary" onClick={load}>
              <RefreshCw size={16} /> Yenile
            </button>
          </div>
        </div>

        {error ? (
          <section className="panel">
            <Blank title="Üyelikler açılamadı" description={error} />
            <button className="button primary" onClick={load}>Tekrar dene</button>
          </section>
        ) : !data ? (
          <div className="loading-row"><Busy /> Müşteri üyelikleri yükleniyor…</div>
        ) : (
          <>
            <div className="stats-grid">
              <section className="stat-card">
                <div className="stat-top">Neta hesabı <Users size={19} /></div>
                <strong className="stat-value">{data.totals.accounts}</strong>
              </section>
              <section className="stat-card">
                <div className="stat-top">İşletme üyeliği <GitBranch size={19} /></div>
                <strong className="stat-value">{data.totals.memberships}</strong>
              </section>
              <section className="stat-card">
                <div className="stat-top">Çoklu işletme müşterisi <UserRound size={19} /></div>
                <strong className="stat-value">{data.totals.multi_business_accounts}</strong>
              </section>
              <section className="stat-card">
                <div className="stat-top">Tek hesaptaki en çok işletme <Building2 size={19} /></div>
                <strong className="stat-value">{data.totals.max_businesses_per_account}</strong>
              </section>
            </div>

            <section className="panel margin-top">
              <div style={{ display: "flex", gap: 12, alignItems: "end", justifyContent: "space-between", flexWrap: "wrap" }}>
                <label className="field" style={{ minWidth: 280, margin: 0, flex: 1 }}>
                  <span>Hesap, müşteri veya işletme ara</span>
                  <div style={{ position: "relative" }}>
                    <Search size={16} style={{ position: "absolute", left: 10, top: 12, opacity: 0.65 }} />
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Ad, telefon, e-posta, işletme…"
                      style={{ paddingLeft: 34 }}
                    />
                  </div>
                </label>
                <label className="button" style={{ cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={multiOnly}
                    onChange={(e) => setMultiOnly(e.target.checked)}
                  />
                  Sadece birden fazla işletmede olanlar
                </label>
              </div>
            </section>

            <div className="form-stack margin-top">
              {groups.map((group) => {
                const account = group.memberships[0];
                return (
                  <section className="panel" key={group.userId}>
                    <div className="panel-header">
                      <div>
                        <div className="stat-top" style={{ justifyContent: "flex-start", gap: 8 }}>
                          <UserRound size={18} />
                          <strong>{account.account_name}</strong>
                          {account.account_disabled ? <span className="badge">Hesap kapalı</span> : null}
                        </div>
                        <p className="muted" style={{ marginTop: 6 }}>
                          {account.account_email} · {account.account_phone || "telefon yok"}
                        </p>
                        <small style={{ userSelect: "all" }}>{group.userId}</small>
                      </div>
                      <span className="badge neutral">
                        <GitBranch size={14} /> {group.memberships.length} ayrı işletme üyeliği
                      </span>
                    </div>

                    <div
                      className="stats-grid margin-top"
                      style={{ gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))" }}
                    >
                      {group.memberships.map((membership) => (
                        <article className="stat-card" key={`${membership.user_id}:${membership.tenant_id}`}>
                          <div className="stat-top">
                            <span><Building2 size={17} /> {membership.business_name}</span>
                            <span className="badge neutral">{membership.business_status}</span>
                          </div>
                          <p className="muted">
                            {membership.business_category} · {membership.business_city || "şehir yok"}
                          </p>

                          <div className="notice" style={{ marginTop: 12 }}>
                            <strong>Bu işletmedeki müşteri kartı</strong>
                            <div>{membership.customer_name}</div>
                            <div>{membership.customer_phone}</div>
                            <div>{membership.customer_email || "e-posta yok"}</div>
                            <small style={{ userSelect: "all" }}>{membership.customer_id}</small>
                          </div>

                          <div className="form-stack" style={{ marginTop: 12, gap: 6 }}>
                            <span><CalendarDays size={14} /> {membership.appointment_count} işletme randevusu</span>
                            <span>{membership.linked_booking_count} randevu Neta hesabına bağlı</span>
                            <span>Üyelik başlangıcı: {formatDate(membership.joined_at)}</span>
                            <span>Son randevu: {formatDate(membership.last_appointment_date)}</span>
                            <span>Tamamlanan hizmet: {money(Number(membership.completed_revenue || 0))}</span>
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                );
              })}

              {!groups.length && (
                <section className="panel">
                  <Blank
                    title="Üyelik bulunamadı"
                    description="Aramayı değiştirin veya çoklu işletme filtresini kapatın."
                  />
                </section>
              )}
            </div>
          </>
        )}
      </main>
    </PublicShell>
  );
}
