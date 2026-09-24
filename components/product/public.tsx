"use client";
import BookingTheme from "@/components/themes/booking-theme";
import { useEffect, useState } from "react";
import {
  MapPin,
  Scissors,
  ArrowRight,
  Star,
  Clock,
  Phone,
  CalendarDays,
  ShieldCheck,
  Sparkles,
  Search,
  Check,
  CalendarClock,
  Ban,
  CalendarPlus,
  Heart,
  Link2,
  Video,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Toaster, toast } from "sonner";
import {
  api,
  Brand,
  ThemeToggle,
  Avatar,
  Blank,
  Busy,
  Field,
  Pick,
  Confirm,
} from "./common";
import BookingForm from "./booking-form";
import { AccountMenu, useSession } from "./session";
import { calendarUrl } from "@/lib/calendar";
import { EarlyArrival } from "./early-arrival";
import { Assistant } from "./assistant";
import { demoWorkspace } from "@/lib/demo";
import {
  CATEGORIES,
  money,
  time,
  today,
  addDays,
  dateLabel,
  STATUS,
} from "@/lib/types";

export function PublicShell({ children, business, presentation }: any) {
  return (
    <div className="public-shell">
      <header className="public-header">
        {presentation?.hide_brand ? (
          <a className="brand business-only-brand" href={"/" + business.slug}>
            {business.name}
          </a>
        ) : (
          <Brand />
        )}
        <nav>
          <a href="/kesfet">İşletmeleri keşfet</a>
          <ThemeToggle />
          <AccountMenu />
        </nav>
      </header>
      {children}
      <footer className="public-footer">
        {presentation?.hide_brand ? (
          <strong>{business.name}</strong>
        ) : (
          <>
            <Brand />
            <span>Randevunuz net.</span>
            <a href={business ? "/kayit?ref=" + business.slug : "/kayit"}>
              Neta ile kendi işletmenizi kurun <ArrowRight size={14} />
            </a>
          </>
        )}
        <a href="/yardim">Yardım</a>
      </footer>
      <Toaster richColors position="bottom-right" />
    </div>
  );
}

export function BusinessBooking({ slug }: any) {
  const sample = slug === "atolye-studio";
  const [data, setData] = useState<any>(sample ? demoWorkspace() : null),
    [error, setError] = useState(""),
    [assistant, setAssistant] = useState(false),
    [initial, setInitial] = useState<any>(null);
  useEffect(() => {
    if (sample) return;
    api("public/" + encodeURIComponent(slug))
      .then(setData)
      .catch((e) => setError(e.message));
  }, [slug, sample]);
  if (error)
    return (
      <PublicShell>
        <div className="public-message">
          <Blank
            title="İşletme şu anda randevuya açık değil"
            description={error}
          />
          <a className="button primary" href="/kesfet">
            Diğer işletmeleri keşfet
          </a>
        </div>
      </PublicShell>
    );
  if (!data)
    return (
      <PublicShell>
        <div className="loading-row">
          <Busy />
          İşletme hazırlanıyor…
        </div>
      </PublicShell>
    );
  const b = data.business;
  return (
    <PublicShell business={b} presentation={data.presentation}>
      <BookingTheme
        data={data}
        onAssistant={() => setAssistant(true)}
        favorite={!sample && <FavoriteButton business={b} />}
      >
        <BookingForm
          key={JSON.stringify(initial)}
          data={data}
          demo={sample}
          initial={initial}
        />
      </BookingTheme>
      <Assistant
        open={assistant}
        onClose={() => setAssistant(false)}
        w={{ ...data, preview: sample }}
        publicSlug={slug}
        onBook={(x: any) => {
          setAssistant(false);
          setInitial(x);
        }}
      />
    </PublicShell>
  );
}

export function Discover() {
  const [rows, setRows] = useState<any[]>([]),
    [search, setSearch] = useState(""),
    [category, setCategory] = useState("all"),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  useEffect(() => {
    api("businesses")
      .then((r) => setRows(r.businesses))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  const filtered = rows.filter(
    (b) =>
      (category === "all" || b.category === category) &&
      (b.name + " " + b.city)
        .toLocaleLowerCase("tr-TR")
        .includes(search.toLocaleLowerCase("tr-TR")),
  );
  return (
    <PublicShell>
      <main className="discover-page">
        <div className="discover-hero">
          <span className="eyebrow">İYİ HİZMET, DOĞRU ZAMANDA.</span>
          <h1>
            Sizin için bir yer,
            <br />
            sizin için bir zaman.
          </h1>
          <p>Güvendiğiniz işletmeleri bulun. Randevunuzu birkaç adımda alın.</p>
          <div className="discover-search">
            <div className="search-input">
              <Search size={19} />
              <Input
                aria-label="İşletme veya şehir ara"
                placeholder="İşletme adı veya şehir…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Pick
              label="Kategori"
              value={category}
              onChange={setCategory}
              options={[
                { value: "all", label: "Tüm kategoriler" },
                ...CATEGORIES.map((c) => ({ value: c, label: c })),
              ]}
            />
          </div>
        </div>
        <div className="section-heading">
          <h2>İşletmeleri keşfedin</h2>
          <span className="muted">{filtered.length} işletme</span>
        </div>
        {loading ? (
          <div className="loading-row">
            <Busy />
            İşletmeler yükleniyor…
          </div>
        ) : error ? (
          <p className="error-message">{error}</p>
        ) : filtered.length ? (
          <div className="business-cards">
            {filtered.map((b: any) => (
              <a className="panel business-card" href={"/" + b.slug} key={b.id}>
                <div className="business-card-art">
                  <Scissors size={42} strokeWidth={1.3} />
                  <span>{b.category}</span>
                </div>
                <div>
                  <span className="eyebrow">{b.category}</span>
                  <h2>{b.name}</h2>
                  <p className="muted">
                    <MapPin size={14} />
                    {b.city || "Konum belirtilmedi"}
                  </p>
                  <div className="business-card-bottom">
                    <span>
                      {b.min_price != null
                        ? money(b.min_price) + "’den başlayan"
                        : "Hizmetleri gör"}
                    </span>
                    <ArrowRight size={18} />
                  </div>
                </div>
              </a>
            ))}
          </div>
        ) : (
          <>
            <Blank
              title="Yeni işletmelere yer açıyoruz"
              description="Onaylanan işletmeler burada listelenecek. Bu sırada örnek randevu akışını deneyebilirsiniz."
            />
            <a className="sample-business" href="/atolye-studio">
              <span className="service-icon">
                <Scissors />
              </span>
              <div>
                <strong>Atölye Studio</strong>
                <small>Örnek işletme · Gerçek randevu oluşturmaz</small>
              </div>
              <ArrowRight size={20} />
            </a>
          </>
        )}
      </main>
    </PublicShell>
  );
}

export function ManageBooking() {
  const { data: session } = useSession();
  const [accountId, setAccountId] = useState(""),
    [claimed, setClaimed] = useState(false);
  const [token, setToken] = useState(""),
    [data, setData] = useState<any>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [cancel, setCancel] = useState(false),
    [editing, setEditing] = useState(false),
    [date, setDate] = useState(today()),
    [slots, setSlots] = useState<any[]>([]),
    [minute, setMinute] = useState(""),
    [busy, setBusy] = useState(false),
    [rating, setRating] = useState(5),
    [comment, setComment] = useState(""),
    [complaint, setComplaint] = useState("");
  async function refresh(t = token, id = accountId) {
    setError("");
    try {
      setData(
        await api(
          id ? "my-appointment?id=" + encodeURIComponent(id) : "manage",
          undefined,
          id ? undefined : t,
        ),
      );
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    const id = new URLSearchParams(location.search).get("id"),
      t = location.hash.slice(1);
    setToken(t);
    if (id) {
      setAccountId(id);
      refresh("", id);
    } else if (t) refresh(t);
    else {
      setError("Randevu sonrasında verilen özel bağlantıyı açın.");
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    if (!editing || !data) return;
    setMinute("");
    api(
      accountId ? "my-appointment" : "manage",
      { action: "slots", date, ...(accountId ? { id: accountId } : {}) },
      accountId ? undefined : token,
    )
      .then((r) => setSlots(r.slots))
      .catch((e) => setError(e.message));
  }, [date, editing]);
  async function act(x: any) {
    setBusy(true);
    setError("");
    try {
      await api(
        accountId ? "my-appointment" : "manage",
        { ...x, ...(accountId ? { id: accountId } : {}) },
        accountId ? undefined : token,
      );
      toast.success(
        x.action === "early_preference"
          ? "Erken geliş tercihiniz kaydedildi."
          : x.action === "early_decline"
            ? "Bu saat için teklif kapatıldı."
            : x.action === "early_accept"
              ? "Randevunuz erkene alındı."
              : x.action === "review"
                ? "Değerlendirmeniz onaya gönderildi."
                : x.action === "complaint"
                  ? "Şikâyetiniz kaydedildi."
                  : "Randevunuz güncellendi.",
      );
      setEditing(false);
      setCancel(false);
      if (x.action === "complaint") setComplaint("");
      await refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const a = data?.appointment;
  return (
    <PublicShell>
      <main className="manage-page">
        <a className="text-button margin-bottom" href="/randevularim">
          Randevularım <ArrowRight size={15} />
        </a>
        <br />
        <span className="eyebrow">KONTROL SİZDE</span>
        <h1>Randevunuz.</h1>
        <p className="muted">
          Planlar değişebilir. Randevunuzu buradan yönetin.
        </p>
        {loading ? (
          <div className="loading-row">
            <Busy />
            Randevu bulunuyor…
          </div>
        ) : (
          <>
            {error && (
              <p role="alert" className="error-message">
                {error}
              </p>
            )}
            {a && (
              <>
                <section className="panel form-stack">
                  <div className="section-heading">
                    <h2>{data.business?.name}</h2>
                    <span className={"badge " + a.status}>
                      {STATUS[a.status]}
                    </span>
                  </div>
                  <div className="summary-strip">
                    <Scissors size={24} />
                    <div>
                      <strong>{a.service_name}</strong>
                      <small>
                        {a.staff_name} · {a.duration} dakika
                      </small>
                    </div>
                    <b>{money(a.price)}</b>
                  </div>
                  <div className="manage-date">
                    <CalendarDays />
                    <strong>{dateLabel(a.date)}</strong>
                    <span>{time(a.minute)}</span>
                  </div>
                  <p>
                    Merhaba {a.customer_name}, randevu bilgileriniz yukarıda.
                  </p>
                  {a.service_description && (
                    <p className="booking-service-description">
                      {a.service_description}
                    </p>
                  )}
                  {a.customer_note && (
                    <div className="customer-note">
                      <strong>İşlem tercihiniz</strong>
                      <p>{a.customer_note}</p>
                    </div>
                  )}
                  {a.status === "confirmed" && (
                    <a
                      className="text-button"
                      download="randevu.ics"
                      href={calendarUrl(a, data.business)}
                    >
                      <CalendarPlus size={17} />
                      Kişisel takvimime ekle
                    </a>
                  )}
                  {a.status === "confirmed" && a.meeting_url && (
                    <a className="button full" href={a.meeting_url} target="_blank" rel="noopener noreferrer"><Video size={17}/>Çevrim içi görüşmeye katıl</a>
                  )}
                  {!accountId && session?.profile && (
                    <button
                      className="button"
                      disabled={claimed || busy}
                      onClick={async () => {
                        setBusy(true);
                        try {
                          await api("claim-booking", { token });
                          setClaimed(true);
                          toast.success("Randevunuz hesabınıza eklendi.");
                        } catch (e: any) {
                          toast.error(e.message);
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      <Link2 size={16} />
                      {claimed
                        ? "Hesabınıza eklendi"
                        : "Bu randevuyu hesabıma ekle"}
                    </button>
                  )}
                  {a.status === "confirmed" && (
                    <>
                      <div className="button-group">
                        <button
                          className="button"
                          onClick={() => setEditing(!editing)}
                        >
                          <CalendarClock size={17} />
                          Tarihi değiştir
                        </button>
                        <button
                          className="button danger"
                          onClick={() => setCancel(true)}
                        >
                          <Ban size={17} />
                          Randevuyu iptal et
                        </button>
                      </div>
                      <p className="helper">
                        Randevuya {data.business?.cancellation_hours} saat
                        kalana kadar değişiklik yapabilirsiniz.
                      </p>
                    </>
                  )}
                  {editing && (
                    <form
                      className="form-stack"
                      onSubmit={(e) => {
                        e.preventDefault();
                        act({
                          action: "reschedule",
                          date,
                          minute: Number(minute),
                          staff_id: a.staff_id,
                        });
                      }}
                    >
                      <Field label="Yeni tarih">
                        <Input
                          type="date"
                          min={today()}
                          max={addDays(today(), 90)}
                          value={date}
                          onChange={(e) => setDate(e.target.value)}
                          required
                        />
                      </Field>
                      <Pick
                        label="Uygun saat seçin"
                        value={minute}
                        onChange={setMinute}
                        options={slots.map((s) => ({
                          value: String(s.minute),
                          label: s.time,
                        }))}
                      />
                      {!slots.length && (
                        <p className="helper">Bu tarihte uygun saat yok.</p>
                      )}
                      <button
                        className="button primary"
                        disabled={!minute || busy}
                      >
                        Değişikliği kaydet
                      </button>
                    </form>
                  )}
                </section>
                <EarlyArrival
                  data={data}
                  action={act}
                  busy={busy}
                  refresh={refresh}
                />
                {a.status === "completed" && (
                  <section className="panel margin-top">
                    <h2>Deneyiminiz nasıldı?</h2>
                    {data.review ? (
                      <div className="notice margin-top">
                        <Check size={17} />
                        Değerlendirmeniz alındı. Teşekkür ederiz.
                      </div>
                    ) : (
                      <form
                        className="form-stack margin-top"
                        onSubmit={(e) => {
                          e.preventDefault();
                          act({ action: "review", rating, comment });
                        }}
                      >
                        <div
                          className="rating-stars"
                          role="group"
                          aria-label="Puan seçimi"
                        >
                          {[1, 2, 3, 4, 5].map((i) => (
                            <button
                              type="button"
                              aria-label={i + " yıldız"}
                              aria-pressed={rating === i}
                              key={i}
                              onClick={() => setRating(i)}
                            >
                              <Star
                                fill={i <= rating ? "currentColor" : "none"}
                              />
                            </button>
                          ))}
                        </div>
                        <Textarea
                          aria-label="Değerlendirmeniz"
                          placeholder="Deneyiminizi paylaşın…"
                          minLength={3}
                          maxLength={1000}
                          required
                          value={comment}
                          onChange={(e) => setComment(e.target.value)}
                        />
                        <button className="button primary" disabled={busy}>
                          Değerlendirmeyi gönder
                        </button>
                      </form>
                    )}
                  </section>
                )}
                <details className="panel margin-top">
                  <summary>Bir sorun mu yaşadınız?</summary>
                  <form
                    className="form-stack margin-top"
                    onSubmit={(e) => {
                      e.preventDefault();
                      act({ action: "complaint", message: complaint });
                    }}
                  >
                    <Field label="Platform yöneticisine iletilecek şikâyetiniz">
                      <Textarea
                        minLength={10}
                        maxLength={2000}
                        required
                        value={complaint}
                        onChange={(e) => setComplaint(e.target.value)}
                      />
                    </Field>
                    <button className="button" disabled={busy}>
                      Şikâyeti kaydet
                    </button>
                  </form>
                </details>
              </>
            )}
          </>
        )}
        <Confirm
          open={cancel}
          onClose={() => setCancel(false)}
          title="Randevunuz iptal edilsin mi?"
          description="Seçtiğiniz saat diğer müşterilere açılacak. Bu işlem geri alınamaz; yeniden randevu alabilirsiniz."
          onConfirm={() => act({ status: "cancelled" })}
        />
      </main>
    </PublicShell>
  );
}

function FavoriteButton({ business }: any) {
  const { data, ready } = useSession();
  const [saved, setSaved] = useState(false),
    [busy, setBusy] = useState(true),
    [error, setError] = useState("");
  useEffect(() => {
    if (!data?.profile) {
      setBusy(false);
      return;
    }
    setBusy(true);
    api("favorites")
      .then((r) => {
        setSaved(r.favorites.some((b: any) => b.id === business.id));
        setError("");
      })
      .catch((e) => setError(e.message))
      .finally(() => setBusy(false));
  }, [data?.profile?.user_id, business.id]);
  if (!ready) return null;
  if (!data?.profile)
    return (
      <a
        className="icon-button favorite-button"
        aria-label="Favorilere eklemek için üye olun"
        href={"/kayit?sonra=" + encodeURIComponent("/" + business.slug)}
      >
        <Heart size={20} />
      </a>
    );
  return (
    <button
      className={"icon-button favorite-button " + (saved ? "saved-heart" : "")}
      disabled={busy}
      aria-label={saved ? "Favorilerimden kaldır" : "Favorilerime ekle"}
      aria-pressed={saved}
      onClick={async () => {
        if (error) {
          toast.error(error);
          return;
        }
        setBusy(true);
        try {
          const r = await api("favorites", {
            tenant_id: business.id,
            saved: !saved,
          });
          setSaved(r.saved);
          toast.success(
            r.saved ? "Favorilerinize eklendi." : "Favorilerden kaldırıldı.",
          );
        } catch (e: any) {
          toast.error(e.message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <Heart size={20} fill={saved ? "currentColor" : "none"} />
    </button>
  );
}
