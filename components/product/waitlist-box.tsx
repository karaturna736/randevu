"use client";
import { useState } from "react";
import { BellRing, CheckCircle2 } from "lucide-react";
import { api, Field, Busy } from "./common";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
export default function WaitlistBox({ business, service, person, date }: any) {
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [done, setDone] = useState(false),
    [error, setError] = useState(""),
    [from, setFrom] = useState("09:00"),
    [to, setTo] = useState("21:00"),
    [form, setForm] = useState({
      name: "",
      phone: "",
      email: "",
      consent: false,
    });
  const minute = (v: string) => Number(v.slice(0, 2)) * 60 + Number(v.slice(3));
  async function submit(e: any) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("waitlist", {
        slug: business.slug,
        service_id: service,
        staff_id: person === "any" ? null : person,
        date,
        minute_from: minute(from),
        minute_to: minute(to),
        ...form,
      });
      setDone(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  if (done)
    return (
      <div className="notice">
        <CheckCircle2 size={18} />
        <span>
          <strong>Bekleme listesine katıldınız.</strong>
          <br />
          Yer açılırsa WhatsApp’tan 10 dakikalık güvenli teklif bağlantısı
          gönderilecek.
        </span>
      </div>
    );
  return (
    <section className="panel waitlist-card">
      <div className="section-heading">
        <div>
          <h3>Uygun saat açılırsa haber verelim</h3>
          <p className="helper">
            İptal olduğunda tercihlerinize uyan müşterilere sırayla teklif
            gönderilir.
          </p>
        </div>
        <BellRing size={20} />
      </div>
      {!open ? (
        <button className="button full" onClick={() => setOpen(true)}>
          Bekleme listesine katıl
        </button>
      ) : (
        <form className="form-stack" onSubmit={submit}>
          <div className="two-fields">
            <Field label="Başlangıç">
              <Input
                type="time"
                step={900}
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                required
              />
            </Field>
            <Field label="Bitiş">
              <Input
                type="time"
                step={900}
                value={to}
                onChange={(e) => setTo(e.target.value)}
                required
              />
            </Field>
          </div>
          <Field label="Ad soyad">
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              minLength={2}
            />
          </Field>
          <Field label="Telefon">
            <Input
              type="tel"
              placeholder="05XX XXX XX XX"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              required
            />
          </Field>
          <Field label="E-posta (isteğe bağlı)">
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </Field>
          <label className="check-row">
            <Checkbox
              checked={form.consent}
              onCheckedChange={(v) => setForm({ ...form, consent: v === true })}
            />
            <span>
              Yalnızca bu bekleme listesi ve randevu işlemleri için WhatsApp
              mesajı almayı kabul ediyorum.
            </span>
          </label>
          {error && <p className="error-message">{error}</p>}
          <div className="form-footer">
            <button
              type="button"
              className="button"
              onClick={() => setOpen(false)}
            >
              Vazgeç
            </button>
            <button className="button primary" disabled={busy || !form.consent}>
              {busy && <Busy />}Listeye katıl
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
