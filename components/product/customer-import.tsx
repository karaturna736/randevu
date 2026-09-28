"use client";

import { useState, type ChangeEvent } from "react";
import { Download, Upload } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { api, Busy, Modal } from "./common";
import { buildSetupImport, parseSetupCsv } from "./setup-import-utils";
import { parseSetupXlsx } from "./setup-xlsx-reader";

type ImportCustomer = {
  name: string;
  phone: string;
  email: string;
  consent: boolean;
};

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_ROWS = 2000;

function downloadTemplate() {
  const csv = "\ufeffad_soyad,telefon,eposta,whatsapp_izni\nAyşe Yılmaz,05321234567,ayse@example.com,hayır\n";
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "neta-musteriler.csv";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function CustomerImport({ tenantId, onImported }: {
  tenantId: string;
  onImported: () => Promise<void> | void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState("");
  const [fileName, setFileName] = useState("");
  const [records, setRecords] = useState<ImportCustomer[]>([]);
  const [incomplete, setIncomplete] = useState(0);

  async function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    setRecords([]);
    setFileName("");
    setIncomplete(0);
    setError("");
    setReading(true);
    try {
      const extension = file.name.toLocaleLowerCase("tr-TR");
      if (!extension.endsWith(".xlsx") && !extension.endsWith(".csv"))
        throw new Error("Yalnızca .xlsx veya .csv dosyası seçin.");
      if (file.size > MAX_FILE_BYTES)
        throw new Error("Dosya en fazla 5 MB olabilir. Daha küçük parçalara ayırın.");
      const rows = extension.endsWith(".xlsx")
        ? await parseSetupXlsx(file)
        : parseSetupCsv(await file.text());
      if (rows.length - 1 > MAX_ROWS)
        throw new Error("Bir seferde en fazla 2000 müşteri yükleyebilirsiniz.");
      const groups = buildSetupImport("customers", rows);
      const raw = (groups.find(([kind]) => kind === "customers")?.[1] || []) as ImportCustomer[];
      const valid = raw.filter((row) => row.name && row.phone);
      if (!valid.length)
        throw new Error("Ad soyad ve telefon içeren müşteri satırı bulunamadı.");
      setRecords(valid);
      setIncomplete(raw.length - valid.length);
      setFileName(file.name);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Dosya okunamadı.");
    } finally {
      setReading(false);
      input.value = "";
    }
  }

  async function importRecords() {
    if (!records.length || busy) return;
    setBusy(true);
    setError("");
    let imported = 0, skipped = incomplete, duplicates = 0;
    const issues: string[] = [];
    try {
      for (let i = 0; i < records.length; i += 40) {
        const response = await api("customer-import", {
          tenant_id: tenantId,
          kind: "customers",
          batch_id: crypto.randomUUID(),
          rows: records.slice(i, i + 40),
        });
        imported += Number(response.imported || 0);
        skipped += Number(response.skipped || 0);
        duplicates += Number(response.duplicate_rows || 0);
        if (Array.isArray(response.issues)) issues.push(...response.issues);
      }
      await onImported();
      setRecords([]);
      setFileName("");
      toast.success(`${imported} müşteri eklendi. ${duplicates} mevcut/tekrar kayıt atlandı.${skipped ? ` ${skipped} satır hatalı.` : ""}`);
      if (issues.length) setError(`Atlanan satırlar: ${issues.slice(0, 5).join(" | ")}`);
      else setOpen(false);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Bağlantı hatası.";
      if (imported) {
        await onImported();
        setRecords([]);
        setError(`${imported} müşteri kaydedildi; aktarımın kalanı tamamlanamadı. Dosyayı tekrar seçerek deneyebilirsiniz. ${message}`);
      } else setError(message);
    } finally {
      setBusy(false);
    }
  }

  return <>
    <button type="button" className="button" onClick={() => setOpen(true)}>
      <Upload size={16} /> Excel / CSV’den aktar
    </button>
    <Modal open={open} onClose={() => !busy && !reading && setOpen(false)} title="Müşterileri içe aktar" description="Önce dosyanızdaki müşteri kayıtlarını kontrol edin, ardından aktarımı başlatın." wide>
      <div className="form-stack">
        <p className="muted">.xlsx veya .csv dosyası seçin. Ad soyad ve telefon sütunları gerekli; e-posta ve WhatsApp izni isteğe bağlıdır. Mevcut telefon numaraları atlanır, kayıtları değiştirilmez. Borç ve geçmiş randevular bu ekrandan aktarılmaz.</p>
        <Input type="file" accept=".xlsx,.csv,text/csv" aria-label="Müşteri Excel veya CSV dosyası" onChange={selectFile} disabled={busy || reading} />
        <button type="button" className="text-button" onClick={downloadTemplate}><Download size={16} /> Örnek CSV indir</button>
        {reading && <Busy />}
        {!!records.length && <div className="notice customer-import-preview">
          <div><strong>{fileName}</strong> · {records.length} müşteri satırı bulundu{incomplete ? ` · ${incomplete} eksik satır atlanacak` : ""}.</div>
          <ul>{records.slice(0, 5).map((row, index) => <li key={index}>{row.name} · {row.phone}</li>)}</ul>
          {records.length > 5 && <small>İlk 5 kayıt gösteriliyor.</small>}
        </div>}
        {error && <p role="alert" className="error-message">{error}</p>}
        <button type="button" className="button primary" onClick={importRecords} disabled={!records.length || busy || reading}>
          {busy ? <Busy /> : <Upload size={16} />}{records.length} müşteriyi aktar
        </button>
      </div>
    </Modal>
  </>;
}
