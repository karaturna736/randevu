"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  BadgePercent,
  Building2,
  CreditCard,
  Gift,
  GraduationCap,
  Link2,
  MessageSquareWarning,
  Shield,
  Sparkles,
  Users,
  WalletCards,
} from "lucide-react";
import { PublicShell } from "./public";
import { api, Blank, Busy } from "./common";
import { money } from "@/lib/types";

type AdminHomeData = {
  core: any;
  campaigns: any | null;
  billing: any | null;
  growth: any | null;
  recurring: any | null;
};

function settledValue(result: PromiseSettledResult<any>) {
  return result.status === "fulfilled" ? result.value : null;
}

export default function AdminHome() {
  const [data, setData] = useState<AdminHomeData | null>(null);
  const [error, setError] = useState("");
  const [denied, setDenied] = useState(false);

  async function load() {
    setError("");
    try {
      const core = await api("admin");
      const [campaigns, billing, growth, recurring] = await Promise.allSettled([
        api("campaigns"),
        api("platform-billing"),
        api("platform-growth"),
        api("platform-recurring"),
      ]);
      setData({
        core,
        campaigns: settledValue(campaigns),
        billing: settledValue(billing),
        growth: settledValue(growth),
        recurring: settledValue(recurring),
      });
      setDenied(false);
    } catch (e: any) {
      setData(null);
      setError(e.message || "Yönetim paneli açılamadı.");
      setDenied(e.status === 401 || e.status === 403);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  if (error) {
    return (
      <PublicShell>
        <main className="admin-page">
          <section className="panel">
            <Blank
              title={denied ? "Yönetici erişimi gerekli" : "Yönetim paneli açılamadı"}
              description={error}
            />
            <div className="button-group margin-top">
              {denied && (
                <a className="button primary" href="/giris?return_to=%2Fadmin">
                  Yetkili hesapla giriş yap <ArrowRight size={15} />
                </a>
              )}
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
          <div className="loading-row"><Busy /> Yönetim merkezi yükleniyor…</div>
        </main>
      </PublicShell>
    );
  }

  const businesses = data.core.businesses.filter((b: any) => b.status !== "deleted" && !b.demo);
  const pendingBusinesses = businesses.filter((b: any) => b.status === "pending").length;
  const openComplaints = data.core.complaints.filter((r: any) => r.status !== "resolved").length;
  const pendingTraining = data.core.training.filter((r: any) => !["completed", "cancelled"].includes(r.status)).length;
  const activeCampaigns = (data.campaigns?.campaigns || []).filter((c: any) => {
    const current = Date.now();
    return c.active && !c.deleted_at && new Date(c.starts_at).getTime() <= current && new Date(c.ends_at).getTime() >= current;
  }).length;
  const referrals = data.growth?.referrals || [];
  const pendingReferrals = referrals.filter((r: any) => r.status === "pending").length;
  const paidAmount = Number(data.billing?.totals?.paid_amount || 0);
  const recurringAmount = Number(data.recurring?.totals?.amount || 0);

  const modules = [
    {
      href: "/admin/kayitlar",
      icon: Building2,
      title: "İşletmeler ve kullanıcılar",
      description: "İşletmeleri onaylayın, askıya alın, kullanıcı erişimini ve platform kayıtlarını yönetin.",
      meta: `${businesses.length} işletme · ${data.core.users.length} kullanıcı`,
    },
    {
      href: "/admin/kampanyalar",
      icon: BadgePercent,
      title: "Kampanyalar",
      description: "İndirim kodu oluşturun, hedef işletme veya kayıtlı kişi seçin, tarih ve kullanım limitlerini yönetin.",
      meta: `${activeCampaigns} aktif kampanya`,
    },
    {
      href: "/admin/odemeler",
      icon: CreditCard,
      title: "Ödeme ve abonelikler",
      description: "Platform fiyatını, PayTR bağlantısını, iyzico aboneliklerini ve tahsilat geçmişini yönetin.",
      meta: `${money(paidAmount + recurringAmount)} doğrulanmış tahsilat`,
    },
    {
      href: "/admin/gecici-odeme",
      icon: Link2,
      title: "Geçici gerçek ödeme",
      description: "Bireysel iyzico Link bağlantılarını tanımlayın, ödeme taleplerini doğrulayın ve 30 günlük erişimi kontrollü açın.",
      meta: "Şirket açılışına kadar kontrollü akış",
    },
    {
      href: "/admin/demo-plus",
      icon: Sparkles,
      title: "Plus satış demosu",
      description: "Gerçek veritabanlı, tam Plus yetkili demo işletmesini açın; randevu ve tüm modülleri müşteriye canlı gösterin.",
      meta: "Kalıcı demo verisi · tam modül erişimi",
    },
    {
      href: "/admin/referanslar",
      icon: Gift,
      title: "Referans ve krediler",
      description: "İşletme davetlerini, bekleyen referansları ve kredi kazanım durumlarını inceleyin.",
      meta: `${pendingReferrals} bekleyen referans`,
    },
  ];

  return (
    <PublicShell>
      <main className="admin-page">
        <div className="page-heading">
          <div>
            <span className="eyebrow">NETA · PLATFORM YÖNETİMİ</span>
            <h1>Yönetim merkezi.</h1>
            <p>İşletmelerden kampanyalara, aboneliklerden satış demosuna kadar tek giriş noktası.</p>
          </div>
          <span className="badge neutral"><Shield size={14} /> Yetkili erişim</span>
        </div>

        <div className="stats-grid">
          {[
            ["Aktif işletme", businesses.filter((b: any) => b.status === "approved").length, Building2],
            ["Kullanıcı", data.core.users.length, Users],
            ["Aktif kampanya", activeCampaigns, BadgePercent],
            ["Tahsilat", money(paidAmount + recurringAmount), WalletCards],
          ].map(([label, value, Icon]: any) => (
            <section className="stat-card" key={label}>
              <div className="stat-top">{label}<Icon size={19} /></div>
              <strong className="stat-value">{value}</strong>
            </section>
          ))}
        </div>

        <section className="panel margin-top">
          <div className="panel-header"><div><h2>Yönetim modülleri</h2><p className="muted">Neta'nın ana kontrollerine buradan geçin.</p></div></div>
          <div className="stats-grid margin-top">
            {modules.map((item) => (
              <Link href={item.href} key={item.href} className="stat-card" style={{ textDecoration: "none", color: "inherit" }}>
                <div className="stat-top"><item.icon size={20} /><ArrowRight size={17} /></div>
                <strong style={{ fontSize: 18 }}>{item.title}</strong>
                <p className="muted" style={{ marginTop: 8 }}>{item.description}</p>
                <small>{item.meta}</small>
              </Link>
            ))}
          </div>
        </section>

        <div className="stats-grid margin-top">
          <section className="panel">
            <div className="stat-top"><Activity size={19} /> Dikkat isteyenler</div>
            <div className="form-stack margin-top">
              <Link className="text-button" href="/admin/kayitlar"><Shield size={16} /> {pendingBusinesses} işletme onay bekliyor</Link>
              <Link className="text-button" href="/admin/kayitlar"><MessageSquareWarning size={16} /> {openComplaints} açık şikâyet</Link>
              <Link className="text-button" href="/admin/kayitlar"><GraduationCap size={16} /> {pendingTraining} açık eğitim talebi</Link>
              <Link className="text-button" href="/admin/referanslar"><Gift size={16} /> {pendingReferrals} bekleyen referans</Link>
            </div>
          </section>

          <section className="panel">
            <div className="stat-top"><Shield size={19} /> Sistem durumu</div>
            <div className="form-stack margin-top">
              <span className="badge neutral">PayTR: {data.billing?.connection?.credentials ? "bağlı" : "eksik"}</span>
              <span className="badge neutral">iyzico: {data.recurring?.connection?.configured ? (data.recurring.connection.live ? "canlı" : "test") : "eksik"}</span>
              <span className="badge neutral">Referans programı: {data.growth?.enabled ? "aktif" : "kapalı"}</span>
              <span className="badge neutral">Google giriş: {data.billing?.auth?.google ? "aktif" : "eksik"}</span>
            </div>
          </section>
        </div>
      </main>
    </PublicShell>
  );
}
