export type SetupImportKind =
  | "auto"
  | "customers"
  | "services"
  | "staff"
  | "appointments"
  | "receivables";

export type BackendImportKind = Exclude<SetupImportKind, "auto">;

export const IMPORT_LABELS: Record<SetupImportKind, string> = {
  auto: "Akıllı aktarım",
  customers: "Müşteriler",
  services: "Hizmetler",
  staff: "Personel",
  appointments: "Randevular",
  receivables: "Borç / Veresiye",
};

const templates: Record<SetupImportKind, { name: string; header: string; sample: string }> = {
  auto: {
    name: "neta-akilli-aktarim.csv",
    header:
      "ad_soyad,telefon,hizmet,personel,tarih,saat,fiyat_tl,durum,borc_tl,vade,aciklama",
    sample:
      "Ayşe Yılmaz,05321234567,Saç Kesimi,Ahmet Usta,15.09.2026,14:30,650,tamamlandi,150,30.09.2026,Eski sistem kaydı",
  },
  customers: {
    name: "musteriler.csv",
    header: "ad_soyad,telefon,eposta,whatsapp_izni,borc_tl,vade,aciklama",
    sample: "Ayşe Yılmaz,05321234567,ayse@example.com,evet,150,30.09.2026,Eski borç",
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
  appointments: {
    name: "randevular.csv",
    header:
      "ad_soyad,telefon,hizmet,personel,tarih,saat,sure_dakika,fiyat_tl,durum,aciklama,borc_tl,vade",
    sample:
      "Ayşe Yılmaz,05321234567,Saç Kesimi,Ahmet Usta,15.09.2026,14:30,45,650,tamamlandi,Eski randevu,150,30.09.2026",
  },
  receivables: {
    name: "borc-veresiye.csv",
    header: "ad_soyad,telefon,borc_tl,vade,aciklama",
    sample: "Ayşe Yılmaz,05321234567,150,30.09.2026,Eski sistemden kalan borç",
  },
};

export function downloadSetupTemplate(kind: SetupImportKind) {
  const t = templates[kind],
    a = document.createElement("a");
  a.href = URL.createObjectURL(
    new Blob(["\ufeff" + t.header + "\n" + t.sample + "\n"], {
      type: "text/csv;charset=utf-8",
    }),
  );
  a.download = t.name;
  a.click();
  URL.revokeObjectURL(a.href);
}

function delimiterOf(line: string) {
  const count = (delimiter: string) => {
    let quoted = false,
      total = 0;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') quoted = !quoted;
      else if (line[i] === delimiter && !quoted) total++;
    }
    return total;
  };
  return [",", ";", "\t"].sort((a, b) => count(b) - count(a))[0];
}

export function parseSetupCsv(text: string) {
  const source = text.replace(/^\ufeff/, "");
  const delimiter = delimiterOf(source.split(/\r?\n/, 1)[0]);
  const rows: string[][] = [];
  let row: string[] = [], field = "", quoted = false;
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (c === '"') {
      if (quoted && source[i + 1] === '"') {
        field += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === delimiter && !quoted) {
      row.push(field.trim());
      field = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && source[i + 1] === "\n") i++;
      row.push(field.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (quoted) throw new Error("CSV dosyasında kapanmamış tırnak bulundu.");
  row.push(field.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

const key = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const aliases: Record<string, string[]> = {
  customer_name: [
    "ad_soyad",
    "adsoyad",
    "isim_soyisim",
    "isim",
    "musteri",
    "musteri_adi",
    "musteri_ad_soyad",
    "customer",
    "customer_name",
    "name",
  ],
  phone: [
    "telefon",
    "telefon_no",
    "telefon_numarasi",
    "gsm",
    "cep",
    "cep_telefonu",
    "phone",
    "mobile",
  ],
  email: ["eposta", "e_posta", "email", "mail"],
  consent: ["whatsapp_izni", "whatsapp_onayi", "izin", "consent"],
  service: [
    "hizmet",
    "hizmet_adi",
    "islem",
    "islem_adi",
    "service",
    "service_name",
  ],
  staff: [
    "personel",
    "personel_adi",
    "uzman",
    "uzman_adi",
    "calisan",
    "calisan_adi",
    "staff",
    "staff_name",
    "kuafor",
    "berber",
  ],
  title: ["unvan", "pozisyon", "title"],
  days: ["gunler", "calisma_gunleri", "gun", "days"],
  start: ["baslangic", "baslangic_saati", "mesai_baslangic", "start"],
  end: ["bitis", "bitis_saati", "mesai_bitis", "end"],
  date: [
    "tarih",
    "randevu_tarihi",
    "randevu_tarih",
    "appointment_date",
    "date",
  ],
  time: ["saat", "randevu_saati", "appointment_time", "time"],
  duration: ["sure_dakika", "sure", "dakika", "duration", "duration_minute"],
  price: [
    "fiyat_tl",
    "fiyat",
    "ucret",
    "tutar",
    "islem_tutari",
    "hizmet_tutari",
    "price",
    "amount",
  ],
  status: ["durum", "randevu_durumu", "status"],
  payment_status: [
    "odeme_durumu",
    "tahsilat_durumu",
    "borc_durumu",
    "payment_status",
    "payment_state",
  ],
  debt: [
    "borc_tl",
    "borc",
    "kalan_borc",
    "veresiye",
    "veresiye_tutari",
    "bakiye",
    "alacak",
    "kalan",
    "debt",
    "remaining_debt",
  ],
  due_date: ["vade", "vade_tarihi", "son_odeme_tarihi", "due_date"],
  note: ["aciklama", "not", "notlar", "musteri_notu", "note", "description"],
};

const dayMap: Record<string, number> = {
  pazar: 0,
  pazartesi: 1,
  sali: 2,
  carsamba: 3,
  persembe: 4,
  cuma: 5,
  cumartesi: 6,
};

function moneyMinor(value: unknown) {
  if (value == null || value === "") return 0;
  if (typeof value === "number" && Number.isFinite(value))
    return Math.max(0, Math.round(value * 100));
  let raw = String(value)
    .trim()
    .replace(/₺|tl|try/gi, "")
    .replace(/\s/g, "")
    .replace(/[^\d,.-]/g, "");
  if (!raw) return 0;
  const comma = raw.lastIndexOf(","),
    dot = raw.lastIndexOf(".");
  if (comma >= 0 && dot >= 0) {
    if (comma > dot) raw = raw.replace(/\./g, "").replace(",", ".");
    else raw = raw.replace(/,/g, "");
  } else if (comma >= 0) {
    const decimals = raw.length - comma - 1;
    raw = decimals <= 2 ? raw.replace(",", ".") : raw.replace(/,/g, "");
  } else if (dot >= 0) {
    const decimals = raw.length - dot - 1;
    if (decimals === 3 && /^-?\d{1,3}\.\d{3}$/.test(raw))
      raw = raw.replace(".", "");
  }
  const n = Number(raw);
  return Number.isFinite(n) ? Math.max(0, Math.round(n * 100)) : 0;
}

function duration(value: unknown) {
  const raw = Number(String(value ?? "").replace(",", "."));
  const n = Number.isFinite(raw) && raw > 0 ? raw : 60;
  return Math.max(15, Math.min(720, Math.round(n / 15) * 15));
}

function excelDate(value: number) {
  const d = new Date(Date.UTC(1899, 11, 30) + Math.round(value * 86400000));
  return d.toISOString().slice(0, 10);
}

function dateValue(value: unknown) {
  if (value instanceof Date && !Number.isNaN(+value))
    return value.toISOString().slice(0, 10);
  if (typeof value === "number" && value > 20000 && value < 80000)
    return excelDate(value);
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const m = raw.match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})$/);
  if (m)
    return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  const parsed = new Date(raw);
  return Number.isNaN(+parsed) ? "" : parsed.toISOString().slice(0, 10);
}

function minuteValue(value: unknown) {
  if (value instanceof Date && !Number.isNaN(+value))
    return Math.max(
      0,
      Math.min(1425, Math.round((value.getHours() * 60 + value.getMinutes()) / 15) * 15),
    );
  if (typeof value === "number" && Number.isFinite(value)) {
    if (value >= 0 && value < 1)
      return Math.max(0, Math.min(1425, Math.round((value * 1440) / 15) * 15));
    if (value >= 0 && value <= 24)
      return Math.max(0, Math.min(1425, Math.round((value * 60) / 15) * 15));
  }
  const raw = String(value ?? "").trim();
  if (!raw) return 720;
  const normalized = raw.replace(".", ":");
  const m = normalized.match(/^(\d{1,2}):?(\d{2})$/);
  if (!m) return 720;
  const total = Number(m[1]) * 60 + Number(m[2]);
  return Math.max(0, Math.min(1425, Math.round(total / 15) * 15));
}

function statusValue(value: unknown, date: string) {
  const v = key(value);
  if (["tamamlandi", "tamam", "bitti", "completed", "odendi"].includes(v))
    return "completed";
  if (["iptal", "iptal_edildi", "cancelled", "canceled"].includes(v))
    return "cancelled";
  if (["gelmedi", "gelmedi_no_show", "no_show", "noshow"].includes(v))
    return "no_show";
  if (["onayli", "onaylandi", "confirmed", "aktif", "bekliyor"].includes(v))
    return "confirmed";
  const today = new Date().toISOString().slice(0, 10);
  return date && date < today ? "completed" : "confirmed";
}

function debtSettled(value: unknown) {
  return [
    "odendi",
    "odenmis",
    "odeme_tamamlandi",
    "borc_odendi",
    "borc_kapandi",
    "borc_yok",
    "paid",
    "paid_in_full",
    "settled",
  ].includes(key(value));
}

function consentValue(value: unknown) {
  return ["evet", "true", "1", "yes", "onayli", "izin_var"].includes(key(value));
}

function hoursValue(daysValue: unknown, startValue: unknown, endValue: unknown) {
  const start = minuteValue(startValue || "09:00"),
    end = minuteValue(endValue || "18:00"),
    hours: Record<string, [number, number]> = {};
  const days = String(daysValue ?? "")
    .split(/[|,;/]+/)
    .map((x) => key(x))
    .filter(Boolean);
  const selected = days.length
    ? days.map((x) => dayMap[x]).filter((x) => x != null)
    : [1, 2, 3, 4, 5, 6];
  for (const d of selected) hours[String(d)] = [start, Math.max(start + 15, end)];
  return hours;
}

function indexer(rows: unknown[][]) {
  if (!rows.length || !rows[0]?.length)
    throw new Error("Dosyada başlık satırı bulunamadı.");
  const headers = rows[0].map(key),
    index = new Map<string, number>();
  headers.forEach((header, i) => {
    if (header) index.set(header, i);
  });
  const find = (field: string) => {
    for (const alias of aliases[field] || []) {
      const i = index.get(alias);
      if (i != null) return i;
    }
    return -1;
  };
  const has = (field: string) => find(field) >= 0;
  const get = (row: unknown[], field: string) => {
    const i = find(field);
    return i >= 0 ? row[i] : undefined;
  };
  return { headers, has, get };
}

function required(has: (field: string) => boolean, fields: string[], message: string) {
  if (!fields.every(has)) throw new Error(message);
}

function nonEmptyRows(rows: unknown[][]) {
  return rows.slice(1).filter((row) => row.some((value) => String(value ?? "").trim()));
}

export function buildSetupImport(kind: SetupImportKind, rows: unknown[][]) {
  const { headers, has, get } = indexer(rows),
    dataRows = nonEmptyRows(rows),
    groups: Record<BackendImportKind, any[]> = {
      customers: [],
      services: [],
      staff: [],
      appointments: [],
      receivables: [],
    };
  if (!dataRows.length) throw new Error("Dosyada aktarılacak satır bulunamadı.");

  if (kind === "customers")
    required(
      has,
      ["customer_name", "phone"],
      "Müşteri aktarımı için ad/soyad ve telefon sütunları gerekli. Örn: ad_soyad, telefon.",
    );
  if (kind === "services")
    required(has, ["service"], "Hizmet sütunu bulunamadı. Örn: hizmet veya hizmet_adi.");
  if (kind === "staff" && !has("staff") && !has("customer_name"))
    throw new Error("Personel adı sütunu bulunamadı. Örn: ad_soyad veya personel.");
  if (kind === "appointments")
    required(
      has,
      ["customer_name", "phone", "date"],
      "Randevu aktarımı için ad/soyad, telefon ve tarih sütunları gerekli.",
    );
  if (kind === "receivables")
    required(
      has,
      ["customer_name", "phone", "debt"],
      "Borç aktarımı için ad/soyad, telefon ve borç/veresiye sütunları gerekli.",
    );

  const customer = (row: unknown[]) => ({
    name: String(get(row, "customer_name") ?? "").trim(),
    phone: String(get(row, "phone") ?? "").trim(),
    email: String(get(row, "email") ?? "").trim(),
    consent: consentValue(get(row, "consent")),
  });
  const receivable = (row: unknown[]) => {
    const c = customer(row),
      amount = moneyMinor(get(row, "debt"));
    return {
      ...c,
      title: String(get(row, "note") || get(row, "service") || "Eski borç").trim().slice(0, 100),
      amount,
      due_date: dateValue(get(row, "due_date")) || null,
      note: String(get(row, "note") ?? "Eski kayıt aktarımı").trim().slice(0, 300),
    };
  };
  const isSettledDebt = (row: unknown[]) =>
    debtSettled(get(row, "payment_status") ?? get(row, "status"));
  const appointment = (row: unknown[]) => {
    const c = customer(row),
      d = dateValue(get(row, "date"));
    return {
      ...c,
      service_name: String(get(row, "service") || "Eski kayıt").trim(),
      staff_name: String(get(row, "staff") || "Eski Personel").trim(),
      date: d,
      minute: minuteValue(get(row, "time")),
      duration: duration(get(row, "duration")),
      price: moneyMinor(get(row, "price")),
      status: statusValue(get(row, "status"), d),
      note: String(get(row, "note") ?? "").trim().slice(0, 500),
    };
  };

  for (const row of dataRows) {
    if (kind === "customers") {
      const c = customer(row);
      if (c.name || c.phone) groups.customers.push(c);
      const debt = receivable(row);
      if (debt.amount > 0 && !isSettledDebt(row) && c.name && c.phone)
        groups.receivables.push(debt);
      continue;
    }
    if (kind === "services") {
      groups.services.push({
        name: String(get(row, "service") ?? "").trim(),
        description: String(get(row, "note") ?? "").trim(),
        duration: duration(get(row, "duration")),
        price: moneyMinor(get(row, "price")),
      });
      continue;
    }
    if (kind === "staff") {
      groups.staff.push({
        name: String(get(row, "staff") || get(row, "customer_name") || "").trim(),
        title: String(get(row, "title") || "Uzman").trim(),
        hours: hoursValue(get(row, "days"), get(row, "start"), get(row, "end")),
      });
      continue;
    }
    if (kind === "appointments") {
      const a = appointment(row);
      groups.appointments.push(a);
      const debt = receivable(row);
      if (debt.amount > 0 && !isSettledDebt(row) && a.name && a.phone)
        groups.receivables.push(debt);
      continue;
    }
    if (kind === "receivables") {
      const debt = receivable(row);
      if (debt.amount > 0 && !isSettledDebt(row)) groups.receivables.push(debt);
      continue;
    }

    const looksStaff = has("title") || has("days") || has("start") || has("end"),
      looksCustomer = has("phone") || has("email"),
      looksAppointment = looksCustomer && (has("date") || has("time") || has("status")),
      looksService = has("service") && !looksCustomer;
    if (looksAppointment) {
      const a = appointment(row);
      if (a.name && a.phone && a.date) groups.appointments.push(a);
      const debt = receivable(row);
      if (debt.amount > 0 && !isSettledDebt(row) && a.name && a.phone)
        groups.receivables.push(debt);
    } else if (looksStaff && !looksCustomer) {
      const name = String(get(row, "staff") || get(row, "customer_name") || "").trim();
      if (name)
        groups.staff.push({
          name,
          title: String(get(row, "title") || "Uzman").trim(),
          hours: hoursValue(get(row, "days"), get(row, "start"), get(row, "end")),
        });
    } else if (looksService) {
      const name = String(get(row, "service") || "").trim();
      if (name)
        groups.services.push({
          name,
          description: String(get(row, "note") ?? "").trim(),
          duration: duration(get(row, "duration")),
          price: moneyMinor(get(row, "price")),
        });
    } else if (looksCustomer) {
      const c = customer(row);
      if (c.name && c.phone) groups.customers.push(c);
      const debt = receivable(row);
      if (debt.amount > 0 && !isSettledDebt(row) && c.name && c.phone)
        groups.receivables.push(debt);
    }
  }

  const result = (Object.entries(groups) as [BackendImportKind, any[]][]).filter(
    ([, records]) => records.length,
  );
  if (!result.length)
    throw new Error(
      `Dosya okunabildi ama tanınan kayıt bulunamadı. Başlıklar: ${headers.filter(Boolean).join(", ") || "yok"}.`,
    );
  return result;
}
