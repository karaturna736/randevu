"use client";
import { useCallback, useEffect, useState } from "react";
import {
  Check,
  Clock3,
  Download,
  FileSpreadsheet,
  Link2,
  MessageSquare,
  RefreshCw,
  Upload,
  Users,
} from "lucide-react";
import { api, Blank, Busy, Field } from "./common";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { money, time, dateLabel } from "@/lib/types";
import { toast } from "sonner";

export function RecoveryEngine({ w }: any) {
  const [d, setD] = useState<any>(null),
    [error, setError] = useState("");
  const load = useCallback(() => {
    if (w.preview) {
      setD({
        totals: {
          filled_slots: 18,
          recovered_customers: 11,
          recovered_revenue: 2740000,
        },
        waiting: [],
        recent: [],
        automation_ready: false,
      });
      return;
    }
    api("recovery?tenant=" + w.business.id)
      .then(setD)
      .catch((e) => setError(e.message));
  }, [w.business.id, w.preview]);
  useEffect(load, [load]);
  if (error) return <p className="error-message">{error}</p>;
  if (!d) return <Busy />;
  return (
    <div className="form-stack">
      <section className="panel revenue-recovery-hero">
        <div>
          <span className="eyebrow">NETA GELİR KURTARMA MOTORU</span>
          <h2>Boşalan saati gelir olarak geri kazanın.</h2>
          <p className="muted">
            İptal edilen saat, hizmet/personel/zaman uyumuna göre bekleyen
            müşterilere sırayla sunulur. İlk onaylayan müşteri aynı takvimde
            randevuyu alır.
          </p>
        </div>
        <span
          className={"badge " + (d.automation_ready ? "confirmed" : "neutral")}
        >
          {d.automation_ready
            ? "Otomasyon aktif"
            : "WhatsApp kurulumu bekliyor"}
        </span>
      </section>
      <div className="operations-metrics">
        <div className="operation-metric">
          <span>Bu ay doldurulan boş saat</span>
          <strong>{d.totals.filled_slots}</strong>
        </div>
        <div className="operation-metric">
          <span>Geri kazanılan müşteri</span>
          <strong>{d.totals.recovered_customers}</strong>
        </div>
        <div className="operation-metric">
          <span>Neta’nın kurtardığı ciro</span>
          <strong>{money(d.totals.recovered_revenue)}</strong>
        </div>
      </div>
      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>Aktif bekleme listesi</h2>
            <p>{d.waiting.length} müşteri uygun saat bekliyor.</p>
          </div>
          <button className="icon-button" onClick={load} aria-label="Yenile">
            <RefreshCw size={17} />
          </button>
        </div>
        {d.waiting.length ? (
          d.waiting.map((r: any) => (
            <div className="collection-row" key={r.id}>
              <div>
                <strong>{r.name}</strong>
                <small>
                  {r.phone} · {r.service_name}
                </small>
              </div>
              <span>
                {dateLabel(r.requested_date)} · {time(r.minute_from)}–
                {time(r.minute_to)}
              </span>
              <span>{r.staff_name}</span>
            </div>
          ))
        ) : (
          <Blank
            title="Bekleyen müşteri yok"
            description="Randevu sayfasında saat bulamayan müşteriler buraya katılabilir."
          />
        )}
      </section>
    </div>
  );
}

const templates: any = {
  customers: {
    name: "musteriler.csv",
    header: "ad_soyad,telefon,eposta,whatsapp_izni",
    sample: "Ayşe Yılmaz,05321234567,ayse@example.com,evet",
  },
  services: {
    name: "hizmetler.csv",
    header: "hizmet,aciklama,sure_dakika,fiyat_tl",
    sample: "Saç Kesimi,Kesim ve şekillendirme,45,650",
  },
  staff: {
    name: "personel.csv",
    header: "ad_soyad,unvan,gunler,baslangic,bitis",
    sample:
      "Ahmet Usta,Berber,pazartesi|sali|carsamba|persembe|cuma|cumartesi,09:00,19:00",
  },
};
function download(kind: string) {
  const t = templates[kind],
    a = document.createElement("a");
  a.href = URL.createObjectURL(
    new Blob(["\ufeff" + t.header + "\n" + t.sample + "\n"], {
      type: "text/csv",
    }),
  );
  a.download = t.name;
  a.click();
  URL.revokeObjectURL(a.href);
}
function csv(text: string) {
  const lines = text
    .replace(/^\ufeff/, "")
    .split(/\r?\n/)
    .filter(Boolean);
  return lines.map((line) => {
    const out: string[] = [];
    let s = "",
      quote = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"' && line[i + 1] === '"') {
        s += '"';
        i++;
      } else if (c === '"') quote = !quote;
      else if (c === "," && !quote) {
        out.push(s.trim());
        s = "";
      } else s += c;
    }
    out.push(s.trim());
    return out;
  });
}
const dayMap: any = {
  pazar: 0,
  pazartesi: 1,
  sali: 2,
  salı: 2,
  carsamba: 3,
  çarşamba: 3,
  persembe: 4,
  perşembe: 4,
  cuma: 5,
  cumartesi: 6,
};
const minutes = (s: any) => {
  const [h, m] = String(s || "")
    .split(":")
    .map(Number);
  return h * 60 + m;
};
function normalized(kind: string, rows: any[][]) {
  const head = rows[0].map((x) => String(x).trim().toLocaleLowerCase("tr-TR")),
    get = (r: any[], key: string) => r[head.indexOf(key)];
  return rows
    .slice(1)
    .filter((r) => r.some(Boolean))
    .map((r) => {
      if (kind === "customers")
        return {
          name: String(get(r, "ad_soyad") || ""),
          phone: String(get(r, "telefon") || ""),
          email: String(get(r, "eposta") || ""),
          consent: /^(evet|true|1)$/i.test(
            String(get(r, "whatsapp_izni") || ""),
          ),
        };
      if (kind === "services")
        return {
          name: String(get(r, "hizmet") || ""),
          description: String(get(r, "aciklama") || ""),
          duration: Number(get(r, "sure_dakika")),
          price: Math.round(
            Number(String(get(r, "fiyat_tl")).replace(",", ".")) * 100,
          ),
        };
      const start = minutes(get(r, "baslangic")),
        end = minutes(get(r, "bitis")),
        hours: any = {};
      String(get(r, "gunler") || "")
        .split("|")
        .forEach((x) => {
          const n = dayMap[x.trim().toLocaleLowerCase("tr-TR")];
          if (n != null) hours[n] = [start, end];
        });
      return {
        name: String(get(r, "ad_soyad") || ""),
        title: String(get(r, "unvan") || "Uzman"),
        hours,
      };
    });
}

export function SetupCenter({ w }: any) {
  const [d, setD] = useState<any>(null),
    [kind, setKind] = useState("customers"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [training, setTraining] = useState({ preferred_date: "", note: "" });
  const load = useCallback(() => {
    if (w.preview) return;
    void api("setup-center?tenant=" + w.business.id)
      .then(setD)
      .catch((e) => setError(e.message));
  }, [w.business.id, w.preview]);
  useEffect(load, [load]);
  async function file(e: any) {
    const f = e.target.files?.[0];
    if (!f) return;
    setBusy(true);
    setError("");
    try {
      let rows: any[][];
      if (f.name.toLowerCase().endsWith(".xlsx")) {
        const read = (await import("read-excel-file")).default;
        rows = (await read(f)) as any[][];
      } else rows = csv(await f.text());
      const data = normalized(kind, rows);
      if (!data.length)
        throw new Error("Dosyada aktarılacak satır bulunamadı.");
      let imported = 0;
      for (let i = 0; i < data.length; i += 40) {
        const r = await api("setup-import", {
          tenant_id: w.business.id,
          batch_id: crypto.randomUUID(),
          kind,
          rows: data.slice(i, i + 40),
        });
        imported += r.imported;
      }
      toast.success(imported + " kayıt içe aktarıldı.");
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }
  if (w.preview)
    return (
      <div className="notice">
        Kurulum Merkezi kendi işletmenizi oluşturduğunuzda açılır.
      </div>
    );
  if (!d && !error) return <Busy />;
  const url =
    typeof location === "undefined"
      ? ""
      : location.origin + (d?.booking_path || "");
  return (
    <div className="form-stack">
      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>Kurulum durumu</h2>
            <p>İşletmenizi satışa hazır hale getiren beş adım.</p>
          </div>
          <span className="badge confirmed">
            {
              [
                d?.counts.customers,
                d?.counts.services,
                d?.counts.staff,
                d?.booking_path,
                d?.training,
              ].filter(Boolean).length
            }
            /5
          </span>
        </div>
        <div className="setup-checklist">
          {[
            [Users, "Müşteriler", d?.counts.customers + " kayıt"],
            [
              FileSpreadsheet,
              "Hizmet ve fiyatlar",
              d?.counts.services + " hizmet",
            ],
            [
              Clock3,
              "Personel ve çalışma saatleri",
              d?.counts.staff + " personel",
            ],
            [Link2, "Randevu bağlantısı", "Hazır"],
            [
              MessageSquare,
              "30 dakikalık eğitim",
              d?.training ? "Talep alındı" : "Planlanmadı",
            ],
          ].map(([Icon, title, value]: any) => (
            <div key={title}>
              <span className="stat-icon lime">
                <Icon size={17} />
              </span>
              <div>
                <strong>{title}</strong>
                <small>{value}</small>
              </div>
              {value && !String(value).startsWith("0") ? (
                <Check size={17} />
              ) : null}
            </div>
          ))}
        </div>
      </section>
      <section className="panel">
        <span className="eyebrow">EXCEL / CSV AKTARIMI</span>
        <h2 className="margin-top">Defterinizi Neta’ya taşıyın</h2>
        <p className="muted margin-bottom">
          Dosya tarayıcınızda okunur ve 40 satırlık güvenli paketlerle
          aktarılır. Aynı telefonlu müşteri çoğaltılmaz.
        </p>
        <div className="button-group">
          {Object.entries({
            customers: "Müşteriler",
            services: "Hizmetler",
            staff: "Personel",
          }).map(([k, v]) => (
            <button
              className={"button " + (kind === k ? "primary" : "")}
              onClick={() => setKind(k)}
              key={k}
            >
              {v}
            </button>
          ))}
        </div>
        <div className="import-drop margin-top">
          <Upload size={25} />
          <strong>.xlsx veya .csv dosyanızı seçin</strong>
          <small>Önce örnek şablonu indirip başlıkları koruyun.</small>
          <Input
            type="file"
            accept=".xlsx,.csv"
            onChange={file}
            disabled={busy}
          />
          {busy && <Busy />}
        </div>
        <button
          className="text-button margin-top"
          onClick={() => download(kind)}
        >
          <Download size={16} />
          Örnek şablonu indir
        </button>
        {error && <p className="error-message">{error}</p>}
      </section>
      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>Randevu bağlantınız</h2>
            <p>
              Instagram biyografisine ve WhatsApp işletme profiline ekleyin.
            </p>
          </div>
          <Link2 size={19} />
        </div>
        <div className="copy-link-row">
          <code>{url}</code>
          <button
            className="button"
            onClick={() =>
              navigator.clipboard
                .writeText(url)
                .then(() => toast.success("Bağlantı kopyalandı."))
            }
          >
            Kopyala
          </button>
        </div>
      </section>
      <section className="panel">
        <h2>30 dakikalık işletme eğitimi</h2>
        <p className="muted">
          Takvim, randevu linki, WhatsApp, ödeme ve gelir kurtarma akışı
          birlikte hazırlanır.
        </p>
        <p className="helper margin-top">
          Talep Platform Yönetimi ekranındaki Eğitim talepleri listesine düşer.
          Yönetici, kayıtlı işletme telefonu veya hesap e-postası üzerinden
          sizinle iletişime geçer.
        </p>
        {d?.training ? (
          <div className="notice margin-top">
            <Check size={17} />
            Talebiniz yönetici paneline iletildi. Durum:{" "}
            {(
              {
                pending: "Bekliyor",
                contacted: "İletişime geçildi",
                scheduled: "Planlandı",
                completed: "Tamamlandı",
                cancelled: "İptal edildi",
              } as any
            )[d.training.status] || d.training.status}
          </div>
        ) : (
          <form
            className="form-stack margin-top"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                await api("setup-training", {
                  tenant_id: w.business.id,
                  preferred_date: training.preferred_date || null,
                  note: training.note,
                });
                toast.success("Eğitim talebi oluşturuldu.");
                load();
              } catch (e: any) {
                setError(e.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <Field label="Tercih edilen gün">
              <Input
                type="date"
                value={training.preferred_date}
                onChange={(e) =>
                  setTraining({ ...training, preferred_date: e.target.value })
                }
              />
            </Field>
            <Field label="Not">
              <Textarea
                maxLength={500}
                placeholder="Uygun saat veya özel ihtiyacınızı yazın."
                value={training.note}
                onChange={(e) =>
                  setTraining({ ...training, note: e.target.value })
                }
              />
            </Field>
            <button className="button primary" disabled={busy}>
              Eğitim talebi oluştur
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
