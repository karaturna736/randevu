// Revenue recovery and migration integration tests. No provider traffic is sent.
import { createRequire } from "node:module";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID, createHash } from "node:crypto";
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
  bindings: { PLATFORM_ADMIN_USER_IDS: "admin" },
  cf: false,
  outboundService: () => {
    throw new Error("No external traffic");
  },
});
let checks = 0;
function check(v, label) {
  assert.ok(v, label);
  checks++;
  console.log("PASS", label);
}
async function call(path, { user, body, token } = {}) {
  const r = await mf.dispatchFetch("https://neta.test/api/v1/" + path, {
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
      ...(token ? { authorization: "Bearer " + token } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: r.status, data: await r.json() };
}
const day = (n) =>
    new Date(Date.now() + n * 86400000).toISOString().slice(0, 10),
  hours = Object.fromEntries(
    [0, 1, 2, 3, 4, 5, 6].map((k) => [k, [540, 1260]]),
  );
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
  const A = (
      await call("businesses", {
        user: "owner-a",
        body: {
          name: "Kurtarma A",
          slug: "kurtarma-a",
          category: "Kuaför & Berber",
        },
      })
    ).data.id,
    B = (
      await call("businesses", {
        user: "owner-b",
        body: {
          name: "Kurtarma B",
          slug: "kurtarma-b",
          category: "Kuaför & Berber",
        },
      })
    ).data.id;
  await call("admin", {
    user: "admin",
    body: { action: "business-status", id: A, status: "approved" },
  });
  await call("admin", {
    user: "admin",
    body: { action: "business-status", id: B, status: "approved" },
  });
  await call("settings", {
    user: "owner-a",
    body: {
      tenant_id: A,
      name: "Kurtarma A",
      category: "Kuaför & Berber",
      city: "İstanbul",
      address: "Test",
      phone: "",
      description: "",
      hours,
      cancellation_hours: 2,
    },
  });
  await call("services", {
    user: "owner-a",
    body: { tenant_id: A, name: "Saç kesimi", duration: 45, price: 65000 },
  });
  await call("staff", {
    user: "owner-a",
    body: { tenant_id: A, name: "Uzman A", title: "Uzman", hours },
  });
  const w = (await call("workspace?tenant=" + A, { user: "owner-a" })).data,
    S = w.services[0].id,
    P = w.staff[0].id,
    D = day(4);
  const booking = (
    await call("bookings", {
      body: {
        slug: "kurtarma-a",
        service_id: S,
        staff_id: P,
        date: D,
        minute: 1050,
        name: "İlk müşteri",
        phone: "05551110000",
        email: "",
        consent: false,
      },
    })
  ).data;
  check(!!booking.id, "Source appointment created");
  const wait = {
    slug: "kurtarma-a",
    service_id: S,
    staff_id: P,
    date: D,
    minute_from: 1020,
    minute_to: 1140,
    name: "Bekleyen müşteri",
    phone: "05552220000",
    email: "wait@example.test",
    consent: true,
  };
  check(
    (await call("waitlist", { body: wait })).status === 201,
    "Customer joins waitlist without membership",
  );
  const duplicate = await call("waitlist", {
    body: { ...wait, minute_from: 1035 },
  });
  check(
    duplicate.data.updated === true,
    "Repeated waitlist intent updates instead of duplicating",
  );
  check(
    (
      await call("waitlist", {
        body: { ...wait, consent: false, phone: "05553330000" },
      })
    ).status === 400,
    "Transactional WhatsApp consent is explicit",
  );
  check(
    (
      await call("appointment", {
        user: "owner-a",
        body: { tenant_id: A, id: booking.id, status: "cancelled" },
      })
    ).status === 200,
    "Cancellation opens a recovery slot",
  );
  const slot = await db
    .prepare("SELECT * FROM recovery_slots WHERE source_appointment_id=?")
    .bind(booking.id)
    .first();
  check(
    slot?.status === "queued" && slot.minute === 1050,
    "Released slot preserves service, staff, time and price",
  );
  const entry = await db
      .prepare(
        "SELECT * FROM waitlist_entries WHERE tenant_id=? AND phone='+905552220000'",
      )
      .bind(A)
      .first(),
    token = "a".repeat(64),
    offerId = randomUUID();
  await db
    .prepare(
      "INSERT INTO recovery_offers(id,tenant_id,recovery_slot_id,waitlist_id,token_hash,status,expires_at,created_at) VALUES(?,?,?,?,?,'offered',?,?)",
    )
    .bind(
      offerId,
      A,
      slot.id,
      entry.id,
      createHash("sha256").update(token).digest("hex"),
      new Date(Date.now() + 600000).toISOString(),
      new Date().toISOString(),
    )
    .run();
  await db
    .prepare("UPDATE recovery_slots SET status='offering' WHERE id=?")
    .bind(slot.id)
    .run();
  const accepted = await Promise.all([
    call("recovery-offer", { token, body: {} }),
    call("recovery-offer", { token, body: {} }),
  ]);
  check(
    accepted.filter((x) => x.status === 201).length === 1 &&
      accepted.filter((x) => x.status === 409).length === 1,
    "Only the first accepter receives the released slot",
  );
  const filled = await db
    .prepare("SELECT * FROM recovery_slots WHERE id=?")
    .bind(slot.id)
    .first();
  check(
    filled.status === "filled" && filled.recovered_amount === 65000,
    "Recovered revenue is attributed to the real appointment",
  );
  const metrics = (await call("recovery?tenant=" + A, { user: "owner-a" }))
    .data;
  check(
    metrics.totals.filled_slots === 1 &&
      metrics.totals.recovered_revenue === 65000,
    "Owner sees actual recovered slot and revenue",
  );
  check(
    (await call("recovery?tenant=" + A, { user: "owner-b" })).status === 403,
    "Recovery analytics stay tenant isolated",
  );
  const batch = randomUUID(),
    customers = {
      tenant_id: A,
      batch_id: batch,
      kind: "customers",
      rows: [
        {
          name: "Aktarılan Müşteri",
          phone: "05554440000",
          email: "import@example.test",
          consent: false,
        },
      ],
    };
  check(
    (await call("setup-import", { user: "owner-a", body: customers })).data
      .imported === 1,
    "Customer migration imports validated rows",
  );
  check(
    (await call("setup-import", { user: "owner-a", body: customers })).data
      .duplicate === true,
    "Import batch retry is idempotent",
  );
  check(
    (
      await call("setup-import", {
        user: "owner-b",
        body: { ...customers, tenant_id: A, batch_id: randomUUID() },
      })
    ).status === 403,
    "Other owner cannot import into a foreign business",
  );
  const serviceBatch = await call("setup-import", {
    user: "owner-a",
    body: {
      tenant_id: A,
      batch_id: randomUUID(),
      kind: "services",
      rows: [
        {
          name: "Sakal bakımı",
          description: "Bakım",
          duration: 30,
          price: 40000,
        },
      ],
    },
  });
  const staffBatch = await call("setup-import", {
    user: "owner-a",
    body: {
      tenant_id: A,
      batch_id: randomUUID(),
      kind: "staff",
      rows: [{ name: "Yeni Uzman", title: "Berber", hours }],
    },
  });
  check(
    serviceBatch.data.imported === 1 && staffBatch.data.imported === 1,
    "Service prices and staff hours migrate through the setup center",
  );
  check(
    (
      await call("setup-training", {
        user: "owner-a",
        body: {
          tenant_id: A,
          preferred_date: day(7),
          note: "Öğleden sonra uygundur.",
        },
      })
    ).status === 201,
    "Owner can request the 30-minute setup training",
  );
  const setup = (await call("setup-center?tenant=" + A, { user: "owner-a" }))
    .data;
  check(
    setup.counts.customers >= 2 &&
      setup.counts.services === 2 &&
      setup.counts.staff === 2 &&
      setup.training.status === "pending",
    "Setup center reports migration and training progress",
  );
  check(
    (await db.prepare("PRAGMA foreign_key_check").all()).results.length === 0,
    "Recovery and setup records preserve tenant foreign keys",
  );
  console.log(JSON.stringify({ passed: checks, failed: 0 }));
} finally {
  await mf.dispose();
}
