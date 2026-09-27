const decoder = new TextDecoder("utf-8");

type ZipEntry = {
  name: string;
  method: number;
  compressedSize: number;
  localOffset: number;
};

function u16(view: DataView, offset: number) {
  return view.getUint16(offset, true);
}

function u32(view: DataView, offset: number) {
  return view.getUint32(offset, true);
}

function findEocd(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const min = Math.max(0, bytes.length - 65557);
  for (let i = bytes.length - 22; i >= min; i--) {
    if (u32(view, i) === 0x06054b50) return i;
  }
  throw new Error("Excel dosyası ZIP yapısında okunamadı.");
}

function listZipEntries(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength),
    eocd = findEocd(bytes),
    total = u16(view, eocd + 10),
    centralOffset = u32(view, eocd + 16),
    entries = new Map<string, ZipEntry>();
  let p = centralOffset;
  for (let n = 0; n < total; n++) {
    if (u32(view, p) !== 0x02014b50)
      throw new Error("Excel dosyasının dizini okunamadı.");
    const method = u16(view, p + 10),
      compressedSize = u32(view, p + 20),
      nameLength = u16(view, p + 28),
      extraLength = u16(view, p + 30),
      commentLength = u16(view, p + 32),
      localOffset = u32(view, p + 42),
      name = decoder.decode(bytes.subarray(p + 46, p + 46 + nameLength));
    entries.set(name.replace(/^\//, ""), {
      name,
      method,
      compressedSize,
      localOffset,
    });
    p += 46 + nameLength + extraLength + commentLength;
  }
  return { view, entries };
}

async function inflateRaw(data: Uint8Array) {
  const Ctor = (globalThis as any).DecompressionStream;
  if (!Ctor)
    throw new Error(
      "Tarayıcınız Excel sıkıştırmasını desteklemiyor. Güncel Chrome, Edge veya Firefox ile tekrar deneyin.",
    );
  const stream = new Blob([data]).stream().pipeThrough(new Ctor("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function zipText(
  bytes: Uint8Array,
  view: DataView,
  entries: Map<string, ZipEntry>,
  path: string,
) {
  const entry = entries.get(path.replace(/^\//, ""));
  if (!entry) return "";
  const p = entry.localOffset;
  if (u32(view, p) !== 0x04034b50)
    throw new Error(`Excel içindeki ${path} kaydı okunamadı.`);
  const nameLength = u16(view, p + 26),
    extraLength = u16(view, p + 28),
    start = p + 30 + nameLength + extraLength,
    compressed = bytes.subarray(start, start + entry.compressedSize);
  let raw: Uint8Array;
  if (entry.method === 0) raw = compressed;
  else if (entry.method === 8) raw = await inflateRaw(compressed);
  else throw new Error("Excel dosyasında desteklenmeyen sıkıştırma yöntemi var.");
  return decoder.decode(raw);
}

function attr(source: string, name: string) {
  const escaped = name.replace(":", "\\:");
  return (
    source.match(new RegExp(`(?:^|\\s)${escaped}=["']([^"']*)["']`, "i"))?.[1] || ""
  );
}

function xmlDecode(value: string) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function texts(xml: string) {
  const out: string[] = [];
  for (const match of xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/gi))
    out.push(xmlDecode(match[1] || ""));
  return out.join("");
}

function sharedStrings(xml: string) {
  if (!xml) return [];
  const out: string[] = [];
  for (const match of xml.matchAll(/<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/gi))
    out.push(texts(match[1] || ""));
  return out;
}

function firstSheetPath(workbook: string, rels: string) {
  const sheet = workbook.match(/<sheet\b([^>]*)\/?\s*>/i)?.[1] || "",
    relationId = attr(sheet, "r:id");
  if (!relationId) return "xl/worksheets/sheet1.xml";
  for (const match of rels.matchAll(/<Relationship\b([^>]*)\/?\s*>/gi)) {
    const a = match[1] || "";
    if (attr(a, "Id") !== relationId) continue;
    const target = attr(a, "Target").replace(/^\//, "");
    if (!target) break;
    if (target.startsWith("xl/")) return target;
    return "xl/" + target.replace(/^\.\//, "");
  }
  return "xl/worksheets/sheet1.xml";
}

function columnIndex(ref: string) {
  const letters = ref.match(/^[A-Z]+/i)?.[0]?.toUpperCase() || "A";
  let n = 0;
  for (const c of letters) n = n * 26 + c.charCodeAt(0) - 64;
  return n - 1;
}

function rowIndex(ref: string) {
  const n = Number(ref.match(/\d+$/)?.[0] || 1);
  return Math.max(0, n - 1);
}

function parseSheet(xml: string, shared: string[]) {
  const rows: unknown[][] = [];
  const cellPattern = /<c\b([^>]*?)(?:\/\s*>|>([\s\S]*?)<\/c>)/gi;
  for (const match of xml.matchAll(cellPattern)) {
    const a = match[1] || "",
      body = match[2] || "",
      ref = attr(a, "r");
    if (!ref) continue;
    const type = attr(a, "t"),
      r = rowIndex(ref),
      c = columnIndex(ref);
    while (rows.length <= r) rows.push([]);
    while (rows[r].length <= c) rows[r].push(undefined);
    let value: unknown = "";
    if (type === "inlineStr") value = texts(body);
    else {
      const raw = body.match(/<v(?:\s[^>]*)?>([\s\S]*?)<\/v>/i)?.[1] || "";
      if (type === "s") value = shared[Number(raw)] ?? "";
      else if (type === "b") value = raw === "1";
      else if (type === "str") value = xmlDecode(raw);
      else if (raw !== "") {
        const n = Number(raw);
        value = Number.isFinite(n) ? n : xmlDecode(raw);
      }
    }
    rows[r][c] = value;
  }
  while (rows.length && !rows[rows.length - 1].some((v) => String(v ?? "").trim()))
    rows.pop();
  return rows;
}

export async function parseSetupXlsx(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer()),
    { view, entries } = listZipEntries(bytes),
    workbook = await zipText(bytes, view, entries, "xl/workbook.xml"),
    rels = await zipText(bytes, view, entries, "xl/_rels/workbook.xml.rels"),
    sheetPath = firstSheetPath(workbook, rels),
    sheet = await zipText(bytes, view, entries, sheetPath),
    sharedXml = await zipText(bytes, view, entries, "xl/sharedStrings.xml");
  if (!sheet)
    throw new Error("Excel dosyasının ilk çalışma sayfası okunamadı.");
  const rows = parseSheet(sheet, sharedStrings(sharedXml));
  if (!rows.length)
    throw new Error("Excel dosyasında aktarılacak satır bulunamadı.");
  return rows;
}
