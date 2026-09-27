import readExcelFile from "read-excel-file";

/**
 * Neta kurulum aktarımı için ilk Excel çalışma sayfasını okur.
 *
 * Projede `read-excel-file` TypeScript path alias'i bizim tarayıcı uyumlu
 * XLSX shim'imize yönlenir. Böylece namespace kullanan Excel üreticilerinin
 * (`<x:row>`, `<x:c>`, `<x:v>` gibi) dosyaları da doğru okunur.
 */
export async function parseSetupXlsx(file: File): Promise<unknown[][]> {
  const parsed = await readExcelFile(file);
  const rows = Array.isArray(parsed)
    ? parsed.map((row) => (Array.isArray(row) ? row : []))
    : [];

  const compact = rows.filter((row, index) => {
    if (index === 0) return row.length > 0;
    return row.some((value) => String(value ?? "").trim().length > 0);
  });

  if (!compact.length || !compact[0]?.length)
    throw new Error("Excel dosyasında okunabilir veri bulunamadı.");

  return compact;
}
