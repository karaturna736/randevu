// Critical access, recovery, branch and import regression tests. No external traffic is sent.
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
  bindings: {
    PLATFORM_ADMIN_USER_IDS: "admin-critical",
    CHATGPT_AUTH_ENABLED: "true",
    PUBLIC_APP_URL: "https://neta.test",
  },
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
async function call(path, { user, body, token } = {}) {
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
        ? {
            "content-type": "application/json",
            origin: "https://neta.test",
            "sec-fetch-site": "same-origin",
          }
        : {}),
      ...(token ? { authorization: "Bearer " + token } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: response.status, data: await response.json() };
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

  const owner = "owner-critical";
  const tenantId = (
    await call("businesses", {
      user: owner,
      body: {
        name: "Kritik Sağlamlık",
        slug: "kritik-saglamlik",
        category: "Kuaför & Berber",
      },
    })
  ).data.id;
  await call("admin", {
    user: "admin-critical",
    body: { action: "business-status", id: tenantId, status: "approved" },
  });
  const stamp = new Date().toISOString(),
    activeUntil = new Date(Date.now() + 7 * 86400000).toISOString();
  await db
    .prepare(
      "INSERT INTO recurring_subscriptions(tenant_id,plan_reference,plan,amount,state,request_id,test_mode,paid_until,created_at,updated_at) VALUES(?,'critical-plus','plus',250000,'ACTIVE',?,0,?,?,?)",
    )
    .bind(tenantId, randomUUID(), activeUntil, stamp, stamp)
    .run();
  await call("settings", {
    user: owner,
    body: {
      tenant_id: tenantId,
      name: "Kritik Sağlamlık",
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
    user: owner,
    body: { tenant_id: tenantId, name: "Saç kesimi", duration: 30, price: 60000 },
  });
  await call("staff", {
    user: owner,
    body: { tenant_id: tenantId, name: "Uzman Bir", title: "Uzman", hours },
  });
  let workspace = (await call("workspace?tenant=" + tenantId, { user: owner })).data;
  const service = workspace.services.find((row) => row.name === "Saç kesimi"),
    firstStaff = workspace.staff.find((row) => row.name === "Uzman Bir"),
    primaryBranch = workspace.branches[0],
    secondBranchId = randomUUID();
  check(!!service && !!firstStaff && !!primaryBranch, "Base business fixture is ready");

  await db
    .prepare(
      "INSERT INTO branches(id,tenant_id,name,city,address,phone,active,is_primary,created_at) VALUES(?,?,?,'İstanbul','Test 2','',1,0,?)",
    )
    .bind(secondBranchId, tenantId, "İkinci Şube", stamp)
    .run();
  await call("staff", {
    user: owner,
    body: { tenant_id: tenantId, name: "Uzman İki", title: "Uzman", hours },
  });
  workspace = (await call("workspace?tenant=" + tenantId, { user: owner })).data;
  const secondStaff = workspace.staff.find((row) => row.name === "Uzman İki");
  await db
    .prepare("UPDATE staff SET branch_id=? WHERE tenant_id=? AND id=?")
    .bind(secondBranchId, tenantId, secondStaff.id)
    .run();

  const bookingDate = day(5);
  const source = await call("bookings", {
    body: {
      slug: "kritik-saglamlik",
      service_id: service.id,
      staff_id: firstStaff.id,
      date: bookingDate,
      minute: 600,
      name: "Taşınacak Müşteri",
      phone: "05551000001",
      email: "",
      consent: false,
    },
  });
  check(source.status === 201 && !!source.data.id, "Source booking is created");

  const moved = await call("appointment", {
    user: owner,
    body: {
      tenant_id: tenantId,
      id: source.data.id,
      action: "reschedule",
      date: bookingDate,
      minute: 660,
      staff_id: secondStaff.id,
    },
  });
  const movedRow = await db
    .prepare("SELECT branch_id,staff_id,date,minute,status FROM appointments WHERE tenant_id=? AND id=?")
    .bind(tenantId, source.data.id)
    .first();
  const movedSlots = await db
    .prepare("SELECT DISTINCT staff_id FROM slots WHERE tenant_id=? AND appointment_id=?")
    .bind(tenantId, source.data.id)
    .all();
  check(
    moved.status === 200 &&
      movedRow?.branch_id === secondBranchId &&
      movedRow?.staff_id === secondStaff.id &&
      movedRow?.minute === 660 &&
      movedSlots.results.length === 1 &&
      movedSlots.results[0].staff_id === secondStaff.id,
    "Reschedule keeps appointment branch, staff and slot ownership consistent",
  );

  const anyWait = {
    slug: "kritik-saglamlik",
    service_id: service.id,
    staff_id: "any",
    date: bookingDate,
    minute_from: 630,
    minute_to: 750,
    name: "Fark Etmez Müşteri",
    phone: "05551000002",
    email: "any@example.test",
    consent: true,
  };
  check(
    (await call("waitlist", { body: anyWait })).status === 201,
    "Any-staff waitlist request is created",
  );
  check(
    (
      await call("appointment", {
        user: owner,
        body: { tenant_id: tenantId, id: source.data.id, status: "cancelled" },
      })
    ).status === 200,
    "Cancellation creates a released-slot recovery record",
  );
  const recoverySlot = await db
      .prepare("SELECT * FROM recovery_slots WHERE tenant_id=? AND source_appointment_id=?")
      .bind(tenantId, source.data.id)
      .first(),
    waitEntry = await db
      .prepare("SELECT * FROM waitlist_entries WHERE tenant_id=? AND phone='+905551000002'")
      .bind(tenantId)
      .first(),
    recoveryToken = "b".repeat(64),
    offerId = randomUUID();
  await db
    .prepare(
      "INSERT INTO recovery_offers(id,tenant_id,recovery_slot_id,waitlist_id,token_hash,status,expires_at,created_at) VALUES(?,?,?,?,?,'offered',?,?)",
    )
    .bind(
      offerId,
      tenantId,
      recoverySlot.id,
      waitEntry.id,
      createHash("sha256").update(recoveryToken).digest("hex"),
      new Date(Date.now() + 600000).toISOString(),
      stamp,
    )
    .run();
  await db
    .prepare("UPDATE recovery_slots SET status='offering' WHERE id=?")
    .bind(recoverySlot.id)
    .run();
  const accepted = await call("recovery-offer", { token: recoveryToken, body: {} });
  const recoveredAppointment = await db
    .prepare(
      "SELECT a.branch_id,a.staff_id,a.status FROM appointments a JOIN customers c ON c.tenant_id=a.tenant_id AND c.id=a.customer_id WHERE a.tenant_id=? AND c.phone='+905551000002' ORDER BY a.created_at DESC LIMIT 1",
    )
    .bind(tenantId)
    .first();
  check(
    accepted.status === 201 &&
      recoveredAppointment?.status === "confirmed" &&
      recoveredAppointment?.staff_id === secondStaff.id &&
      recoveredAppointment?.branch_id === secondBranchId,
    "Any-staff recovery acceptance uses the concrete staff and branch from the released slot",
  );

  const linkedWait = {
    ...anyWait,
    date: day(6),
    minute_from: 600,
    minute_to: 720,
    phone: "05551000003",
    name: "Hesaba Bağlı Müşteri",
  };
  const linked = await call("waitlist", { body: linkedWait });
  await db
    .prepare("UPDATE waitlist_entries SET account_user_id='linked-user' WHERE id=?")
    .bind(linked.data.id)
    .run();
  const unauthorizedUpdate = await call("waitlist", {
    body: { ...linkedWait, minute_from: 645 },
  });
  const linkedAfter = await db
    .prepare("SELECT minute_from,account_user_id FROM waitlist_entries WHERE id=?")
    .bind(linked.data.id)
    .first();
  check(
    unauthorizedUpdate.status === 409 &&
      linkedAfter?.minute_from === 600 &&
      linkedAfter?.account_user_id === "linked-user",
    "Unauthenticated caller cannot overwrite an account-owned waitlist request",
  );

  const conflictPhone = "+905551000004";
  const conflictImport = await call("setup-import", {
    user: owner,
    body: {
      tenant_id: tenantId,
      batch_id: randomUUID(),
      kind: "appointments",
      rows: [
        {
          name: "Çakışan Aktarım",
          phone: conflictPhone,
          email: "",
          consent: false,
          service_name: "Sadece Çakışmada Oluşacak Hizmet",
          staff_name: "Uzman İki",
          date: bookingDate,
          minute: 660,
          duration: 30,
          price: 30000,
          status: "confirmed",
          note: "Bu satır reddedilmeli",
        },
      ],
    },
  });
  const conflictCustomer = await db
      .prepare("SELECT id FROM customers WHERE tenant_id=? AND phone=?")
      .bind(tenantId, conflictPhone)
      .first(),
    conflictService = await db
      .prepare("SELECT id FROM services WHERE tenant_id=? AND name='Sadece Çakışmada Oluşacak Hizmet'")
      .bind(tenantId)
      .first(),
    conflictAppointment = await db
      .prepare(
        "SELECT a.id FROM appointments a JOIN customers c ON c.tenant_id=a.tenant_id AND c.id=a.customer_id WHERE a.tenant_id=? AND c.phone=?",
      )
      .bind(tenantId, conflictPhone)
      .first();
  check(
    conflictImport.status === 200 &&
      conflictImport.data.imported === 0 &&
      conflictImport.data.skipped === 1 &&
      !conflictCustomer &&
      !conflictService &&
      !conflictAppointment,
    "Conflict-rejected Excel appointment leaves no customer, service or appointment side effects",
  );

  const employeeBooking = await call("bookings", {
    body: {
      slug: "kritik-saglamlik",
      service_id: service.id,
      staff_id: firstStaff.id,
      date: day(7),
      minute: 720,
      name: "Çalışan Erişim Testi",
      phone: "05551000005",
      email: "",
      consent: false,
    },
  });
  await db
    .prepare(
      "INSERT INTO members(tenant_id,user_id,email,name,role,staff_id,disabled) VALUES(?,?,?,?,'staff',?,0)",
    )
    .bind(
      tenantId,
      "employee-critical",
      "employee-critical@example.test",
      "Çalışan",
      firstStaff.id,
    )
    .run();
  const activeAccess = await call(
    "team-jobs?tenant=" + tenantId + "&date=" + day(7),
    { user: "employee-critical" },
  );
  check(
    activeAccess.status === 200 && activeAccess.data.business?.id === tenantId,
    "Employee assignment is visible while subscription is active",
  );
  await db
    .prepare("UPDATE recurring_subscriptions SET paid_until=? WHERE tenant_id=?")
    .bind(new Date(Date.now() - 86400000).toISOString(), tenantId)
    .run();
  const expiredWrite = await call("team-jobs", {
    user: "employee-critical",
    body: {
      tenant_id: tenantId,
      id: employeeBooking.data.id,
      status: "completed",
    },
  });
  const employeeAppointmentAfter = await db
    .prepare("SELECT status FROM appointments WHERE tenant_id=? AND id=?")
    .bind(tenantId, employeeBooking.data.id)
    .first();
  const expiredRead = await call(
    "team-jobs?tenant=" + tenantId + "&date=" + day(7),
    { user: "employee-critical" },
  );
  check(
    expiredWrite.status === 403 &&
      employeeAppointmentAfter?.status === "confirmed" &&
      expiredRead.status === 200 &&
      expiredRead.data.businesses?.length === 0,
    "Expired tenant blocks employee writes and removes staff workspace access without mutating data",
  );

  check(
    (await db.prepare("PRAGMA foreign_key_check").all()).results.length === 0,
    "Critical fixes preserve foreign-key integrity",
  );
  console.log(JSON.stringify({ passed: checks, failed: 0 }));
} finally {
  await mf.dispose();
}
