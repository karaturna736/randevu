import Database from "better-sqlite3";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";

if (process.env.ALLOW_LOAD_TEST !== "1") {
  console.error("LOADTEST_REFUSED: ALLOW_LOAD_TEST=1 gerekli.");
  process.exit(2);
}

const users = Math.max(2, Math.min(250, Number(process.env.LOAD_TEST_USERS || 250)));
const dbPath = process.env.DATABASE_PATH;
const publicOrigin = String(process.env.PUBLIC_APP_URL || "https://netarandevu.com").replace(/\/$/, "");
const targetOrigin = "http://127.0.0.1:3000";
if (!dbPath || !dbPath.startsWith("/")) {
  console.error("LOADTEST_REFUSED: DATABASE_PATH mutlak yol olmalı.");
  process.exit(2);
}
if (publicOrigin !== "https://netarandevu.com") {
  console.error("LOADTEST_REFUSED: yalnızca doğrulanmış Neta production origin üzerinde çalışır.");
  process.exit(2);
}

const runId = `${Date.now()}-${randomBytes(4).toString("hex")}`;
const tenantId = `loadtest-${runId}`;
const branchId = `branch-${tenantId}`;
const serviceId = `service-${tenantId}`;
const slug = `loadtest-${runId}`.slice(0, 58);
const stamp = new Date().toISOString();
const expiresAt = Date.now() + 30 * 60 * 1000;
const hoursObject = Object.fromEntries(
  [0, 1, 2, 3, 4, 5, 6].map((day) => [day, [480, 1320]]),
);
const hours = JSON.stringify(hoursObject);
const testDate = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
const staffCount = Math.min(25, users);
const staffIds = Array.from({ length: staffCount }, (_, i) => `staff-${tenantId}-${i}`);
const db = new Database(dbPath);
db.pragma("foreign_keys = ON");
db.pragma("busy_timeout = 10000");

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const sessions = [];
let setupComplete = false;

function clientIp(index) {
  const n = index + 1;
  return `198.18.${Math.floor((n - 1) / 254)}.${((n - 1) % 254) + 1}`;
}

function quantile(values, q) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil(q * sorted.length) - 1));
  return Math.round(sorted[idx] * 10) / 10;
}

function phaseStats(results) {
  const times = results.map((r) => r.ms || 0);
  const failed = results.filter((r) => !r.ok);
  return {
    requests: results.length,
    ok: results.length - failed.length,
    failed: failed.length,
    p50_ms: quantile(times, 0.5),
    p95_ms: quantile(times, 0.95),
    p99_ms: quantile(times, 0.99),
    max_ms: Math.round(Math.max(...times, 0) * 10) / 10,
    statuses: Object.fromEntries(
      [...new Set(results.map((r) => String(r.status)))].map((status) => [
        status,
        results.filter((r) => String(r.status) === status).length,
      ]),
    ),
    sample_errors: failed.slice(0, 5).map((r) => r.error || `HTTP ${r.status}`),
  };
}

function syntheticFailure(message) {
  return { ok: false, status: "not-run", ms: 0, data: null, error: message };
}

function expectedConflictStats(results, successStatus = 201) {
  return {
    ...phaseStats(results),
    accepted: results.filter((r) => r.status === successStatus).length,
    conflicts: results.filter((r) => r.status === 409).length,
    unexpected: results.filter((r) => r.status !== successStatus && r.status !== 409).length,
  };
}

async function request(session, path, options = {}) {
  const started = performance.now();
  try {
    const headers = {
      Accept: "application/json",
      Host: "netarandevu.com",
      Cookie: `__Host-neta-session=${session.token}`,
      "CF-Connecting-IP": session.ip,
      ...(options.body
        ? {
            "Content-Type": "application/json",
            Origin: publicOrigin,
            "Sec-Fetch-Site": "same-origin",
          }
        : {}),
      ...(options.headers || {}),
    };
    const response = await fetch(targetOrigin + path, {
      method: options.method || (options.body ? "POST" : "GET"),
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      redirect: "manual",
      signal: AbortSignal.timeout(30000),
    });
    const text = await response.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }
    return {
      ok: response.ok,
      status: response.status,
      ms: performance.now() - started,
      data,
      error: response.ok ? "" : data?.error || text.slice(0, 180) || `HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      ok: false,
      status: "network",
      ms: performance.now() - started,
      data: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function setup() {
  const insertBusiness = db.prepare(
    "INSERT INTO businesses(id,name,slug,invite_code,category,city,address,phone,description,status,demo,hours,selected_plan,terminology,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
  );
  const insertBranch = db.prepare(
    "INSERT INTO branches(id,tenant_id,name,city,address,phone,active,is_primary,created_at) VALUES(?,?,?,?,?,?,1,1,?)",
  );
  const insertService = db.prepare(
    "INSERT INTO services(id,tenant_id,name,duration,price,color,active) VALUES(?,?,?,?,?,?,1)",
  );
  const insertStaff = db.prepare(
    "INSERT INTO staff(id,tenant_id,branch_id,name,title,hours,color,active) VALUES(?,?,?,?,?,?,?,1)",
  );
  const insertMember = db.prepare(
    "INSERT INTO members(tenant_id,user_id,email,name,role,disabled) VALUES(?,?,?,?, 'owner',0)",
  );
  const insertSession = db.prepare(
    "INSERT INTO auth_sessions(token_hash,user_id,email,full_name,created_at,expires_at) VALUES(?,?,?,?,?,?)",
  );
  const tx = db.transaction(() => {
    insertBusiness.run(
      tenantId,
      `Neta ${users} Kullanıcı Ağır Testi`,
      slug,
      `LT${randomBytes(8).toString("hex")}`,
      "Kuaför & Berber",
      "Antalya",
      "İzole yük testi",
      "",
      "Otomatik oluşturulan geçici eşzamanlılık testi",
      "approved",
      1,
      hours,
      "plus",
      "Hizmet",
      stamp,
    );
    insertBranch.run(branchId, tenantId, "Test Şubesi", "Antalya", "", "", stamp);
    insertService.run(serviceId, tenantId, "Yük Testi Hizmeti", 15, 100000, "#789c74");
    for (let i = 0; i < staffCount; i++)
      insertStaff.run(
        staffIds[i],
        tenantId,
        branchId,
        `Test Uzmanı ${i + 1}`,
        "Uzman",
        hours,
        "#e1eccd",
      );
    for (let i = 0; i < users; i++) {
      const userId = `loadtest:${runId}:${i}`;
      const email = `loadtest-${runId}-${i}@example.invalid`;
      const token = randomBytes(32).toString("hex");
      insertMember.run(tenantId, userId, email, `Test Kullanıcı ${i + 1}`);
      insertSession.run(sha256(token), userId, email, `Test Kullanıcı ${i + 1}`, Date.now(), expiresAt);
      sessions.push({ userId, token, ip: clientIp(i), index: i });
    }
  });
  tx();
  setupComplete = true;
}

function cleanup() {
  if (!setupComplete) return;

  db.prepare("DELETE FROM auth_sessions WHERE user_id LIKE ?").run(`loadtest:${runId}:%`);
  db.prepare("DELETE FROM audit WHERE user_id LIKE ?").run(`loadtest:${runId}:%`);

  const tenantTables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
    .all()
    .map((row) => String(row.name))
    .filter((table) => /^[A-Za-z0-9_]+$/.test(table))
    .filter((table) =>
      db.prepare(`PRAGMA table_info(\"${table}\")`).all().some((column) => column.name === "tenant_id"),
    );

  let pending = tenantTables;
  for (let pass = 0; pass < 12 && pending.length; pass++) {
    const next = [];
    for (const table of pending) {
      try {
        db.prepare(`DELETE FROM \"${table}\" WHERE tenant_id=?`).run(tenantId);
      } catch {
        next.push(table);
      }
    }
    if (next.length === pending.length) break;
    pending = next;
  }
  if (pending.length)
    console.error("LOADTEST_CLEANUP_PENDING", pending.join(","));

  db.prepare("DELETE FROM businesses WHERE id=?").run(tenantId);

  const bucket = Math.floor(Date.now() / 600000);
  const deleteRate = db.prepare("DELETE FROM rate_limits WHERE key=?");
  for (const session of sessions)
    for (const b of [bucket - 1, bucket, bucket + 1])
      deleteRate.run(sha256(`booking:${session.ip}:${b}`));

  setupComplete = false;
}

async function main() {
  setup();
  console.log(`LOADTEST_START users=${users} tenant=${tenantId} target=${targetOrigin}`);
  console.log(
    `LOADTEST_NOTE ${users} ayrı oturum ve ${users} ayrı istemci IP'si simüle ediliyor; ödeme gerçek sağlayıcıya gitmeden yalnızca izole demo tenant kullanılıyor.`,
  );

  const warm = await request(sessions[0], `/api/v1/workspace?tenant=${encodeURIComponent(tenantId)}`);
  if (!warm.ok || warm.data?.business?.id !== tenantId) {
    throw new Error(`Warmup başarısız: ${warm.error || warm.status}`);
  }

  const workspaceReads = await Promise.all(
    sessions.map((session) => request(session, `/api/v1/workspace?tenant=${encodeURIComponent(tenantId)}`)),
  );

  const phones = sessions.map((_, i) => `+90557${String(i).padStart(7, "0")}`);
  const bookingResults = await Promise.all(
    sessions.map((session, i) => {
      const slotIndex = Math.floor(i / staffCount);
      return request(session, "/api/v1/bookings", {
        body: {
          tenant_id: tenantId,
          service_id: serviceId,
          staff_id: staffIds[i % staffCount],
          date: testDate,
          minute: 600 + slotIndex * 15,
          name: `Yük Müşterisi ${i + 1}`,
          phone: phones[i],
          email: "",
          consent: false,
        },
      });
    }),
  );
  const appointmentIds = bookingResults.map((r) => r.data?.id || "");
  const dbBookedCount = db
    .prepare("SELECT COUNT(*) n FROM appointments WHERE tenant_id=? AND status='confirmed'")
    .get(tenantId).n;

  const bookingVisibility = await Promise.all(
    sessions.map(async (session) => {
      const result = await request(session, `/api/v1/workspace?tenant=${encodeURIComponent(tenantId)}`);
      if (!result.ok) return result;
      const seen = new Set((result.data?.appointments || []).map((a) => a.id));
      const missing = appointmentIds.filter(Boolean).filter((id) => !seen.has(id));
      if (missing.length || appointmentIds.filter(Boolean).length !== users) {
        return {
          ...result,
          ok: false,
          error: `${missing.length || users - appointmentIds.filter(Boolean).length} randevu bu oturumda görünmedi`,
        };
      }
      return result;
    }),
  );

  const cancellationResults = await Promise.all(
    sessions.map((session, i) =>
      appointmentIds[i]
        ? request(session, "/api/v1/appointment", {
            body: { tenant_id: tenantId, id: appointmentIds[i], status: "cancelled" },
          })
        : syntheticFailure("Randevu oluşturulamadığı için iptal çalıştırılmadı"),
    ),
  );
  const dbCancelledCount = db
    .prepare("SELECT COUNT(*) n FROM appointments WHERE tenant_id=? AND status='cancelled'")
    .get(tenantId).n;
  const dbSlotCountAfterCancellation = db
    .prepare("SELECT COUNT(*) n FROM slots WHERE tenant_id=?")
    .get(tenantId).n;

  const collisionPhones = sessions.map((_, i) => `+90556${String(i).padStart(7, "0")}`);
  const bookingCollisionResults = await Promise.all(
    sessions.map((session, i) =>
      request(session, "/api/v1/bookings", {
        body: {
          tenant_id: tenantId,
          service_id: serviceId,
          staff_id: staffIds[0],
          date: testDate,
          minute: 900,
          name: `Slot Çakışma ${i + 1}`,
          phone: collisionPhones[i],
          email: "",
          consent: false,
        },
      }),
    ),
  );
  const bookingCollisionAccepted = bookingCollisionResults.filter((r) => r.status === 201);
  const bookingCollisionRowCount = db
    .prepare(
      "SELECT COUNT(*) n FROM appointments WHERE tenant_id=? AND staff_id=? AND date=? AND minute=? AND status='confirmed'",
    )
    .get(tenantId, staffIds[0], testDate, 900).n;
  if (bookingCollisionAccepted[0]?.data?.id)
    await request(sessions[0], "/api/v1/appointment", {
      body: {
        tenant_id: tenantId,
        id: bookingCollisionAccepted[0].data.id,
        status: "cancelled",
      },
    });

  const customers = db
    .prepare("SELECT id,phone FROM customers WHERE tenant_id=?")
    .all(tenantId);
  const customerByPhone = new Map(customers.map((row) => [String(row.phone), String(row.id)]));

  const receivableCreateResults = await Promise.all(
    sessions.map((session, i) => {
      const customerId = customerByPhone.get(phones[i]);
      if (!customerId) return syntheticFailure("Randevu müşterisi bulunamadı");
      return request(session, "/api/v1/receivables", {
        body: {
          tenant_id: tenantId,
          customer_id: customerId,
          appointment_id: appointmentIds[i] || null,
          title: `Yük Testi Borcu ${i + 1}`,
          amount: 100000,
          due_date: null,
          note: "250 kullanıcı eşzamanlılık testi",
          idempotency_key: randomUUID(),
        },
      });
    }),
  );
  const receivableIds = receivableCreateResults.map((r) => r.data?.id || "");

  const collectionResults = await Promise.all(
    sessions.map((session, i) =>
      receivableIds[i]
        ? request(session, "/api/v1/collections", {
            body: {
              tenant_id: tenantId,
              receivable_id: receivableIds[i],
              amount: 100000,
              method: "cash",
              note: "Eşzamanlı tahsilat testi",
              idempotency_key: randomUUID(),
            },
          })
        : syntheticFailure("Borç kaydı oluşmadığı için tahsilat çalıştırılmadı"),
    ),
  );

  const firstCustomerId = customerByPhone.get(phones[0]);
  let debtCollisionCreate = syntheticFailure("Çakışma borcu için müşteri bulunamadı");
  if (firstCustomerId)
    debtCollisionCreate = await request(sessions[0], "/api/v1/receivables", {
      body: {
        tenant_id: tenantId,
        customer_id: firstCustomerId,
        appointment_id: null,
        title: "Tek Borca 250 Tahsilat Çakışması",
        amount: 100000,
        due_date: null,
        note: "Aynı kalan tutarın iki kez tahsil edilmemesi testi",
        idempotency_key: randomUUID(),
      },
    });
  const debtCollisionId = debtCollisionCreate.data?.id || "";
  const debtCollisionResults = debtCollisionId
    ? await Promise.all(
        sessions.map((session) =>
          request(session, "/api/v1/collections", {
            body: {
              tenant_id: tenantId,
              receivable_id: debtCollisionId,
              amount: 100000,
              method: "cash",
              note: "Aynı borca eşzamanlı tahsilat",
              idempotency_key: randomUUID(),
            },
          }),
        ),
      )
    : sessions.map(() => syntheticFailure("Çakışma borcu oluşturulamadı"));

  const debtCollisionAccepted = debtCollisionResults.filter((r) => r.status === 200).length;
  const debtCollisionConflicts = debtCollisionResults.filter((r) => r.status === 409).length;
  const debtCollisionRow = debtCollisionId
    ? db.prepare("SELECT remaining,status FROM receivables WHERE tenant_id=? AND id=?").get(tenantId, debtCollisionId)
    : null;
  const debtCollisionPaymentCount = debtCollisionId
    ? db
        .prepare("SELECT COUNT(*) n FROM receivable_payments WHERE tenant_id=? AND receivable_id=? AND status='recorded'")
        .get(tenantId, debtCollisionId).n
    : 0;

  const dbUniqueReceivablesClosed = db
    .prepare(
      "SELECT COUNT(*) n FROM receivables WHERE tenant_id=? AND id!=? AND remaining=0 AND status='closed'",
    )
    .get(tenantId, debtCollisionId || "-").n;
  const dbNegativeReceivables = db
    .prepare("SELECT COUNT(*) n FROM receivables WHERE tenant_id=? AND remaining<0")
    .get(tenantId).n;

  const receivableVisibility = await Promise.all(
    sessions.map(async (session) => {
      const result = await request(session, `/api/v1/receivables?tenant=${encodeURIComponent(tenantId)}`);
      if (!result.ok) return result;
      const debtMap = new Map((result.data?.debts || []).map((row) => [row.id, row]));
      const expected = [...receivableIds.filter(Boolean), ...(debtCollisionId ? [debtCollisionId] : [])];
      const missing = expected.filter((id) => !debtMap.has(id));
      const open = expected.filter((id) => Number(debtMap.get(id)?.remaining ?? 1) !== 0);
      if (missing.length || open.length || expected.length !== users + 1) {
        return {
          ...result,
          ok: false,
          error: `borç görünürlüğü hatalı: missing=${missing.length}, remaining=${open.length}, expected=${expected.length}`,
        };
      }
      return result;
    }),
  );

  const result = {
    users,
    simulated_distinct_clients: users,
    transport: "direct_node_upstream",
    nginx_per_ip_rate_limit_bypassed: true,
    app_rate_limits_exercised_with_distinct_ips: true,
    tenant_isolated: true,
    payment_bypassed_via_demo_tenant: true,
    concurrent_workspace_reads: phaseStats(workspaceReads),
    concurrent_unique_bookings: phaseStats(bookingResults),
    all_sessions_observe_all_bookings: phaseStats(bookingVisibility),
    db_confirmed_booking_count_before_cancel: dbBookedCount,
    concurrent_cancellations: phaseStats(cancellationResults),
    db_cancelled_booking_count: dbCancelledCount,
    db_slot_count_after_cancellation: dbSlotCountAfterCancellation,
    same_slot_booking_collision: expectedConflictStats(bookingCollisionResults, 201),
    same_slot_confirmed_row_count: bookingCollisionRowCount,
    concurrent_receivable_creation: phaseStats(receivableCreateResults),
    concurrent_unique_collections: phaseStats(collectionResults),
    db_unique_receivables_closed: dbUniqueReceivablesClosed,
    same_debt_collection_collision: expectedConflictStats(debtCollisionResults, 200),
    same_debt_accepted: debtCollisionAccepted,
    same_debt_conflicts: debtCollisionConflicts,
    same_debt_remaining: debtCollisionRow?.remaining ?? null,
    same_debt_recorded_payment_count: debtCollisionPaymentCount,
    negative_receivable_count: dbNegativeReceivables,
    all_sessions_observe_all_collections: phaseStats(receivableVisibility),
  };

  const passed =
    result.concurrent_workspace_reads.failed === 0 &&
    result.concurrent_unique_bookings.failed === 0 &&
    result.all_sessions_observe_all_bookings.failed === 0 &&
    dbBookedCount === users &&
    result.concurrent_cancellations.failed === 0 &&
    dbCancelledCount === users &&
    dbSlotCountAfterCancellation === 0 &&
    result.same_slot_booking_collision.accepted === 1 &&
    result.same_slot_booking_collision.conflicts === users - 1 &&
    result.same_slot_booking_collision.unexpected === 0 &&
    bookingCollisionRowCount === 1 &&
    result.concurrent_receivable_creation.failed === 0 &&
    result.concurrent_unique_collections.failed === 0 &&
    dbUniqueReceivablesClosed === users &&
    debtCollisionAccepted === 1 &&
    debtCollisionConflicts === users - 1 &&
    result.same_debt_collection_collision.unexpected === 0 &&
    Number(debtCollisionRow?.remaining) === 0 &&
    debtCollisionPaymentCount === 1 &&
    dbNegativeReceivables === 0 &&
    result.all_sessions_observe_all_collections.failed === 0;

  console.log("LOADTEST_RESULT " + JSON.stringify({ ...result, passed }));
  if (!passed) process.exitCode = 1;
}

try {
  await main();
} catch (error) {
  console.error("LOADTEST_FATAL", error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
} finally {
  try {
    cleanup();
    console.log("LOADTEST_CLEANUP ok");
  } catch (error) {
    console.error("LOADTEST_CLEANUP_FAILED", error instanceof Error ? error.stack || error.message : String(error));
    process.exitCode = 1;
  }
  db.close();
}
