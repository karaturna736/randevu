"use client";

import { useMemo, useState } from "react";
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  Scissors,
  UserRound,
  ChartNoAxesCombined,
  ArrowRight,
} from "lucide-react";
import { demoWorkspace } from "@/lib/demo";
import { money, today } from "@/lib/types";
import { Brand, ThemeToggle, Avatar } from "@/components/product/common";
import {
  Overview,
  Reports,
  AppointmentTable,
} from "@/components/product/overview";

const views = [
  ["overview", "Genel bakış", LayoutDashboard],
  ["appointments", "Randevular", CalendarDays],
  ["customers", "Müşteriler", Users],
  ["services", "Hizmetler", Scissors],
  ["staff", "Ekip", UserRound],
  ["reports", "Gelir raporu", ChartNoAxesCombined],
] as const;

type View = (typeof views)[number][0];

export default function DemoPage() {
  const [view, setView] = useState<View>("overview");
  const w = useMemo(() => demoWorkspace(), []);
  const todayRows = useMemo(
    () =>
      w.appointments
        .filter((a: any) => a.date === today())
        .sort((a: any, b: any) => a.minute - b.minute),
    [w],
  );

  return (
    <main className="auth-page" style={{ minHeight: "100vh" }}>
      <aside className="auth-story" style={{ overflow: "auto" }}>
        <Brand />
        <div className="auth-story-main" style={{ gap: 10 }}>
          <span className="auth-eyebrow">GİRİŞSİZ CANLI DEMO</span>
          <h1 style={{ fontSize: "clamp(2rem,4vw,3.4rem)" }}>
            Neta panelini
            <br />
            <em>hemen keşfedin.</em>
          </h1>
          <p style={{ opacity: 0.8 }}>
            Bu alan yalnızca örnek veriler kullanır. Hiçbir kayıt gerçek müşterilere
            gönderilmez.
          </p>
          <nav className="form-stack" style={{ marginTop: 12 }}>
            {views.map(([id, label, Icon]) => (
              <button
                key={id}
                className={"button " + (view === id ? "primary" : "")}
                onClick={() => setView(id)}
              >
                <Icon size={17} />
                {label}
              </button>
            ))}
          </nav>
        </div>
        <a className="button primary" href="/kayit?rol=business">
          Kendi işletmemi oluştur <ArrowRight size={17} />
        </a>
      </aside>

      <section className="auth-main" style={{ minWidth: 0, overflow: "auto" }}>
        <header>
          <div>
            <strong>{w.business.name}</strong>
            <small style={{ display: "block", opacity: 0.7 }}>
              {w.business.city} · Örnek işletme
            </small>
          </div>
          <ThemeToggle />
        </header>

        <div className="dashboard-content" style={{ width: "100%", maxWidth: 1280 }}>
          <div className="demo-banner">
            <span className="demo-dot" />
            <span>
              <strong>Girişsiz demo</strong> · Veriler temsilidir ve tarayıcıda hazırlanır.
            </span>
          </div>

          {view === "overview" && (
            <Overview
              w={w}
              onSelect={() => {}}
              onNavigate={(next: string) =>
                setView(
                  views.some(([id]) => id === next)
                    ? (next as View)
                    : "appointments",
                )
              }
              onNew={() => (location.href = "/kayit?rol=business")}
            />
          )}

          {view === "appointments" && (
            <section className="panel">
              <div className="section-heading">
                <div>
                  <h2>Bugünün randevuları</h2>
                  <p className="muted">Örnek işletmenin bugünkü planı</p>
                </div>
                <span className="count-pill">{todayRows.length}</span>
              </div>
              <AppointmentTable
                rows={todayRows}
                onSelect={() => {}}
                showDate={false}
              />
            </section>
          )}

          {view === "customers" && (
            <section className="panel">
              <div className="section-heading">
                <div>
                  <h2>Müşteriler</h2>
                  <p className="muted">Örnek müşteri hafızası</p>
                </div>
                <span className="count-pill">{w.customers.length}</span>
              </div>
              <div className="collection-list">
                {w.customers.slice(0, 12).map((c: any) => (
                  <div className="collection-row" key={c.id}>
                    <div className="person-cell">
                      <Avatar name={c.name} />
                      <span>
                        <strong>{c.name}</strong>
                        <small>{c.phone}</small>
                      </span>
                    </div>
                    <span>{c.visits} ziyaret</span>
                    <b>{money(c.total_spent)}</b>
                  </div>
                ))}
              </div>
            </section>
          )}

          {view === "services" && (
            <section className="panel">
              <div className="section-heading">
                <div>
                  <h2>Hizmetler</h2>
                  <p className="muted">Süre ve örnek fiyatlar</p>
                </div>
              </div>
              <div className="collection-list">
                {w.services.map((s: any) => (
                  <div className="collection-row" key={s.id}>
                    <strong>{s.name}</strong>
                    <span>{s.duration} dakika</span>
                    <b>{money(s.price)}</b>
                  </div>
                ))}
              </div>
            </section>
          )}

          {view === "staff" && (
            <section className="panel">
              <div className="section-heading">
                <div>
                  <h2>Ekip</h2>
                  <p className="muted">Örnek çalışma ekibi</p>
                </div>
              </div>
              <div className="collection-list">
                {w.staff.map((p: any) => (
                  <div className="collection-row" key={p.id}>
                    <div className="person-cell">
                      <Avatar name={p.name} color={p.color} />
                      <span>
                        <strong>{p.name}</strong>
                        <small>{p.title}</small>
                      </span>
                    </div>
                    <span className="badge confirmed">Aktif</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {view === "reports" && <Reports w={w} />}
        </div>
      </section>
    </main>
  );
}
