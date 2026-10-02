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
  TrendingUp,
  Upload,
  Users,
} from "lucide-react";
import { api, Blank, Busy, Field } from "./common";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { money, time, dateLabel } from "@/lib/types";
import { toast } from "sonner";
import {
  buildSetupImport,
  downloadSetupTemplate,
  IMPORT_LABELS,
  parseSetupCsv,
  type SetupImportKind,
} from "./setup-import-utils";
import { parseSetupXlsx } from "./setup-xlsx-reader";

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
        <div className="panel operation-metric">
          <Clock3 size={20} />
          <span>Bu ay doldurulan boş saat</span>
          <strong>{d.totals.filled_slots}</strong>
        </div>
        <div className="panel operation-metric">
          <Users size={20} />
          <span>Geri kazanılan müşteri</span>
          <strong>{d.totals.recovered_customers}</strong>
        </div>
        <div className="panel operation-metric">
          <TrendingUp size={20} />
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

export function SetupCenter({ w }: any) {
  const [d, setD] = useState<any>(null),
    [kind, setKind] = useState<SetupImportKind>("auto"),
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
      let rows: unknown[][];
      if (f.name.toLowerCase().endsWith(".xlsx")) rows = await parseSetupXlsx(f);
      else rows = parseSetupCsv(await f.text());
      const groups = buildSetupImport(kind, rows);
      let imported = 0,
        skipped = 0,
        duplicateRows = 0;
      const issues: string[] = [];
      for (const [importKind, data] of groups) {
        const batchSize = importKind === "appointments" ? 20 : 40;
        for (let i = 0; i < data.length; i += batchSize) {
          const r = await api("setup-import", {
            tenant_id: w.business.id,
            batch_id: crypto.randomUUID(),
            kind: importKind,
            rows: data.slice(i, i + batchSize),
          });
          imported += Number(r.imported || 0);
          skipped += Number(r.skipped || 0);
          duplicateRows += Number(r.duplicate_rows || 0);
          if (Array.isArray(r.issues)) issues.push(...r.issues);
        }
      }
      if (!imported && !duplicateRows)
        throw new Error(
          issues[0] || "Dosya okundu ancak aktarılabilir kayıt bulunamadı.",
        );
      const details = [
        duplicateRows ? `${duplicateRows} tekrar kayıt atlandı` : "",
        skipped ? `${skipped} hatalı satır atlandı` : "",
      ]
        .filter(Boolean)
        .join(" · ");
      toast.success(
        `${imported} sistem kaydı içe aktarıldı${details ? ` · ${details}` : ""}.`,
      );
      if (issues.length)
        setError(
          `Aktarım tamamlandı. Kontrol edilmesi gereken satırlar: ${issues
            .slice(0, 5)
            .join(" | ")}`,
        );
      await load();
    } catch (e: any) {
      setError(e?.message || "Excel/CSV dosyası okunamadı.");
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
        <h2 className="margin-top">Eski kayıtlarınızı Neta’ya taşıyın</h2>
        <p className="muted margin-bottom">
          Akıllı aktarım Türkçe Excel/CSV başlıklarını tanır. Müşteriyi,
          geçmiş randevuyu, tamamlanan işlem gelirini ve borç/veresiye tutarını
          ilgili Neta kayıtlarına otomatik bağlar. Aynı telefonlu müşteri veya
          aynı randevu tekrar oluşturulmaz.
        </p>
        <div className="button-group">
          {(Object.entries(IMPORT_LABELS) as [SetupImportKind, string][]).map(
            ([k, v]) => (
              <button
                type="button"
                className={"button " + (kind === k ? "primary" : "")}
                onClick={() => setKind(k)}
                key={k}
              >
                {v}
              </button>
            ),
          )}
        </div>
        <div className="import-drop margin-top">
          <Upload size={25} />
          <strong>.xlsx veya .csv dosyanızı seçin</strong>
          <small>
            {kind === "auto"
              ? "Dosyanızın başlıklarını otomatik eşleştirir; eski programın şablonunu değiştirmeniz gerekmez."
              : "Bu veri türünü seçtik. Farklı Türkçe başlık adları da otomatik tanınır."}
          </small>
          <Input
            type="file"
            accept=".xlsx,.csv,text/csv"
            onChange={file}
            disabled={busy}
          />
          {busy && <Busy />}
        </div>
        <button
          type="button"
          className="text-button margin-top"
          onClick={() => downloadSetupTemplate(kind)}
        >
          <Download size={16} />
          Örnek şablonu indir
        </button>
        {(d?.counts.appointments > 0 || d?.counts.receivables > 0) && (
          <div className="notice margin-top">
            <Check size={17} />
            Sistemde {d?.counts.appointments || 0} randevu ve{" "}
            {d?.counts.receivables || 0} açık borç/veresiye kaydı bulunuyor.
          </div>
        )}
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
