import {
  BarChart3,
  Bell,
  CalendarDays,
  ChevronRight,
  Clock3,
  MessageCircle,
  Search,
  Settings,
  Sparkles,
  UserRound,
  Users,
} from "lucide-react";

const team = [
  { initials: "AY", name: "Ahmet", role: "Saç Uzmanı" },
  { initials: "ZG", name: "Zeynep", role: "Cilt Bakımı" },
  { initials: "MK", name: "Mert", role: "Erkek Bakımı" },
];

const appointments = [
  { cls: "a1", time: "09:00", name: "Ayşe Demir", service: "Saç Kesimi" },
  { cls: "a2", time: "10:00", name: "Mehmet Kaya", service: "Sakal Bakımı" },
  { cls: "a3", time: "11:00", name: "Elif Yılmaz", service: "Cilt Bakımı" },
  { cls: "a4", time: "14:00", name: "Merve Arslan", service: "Saç Rengi" },
  { cls: "a5", time: "14:00", name: "Deniz Çetin", service: "Cilt Bakımı" },
  { cls: "a6", time: "15:00", name: "Burak Yıldız", service: "Saç Kesimi" },
  { cls: "a7", time: "16:00", name: "Emre Taş", service: "Sakal Bakımı" },
];

export function LandingDashboardPreview() {
  return (
    <div className="neta-product-stage" aria-label="Neta işletme paneli örnek görünümü">
      <div className="neta-live-pill"><span /> Canlı randevu görünümü</div>
      <div className="neta-product-shell">
        <aside className="neta-product-side">
          <div className="neta-product-brand"><img src="/neta-logo.png" alt="" /></div>
          <nav>
            <span className="active"><CalendarDays size={15} /> Ana sayfa</span>
            <span><Clock3 size={15} /> Randevular</span>
            <span><UserRound size={15} /> Müşteriler</span>
            <span><Users size={15} /> Ekip</span>
            <span><Sparkles size={15} /> Hizmetler</span>
            <span><MessageCircle size={15} /> Talep/mesajlar <b>3</b></span>
            <span><BarChart3 size={15} /> Raporlar</span>
            <span><Settings size={15} /> Ayarlar</span>
          </nav>
          <div className="neta-wa-mini"><MessageCircle size={17} /><strong>WhatsApp'tan<br/>randevu alın</strong><small>Kurulumu başlat →</small></div>
        </aside>

        <div className="neta-product-main">
          <header className="neta-product-topbar">
            <div className="neta-product-search"><Search size={14} /> Müşteri ara, randevu kontrol et...</div>
            <Bell size={16} />
            <div className="neta-owner"><span>A</span><div><strong>Atölye Studio</strong><small>İşletme sahibi</small></div></div>
          </header>

          <div className="neta-product-kpis">
            <article><CalendarDays size={17}/><div><small>Bugün</small><strong>12 randevu</strong></div><ChevronRight size={15}/></article>
            <article><BarChart3 size={17}/><div><small>Doluluk oranı</small><strong>%78</strong></div><ChevronRight size={15}/></article>
            <article><Users size={17}/><div><small>Kaçan talep</small><strong>4</strong></div><ChevronRight size={15}/></article>
          </div>

          <div className="neta-product-workspace">
            <div className="neta-calendar-card">
              <div className="neta-calendar-head"><strong>26 Eylül 2026, Cumartesi</strong><button>Tüm ekip⌄</button></div>
              <div className="neta-team-head"><span />{team.map((x)=><div key={x.name}><b>{x.initials}</b><p><strong>{x.name}</strong><small>{x.role}</small></p></div>)}</div>
              <div className="neta-calendar-grid">
                {["09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00"].map(t=><span className="neta-time" key={t}>{t}</span>)}
                <i className="neta-gridline l1"/><i className="neta-gridline l2"/><i className="neta-gridline l3"/>
                {appointments.map(a=><div key={a.name} className={`neta-appt ${a.cls}`}><strong>{a.name}</strong><small>{a.service}</small></div>)}
                <div className="neta-open-slot">＋</div>
              </div>
            </div>

            <aside className="neta-product-insights">
              <article className="neta-demand-card"><BarChart3 size={18}/><strong>Cumartesi 18:00–20:00<br/>talep artıyor.</strong><p>Bu saatlerde genellikle yoğunluk %40 daha fazla.</p></article>
              <article className="neta-request-card"><small>Yeni randevu talebi</small><div><span><MessageCircle size={17}/></span><p><strong>13:30<br/>Melis Karaca</strong><small>Saç Kesimi</small></p></div><button>Randevuyu ekle</button><button className="ghost">Detayları gör</button></article>
            </aside>
          </div>
        </div>
      </div>
      <div className="neta-product-glow" />
    </div>
  );
}
