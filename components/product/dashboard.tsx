"use client";
import { useState, useEffect, useCallback } from "react";
import {
  Wallet,
  Route,
  Link2,
  Gift,
  LifeBuoy,
  Radar,
  BarChart3,
  LayoutDashboard,
  CalendarDays,
  CalendarRange,
  Users,
  Scissors,
  UserRound,
  ChartNoAxesCombined,
  Plug,
  Settings as SettingsIcon,
  ChevronRight,
  ChevronLeft,
  Plus,
  Sparkles,
  ArrowUpRight,
  ArrowRight,
  Search,
  Globe,
  Shield,
  Store,
  LogOut,
  HeartHandshake,
  Send,
  MessageSquare,
  Check,
  Building2,
} from "lucide-react";
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Toaster, toast } from "sonner";
import { demoWorkspace } from "@/lib/demo";
import { money, time, today, addDays, dateLabel, STATUS } from "@/lib/types";
import {
  api,
  Avatar,
  Brand,
  ThemeToggle,
  Modal,
  Field,
  Blank,
  Busy,
  Pick,
} from "./common";
import { DemandInsights, ServiceInsights } from "./insights";
import { Overview, Reports, AppointmentTable } from "./overview";
import { Management, Settings, Integrations } from "./management";
import BookingForm from "./booking-form";
import AppointmentSheet from "./appointment-sheet";
import { useAppointmentTools } from "./webmcp";
import { Assistant } from "./assistant";
import { AccountMenu, AccountGate } from "./session";
import { WelcomeWorkspace, BusinessChecklist } from "./onboarding";

import { Receivables, Journeys } from "./customer-operations";
import { BookingLink, Growth, WhatsAppPanel, HelpCenter } from "./growth";
import { RecoveryEngine, SetupCenter } from "./recovery-setup";
import { BranchProfitability } from "./branches";
import { PlusTools } from "./plus-tools";

const NAV = [
  { id: "overview", title: "Genel bakış", icon: LayoutDashboard },
  { id: "appointments", title: "Randevular", icon: CalendarDays },
  { id: "calendar", title: "Takvim", icon: CalendarRange },
  { id: "customers", title: "Müşteriler", icon: Users },
  { id: "services", title: "Hizmetler", icon: Scissors },
  { id: "staff", title: "Ekip", icon: UserRound },
  { id: "receivables", title: "Borç / Veresiye", icon: Wallet },
  { id: "journeys", title: "Hizmet yolculuğu", icon: Route },
  { id: "share", title: "Randevu linkim", icon: Link2 },
  { id: "growth", title: "Pazarlama ve büyüme", icon: Gift },
  { id: "recovery", title: "Gelir kurtarma", icon: HeartHandshake },
  { id: "demand", title: "Talep fırsatları", icon: Radar },
  { id: "service-report", title: "İşlem analizi", icon: BarChart3 },
  { id: "reports", title: "Gelir raporu", icon: ChartNoAxesCombined },
  { id: "branches", title: "Şube kârlılığı", icon: Building2 },
  { id: "plus-tools", title: "Plus araçları", icon: Plug },
  { id: "whatsapp", title: "WhatsApp", icon: MessageSquare },
  { id: "setup-center", title: "Kurulum Merkezi", icon: Store },
  { id: "help", title: "Yardım merkezi", icon: LifeBuoy },
  { id: "settings", title: "Ayarlar", icon: SettingsIcon },
];

const VIEW_MODULES: Record<string, string> = {
  receivables: "receivables",
  journeys: "journeys",
  growth: "growth",
  recovery: "recovery",
  demand: "demand",
  "service-report": "serviceReport",
  reports: "revenueReport",
  branches: "branchProfit",
  "plus-tools": "managementApi",
  whatsapp: "whatsapp",
  integrations: "whatsapp",
  "setup-center": "setupCenter",
};
function planAllowsView(w: any, id: string) {
  const module = VIEW_MODULES[id];
  if (!module) return true;
  if (w?.preview || w?.business?.demo) return true;
  return !!w?.entitlements?.modules?.[module];
}

const TITLES: Record<string, [string, string]> = {
  receivables: [
    "Alacaklarınız kaybolmasın.",
    "Müşteri borçlarını ve tahsilatları bir arada takip edin.",
  ],
  journeys: [
    "Her müşteri, kendi yolculuğunda.",
    "Hizmetin aşamalarını ve sıradaki adımı görün.",
  ],
  share: [
    "Randevunuza açılan kapı.",
    "İşletmenizin tek bağlantısını her yerde paylaşın.",
  ],
  growth: [
    "Müşterilerinizle yeniden buluşun.",
    "Geri çağırma, işletme davetleri ve sayfa markanız.",
  ],
  recovery: [
    "Boş saatleri gelire çevirin.",
    "Bekleme listesini, sıralı teklifleri ve kurtarılan cironuzu görün.",
  ],
  "plus-tools": [
    "Plus altyapınız tek merkezde.",
    "İşletme web sitesi, Yönetim API'si ve şubeler arası otomasyonu yönetin.",
  ],
  "setup-center": [
    "İşletmenizi birlikte hazırlayalım.",
    "Excel aktarımı, randevu bağlantısı ve 30 dakikalık eğitim tek yerde.",
  ],
  whatsapp: [
    "Bir mesajdan randevuya.",
    "Web ve WhatsApp, aynı takvimde buluşuyor.",
  ],
  help: [
    "Nasıl yardımcı olabiliriz?",
    "Aradığınız adımı bulun, işinize devam edin.",
  ],
  demand: [
    "Talep var. Peki ya yer?",
    "Uygun saat bulamayan müşterilerinizi ve kapasite fırsatlarını görün.",
  ],
  "service-report": [
    "En çok hangi işlem yapılıyor?",
    "Hizmetlerinizi tamamlanan işlem, süre ve ciroyla karşılaştırın.",
  ],
  overview: [
    "Her şey, bir arada.",
    "Randevularınıza hâkim olun, işinize odaklanın.",
  ],
  appointments: [
    "Her randevu, iyi bir başlangıç.",
    "Planınızı yönetin, müşterilerinize zaman ayırın.",
  ],
  calendar: [
    "Gününüzü birlikte planlayalım.",
    "Ekibinizin randevuları tek bir takvimde.",
  ],
  customers: [
    "Müşterilerinizi hatırlayan bir sistem.",
    "Her ziyaret, daha iyi bir deneyim için bir adım.",
  ],
  retention: [
    "Yeniden bir araya gelin.",
    "Son ziyaretinin üzerinden 90 gün geçen müşterileriniz.",
  ],
  services: [
    "Ustalığınızı hizmete dönüştürün.",
    "Hizmetlerinizi, sürelerinizi ve fiyatlarınızı yönetin.",
  ],
  staff: ["Birlikte daha iyi.", "Ekibinizi ve çalışma saatlerini düzenleyin."],
  reports: [
    "İşinizi rakamlarla tanıyın.",
    "Randevularınızdan doğan içgörüler.",
  ],
  branches: [
    "Şubelerinizi rakamlarla yönetin.",
    "Hangi şube kârda, hangisi zararda; gelir, gider ve net sonucu karşılaştırın.",
  ],
  integrations: [
    "İşletmenize yeni yetenekler.",
    "Bildirim, ödeme ve asistan bağlantıları.",
  ],
  settings: [
    "Size göre, sizin için.",
    "İşletmenizin profilini ve randevu kurallarını düzenleyin.",
  ],
};

function sectorHeading(view: string, w: any): [string, string] {
  const p = w.configuration?.businessProfile;
  if (!p) return TITLES[view] || TITLES.overview;
  if (view === "overview") return ["Her şey, bir arada.", p.workspaceHint];
  if (view === "services")
    return [
      p.serviceLabel + "lerinizi yönetin.",
      p.serviceLabel +
        " sürelerini, fiyatlarını ve randevu uygunluğunu düzenleyin.",
    ];
  if (view === "staff")
    return [
      p.staffPlural + " için ortak plan.",
      p.staffPlural + " çalışma saatlerini ve izinlerini düzenleyin.",
    ];
  if (view === "customers")
    return [
      p.customerLabel + " geçmişi, tek yerde.",
      p.customerLabel + " ziyaretlerini, tercihlerini ve harcamalarını görün.",
    ];
  if (view === "appointments")
    return [
      p.appointmentLabel + " planınız hazır.",
      p.customerLabel +
        ", " +
        p.serviceLabel.toLocaleLowerCase("tr-TR") +
        " ve saat bilgilerini yönetin.",
    ];
  return TITLES[view] || TITLES.overview;
}

function SideNavigation({ w, view, navigate, onSetup, selectBusiness }: any) {
  const { setOpenMobile } = useSidebar();
  return (
    <Sidebar className="app-sidebar">
      <SidebarHeader>
        <Brand />
        <div className="business-switch">
          <span className="business-logo">
            <Scissors size={20} />
          </span>
          <div>
            <strong>{w.business.name}</strong>
            <small>{w.business.city || "İşletme paneli"}</small>
          </div>
        </div>
        {w.businesses?.length > 1 && (
          <Pick
            label="İşletme değiştir"
            value={w.business.id}
            onChange={selectBusiness}
            options={w.businesses.map((b: any) => ({
              value: b.id,
              label: b.name,
            }))}
          />
        )}
      </SidebarHeader>
      <SidebarContent>
        <span className="nav-label">ÇALIŞMA ALANI</span>
        <SidebarMenu>
          {NAV.filter((n) => planAllowsView(w, n.id)).map((n, i) => (
            <SidebarMenuItem
              key={n.id}
              className={i === 6 ? "nav-section-break" : ""}
            >
              <SidebarMenuButton
                className="nav-button"
                isActive={
                  view === n.id ||
                  (view === "retention" && n.id === "customers")
                }
                onClick={() => {
                  navigate(n.id);
                  setOpenMobile(false);
                }}
              >
                <n.icon size={18} />
                <span>{n.title}</span>
                {n.id === "appointments" && (
                  <span className="nav-count">
                    {
                      w.appointments.filter(
                        (a: any) =>
                          a.date === today() && a.status === "confirmed",
                      ).length
                    }
                  </span>
                )}
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter>
        {w.preview ? (
          <button className="footer-nav" onClick={onSetup}>
            <Plus size={17} />
            İşletmemi oluştur
          </button>
        ) : (
          <a className="footer-nav" href="/kurulum">
            <Plus size={17} />
            Yeni işletme ekle
            <ArrowUpRight size={14} />
          </a>
        )}
        <a
          className="footer-nav"
          href={"/abonelik" + (!w.preview ? "?tenant=" + w.business.id : "")}
        >
          <Shield size={17} />
          Abonelik ve ödemeler
          <ArrowUpRight size={14} />
        </a>
        <a className="footer-nav" href="/kesfet">
          <Globe size={17} />
          İşletmeleri keşfet
          <ArrowUpRight size={14} />
        </a>
        {w.isAdmin && (
          <a className="footer-nav" href="/admin">
            <Shield size={17} />
            Platform yönetimi
            <ArrowUpRight size={14} />
          </a>
        )}
        <div className="account-row">
          <Avatar name={w.user?.displayName || "İşletme sahibi"} />
          <div>
            <strong>
              {w.preview ? "Hoş geldiniz" : w.user?.displayName?.split("@")[0]}
            </strong>
            <small>
              {w.preview ? "İşletmenizi oluşturun" : "İşletme sahibi"}
            </small>
          </div>
          {!w.preview ? (
            <a
              className="icon-button"
              aria-label="Çıkış yap"
              href="/cikis"
              target="_top"
            >
              <LogOut size={16} />
            </a>
          ) : (
            <button
              className="icon-button"
              aria-label="Hesabını oluştur"
              onClick={onSetup}
            >
              <ArrowRight size={16} />
            </button>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

export default function Dashboard({
  initialView = "overview",
}: { initialView?: string } = {}) {
  const [w, setW] = useState<any>(() => demoWorkspace()),
    [view, setView] = useState(initialView),
    [needsOnboarding, setNeedsOnboarding] = useState(false),
    [booking, setBooking] = useState<any>(false),
    [selected, setSelected] = useState<any>(null),
    [customer, setCustomer] = useState<any>(null),
    [assistant, setAssistant] = useState(false),
    [loading, setLoading] = useState(true),
    [loadError, setLoadError] = useState("");
  const refresh = useCallback(async (id?: string, demo = false) => {
    setLoading(true);
    setLoadError("");
    try {
      const data = demo
        ? await api("demo-workspace", {})
        : await api("workspace" + (id ? "?tenant=" + id : ""));
      if (data.subscription_required) {
        location.replace(
          "/abonelik?tenant=" +
            encodeURIComponent(data.business.id) +
            "&gerekli=1",
        );
        return;
      }
      setNeedsOnboarding(!!data.needs_onboarding);
      if (data.needs_onboarding) {
        setW({ ...demoWorkspace(), user: data.user, isAdmin: data.isAdmin });
      } else setW(data);
    } catch (e: any) {
      if (e.status === 401) {
        setNeedsOnboarding(false);
        setW(demoWorkspace());
      } else setLoadError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    const publicDemo = location.pathname === "/demo" || q.get("demo") === "1";
    if (q.get("view") && TITLES[q.get("view")!]) setView(q.get("view")!);
    refresh(q.get("tenant") || undefined, publicDemo);
    if (q.has("setup")) location.assign("/kurulum");
  }, [refresh]);
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [view]);
  const requireReal = () => {
    if (w.preview) {
      location.assign("/kurulum");
      toast.info("Kaydetmek için önce işletmenizi oluşturun.");
      return false;
    }
    return true;
  };
  const openBooking = useCallback(() => setBooking({}), []);
  useAppointmentTools(w, openBooking);
  const activeView = planAllowsView(w, view) ? view : "overview";
  const canUseAssistant =
    w.preview || w.business?.demo || Number(w.entitlements?.aiDaily || 0) > 0;
  const [title, description] = sectorHeading(activeView, w);
  const navTitle =
    NAV.find((n) => n.id === activeView)?.title || "Genel bakış";
  if (
    !loading &&
    w.preview &&
    !loadError &&
    location.pathname !== "/demo" &&
    new URLSearchParams(location.search).get("demo") !== "1" &&
    !needsOnboarding
  )
    return (
      <>
        <header className="public-header">
          <Brand />
          <ThemeToggle />
        </header>
        <main className="billing-page">
          <AccountGate returnTo="/panel">
            <WelcomeWorkspace isAdmin={w.isAdmin} />
          </AccountGate>
        </main>
      </>
    );
  if (!loading && needsOnboarding)
    return <WelcomeWorkspace isAdmin={w.isAdmin} />;
  return (
    <SidebarProvider style={{ "--sidebar-width": "238px" } as any}>
      <SideNavigation
        w={w}
        view={activeView}
        navigate={setView}
        selectBusiness={(id: string) => {
          setSelected(null);
          setCustomer(null);
          refresh(id);
        }}
        onSetup={() => location.assign("/kurulum")}
      />
      <SidebarInset className="app-main">
        <header className="topbar">
          <div className="breadcrumb">
            <SidebarTrigger className="mobile-menu" />
            <span>Çalışma alanı</span>
            <ChevronRight size={14} />
            <strong>{navTitle}</strong>
          </div>
          <div className="topbar-right">
            <span className="topbar-date">
              <CalendarDays size={15} />
              {new Date(today() + "T12:00:00Z").toLocaleDateString("tr-TR", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </span>
            <ThemeToggle />
            <span className="topbar-divider" />
            {w.preview ? (
              <span className="badge neutral">Girişsiz demo</span>
            ) : (
              <AccountMenu />
            )}
          </div>
        </header>
        <main className="dashboard-content">
          <div className="page-heading">
            <div>
              <span className="eyebrow greeting">
                {w.business.name.toLocaleUpperCase("tr-TR")} · İŞLETME PANELİ
              </span>
              <h1>{title}</h1>
              <p>{description}</p>
            </div>
            <div className="button-group">
              <button className="button" onClick={() => setView("share")}>
                <Link2 size={16} />
                Randevu linkim
              </button>
              {canUseAssistant && (
                <button
                  className="button assistant-trigger"
                  onClick={() => setAssistant(true)}
                >
                  <Sparkles size={16} />
                  Randevu asistanı
                </button>
              )}
              <button className="button primary" onClick={openBooking}>
                <Plus size={18} />
                Yeni randevu
              </button>
            </div>
          </div>
          {loadError && (
            <div className="error-message">
              {loadError}{" "}
              <button className="text-button" onClick={() => refresh()}>
                Tekrar dene
              </button>
            </div>
          )}
          {w.preview ? (
            <div className="demo-banner">
              <span className="demo-dot" />
              <span>
                <strong>Örnek işletme</strong>
                <span className="banner-detail">
                  {" "}
                  · Paneli keşfedin. Gösterilen veriler temsilidir.
                </span>
              </span>
              <button onClick={() => location.assign("/kurulum")}>
                {loading ? (
                  <Busy />
                ) : (
                  <>
                    Kendi işletmemi oluştur <ArrowRight size={14} />
                  </>
                )}
              </button>
            </div>
          ) : w.business.demo ? (
            <div className="demo-banner">
              <span className="demo-dot" />
              <span>
                <strong>Deneme çalışma alanı</strong> · Tüm değişiklikler yalnızca
                bu örnek alana kaydedilir; müşterilere mesaj gönderilmez.
              </span>
              <button onClick={() => location.assign("/kurulum")}>
                Gerçek işletme oluştur <ArrowRight size={14} />
              </button>
            </div>
          ) : w.business.status === "pending" ? (
            <div className="notice">
              İşletmeniz onay bekliyor. Hizmet ve personel ekleyebilirsiniz;
              randevu sayfası onaydan sonra açılır.
            </div>
          ) : null}
          {activeView === "overview" && (
            <>
              <BookingLink w={w} compact onNavigate={setView} />
              <BusinessChecklist
                w={w}
                onNavigate={setView}
                onSelect={setSelected}
              />
              <Overview
                w={w}
                onSelect={setSelected}
                onNavigate={setView}
                onNew={openBooking}
              />
            </>
          )}{" "}
          {activeView === "appointments" && (
            <Appointments w={w} onSelect={setSelected} />
          )}{" "}
          {activeView === "calendar" && <Calendar w={w} onSelect={setSelected} />}{" "}
          {(activeView === "customers" || activeView === "retention") && (
            <Customers
              w={w}
              retention={activeView === "retention"}
              onSelect={setCustomer}
            />
          )}{" "}
          {(activeView === "services" || activeView === "staff") && (
            <Management
              key={w.business.id + view}
              w={w}
              view={activeView}
              refresh={() => refresh(w.business.id)}
              requireReal={requireReal}
            />
          )}{" "}
          {activeView === "demand" && <DemandInsights w={w} onNavigate={setView} />}{" "}
          {activeView === "service-report" && <ServiceInsights w={w} />}{" "}
          {activeView === "reports" && <Reports w={w} />}{" "}
          {activeView === "branches" && (
            <BranchProfitability key={w.business.id} w={w} />
          )}{" "}
          {activeView === "plus-tools" && (
            <PlusTools key={w.business.id} w={w} />
          )}{" "}
          {activeView === "receivables" && (
            <Receivables key={w.business.id} w={w} requireReal={requireReal} />
          )}{" "}
          {activeView === "journeys" && (
            <Journeys key={w.business.id} w={w} requireReal={requireReal} />
          )}{" "}
          {activeView === "share" && <BookingLink key={w.business.id} w={w} />}{" "}
          {activeView === "growth" && (
            <Growth key={w.business.id} w={w} requireReal={requireReal} />
          )}{" "}
          {activeView === "recovery" && <RecoveryEngine key={w.business.id} w={w} />}{" "}
          {(activeView === "whatsapp" || activeView === "integrations") && (
            <WhatsAppPanel key={w.business.id} w={w} onNavigate={setView} />
          )}{" "}
          {activeView === "help" && (
            <HelpCenter key={w.business.id} w={w} onNavigate={setView} />
          )}{" "}
          {activeView === "setup-center" && <SetupCenter key={w.business.id} w={w} />}{" "}
          {activeView === "settings" && (
            <Settings
              key={w.business.id}
              w={w}
              refresh={() => refresh(w.business.id)}
              requireReal={requireReal}
            />
          )}
          <footer className="dashboard-footer">
            <span>Biraz daha düzen. İşinize daha çok zaman.</span>
            <span>neta randevu</span>
          </footer>
        </main>
      </SidebarInset>
      <Modal
        open={!!booking}
        onClose={() => setBooking(false)}
        title="Yeni bir randevu"
        description={
          w.business.name +
          " · " +
          (w.preview ? "Örnek akış" : "İşletmenize randevu ekleyin")
        }
        wide
      >
        {booking && (
          <BookingForm
            key={JSON.stringify(booking)}
            data={w}
            tenantId={w.preview ? undefined : w.business.id}
            demo={w.preview}
            initial={booking.service_id ? booking : undefined}
            onSaved={() => !w.preview && refresh(w.business.id)}
          />
        )}
      </Modal>
      {selected && (
        <AppointmentSheet
          key={selected.id}
          a={selected}
          w={w}
          onClose={() => setSelected(null)}
          refresh={() => refresh(w.business.id)}
          requireReal={requireReal}
        />
      )}{" "}
      {customer && (
        <CustomerSheet
          customer={customer}
          w={w}
          onClose={() => setCustomer(null)}
          onAppointment={(a: any) => {
            setCustomer(null);
            setSelected(a);
          }}
        />
      )}
      <Assistant
        open={assistant}
        onClose={() => setAssistant(false)}
        w={w}
        onBook={(x: any) => {
          setAssistant(false);
          setBooking(x);
        }}
      />
      <Toaster position="bottom-right" richColors />
    </SidebarProvider>
  );
}

function Appointments({ w, onSelect }: any) {
  const [search, setSearch] = useState(""),
    [status, setStatus] = useState("all"),
    [date, setDate] = useState(today());
  const rows = w.appointments
    .filter(
      (a: any) =>
        (!date || a.date === date) &&
        (status === "all" || a.status === status) &&
        (a.customer_name + " " + a.service_name + " " + a.customer_phone)
          .toLocaleLowerCase("tr-TR")
          .includes(search.toLocaleLowerCase("tr-TR")),
    )
    .sort(
      (a: any, b: any) => a.date.localeCompare(b.date) || a.minute - b.minute,
    );
  return (
    <section className="panel">
      <div className="toolbar">
        <div className="search-input">
          <Search size={17} />
          <Input
            aria-label="Randevu ara"
            placeholder="Müşteri, telefon veya hizmet ara…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="button-group">
          <Input
            aria-label="Randevu günü"
            className="date-input"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <button
            className="button"
            onClick={() => setDate(date ? "" : today())}
          >
            {date ? "Tüm tarihler" : "Bugün"}
          </button>
        </div>
      </div>
      <Tabs value={status} onValueChange={setStatus}>
        <TabsList className="filter-tabs">
          <TabsTrigger value="all">Tümü</TabsTrigger>
          {Object.entries(STATUS).map(([key, label]) => (
            <TabsTrigger key={key} value={key}>
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <AppointmentTable rows={rows} showDate={!date} onSelect={onSelect} />
      <p className="helper">{rows.length} randevu gösteriliyor.</p>
    </section>
  );
}

function Calendar({ w, onSelect }: any) {
  const [date, setDate] = useState(today());
  const people = w.staff.filter((p: any) => p.active),
    rows = w.appointments.filter(
      (a: any) => a.date === date && a.status !== "cancelled",
    );
  const spans = people
    .map(
      (p: any) =>
        JSON.parse(p.hours)[String(new Date(date + "T12:00:00Z").getUTCDay())],
    )
    .filter(Boolean);
  const start =
    Math.floor(
      Math.min(
        540,
        ...spans.map((h: any) => h[0]),
        ...rows.map((a: any) => a.minute),
      ) / 60,
    ) * 60;
  const end =
    Math.ceil(
      Math.max(
        1140,
        ...spans.map((h: any) => h[1]),
        ...rows.map((a: any) => a.minute + a.duration),
      ) / 60,
    ) * 60;
  const height = ((end - start) / 60) * 64;
  return (
    <section className="panel calendar-panel">
      <div className="toolbar">
        <div className="button-group">
          <button
            className="icon-button"
            aria-label="Önceki gün"
            onClick={() => setDate(addDays(date, -1))}
          >
            <ChevronLeft size={19} />
          </button>
          <Input
            aria-label="Takvim tarihi"
            className="date-input"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <button
            className="icon-button"
            aria-label="Sonraki gün"
            onClick={() => setDate(addDays(date, 1))}
          >
            <ChevronRight size={19} />
          </button>
          <button className="button" onClick={() => setDate(today())}>
            Bugün
          </button>
        </div>
        <span className="period-pill">Gün görünümü · Türkiye saati</span>
      </div>
      {people.length ? (
        <div className="calendar-scroll">
          <div
            className="calendar-grid"
            style={{
              gridTemplateColumns: `58px repeat(${people.length},minmax(160px,1fr))`,
            }}
          >
            <div className="calendar-corner" />
            {people.map((p: any) => (
              <div className="calendar-person" key={p.id}>
                <Avatar name={p.name} color={p.color} />
                <div>
                  <strong>{p.name}</strong>
                  <small>{p.title}</small>
                </div>
              </div>
            ))}
            <div className="calendar-hours" style={{ height }}>
              {Array.from({ length: (end - start) / 60 }, (_, i) => (
                <span key={i} style={{ top: i * 64 }}>
                  {time(start + i * 60)}
                </span>
              ))}
            </div>
            {people.map((p: any) => (
              <div className="calendar-track" style={{ height }} key={p.id}>
                {w.closures.some(
                  (c: any) =>
                    c.date === date && (!c.staff_id || c.staff_id === p.id),
                ) && <div className="calendar-closed">İzinli</div>}
                {rows
                  .filter((a: any) => a.staff_id === p.id)
                  .map((a: any) => (
                    <button
                      className={
                        "calendar-event " +
                        (a.status === "completed" ? "finished" : "")
                      }
                      key={a.id}
                      style={{
                        top: ((a.minute - start) / 60) * 64,
                        height: Math.max(34, (a.duration / 60) * 64 - 3),
                        background: p.color,
                        borderLeftColor: w.services.find(
                          (s: any) => s.id === a.service_id,
                        )?.color,
                      }}
                      onClick={() => onSelect(a)}
                    >
                      <strong>{a.customer_name}</strong>
                      <small>
                        {time(a.minute)} · {a.service_name}
                      </small>
                    </button>
                  ))}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <Blank
          title="Takviminiz ekibinizi bekliyor"
          description="Ekip bölümünden personel ekleyerek başlayın."
        />
      )}
    </section>
  );
}

function Customers({ w, retention, onSelect }: any) {
  const [search, setSearch] = useState("");
  const rows = w.customers.filter(
    (c: any) =>
      (!retention || (c.last_visit && c.last_visit < addDays(today(), -90))) &&
      (c.name + " " + c.phone)
        .toLocaleLowerCase("tr-TR")
        .includes(search.toLocaleLowerCase("tr-TR")),
  );
  return (
    <section className="panel">
      <div className="toolbar">
        <div className="search-input">
          <Search size={17} />
          <Input
            aria-label="Müşteri ara"
            placeholder="İsim veya telefon numarası ara…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <span className="muted">{rows.length} müşteri</span>
      </div>
      {retention && (
        <div className="notice margin-bottom">
          <HeartHandshake size={18} />
          Son ziyaret tarihine göre hazırlanır. Otomatik kampanya gönderilmez.
        </div>
      )}
      {rows.length ? (
        <Table className="appointment-table">
          <TableHeader>
            <TableRow>
              <TableHead>Müşteri</TableHead>
              <TableHead>Son ziyaret</TableHead>
              <TableHead>Randevu</TableHead>
              <TableHead>Toplam harcama</TableHead>
              <TableHead>Tercih edilen personel</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((c: any) => (
              <TableRow key={c.id}>
                <TableCell>
                  <button className="person-cell" onClick={() => onSelect(c)}>
                    <Avatar name={c.name} />
                    <span>
                      <strong>{c.name}</strong>
                      <small>{c.phone}</small>
                    </span>
                  </button>
                </TableCell>
                <TableCell>
                  {c.last_visit ? dateLabel(c.last_visit) : "Henüz gelmedi"}
                </TableCell>
                <TableCell>{c.visits}</TableCell>
                <TableCell>{money(c.total_spent)}</TableCell>
                <TableCell>{c.preferred_staff || "—"}</TableCell>
                <TableCell>
                  <button
                    className="icon-button"
                    aria-label={c.name + " müşteri geçmişi"}
                    onClick={() => onSelect(c)}
                  >
                    <ArrowUpRight size={16} />
                  </button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <Blank
          title={
            retention
              ? "Şu anda geri kazanma listesi boş"
              : "Müşteri bulunamadı"
          }
          description={
            retention
              ? "90 günden uzun süre gelmeyen müşterileriniz burada görünür."
              : "İlk randevuyla birlikte müşteri kaydı otomatik oluşturulur."
          }
        />
      )}
    </section>
  );
}

function CustomerSheet({ customer: c, w, onClose, onAppointment }: any) {
  const rows = w.appointments
    .filter((a: any) => a.customer_id === c.id)
    .sort((a: any, b: any) => b.date.localeCompare(a.date));
  return (
    <Sheet open onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="detail-sheet">
        <SheetHeader>
          <SheetTitle>Müşteri hafızası</SheetTitle>
          <SheetDescription>
            Ziyaretler ve tercihler, bir arada.
          </SheetDescription>
        </SheetHeader>
        <div className="sheet-body">
          <div className="detail-person">
            <Avatar name={c.name} large />
            <div>
              <h2>{c.name}</h2>
              <p className="muted">{c.phone}</p>
            </div>
          </div>
          <div className="customer-stats">
            <div>
              <strong>{c.visits}</strong>
              <small>tamamlanan randevu</small>
            </div>
            <div>
              <strong>{money(c.total_spent)}</strong>
              <small>hizmet toplamı</small>
            </div>
          </div>
          <div className="detail-facts">
            <div>
              <span>Son ziyaret</span>
              <b>{c.last_visit ? dateLabel(c.last_visit) : "—"}</b>
            </div>
            <div>
              <span>Tercih edilen personel</span>
              <b>{c.preferred_staff || "—"}</b>
            </div>
            <div>
              <span>Gelmeme kaydı</span>
              <b>{c.no_shows}</b>
            </div>
            <div>
              <span>Kampanya izni</span>
              <b>{c.consent ? "Var" : "Yok"}</b>
            </div>
          </div>
          <h3 className="margin-top">Ziyaret geçmişi</h3>
          {rows.map((a: any) => (
            <button
              className="history-row"
              onClick={() => onAppointment(a)}
              key={a.id}
            >
              <span className="service-icon">
                <Scissors size={18} />
              </span>
              <div>
                <strong>{a.service_name}</strong>
                <small>
                  {dateLabel(a.date)} · {time(a.minute)} · {a.staff_name}
                </small>
              </div>
              <span>
                <b>{money(a.price)}</b>
                <small>{STATUS[a.status]}</small>
              </span>
            </button>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
