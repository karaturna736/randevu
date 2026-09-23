"use client";
import { useEffect, useState } from "react";
import { CalendarDays, CheckCircle2, Clock, Scissors } from "lucide-react";
import { api, Busy } from "./common";
import { PublicShell } from "./public";
import { dateLabel, money, time } from "@/lib/types";
export default function RecoveryOffer() {
  const [d, setD] = useState<any>(null),
    [token, setToken] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [done, setDone] = useState<any>(null);
  useEffect(() => {
    const t = location.hash.slice(1);
    setToken(t);
    if (!t) {
      setError("Teklif bağlantısı eksik.");
      return;
    }
    api("recovery-offer", undefined, t)
      .then(setD)
      .catch((e) => setError(e.message));
  }, []);
  async function accept() {
    setBusy(true);
    setError("");
    try {
      setDone(await api("recovery-offer", {}, token));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <PublicShell>
      <main className="manage-page">
        <span className="eyebrow">NETA BEKLEME LİSTESİ</span>
        <h1>{done ? "Randevunuz hazır." : "Sizin için yer açıldı."}</h1>
        {error && <p className="error-message">{error}</p>}
        {!d && !error && !done && <Busy />}
        {done ? (
          <section className="panel booking-success">
            <CheckCircle2 className="success-icon" />
            <h2>{done.service}</h2>
            <p>
              {dateLabel(done.date)} · {done.time}
            </p>
            <a className="button primary" href={"/randevum#" + done.token}>
              Randevumu yönet
            </a>
          </section>
        ) : (
          d && (
            <section className="panel form-stack">
              <div className="summary-strip">
                <Scissors />
                <div>
                  <strong>{d.service_name}</strong>
                  <small>
                    {d.business_name} · {d.staff_name}
                  </small>
                </div>
                <b>{money(d.price)}</b>
              </div>
              <div className="manage-date">
                <CalendarDays />
                <strong>{dateLabel(d.date)}</strong>
                <span>
                  <Clock size={16} /> {time(d.minute)}
                </span>
              </div>
              <p className="helper">
                Bu teklif 10 dakika boyunca size ayrılmış değildir; ilk
                onaylayan müşteri randevuyu alır. Saat dolarsa ücret alınmaz ve
                kayıt oluşmaz.
              </p>
              <button
                className="button primary full"
                disabled={!d.available || busy}
                onClick={accept}
              >
                {busy && <Busy />}
                {d.available ? "Randevuyu onayla" : "Teklifin süresi doldu"}
              </button>
            </section>
          )
        )}
      </main>
    </PublicShell>
  );
}
