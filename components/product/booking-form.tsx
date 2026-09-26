"use client";
import { ListPlus, Video } from "lucide-react";
import { useState, useEffect } from "react";
import {
  Scissors,
  Clock,
  ArrowRight,
  ArrowLeft,
  Check,
  CheckCircle2,
  Copy,
  CalendarDays,
  ShieldCheck,
  CalendarPlus,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { api, Pick, Field, Blank, Busy } from "./common";
import { money, today, addDays, time, dateLabel } from "@/lib/types";
import { useSession } from "./session";
import { calendarUrl } from "@/lib/calendar";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import DemandSearch from "./demand-search";
import { bookingVisit } from "@/lib/demand-client";
export default function BookingForm({
  data,
  tenantId,
  demo = false,
  onSaved,
  initial,
}: any) {
  const { data: session } = useSession();
  const business = data.business,
    services = data.services.filter((s: any) => s.active !== 0),
    staff = data.staff.filter((p: any) => p.active !== 0),
    branches = (data.branches || []).filter((b: any) => b.active !== 0);
  const [demand, setDemand] = useState<any>(null),
    [early, setEarly] = useState(false),
    [earlyTime, setEarlyTime] = useState("17:00"),
    [step, setStep] = useState(initial ? 2 : 0),
    [service, setService] = useState(
      initial?.service_id || services[0]?.id || "",
    ),
    [person, setPerson] = useState(initial?.slot?.staff_id || "any"),
    [branch, setBranch] = useState(initial?.branch_id || branches[0]?.id || ""),
    [alternatives, setAlternatives] = useState<any[]>([]),
    [date, setDate] = useState(initial?.date || today()),
    [slots, setSlots] = useState<any[]>([]),
    [selected, setSelected] = useState<any>(initial?.slot || null),
    [loading, setLoading] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [form, setForm] = useState({
      name: "",
      phone: "",
      email: "",
      consent: false,
      customer_note: "",
    }),
    [result, setResult] = useState<any>(null);
  useEffect(() => {
    if (!tenantId && !demo && session?.profile)
      setForm((f) => ({
        ...f,
        name: f.name || session.profile.name,
        phone: f.phone || session.profile.phone,
        email: f.email || session.profile.email,
      }));
  }, [session?.profile?.user_id]);
  useEffect(() => {
    if (initial || tenantId) return;
    const q = new URLSearchParams(location.search);
    if (services.some((s: any) => s.id === q.get("service")))
      setService(q.get("service")!);
    if (staff.some((p: any) => p.id === q.get("person")))
      setPerson(q.get("person")!);
    if (branches.some((b: any) => b.id === q.get("branch")))
      setBranch(q.get("branch")!);
  }, []);
  useEffect(() => {
    if (!tenantId && !demo) bookingVisit(business.slug).catch(() => {});
  }, [business.slug]);
  useEffect(() => {
    if (selected) setEarlyTime(time(Math.max(0, selected.minute - 60)));
  }, [selected?.minute]);
  const s = services.find((s: any) => s.id === service);
  useEffect(() => {
    if (step !== 1 || !service) return;
    let stopped = false;
    setSelected(null);
    setDemand(null);
    setLoading(true);
    setError("");
    if (demo) {
      setSlots(
        Array.from({ length: 16 }, (_, i) => ({
          minute: 600 + i * 30,
          time: time(600 + i * 30),
          staff_id: person === "any" ? staff[0]?.id : person,
          staff_name:
            staff.find((p: any) => p.id === person)?.name || staff[0]?.name,
        })),
      );
      setLoading(false);
      return;
    }
    api(
      `availability?${tenantId ? "tenant=" + tenantId : "slug=" + business.slug}&service=${service}&date=${date}&staff=${person}&branch=${branch}`,
    )
      .then((r) => { if (!stopped) { setSlots(r.slots); setAlternatives(r.alternatives || []); } })
      .catch((e) => !stopped && setError(e.message))
      .finally(() => !stopped && setLoading(false));
    return () => {
      stopped = true;
    };
  }, [step, service, person, date, branch]);
  async function submit(e: any) {
    e.preventDefault();
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      const r = demo
        ? {
            date,
            time: selected.time,
            service: s.name,
            price: s.price,
            demo: true,
          }
        : await api("bookings", {
            ...form,
            ...(!tenantId
              ? await bookingVisit(business.slug).catch(() => ({}))
              : {}),
            early_from: early
              ? Number(earlyTime.split(":")[0]) * 60 +
                Number(earlyTime.split(":")[1])
              : null,
            ...(tenantId ? { tenant_id: tenantId } : { slug: business.slug }),
            service_id: service,
            staff_id: selected.staff_id,
            branch_id: branch || undefined,
            date,
            minute: selected.minute,
          });
      setResult(r);
      setStep(3);
      onSaved?.();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  if (!services.length || !staff.length)
    return (
      <Blank
        title="Randevuya hazırlık gerekiyor"
        description="Önce en az bir aktif hizmet ve personel ekleyin."
      />
    );
  if (result)
    return (
      <div className="booking-success">
        <span className="success-icon">
          <CheckCircle2 size={32} />
        </span>
        <h2>{demo ? "Örnek akış tamamlandı" : "Randevunuz hazır!"}</h2>
        <p className="muted">
          {demo
            ? "Gerçek randevu oluşturulmadı."
            : business.name + " sizi bekliyor."}
        </p>
        <div className="booking-receipt">
          <strong>{result.service}</strong>
          <span>
            <CalendarDays size={17} />
            {dateLabel(result.date)} · {result.time}
          </span>
          <b>{money(result.price)}</b>
        </div>
        {result.meeting_url && (
          <a
            className="button full"
            href={result.meeting_url}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Video size={17} /> Çevrim içi görüşme bağlantısını aç
          </a>
        )}
        {!demo && (
          <>
            <>
              {result.saved_to_account && (
                <div className="notice">
                  <Check size={17} />
                  Randevunuz hesabınıza kaydedildi.
                </div>
              )}
            </>
            <p className="helper">
              İptal ve değişiklik için özel bağlantıyı saklayın. Bu bağlantıyı
              bilen kişi randevuyu yönetebilir. Otomatik mesaj gönderimi bağlı
              değil.
            </p>
            <button
              className="button primary full"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(
                    location.origin + "/randevum#" + result.token,
                  );
                  toast.success("Bağlantı kopyalandı.");
                } catch {
                  toast.error(
                    "Bağlantıyı açıp tarayıcıdan kopyalayabilirsiniz.",
                  );
                }
              }}
            >
              <Copy size={16} />
              Randevu bağlantımı kopyala
            </button>
            <a className="text-button" href={"/randevum#" + result.token}>
              Randevumu yönet <ArrowRight size={15} />
            </a>
            <a
              className="text-button"
              download="randevu.ics"
              href={calendarUrl(
                {
                  id: result.id,
                  date: result.date,
                  minute: selected.minute,
                  duration: s.duration,
                  service_name: result.service,
                },
                business,
              )}
            >
              <CalendarPlus size={16} />
              Takvime ekle
            </a>
            {result.saved_to_account && (
              <a className="text-button" href="/randevularim">
                Tüm randevularım <ArrowRight size={15} />
              </a>
            )}
          </>
        )}
      </div>
    );
  return (
    <div className="booking-flow">
      <div className="booking-steps">
        {["Hizmet & uzman", "Tarih & saat", "Bilgileriniz"].map((l, i) => (
          <div
            key={l}
            className={step === i ? "current" : step > i ? "done" : ""}
          >
            <span>{step > i ? <Check size={13} /> : i + 1}</span>
            {l}
          </div>
        ))}
      </div>
      {demo && (
        <div className="notice">
          Örnek rezervasyon · Gerçek randevu oluşturulmaz.
        </div>
      )}
      {step === 0 && (
        <>
          <h3>Size nasıl yardımcı olabiliriz?</h3>
          <div className="service-options">
            {services
              .filter((s: any) => s.active !== 0)
              .map((v: any) => (
                <button
                  key={v.id}
                  className={
                    "service-option " + (service === v.id ? "selected" : "")
                  }
                  onClick={() => setService(v.id)}
                >
                  <span
                    className="service-icon"
                    style={{ color: v.color, background: v.color + "22" }}
                  >
                    {v.delivery_mode === "online" ? (
                      <Video size={21} />
                    ) : (
                      <Scissors size={21} />
                    )}
                  </span>
                  <span>
                    <strong>{v.name}</strong>
                    <small>
                      <Clock size={13} />
                      {v.duration} dakika
                      {v.delivery_mode === "online"
                        ? " · Online"
                        : v.delivery_mode === "hybrid"
                          ? " · Yüz yüze / online"
                          : ""}
                    </small>
                    {v.description && (
                      <span className="service-option-description">
                        {v.description}
                      </span>
                    )}
                  </span>
                  <b>{money(v.price)}</b>
                  <span className="radio-indicator">
                    {service === v.id && <Check size={12} />}
                  </span>
                </button>
              ))}
          </div>
          {branches.length > 1 && (
            <Field label="Şube tercihiniz">
              <Pick
                label="Şube"
                value={branch}
                onChange={(v)=>{setBranch(v);setPerson("any")}}
                options={branches.map((b:any)=>({
                  value:b.id,
                  label:[b.name,b.city,b.address].filter(Boolean).join(" · "),
                }))}
              />
            </Field>
          )}
          {staff.filter((p:any)=>!branch||!p.branch_id||p.branch_id===branch).length > 1 && (
            <Field label="Personel tercihiniz">
              <Pick
                label="Personel"
                value={person}
                onChange={setPerson}
                options={[
                  { value: "any", label: "Fark etmez · İlk uygun uzman" },
                  ...staff
                    .filter((p: any) => p.active !== 0 && (!branch || !p.branch_id || p.branch_id === branch))
                    .map((p: any) => ({ value: p.id, label: p.name })),
                ]}
              />
            </Field>
          )}
          <button className="button primary full" onClick={() => setStep(1)}>
            Tarih ve saat seç <ArrowRight size={17} />
          </button>
        </>
      )}
      {step === 1 && (
        <>
          <div className="section-heading">
            <h3>Size uygun zamanı seçin</h3>
            <Input
              type="date"
              aria-label="Randevu tarihi"
              min={today()}
              max={addDays(today(), 90)}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="date-input"
            />
          </div>
          <div className="date-chips">
            {Array.from({ length: 7 }, (_, i) => addDays(today(), i)).map(
              (d) => (
                <button
                  key={d}
                  className={date === d ? "selected" : ""}
                  onClick={() => setDate(d)}
                >
                  <small>
                    {new Date(d + "T12:00:00Z").toLocaleDateString("tr-TR", {
                      weekday: "short",
                    })}
                  </small>
                  <strong>{d.slice(8)}</strong>
                </button>
              ),
            )}
          </div>
          {!tenantId && (
            <DemandSearch
              key={date + service + person}
              business={business}
              service={service}
              person={person}
              date={date}
              demo={demo}
              disabled={loading}
              filtered={demand}
              onResult={(r: any) => {
                setDemand(r);
                setSlots(r.slots);
                setSelected(null);
              }}
              onReset={async () => {
                setDemand(null);
                setSelected(null);
                setLoading(true);
                try {
                  if (demo)
                    setSlots(
                      Array.from({ length: 16 }, (_, i) => ({
                        minute: 600 + i * 30,
                        time: time(600 + i * 30),
                        staff_id: staff[0]?.id,
                        staff_name: staff[0]?.name,
                      })),
                    );
                  else
                    setSlots(
                      (
                        await api(
                          `availability?slug=${business.slug}&service=${service}&date=${date}&staff=${person}&branch=${branch}`,
                        )
                      ).slots,
                    );
                } catch (e: any) {
                  setError(e.message);
                } finally {
                  setLoading(false);
                }
              }}
            />
          )}
          <div className="slots-heading">
            <span>{dateLabel(date)}</span>
            <small>Türkiye saati</small>
          </div>
          {loading ? (
            <div className="loading-row">
              <Busy />
              Saatler bulunuyor…
            </div>
          ) : (
            <div className="slot-grid">
              {slots
                .filter(
                  (s, i, a) => i === a.findIndex((v) => v.minute === s.minute),
                )
                .map((v) => (
                  <button
                    key={v.minute}
                    className={selected?.minute === v.minute ? "selected" : ""}
                    onClick={() => setSelected(v)}
                  >
                    {v.time}
                  </button>
                ))}
            </div>
          )}
          {!loading && !slots.length && !error && (
            <>
              <Blank
                title={
                  demand
                    ? "İstediğiniz aralıkta boş saat yok"
                    : "Bu gün için boş saat yok"
                }
                description="Başka bir tarih deneyebilir veya bekleme listesine katılabilirsiniz."
              />
              {!tenantId && !demo && (
                <WaitlistJoin
                  business={business}
                  service={service}
                  person={person}
                  date={date}
                  session={session}
                />
              )}
            </>
          )}
          {!tenantId && alternatives.length > 0 && (
            <div className="demand-alternatives">
              <strong>Seçtiğiniz şube dolu · diğer şubelerde alternatifler</strong>
              <p className="helper">
                Seçili şubede boş saat yok. Aşağıdaki seçenekler farklı şubelerdedir; şube adı, şehir ve açık adres birlikte gösterilir.
              </p>
              <div className="service-options">
                {alternatives.map((a:any)=><button type="button" className="service-option" key={a.branch.id} onClick={()=>{setBranch(a.branch.id);setPerson("any");setAlternatives([])}}><span><strong>{a.branch.name}</strong><small>{[a.branch.city,a.branch.address].filter(Boolean).join(" · ")||"Adres bilgisi yok"} · İlk uygun {a.slots[0]?.time}</small></span><ArrowRight size={16}/></button>)}
              </div>
            </div>
          )}
          {demand?.alternatives?.length > 0 && (
            <div className="demand-alternatives">
              <strong>Aynı gün için diğer seçenekler</strong>
              <div className="slot-grid">
                {demand.alternatives.map((v: any) => (
                  <button
                    key={v.staff_id + v.minute}
                    className={selected?.minute === v.minute ? "selected" : ""}
                    onClick={() => setSelected(v)}
                  >
                    {v.time}
                  </button>
                ))}
              </div>
            </div>
          )}
          {selected && (
            <p className="helper">
              {selected.staff_name} ile {s.duration} dakika
            </p>
          )}
          <div className="form-footer">
            <button className="button" onClick={() => setStep(0)}>
              <ArrowLeft size={16} />
              Geri
            </button>
            <button
              className="button primary"
              disabled={!selected}
              onClick={() => setStep(2)}
            >
              Devam et <ArrowRight size={16} />
            </button>
          </div>
        </>
      )}
      {step === 2 && (
        <form className="form-stack" onSubmit={submit}>
          <div className="summary-strip">
            <CalendarDays size={22} />
            <div>
              <strong>{s.name}</strong>
              <small>
                {dateLabel(date)} · {selected?.time} · {selected?.staff_name}
              </small>
            </div>
            <b>{money(s.price)}</b>
          </div>
          {[
            ["name", "Adınız soyadınız", "text", "Ad Soyad"],
            ["phone", "Telefon numaranız", "tel", "05XX XXX XX XX"],
            ["email", "E-posta (isteğe bağlı)", "email", "ornek@mail.com"],
          ].map(([k, label, type, placeholder]) => (
            <Field label={label} key={k}>
              <Input
                type={type}
                placeholder={placeholder}
                required={k !== "email"}
                value={(form as any)[k]}
                onChange={(e) => setForm({ ...form, [k]: e.target.value })}
              />
            </Field>
          ))}
          {s.description && (
            <p className="booking-service-description">{s.description}</p>
          )}
          <Field label="İşlem tercihiniz (isteğe bağlı)">
            <Textarea
              maxLength={500}
              placeholder="İşlem tercihinizi yazın. Sağlık veya hassas kişisel bilgi paylaşmayın."
              value={form.customer_note}
              onChange={(e) =>
                setForm({ ...form, customer_note: e.target.value })
              }
            />
          </Field>
          <section className="booking-early">
            <label className="toggle-row">
              <span>
                <strong>Erken gelirim</strong>
                <small>Daha erken yer açılırsa teklif görmek istiyorum.</small>
              </span>
              <Switch
                checked={early}
                onCheckedChange={setEarly}
                aria-label="Erken gelirim"
              />
            </label>
            {early && (
              <>
                <Field label="Bu saatten itibaren gelebilirim">
                  <Input
                    type="time"
                    step={900}
                    required
                    max={time((selected?.minute || 60) - 15)}
                    value={earlyTime}
                    onChange={(e) => setEarlyTime(e.target.value)}
                  />
                </Field>
                <p className="helper">
                  Saatiniz yalnızca kabul ederseniz değişir. Teklifleri randevu
                  yönetim sayfanızdan görebilirsiniz.
                </p>
              </>
            )}
          </section>
          <label className="check-row">
            <Checkbox
              checked={form.consent}
              onCheckedChange={(v) => setForm({ ...form, consent: v === true })}
            />
            <span>
              İşletmenin WhatsApp üzerinden kampanya ve yeniden randevu
              hatırlatması göndermesine izin veriyorum. İstediğim zaman DUR
              yazarak vazgeçebilirim.
            </span>
          </label>
          <p className="helper">
            <ShieldCheck size={15} />
            Bilgileriniz randevuyu yönetmek için işletmeyle paylaşılır.{" "}
            {business.cancellation_hours} saat öncesine kadar iptal
            edebilirsiniz.
          </p>
          <div className="form-footer">
            <button type="button" className="button" onClick={() => setStep(1)}>
              <ArrowLeft size={16} />
              Geri
            </button>
            <button className="button primary" disabled={busy}>
              {busy ? <Busy /> : <Check size={17} />}{" "}
              {demo ? "Örnek akışı tamamla" : "Randevuyu oluştur"}
            </button>
          </div>
        </form>
      )}
      {error && (
        <p role="alert" className="error-message">
          {error}
        </p>
      )}
    </div>
  );
}

function WaitlistJoin({ business, service, person, date, session }: any) {
  const [open, setOpen] = useState(false),
    [saved, setSaved] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [form, setForm] = useState({
    name: session?.profile?.name || "",
    phone: session?.profile?.phone || "",
    minute_from: 540,
    minute_to: 1080,
    consent: false,
  });
  if (saved)
    return (
      <div className="notice">
        <Check size={17} />
        Bekleme listesine eklendiniz. İşletme uygun saat açıldığında sizinle
        iletişime geçebilir.
      </div>
    );
  if (!open)
    return (
      <button className="button full" onClick={() => setOpen(true)}>
        <ListPlus size={17} />
        Bekleme listesine katıl
      </button>
    );
  return (
    <form
      className="panel form-stack"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setError("");
        try {
          await api("waitlist", {
            slug: business.slug,
            service_id: service,
            staff_id: person,
            date,
            ...form,
          });
          setSaved(true);
        } catch (reason: any) {
          setError(reason.message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <h3>Bu gün için yer açılırsa haber verin</h3>
      <div className="form-grid">
        <Field label="Ad soyad">
          <Input
            required
            minLength={2}
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
        </Field>
        <Field label="Telefon">
          <Input
            required
            type="tel"
            value={form.phone}
            onChange={(event) =>
              setForm({ ...form, phone: event.target.value })
            }
          />
        </Field>
      </div>
      <div className="form-grid">
        <Field label="En erken">
          <Input
            required
            type="time"
            step={900}
            value={time(form.minute_from)}
            onChange={(event) => {
              const [hour, minute] = event.target.value.split(":").map(Number);
              setForm({ ...form, minute_from: hour * 60 + minute });
            }}
          />
        </Field>
        <Field label="En geç">
          <Input
            required
            type="time"
            step={900}
            value={time(form.minute_to)}
            onChange={(event) => {
              const [hour, minute] = event.target.value.split(":").map(Number);
              setForm({ ...form, minute_to: hour * 60 + minute });
            }}
          />
        </Field>
      </div>
      <label className="check-row">
        <Checkbox
          checked={form.consent}
          onCheckedChange={(value) =>
            setForm({ ...form, consent: value === true })
          }
        />
        <span>
          Bu bekleme talebiyle ilgili WhatsApp veya telefonla iletişim
          kurulmasını kabul ediyorum.
        </span>
      </label>
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
      <div className="button-group">
        <button type="button" className="button" onClick={() => setOpen(false)}>
          Vazgeç
        </button>
        <button className="button primary" disabled={busy}>
          {busy ? <Busy /> : <ListPlus size={17} />}Listeye katıl
        </button>
      </div>
    </form>
  );
}
