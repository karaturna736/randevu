"use client";
import { useEffect, useState } from "react";
import { Check, MessageCircle, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";
import { api, Blank, Busy } from "./common";
import { dateLabel, time } from "@/lib/types";

const states: Record<string, string> = {
  waiting: "Bekliyor",
  contacted: "Ulaşıldı",
  booked: "Randevu aldı",
  cancelled: "Kapatıldı",
};

export function Waitlist({ w }: any) {
  const [rows, setRows] = useState<any[]>([]),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState("");
  async function refresh() {
    setLoading(true);
    try {
      setRows(
        (await api("waitlist?tenant=" + encodeURIComponent(w.business.id)))
          .requests,
      );
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    refresh();
  }, [w.business.id]);
  async function change(id: string, status: string) {
    setBusy(id);
    try {
      await api("waitlist", { tenant_id: w.business.id, id, status });
      await refresh();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setBusy("");
    }
  }
  if (loading)
    return (
      <div className="loading-row">
        <Busy />
        Bekleme listesi yükleniyor…
      </div>
    );
  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <h2>Boş yer bekleyen müşteriler</h2>
          <p className="muted">
            Uygun saat bulamayan müşteriler kendi seçtikleri gün ve aralık için
            burada görünür.
          </p>
        </div>
        <button className="button" onClick={refresh}>
          <RefreshCw size={16} />
          Yenile
        </button>
      </div>
      {!rows.length ? (
        <Blank
          title="Bekleme listesi boş"
          description="Dolu günlerde müşteriler randevu sayfanızdan listeye katılabilir."
        />
      ) : (
        <div className="collection-list">
          {rows.map((row) => (
            <div className="collection-row" key={row.id}>
              <div>
                <strong>
                  {row.name} · {row.service_name}
                </strong>
                <small>
                  {dateLabel(row.date)} · {time(row.minute_from)}–
                  {time(row.minute_to)}
                  {row.staff_name ? " · " + row.staff_name : ""}
                </small>
                <small>{row.phone}</small>
              </div>
              <span
                className={
                  "badge " + (row.status === "booked" ? "confirmed" : "neutral")
                }
              >
                {states[row.status] || row.status}
              </span>
              <div className="button-group">
                <a
                  className="icon-button"
                  aria-label={row.name + " kişisine WhatsApp üzerinden yaz"}
                  href={
                    "https://wa.me/" +
                    row.phone.replace(/\D/g, "") +
                    "?text=" +
                    encodeURIComponent(
                      w.business.name +
                        " için beklediğiniz tarih/saatte yer açıldı. Randevu linki: " +
                        location.origin +
                        "/" +
                        w.business.slug,
                    )
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => change(row.id, "contacted")}
                >
                  <MessageCircle size={16} />
                </a>
                <button
                  className="icon-button"
                  aria-label="Randevu aldı"
                  disabled={busy === row.id}
                  onClick={() => change(row.id, "booked")}
                >
                  {busy === row.id ? <Busy /> : <Check size={16} />}
                </button>
                <button
                  className="icon-button"
                  aria-label="Bekleme kaydını kapat"
                  disabled={busy === row.id}
                  onClick={() => change(row.id, "cancelled")}
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
