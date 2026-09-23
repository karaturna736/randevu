"use client";
import { useState, useEffect } from "react";
import {
  CalendarDays,
  Clock,
  Scissors,
  Phone,
  Check,
  CalendarClock,
  Ban,
  UserX,
  Video,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Avatar, api, Pick, Field, Busy, Confirm } from "./common";
import { money, time, today, addDays, dateLabel, STATUS } from "@/lib/types";

export default function AppointmentSheet({
  a,
  w,
  onClose,
  refresh,
  requireReal,
}: any) {
  const [editing, setEditing] = useState(false),
    [date, setDate] = useState(a.date),
    [person, setPerson] = useState(a.staff_id),
    [minute, setMinute] = useState(""),
    [slots, setSlots] = useState<any[]>([]),
    [busy, setBusy] = useState(false),
    [confirm, setConfirm] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    if (!editing) return;
    setMinute("");
    setError("");
    if (w.preview) {
      setSlots(
        Array.from({ length: 16 }, (_, i) => ({
          minute: 600 + i * 30,
          time: time(600 + i * 30),
        })),
      );
      return;
    }
    let stop = false;
    api(
      `availability?tenant=${w.business.id}&service=${a.service_id}&date=${date}&staff=${person}`,
    )
      .then((r) => !stop && setSlots(r.slots))
      .catch((e) => !stop && setError(e.message));
    return () => {
      stop = true;
    };
  }, [editing, date, person]);
  async function change(x: any) {
    if (!requireReal()) return;
    setBusy(true);
    try {
      await api("appointment", { tenant_id: w.business.id, id: a.id, ...x });
      toast.success("Randevu güncellendi.");
      refresh();
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
      setConfirm("");
    }
  }
  const ended =
    Date.now() >=
    new Date(
      a.date + "T" + time(a.minute + a.duration) + ":00+03:00",
    ).getTime();
  return (
    <Sheet open onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="detail-sheet">
        <SheetHeader>
          <SheetTitle>Randevu detayı</SheetTitle>
          <SheetDescription>
            Randevuyu ve müşteri bilgilerini yönetin.
          </SheetDescription>
        </SheetHeader>
        <div className="sheet-body">
          <div className="detail-person">
            <Avatar name={a.customer_name} large />
            <div>
              <h2>{a.customer_name}</h2>
              <span className={"badge " + a.status}>{STATUS[a.status]}</span>
            </div>
          </div>
          {a.service_description && (
            <p className="booking-service-description">
              {a.service_description}
            </p>
          )}
          {a.customer_note && (
            <div className="customer-note">
              <strong>Müşteri işlem tercihi</strong>
              <p>{a.customer_note}</p>
            </div>
          )}
          {a.early_from != null && (
            <p className="early-tag">
              {time(a.early_from)} itibarıyla erken gelebilir
            </p>
          )}
          <div className="detail-facts">
            <div>
              <Scissors />
              <span>{a.service_name}</span>
              <b>{money(a.price)}</b>
            </div>
            <div>
              <CalendarDays />
              <span>{dateLabel(a.date)}</span>
              <strong>{time(a.minute)}</strong>
            </div>
            <div>
              <Clock />
              <span>{a.duration} dakika</span>
            </div>
            <div>
              <Avatar name={a.staff_name} color={a.staff_color} />
              <span>{a.staff_name}</span>
            </div>
            <div>
              <Phone />
              <span>{a.customer_phone}</span>
            </div>
            <div><span>Randevu kaynağı</span><b>{a.source === "whatsapp" ? "WhatsApp" : a.source === "panel" ? "Panel" : "Web"}</b></div>
          </div>
          {a.meeting_url && <a className="button full" href={a.meeting_url} target="_blank" rel="noopener noreferrer"><Video size={17}/>Çevrim içi görüşmeyi aç</a>}
          {a.status === "confirmed" && (
            <>
              <div className="detail-actions">
                <button
                  className="button primary"
                  disabled={!ended || busy}
                  onClick={() => setConfirm("completed")}
                >
                  <Check size={16} />
                  Tamamlandı
                </button>
                <button className="button" onClick={() => setEditing(!editing)}>
                  <CalendarClock size={16} />
                  Tarihi değiştir
                </button>
                <button
                  className="button"
                  disabled={!ended || busy}
                  onClick={() => setConfirm("no_show")}
                >
                  <UserX size={16} />
                  Gelmedi
                </button>
                <button
                  className="button danger"
                  onClick={() => setConfirm("cancelled")}
                >
                  <Ban size={16} />
                  İptal et
                </button>
              </div>
              {!ended && (
                <p className="helper">
                  Tamamlandı ve gelmedi işlemleri randevu bittikten sonra
                  açılır.
                </p>
              )}
              {editing && (
                <form
                  className="form-stack edit-booking"
                  onSubmit={(e) => {
                    e.preventDefault();
                    change({
                      action: "reschedule",
                      date,
                      staff_id: person,
                      minute: Number(minute),
                    });
                  }}
                >
                  <h3>Yeni tarih ve saat</h3>
                  <Field label="Tarih">
                    <Input
                      type="date"
                      min={today()}
                      max={addDays(today(), 90)}
                      required
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                    />
                  </Field>
                  <Pick
                    label="Personel"
                    value={person}
                    onChange={setPerson}
                    options={w.staff
                      .filter((p: any) => p.active)
                      .map((p: any) => ({ value: p.id, label: p.name }))}
                  />
                  <Pick
                    label="Uygun saat"
                    value={minute}
                    onChange={setMinute}
                    options={slots.map((s) => ({
                      value: String(s.minute),
                      label: s.time,
                    }))}
                  />
                  {!slots.length && (
                    <p className="helper">Bu tarihte uygun saat bulunamadı.</p>
                  )}
                  <button className="button primary" disabled={!minute || busy}>
                    {busy && <Busy />}Değişikliği kaydet
                  </button>
                </form>
              )}
            </>
          )}
          {error && <p className="error-message">{error}</p>}
          <p className="helper margin-top">
            Bildirim sağlayıcısı bağlı değil. Müşteriye otomatik mesaj
            gönderilmez.
          </p>
        </div>
        <Confirm
          open={!!confirm}
          onClose={() => setConfirm("")}
          title="Randevu güncellensin mi?"
          description={
            "Yeni durum: " +
            (STATUS[confirm] || "") +
            ". Bu işlem randevu geçmişine kaydedilir."
          }
          onConfirm={() => change({ status: confirm })}
        />
      </SheetContent>
    </Sheet>
  );
}
