// Smart legacy Excel/CSV migration integration tests. No external traffic is sent.
import { createRequire } from "node:module";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
const require = createRequire(import.meta.url),
  wr = createRequire(require.resolve("wrangler/package.json"));
const { Miniflare } = await import(wr.resolve("miniflare"));
const root = resolve("dist/server");
const files = [
  "index.js",
  ...readdirSync(root, { recursive: true }).filter(
    (p) => p.endsWith(".js") && p !== "index.js",
  ),
];
const mf = new Miniflare({
  modules: files.map((p) => ({ type: "ESModule", path: resolve(root, p) })),
  modulesRoot: root,
  compatibilityDate: "2026-05-15",
  compatibilityFlags: ["nodejs_compat"],
  d1Databases: ["DB"],
  bindings: { PLATFORM_ADMIN_USER_IDS: "admin", CHATGPT_AUTH_ENABLED: "true" },
  cf: false,
  outboundService: () => {
    throw new Error("No external traffic");
  },
});
let checks = 0;
function check(value, label) {
  assert.ok(value, label);
  checks++;
  console.log("PASS", label);
}
async function call(path, { user, body } = {}) {
  const response = await mf.dispatchFetch("https://neta.test/api/v1/" + path, {
    method: body ? "POST" : "GET",
    headers: {
      ...(user
        ? {
            "oai-authenticated-user-id": user,
            "oai-authenticated-user-email": user + "@example.test",
          }
        : {}),
      ...(body
        ? { "content-type": "application/json", origin: "https://neta.test" }
        : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: response.status, data: await response.json() };
}
const day = (n) =>
  new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

try {
  const db = await mf.getD1Database("DB");
  for (const file of readdirSync("drizzle")
    .filter((p) => p.endsWith(".sql"))
    .sort())
    for (const sql of readFileSync("drizzle/" + file, "utf8")
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean))
      await db.prepare(sql).run();

  const tenantId = (
    await call("businesses", {
      user: "owner-import",
      body: {
        name: "Eski Kayıt Test",
        slug: "eski-kayit-test",
        category: "Kuaför & Berber",
      },
    })
  ).data.id;
  await call("admin", {
    user: "admin",
    body: { action: "business-status", id: tenantId, status: "approved" },
  });
  const stamp = new Date().toISOString();
  await db
    .prepare(
      "INSERT INTO recurring_subscriptions(tenant_id,plan_reference,plan,amount,state,request_id,test_mode,paid_until,created_at,updated_at) VALUES(?,'legacy-import-plus','plus',250000,'ACTIVE',?,0,?,?,?)",
    )
    .bind(
      tenantId,
      randomUUID(),
      new Date(Date.now() + 86400000).toISOString(),
      stamp,
      stamp,
    )
    .run();

  const appointmentImport = await call("setup-import", {
    user: "owner-import",
    body: {
      tenant_id: tenantId,
      batch_id: randomUUID(),
      kind: "appointments",
      rows: [
        {
          name: "Geçmiş Müşteri",
          phone: "05557770000",
          email: "",
          consent: false,
          service_name: "Arşiv Saç Kesimi",
          staff_name: "Arşiv Uzman",
          date: day(-5),
          minute: 600,
          duration: 45,
          price: 72500,
          status: "completed",
          note: "Eski programdan geldi",
        },
      ],
    },
  });
  check(
    appointmentImport.status === 200 && appointmentImport.data.imported === 1,
    "Historical appointment imports through setup center",
  );
  const importedAppointment = await db
    .prepare(
      "SELECT a.*,c.phone,s.name service_name,p.name staff_name FROM appointments a JOIN customers c ON c.tenant_id=a.tenant_id AND c.id=a.customer_id JOIN services s ON s.tenant_id=a.tenant_id AND s.id=a.service_id JOIN staff p ON p.tenant_id=a.tenant_id AND p.id=a.staff_id WHERE a.tenant_id=? AND c.phone='+905557770000'",
    )
    .bind(tenantId)
    .first();
  check(
    importedAppointment?.status === "completed" &&
      importedAppointment?.price === 72500 &&
      importedAppointment?.source === "api" &&
      importedAppointment?.branch_id &&
      importedAppointment?.service_name === "Arşiv Saç Kesimi" &&
      importedAppointment?.staff_name === "Arşiv Uzman",
    "Imported history is attached to customer, service, staff and branch",
  );
  const revenue = await db
    .prepare(
      "SELECT COALESCE(SUM(price),0) total FROM appointments WHERE tenant_id=? AND status='completed'",
    )
    .bind(tenantId)
    .first();
  check(
    revenue?.total === 72500,
    "Imported completed appointment contributes to revenue reports",
  );

  const debtBody = {
    tenant_id: tenantId,
    batch_id: randomUUID(),
    kind: "receivables",
    rows: [
      {
        name: "Borçlu Müşteri",
        phone: "05558880000",
        email: "",
        title: "Eski sistem borcu",
        amount: 18500,
        due_date: day(7),
        note: "Excel aktarımı",
      },
    ],
  };
  const debtImport = await call("setup-import", {
    user: "owner-import",
    body: debtBody,
  });
  check(
    debtImport.status === 200 && debtImport.data.imported === 1,
    "Debt column can migrate into receivables",
  );
  const receivables = (
    await call("receivables?tenant=" + tenantId, { user: "owner-import" })
  ).data;
  check(
    receivables.debts.some(
      (row) =>
        row.customer_phone === "+905558880000" &&
        row.amount === 18500 &&
        row.remaining === 18500 &&
        row.status === "open",
    ),
    "Imported debt is visible in the digital receivables ledger",
  );

  const repeatedDebt = await call("setup-import", {
    user: "owner-import",
    body: { ...debtBody, batch_id: randomUUID() },
  });
  check(
    repeatedDebt.data.imported === 0 && repeatedDebt.data.duplicate_rows === 1,
    "Re-uploading the same debt does not duplicate the balance",
  );
  const debtCount = await db
    .prepare(
      "SELECT COUNT(*) n FROM receivables r JOIN customers c ON c.tenant_id=r.tenant_id AND c.id=r.customer_id WHERE r.tenant_id=? AND c.phone='+905558880000'",
    )
    .bind(tenantId)
    .first();
  check(debtCount?.n === 1, "Debt idempotency is stable across import batches");

  const setup = (
    await call("setup-center?tenant=" + tenantId, { user: "owner-import" })
  ).data;
  check(
    setup.counts.appointments >= 1 && setup.counts.receivables >= 1,
    "Setup center reports migrated appointments and open debts",
  );
  check(
    (await db.prepare("PRAGMA foreign_key_check").all()).results.length === 0,
    "Legacy import preserves tenant foreign keys",
  );
  console.log(JSON.stringify({ passed: checks, failed: 0 }));
} finally {
  await mf.dispose();
}
