import Database from "better-sqlite3";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";

if (process.env.ALLOW_LOAD_TEST !== "1" || process.env.LOAD_TEST_ISOLATED_DB !== "1") {
  console.error("LOADTEST_REFUSED: ağır test yalnızca ALLOW_LOAD_TEST=1 ve LOAD_TEST_ISOLATED_DB=1 ile çalışır.");
  process.exit(2);
}

const users = Math.max(2, Math.min(250, Number(process.env.LOAD_TEST_USERS || 250)));
const dbPath = process.env.DATABASE_PATH;
const publicOrigin = String(process.env.PUBLIC_APP_URL || "https://netarandevu.com").replace(/\/$/, "");
const targetOrigin = String(process.env.LOAD_TEST_TARGET_ORIGIN || "").replace(/\/$/, "");
if (!dbPath || !dbPath.startsWith("/")) throw new Error("DATABASE_PATH mutlak yol olmalı.");
if (publicOrigin !== "https://netarandevu.com") throw new Error("PUBLIC_APP_URL production origin olmalı.");
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(targetOrigin)) throw new Error("LOAD_TEST_TARGET_ORIGIN yalnızca yerel izole sunucu olabilir.");
if (targetOrigin === "http://127.0.0.1:3000") throw new Error("Production upstream üzerinde ağır test yasak.");

const runId = `${Date.now()}-${randomBytes(4).toString("hex")}`;
const tenantId = `loadtest-${runId}`;
const branchId = `branch-${tenantId}`;
const serviceId = `service-${tenantId}`;
const slug = `loadtest-${runId}`.slice(0, 58);
const stamp = new Date().toISOString();
const expiresAt = Date.now() + 30 * 60 * 1000;
const hoursObject = Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((d) => [d, [480, 1320]]));
const hours = JSON.stringify(hoursObject);
const testDate = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
const staffCount = Math.min(25, users);
const staffIds = Array.from({ length: staffCount }, (_, i) => `staff-${tenantId}-${i}`);
const db = new Database(dbPath);
db.pragma("foreign_keys = ON");
db.pragma("busy_timeout = 10000");

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const sessions = [];

function clientIp(i) {
  const n = i + 1;
  return `198.18.${Math.floor((n - 1) / 254)}.${((n - 1) % 254) + 1}`;
}
function quantile(values, q) {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  return Math.round(s[Math.min(s.length - 1, Math.max(0, Math.ceil(q * s.length) - 1))] * 10) / 10;
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
    statuses: Object.fromEntries([...new Set(results.map((r) => String(r.status)))].map((s) => [s, results.filter((r) => String(r.status) === s).length])),
    sample_errors: failed.slice(0, 5).map((r) => r.error || `HTTP ${r.status}`),
  };
}
function expectedConflictStats(results, successStatus) {
  return {
    ...phaseStats(results),
    accepted: results.filter((r) => r.status === successStatus).length,
    conflicts: results.filter((r) => r.status === 409).length,
    unexpected: results.filter((r) => r.status !== successStatus && r.status !== 409).length,
  };
}
function syntheticFailure(error) {
  return { ok: false, status: "not-run", ms: 0, data: null, error };
}

async function request(session, path, body) {
  const started = performance.now();
  try {
    const response = await fetch(targetOrigin + path, {
      method: body ? "POST" : "GET",
      headers: {
        Accept: "application/json",
        Host: "netarandevu.com",
        Cookie: `__Host-neta-session=${session.token}`,
        "CF-Connecting-IP": session.ip,
        ...(body ? { "Content-Type": "application/json", Origin: publicOrigin, "Sec-Fetch-Site": "same-origin" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      redirect: "manual",
      signal: AbortSignal.timeout(30000),
    });
    const text = await response.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch {}
    return {
      ok: response.ok,
      status: response.status,
      ms: performance.now() - started,
      data,
      error: response.ok ? "" : data?.error || text.slice(0, 180) || `HTTP ${response.status}`,
    };
  } catch (error) {
    return { ok: false, status: "network", ms: performance.now() - started, data: null, error: error instanceof Error ? error.message : String(error) };
  }
}

function seed() {
  const insertBusiness = db.prepare("INSERT INTO businesses(id,name,slug,invite_code,category,city,address,phone,description,status,demo,hours,selected_plan,terminology,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)");
  const insertBranch = db.prepare("INSERT INTO branches(id,tenant_id,name,city,address,phone,active,is_primary,created_at) VALUES(?,?,?,?,?,?,1,1,?)");
  const insertService = db.prepare("INSERT INTO services(id,tenant_id,name,duration,price,color,active) VALUES(?,?,?,?,?,?,1)");
  const insertStaff = db.prepare("INSERT INTO staff(id,tenant_id,branch_id,name,title,hours,color,active) VALUES(?,?,?,?,?,?,?,1)");
  const insertMember = db.prepare("INSERT INTO members(tenant_id,user_id,email,name,role,disabled) VALUES(?,?,?,?, 'owner',0)");
  const insertSession = db.prepare("INSERT INTO auth_sessions(token_hash,user_id,email,full_name,created_at,expires_at) VALUES(?,?,?,?,?,?)");
  db.transaction(() => {
    insertBusiness.run(tenantId, `Neta ${users} Kullanıcı Ağır Testi`, slug, `LT${randomBytes(8).toString("hex")}`, "Kuaför & Berber", "Antalya", "İzole DB yük testi", "", "Geçici yük testi", "approved", 1, hours, "plus", "Hizmet", stamp);
    insertBranch.run(branchId, tenantId, "Test Şubesi", "Antalya", "", "", stamp);
    insertService.run(serviceId, tenantId, "Yük Testi Hizmeti", 15, 100000, "#789c74");
    for (let i = 0; i < staffCount; i++) insertStaff.run(staffIds[i], tenantId, branchId, `Test Uzmanı ${i + 1}`, "Uzman", hours, "#e1eccd");
    for (let i = 0; i < users; i++) {
      const userId = `loadtest:${runId}:${i}`;
      const email = `loadtest-${runId}-${i}@example.invalid`;
      const token = randomBytes(32).toString("hex");
      insertMember.run(tenantId, userId, email, `Test Kullanıcı ${i + 1}`);
      insertSession.run(sha256(token), userId, email, `Test Kullanıcı ${i + 1}`, Date.now(), expiresAt);
      sessions.push({ userId, token, ip: clientIp(i) });
    }
  })();
}

async function main() {
  seed();
  console.log(`LOADTEST_START users=${users} tenant=${tenantId} target=${targetOrigin} isolated_db=1`);

  const warm = await request(sessions[0], `/api/v1/workspace?tenant=${encodeURIComponent(tenantId)}`);
  if (!warm.ok || warm.data?.business?.id !== tenantId) throw new Error(`Warmup başarısız: ${warm.error || warm.status}`);

  const workspaceReads = await Promise.all(sessions.map((s) => request(s, `/api/v1/workspace?tenant=${encodeURIComponent(tenantId)}`)));

  const phones = sessions.map((_, i) => `+90557${String(i).padStart(7, "0")}`);
  const bookingResults = await Promise.all(sessions.map((s, i) => request(s, "/api/v1/bookings", {
    tenant_id: tenantId,
    service_id: serviceId,
    staff_id: staffIds[i % staffCount],
    date: testDate,
    minute: 600 + Math.floor(i / staffCount) * 15,
    name: `Yük Müşterisi ${i + 1}`,
    phone: phones[i],
    email: "",
    consent: false,
  })));
  const appointmentIds = bookingResults.map((r) => r.data?.id || "");
  const dbBookedCount = Number(db.prepare("SELECT COUNT(*) n FROM appointments WHERE tenant_id=? AND status='confirmed'").get(tenantId).n);

  const bookingVisibility = await Promise.all(sessions.map(async (s) => {
    const r = await request(s, `/api/v1/workspace?tenant=${encodeURIComponent(tenantId)}`);
    if (!r.ok) return r;
    const seen = new Set((r.data?.appointments || []).map((a) => a.id));
    const missing = appointmentIds.filter(Boolean).filter((id) => !seen.has(id));
    return missing.length || appointmentIds.filter(Boolean).length !== users ? { ...r, ok: false, error: `${missing.length || users - appointmentIds.filter(Boolean).length} randevu görünmedi` } : r;
  }));

  const cancellationResults = await Promise.all(sessions.map((s, i) => appointmentIds[i]
    ? request(s, "/api/v1/appointment", { tenant_id: tenantId, id: appointmentIds[i], status: "cancelled" })
    : syntheticFailure("Randevu oluşmadı")));
  const dbCancelledCount = Number(db.prepare("SELECT COUNT(*) n FROM appointments WHERE tenant_id=? AND status='cancelled'").get(tenantId).n);
  const dbSlotCountAfterCancellation = Number(db.prepare("SELECT COUNT(*) n FROM slots WHERE tenant_id=?").get(tenantId).n);

  const collisionPhones = sessions.map((_, i) => `+90556${String(i).padStart(7, "0")}`);
  const bookingCollisionResults = await Promise.all(sessions.map((s, i) => request(s, "/api/v1/bookings", {
    tenant_id: tenantId,
    service_id: serviceId,
    staff_id: staffIds[0],
    date: testDate,
    minute: 900,
    name: `Slot Çakışma ${i + 1}`,
    phone: collisionPhones[i],
    email: "",
    consent: false,
  })));
  const bookingCollisionAccepted = bookingCollisionResults.filter((r) => r.status === 201);
  const bookingCollisionRowCount = Number(db.prepare("SELECT COUNT(*) n FROM appointments WHERE tenant_id=? AND staff_id=? AND date=? AND minute=? AND status='confirmed'").get(tenantId, staffIds[0], testDate, 900).n);
  if (bookingCollisionAccepted[0]?.data?.id) await request(sessions[0], "/api/v1/appointment", { tenant_id: tenantId, id: bookingCollisionAccepted[0].data.id, status: "cancelled" });

  const customerByPhone = new Map(db.prepare("SELECT id,phone FROM customers WHERE tenant_id=?").all(tenantId).map((r) => [String(r.phone), String(r.id)]));
  const receivableCreateResults = await Promise.all(sessions.map((s, i) => {
    const customerId = customerByPhone.get(phones[i]);
    if (!customerId) return syntheticFailure("Randevu müşterisi bulunamadı");
    return request(s, "/api/v1/receivables", {
      tenant_id: tenantId,
      customer_id: customerId,
      appointment_id: null,
      title: `Yük Testi Borcu ${i + 1}`,
      amount: 100000,
      due_date: null,
      note: "250 kullanıcı eşzamanlılık testi",
      idempotency_key: randomUUID(),
    });
  }));
  const receivableIds = receivableCreateResults.map((r) => r.data?.id || "");

  const collectionResults = await Promise.all(sessions.map((s, i) => receivableIds[i]
    ? request(s, "/api/v1/collections", { tenant_id: tenantId, receivable_id: receivableIds[i], amount: 100000, method: "cash", note: "Eşzamanlı tahsilat testi", idempotency_key: randomUUID() })
    : syntheticFailure("Borç oluşmadı")));

  const firstCustomerId = customerByPhone.get(phones[0]);
  const debtCollisionCreate = firstCustomerId
    ? await request(sessions[0], "/api/v1/receivables", { tenant_id: tenantId, customer_id: firstCustomerId, appointment_id: null, title: "Tek Borca 250 Tahsilat Çakışması", amount: 100000, due_date: null, note: "Aynı borcun iki kez tahsil edilmemesi", idempotency_key: randomUUID() })
    : syntheticFailure("Çakışma müşterisi bulunamadı");
  const debtCollisionId = debtCollisionCreate.data?.id || "";
  const debtCollisionResults = debtCollisionId
    ? await Promise.all(sessions.map((s) => request(s, "/api/v1/collections", { tenant_id: tenantId, receivable_id: debtCollisionId, amount: 100000, method: "cash", note: "Aynı borca eşzamanlı tahsilat", idempotency_key: randomUUID() })))
    : sessions.map(() => syntheticFailure("Çakışma borcu oluşmadı"));

  const debtCollisionAccepted = debtCollisionResults.filter((r) => r.status === 200).length;
  const debtCollisionConflicts = debtCollisionResults.filter((r) => r.status === 409).length;
  const debtCollisionRow = debtCollisionId ? db.prepare("SELECT remaining FROM receivables WHERE tenant_id=? AND id=?").get(tenantId, debtCollisionId) : null;
  const debtCollisionPaymentCount = debtCollisionId ? Number(db.prepare("SELECT COUNT(*) n FROM receivable_payments WHERE tenant_id=? AND receivable_id=? AND status='recorded'").get(tenantId, debtCollisionId).n) : 0;
  const dbUniqueReceivablesPaid = Number(db.prepare("SELECT COUNT(*) n FROM receivables WHERE tenant_id=? AND id!=? AND remaining=0").get(tenantId, debtCollisionId || "-").n);
  const dbNegativeReceivables = Number(db.prepare("SELECT COUNT(*) n FROM receivables WHERE tenant_id=? AND remaining<0").get(tenantId).n);

  const receivableVisibility = await Promise.all(sessions.map(async (s) => {
    const r = await request(s, `/api/v1/receivables?tenant=${encodeURIComponent(tenantId)}`);
    if (!r.ok) return r;
    const debtMap = new Map((r.data?.debts || []).map((row) => [row.id, row]));
    const expected = [...receivableIds.filter(Boolean), ...(debtCollisionId ? [debtCollisionId] : [])];
    const missing = expected.filter((id) => !debtMap.has(id));
    const open = expected.filter((id) => Number(debtMap.get(id)?.remaining ?? 1) !== 0);
    return missing.length || open.length || expected.length !== users + 1 ? { ...r, ok: false, error: `borç görünürlüğü hatalı: missing=${missing.length}, remaining=${open.length}, expected=${expected.length}` } : r;
  }));

  const result = {
    users,
    simulated_distinct_clients: users,
    isolated_database_copy: true,
    transport: "isolated_local_node",
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
    db_unique_receivables_paid: dbUniqueReceivablesPaid,
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
    dbUniqueReceivablesPaid === users &&
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
  db.close();
  console.log("LOADTEST_ISOLATED_DB_DISCARDED_BY_RUNNER");
}
