import { createRequire } from "node:module";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const wr = createRequire(require.resolve("wrangler/package.json"));
const { Miniflare } = await import(wr.resolve("miniflare"));
const root = resolve("dist/server");
const files = ["index.js", ...readdirSync(root, { recursive: true }).filter((p) => p.endsWith(".js") && p !== "index.js")];
const mf = new Miniflare({
  modules: files.map((p) => ({ type: "ESModule", path: resolve(root, p) })),
  modulesRoot: root,
  compatibilityDate: "2026-05-15",
  compatibilityFlags: ["nodejs_compat"],
  d1Databases: ["DB"],
  cf: false,
  outboundService: () => { throw new Error("External network not allowed"); },
});

let checks = 0;
function check(value, label) {
  assert.ok(value, label);
  checks++;
  console.log("PASS", label);
}

try {
  const db = await mf.getD1Database("DB");
  for (const file of readdirSync("drizzle").filter((p) => p.endsWith(".sql")).sort()) {
    for (const sql of readFileSync(`drizzle/${file}`, "utf8")
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean)) {
      await db.prepare(sql).run();
    }
  }

  const now = new Date().toISOString();
  const hours = JSON.stringify({ "1": [540, 1080] });
  await db.prepare("INSERT INTO profiles(user_id,name,email,phone,city,account_type,marketing_consent,disabled,created_at,updated_at) VALUES('customer-1','Ortak Müşteri','customer@example.test','+905550000001','','customer',0,0,?,?)").bind(now, now).run();

  for (const [id, name, slug, category, phone] of [
    ["biz-a", "Spa A", "spa-a", "Güzellik Salonu", "+905550000011"],
    ["biz-b", "Kuaför B", "kuafor-b", "Kuaför & Berber", "+905550000012"],
    ["biz-c", "Diyetisyen C", "diyetisyen-c", "Diyetisyen", "+905550000013"],
  ]) {
    await db.prepare("INSERT INTO businesses(id,name,slug,category,hours,status,created_at) VALUES(?,?,?,?,?,'approved',?)").bind(id, name, slug, category, hours, now).run();
    await db.prepare("INSERT INTO customers(id,tenant_id,name,phone,email,consent,created_at) VALUES(?,?,?,?,?,0,?)").bind(`customer-${id}`, id, "Ortak Müşteri", phone, "customer@example.test", now).run();
    await db.prepare("INSERT INTO customer_memberships(tenant_id,user_id,customer_id,joined_at,updated_at) VALUES(?,?,?,?,?)").bind(id, "customer-1", `customer-${id}`, now, now).run();
  }

  const memberships = (await db.prepare("SELECT tenant_id,customer_id FROM customer_memberships WHERE user_id='customer-1' ORDER BY tenant_id").all()).results;
  check(memberships.length === 3, "One Neta account can hold three separate business memberships");
  check(new Set(memberships.map((row) => row.customer_id)).size === 3, "Each business membership keeps its own local customer card");

  let duplicateRejected = false;
  try {
    await db.prepare("INSERT INTO customer_memberships(tenant_id,user_id,customer_id,joined_at,updated_at) VALUES('biz-a','customer-1','customer-biz-a',?,?)").bind(now, now).run();
  } catch {
    duplicateRejected = true;
  }
  check(duplicateRejected, "The same account cannot create a duplicate membership inside one business");

  const trigger = await db.prepare("SELECT sql FROM sqlite_master WHERE type='trigger' AND name='account_booking_customer_membership'").first();
  check(!!trigger?.sql, "Account booking membership trigger is installed");
  check((await db.prepare("PRAGMA foreign_key_check").all()).results.length === 0, "Customer membership foreign keys remain valid");

  console.log(JSON.stringify({ passed: checks, failed: 0 }));
} finally {
  await mf.dispose();
}
