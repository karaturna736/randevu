import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import readXlsx from "../lib/read-excel-file-shim.ts";
import { buildSetupImport, parseSetupCsv } from "../components/product/setup-import-utils.ts";

const csv = '\ufeffAd Soyad;Telefon;E-posta;WhatsApp İzni\r\n"Ayşe, Test";05321234567;;hayır\r\n"Ali\nYılmaz";05554443322;ali@example.test;evet\r\n';
const csvRows = parseSetupCsv(csv);
assert.equal(csvRows.length, 3);
assert.equal(csvRows[1][0], "Ayşe, Test");
assert.equal(csvRows[2][0], "Ali\nYılmaz");
const customers = buildSetupImport("customers", csvRows).find(([kind]) => kind === "customers")?.[1];
assert.equal(customers?.length, 2);
assert.equal(customers[0].consent, false);
assert.equal(customers[1].consent, true);
console.log("PASS Excel CSV with Turkish headers, BOM and quoted newlines maps customer and consent fields");

const bytes = readFileSync("tests/fixtures/customer-import.xlsx");
const xlsxRows = await readXlsx(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
const xlsxCustomers = buildSetupImport("customers", xlsxRows).find(([kind]) => kind === "customers")?.[1];
assert.equal(xlsxCustomers?.length, 1);
assert.equal(xlsxCustomers[0].name, "Ayşe Örnek");
assert.equal(xlsxCustomers[0].phone, "5321234567");
assert.equal(xlsxCustomers[0].consent, false);
console.log("PASS XLSX shared strings and numeric telephone columns map to customer data");
