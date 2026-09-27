type ZipEntry = {
  method: number;
  compressedSize: number;
  localOffset: number;
};

const decoder = new TextDecoder("utf-8");
const u16 = (view: DataView, offset: number) => view.getUint16(offset, true);
const u32 = (view: DataView, offset: number) => view.getUint32(offset, true);

function zipEntries(buffer: ArrayBuffer) {
  const view = new DataView(buffer);
  let end = -1;
  const min = Math.max(0, buffer.byteLength - 66000);
  for (let i = buffer.byteLength - 22; i >= min; i--) {
    if (u32(view, i) === 0x06054b50) {
      end = i;
      break;
    }
  }
  if (end < 0) throw new Error("Excel dosyasının ZIP dizini okunamadı.");

  const count = u16(view, end + 10);
  let offset = u32(view, end + 16);
  const entries = new Map<string, ZipEntry>();
  for (let n = 0; n < count; n++) {
    if (u32(view, offset) !== 0x02014b50)
      throw new Error("Excel dosyasının ZIP dizini bozuk.");
    const method = u16(view, offset + 10),
      compressedSize = u32(view, offset + 20),
      nameLength = u16(view, offset + 28),
      extraLength = u16(view, offset + 30),
      commentLength = u16(view, offset + 32),
      localOffset = u32(view, offset + 42),
      name = decoder.decode(new Uint8Array(buffer, offset + 46, nameLength));
    entries.set(name.replace(/^\//, ""), {
      method,
      compressedSize,
      localOffset,
    });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

async function inflateEntry(buffer: ArrayBuffer, entry: ZipEntry) {
  const view = new DataView(buffer),
    local = entry.localOffset;
  if (u32(view, local) !== 0x04034b50)
    throw new Error("Excel dosyasındaki bir kayıt okunamadı.");
  const nameLength = u16(view, local + 26),
    extraLength = u16(view, local + 28),
    start = local + 30 + nameLength + extraLength,
    compressed = new Uint8Array(buffer, start, entry.compressedSize);
  if (entry.method === 0) return compressed;
  if (entry.method !== 8)
    throw new Error("Bu Excel sıkıştırma biçimi desteklenmiyor.");
  const stream = new Blob([compressed])
    .stream()
    .pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function decodeXml(value = "") {
  return value.replace(
    /&#(x?[0-9a-f]+);|&(amp|lt|gt|quot|apos);/gi,
    (_match, numeric: string | undefined, named: string | undefined) => {
      if (numeric) {
        const hex = numeric[0].toLowerCase() === "x";
        const code = Number.parseInt(hex ? numeric.slice(1) : numeric, hex ? 16 : 10);
        return Number.isFinite(code) ? String.fromCodePoint(code) : "";
      }
      return ({
        amp: "&",
        lt: "<",
        gt: ">",
        quot: '"',
        apos: "'",
      } as Record<string, string>)[String(named).toLowerCase()] || "";
    },
  );
}

function attribute(source: string, name: string) {
  const escaped = name.replace(":", "\\:");
  const match = source.match(
    new RegExp(`(?:^|\\s)${escaped}=["']([^"']*)["']`, "i"),
  );
  return match ? decodeXml(match[1]) : "";
}

function textNodes(xml: string) {
  let out = "",
    match: RegExpExecArray | null;
  const pattern = /<(?:\w+:)?t\b[^>]*>([\s\S]*?)<\/(?:\w+:)?t>/gi;
  while ((match = pattern.exec(xml)))
    out += decodeXml(match[1].replace(/<[^>]+>/g, ""));
  return out;
}

function columnIndex(reference: string) {
  const match = reference.match(/^([A-Z]+)/i);
  if (!match) return 0;
  let value = 0;
  for (const char of match[1].toUpperCase())
    value = value * 26 + char.charCodeAt(0) - 64;
  return value - 1;
}

async function parseXlsx(input: Blob | ArrayBuffer) {
  const buffer = input instanceof ArrayBuffer ? input : await input.arrayBuffer();
  const entries = zipEntries(buffer);
  const read = async (path: string) => {
    const entry = entries.get(path.replace(/^\//, ""));
    if (!entry) return "";
    return decoder
      .decode(await inflateEntry(buffer, entry))
      .replace(/^\ufeff/, "");
  };

  const shared: string[] = [];
  if (entries.has("xl/sharedStrings.xml")) {
    const xml = await read("xl/sharedStrings.xml");
    let match: RegExpExecArray | null;
    const pattern = /<(?:\w+:)?si\b[^>]*>([\s\S]*?)<\/(?:\w+:)?si>/gi;
    while ((match = pattern.exec(xml))) shared.push(textNodes(match[1]));
  }

  const sheets = [...entries.keys()]
    .filter((path) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(path))
    .sort((a, b) => {
      const left = Number(a.match(/sheet(\d+)/i)?.[1] || 0),
        right = Number(b.match(/sheet(\d+)/i)?.[1] || 0);
      return left - right;
    });
  if (!sheets.length) throw new Error("Excel içinde çalışma sayfası bulunamadı.");

  const xml = await read(sheets[0]);
  const rows: unknown[][] = [];
  let rowMatch: RegExpExecArray | null;
  const rowPattern = /<(?:\w+:)?row\b[^>]*>([\s\S]*?)<\/(?:\w+:)?row>/gi;
  while ((rowMatch = rowPattern.exec(xml))) {
    const row: unknown[] = [];
    let cellMatch: RegExpExecArray | null;
    const cellPattern = /<(?:\w+:)?c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:\w+:)?c>)/gi;
    while ((cellMatch = cellPattern.exec(rowMatch[1]))) {
      const attrs = cellMatch[1] || "",
        body = cellMatch[2] || "",
        reference = attribute(attrs, "r"),
        type = attribute(attrs, "t");
      let value: unknown = "";
      if (type === "inlineStr") value = textNodes(body);
      else {
        const valueMatch = body.match(
          /<(?:\w+:)?v\b[^>]*>([\s\S]*?)<\/(?:\w+:)?v>/i,
        );
        const raw = valueMatch
          ? decodeXml(valueMatch[1].replace(/<[^>]+>/g, ""))
          : "";
        if (type === "s") {
          const index = Number(raw);
          value = Number.isInteger(index) ? shared[index] || "" : "";
        } else if (type === "b") value = raw === "1";
        else if (type === "str") value = raw;
        else if (type === "e") value = "";
        else if (raw === "") value = "";
        else {
          const number = Number(raw);
          value = Number.isFinite(number) ? number : raw;
        }
      }
      row[reference ? columnIndex(reference) : row.length] = value;
    }
    rows.push(row);
  }

  const compact = rows.filter((row, index) => {
    if (index === 0) return true;
    return row.some((value) => String(value ?? "").trim().length > 0);
  });
  if (!compact.length || !compact[0]?.length)
    throw new Error("Excel dosyasında okunabilir veri bulunamadı.");
  return compact;
}

export default async function readExcelFile(input: Blob | ArrayBuffer) {
  return parseXlsx(input);
}
