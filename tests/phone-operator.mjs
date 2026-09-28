import { createRequire } from "node:module";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const wrangler = createRequire(require.resolve("wrangler/package.json"));
const { Miniflare } = await import(wrangler.resolve("miniflare"));
const root = resolve("dist/server");
const files = ["index.js", ...readdirSync(root, { recursive: true }).filter((x) => x.endsWith(".js") && x !== "index.js")];
const mf = new Miniflare({ modules: files.map((path) => ({ type: "ESModule", path: resolve(root, path) })), modulesRoot: root, compatibilityDate: "2026-05-15", compatibilityFlags: ["nodejs_compat"], d1Databases: ["DB"], bindings: { PLATFORM_ADMIN_USER_IDS: "qa-admin", CHATGPT_AUTH_ENABLED: "true", PUBLIC_APP_URL: "https://neta.test" }, cf: false });
const request = async (path, user, body) => {
  const response = await mf.dispatchFetch("https://neta.test/api/v1/" + path, { method: body ? "POST" : "GET", headers: { "oai-authenticated-user-id": user, "oai-authenticated-user-email": user + "@example.test", ...(body ? { "content-type": "application/json", origin: "https://neta.test", "sec-fetch-site": "same-origin" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, data: await response.json() };
};

try {
  const db = await mf.getD1Database("DB");
  for (const file of readdirSync("drizzle").filter((x) => x.endsWith(".sql")).sort()) {
    for (const sql of readFileSync("drizzle/" + file, "utf8").split("--> statement-breakpoint").map((x) => x.trim()).filter(Boolean)) await db.prepare(sql).run();
  }
  const workspace = await request("demo-workspace", "owner", {});
  assert.equal(workspace.status, 201);
  const tenant = workspace.data.business.id;
  assert.equal((await request("phone-operator?tenant=" + tenant, "owner")).status, 402);
  assert.equal((await request("admin-manager-addon", "qa-admin", { tenant_id: tenant, code: "phone_operator", enabled: true })).status, 200);
  const initial = await request("phone-operator?tenant=" + tenant, "owner");
  assert.equal(initial.status, 200);
  assert.equal(initial.data.settings.provider, "demo");
  assert.equal((await request("phone-operator", "owner", { tenant_id: tenant, inbound_number: "08501234567", provider: "demo", greeting: "Merhaba, bilgi için 1, randevu için 2.", info_transfer_number: "05551234567", timeout_seconds: 15, appointment_message: "Randevu bağlantınız WhatsApp üzerinden gönderilecektir." })).status, 200);
  const info = await request("phone-operator", "owner", { tenant_id: tenant, action: "simulate", digit: "1", caller_phone: "05550000001", duration_seconds: 8 });
  assert.equal(info.status, 200); assert.equal(info.data.outcome, "info_transfer");
  const appointment = await request("phone-operator", "owner", { tenant_id: tenant, action: "simulate", digit: "2", caller_phone: "05550000002", duration_seconds: 6 });
  assert.equal(appointment.status, 200); assert.equal(appointment.data.outcome, "appointment_whatsapp"); assert.ok(appointment.data.appointment_link);
  const snapshot = await request("phone-operator?tenant=" + tenant, "owner");
  assert.equal(snapshot.data.totals.calls, 2); assert.equal(snapshot.data.totals.info_requests, 1); assert.equal(snapshot.data.totals.appointment_requests, 1);
  assert.equal((await request("phone-operator?tenant=" + tenant, "other-owner")).status, 403);
  console.log("PASS phone operator addon gate, settings, demo IVR outcomes, WhatsApp link and tenant isolation");
} finally { await mf.dispose(); }
