import Database from "better-sqlite3";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";

if (process.env.ALLOW_LOAD_TEST !== "1") {
  console.error("LOADTEST_REFUSED: ALLOW_LOAD_TEST=1 gerekli.");
  process.exit(2);
}

const users = Math.max(2, Math.min(250, Number(process.env.LOAD_TEST_USERS || 100)));
const dbPath = process.env.DATABASE_PATH;
const origin = String(process.env.PUBLIC_APP_URL || "https://netarandevu.com").replace(/\/$/, "");
if (!dbPath || !dbPath.startsWith("/")) {
  console.error("LOADTEST_REFUSED: DATABASE_PATH mutlak yol olmalı.");
  process.exit(2);
}
if (origin !== "https://netarandevu.com") {
  console.error("LOADTEST_REFUSED: yalnızca doğrulanmış Neta production origin üzerinde çalışır.");
  process.exit(2);
}

const runId = `${Date.now()}-${randomBytes(4).toString("hex")}`;
const tenantId = `loadtest-${runId}`;
const branchId = `branch-${tenantId}`;
const slug = `loadtest-${runId}`.slice(0, 58);
const stamp = new Date().toISOString();
const expiresAt = Date.now() + 30 * 60 * 1000;
const hours = JSON.stringify({ 1: [540, 1140], 2: [540, 1140], 3: [540, 1140], 4: [540, 1140], 5: [540, 1140], 6: [600, 1080] });
const db = new Database(dbPath);
db.pragma("foreign_keys = ON");
db.pragma("busy_timeout = 10000");

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const sessions = [];
let setupComplete = false;

function quantile(values, q) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil(q * sorted.length) - 1));
  return Math.round(sorted[idx] * 10) / 10;
}

function phaseStats(results) {
  const times = results.map((r) => r.ms);
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

async function request(session, path, options = {}) {
  const started = performance.now();
  try {
    const headers = {
      Accept: "application/json",
      Cookie: `__Host-neta-session=${session.token}`,
      ...(options.body
        ? {
            "Content-Type": "application/json",
            Origin: origin,
            "Sec-Fetch-Site": "same-origin",
          }
        : {}),
      ...(options.headers || {}),
    };
    const response = await fetch(origin + path, {
      method: options.method || (options.body ? "POST" : "GET"),
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      redirect: "manual",
      signal: AbortSignal.timeout(20000),
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
  const insertMember = db.prepare(
    "INSERT INTO members(tenant_id,user_id,email,name,role,disabled) VALUES(?,?,?,?, 'owner',0)",
  );
  const insertSession = db.prepare(
    "INSERT INTO auth_sessions(token_hash,user_id,email,full_name,created_at,expires_at) VALUES(?,?,?,?,?,?)",
  );
  const tx = db.transaction(() => {
    insertBusiness.run(
      tenantId,
      "Neta 100 Kullanıcı Testi",
      slug,
      `LT${randomBytes(8).toString("hex")}`,
      "Kuaför & Berber",
      "Antalya",
      "İzole yük testi",
      "",
      "Otomatik oluşturulan geçici senkronizasyon testi",
      "approved",
      1,
      hours,
      "normal",
      "Hizmet",
      stamp,
    );
    insertBranch.run(branchId, tenantId, "Test Şubesi", "Antalya", "", "", stamp);
    for (let i = 0; i < users; i++) {
      const userId = `loadtest:${runId}:${i}`;
      const email = `loadtest-${runId}-${i}@example.invalid`;
      const token = randomBytes(32).toString("hex");
      insertMember.run(tenantId, userId, email, `Test Kullanıcı ${i + 1}`);
      insertSession.run(sha256(token), userId, email, `Test Kullanıcı ${i + 1}`, Date.now(), expiresAt);
      sessions.push({ userId, token });
    }
  });
  tx();
  setupComplete = true;
}

function cleanup() {
  if (!setupComplete) return;
  const tx = db.transaction(() => {
    db.prepare("DELETE FROM auth_sessions WHERE user_id LIKE ?").run(`loadtest:${runId}:%`);
    db.prepare("DELETE FROM customers WHERE tenant_id=?").run(tenantId);
    db.prepare("DELETE FROM members WHERE tenant_id=?").run(tenantId);
    db.prepare("DELETE FROM branches WHERE tenant_id=?").run(tenantId);
    db.prepare("DELETE FROM businesses WHERE id=?").run(tenantId);
  });
  tx();
  setupComplete = false;
}

async function main() {
  setup();
  console.log(`LOADTEST_START users=${users} tenant=${tenantId}`);

  const warm = await request(sessions[0], `/api/v1/workspace?tenant=${encodeURIComponent(tenantId)}`);
  if (!warm.ok || warm.data?.business?.id !== tenantId) {
    throw new Error(`Warmup başarısız: ${warm.error || warm.status}`);
  }

  const readResults = await Promise.all(
    sessions.map((session) => request(session, `/api/v1/workspace?tenant=${encodeURIComponent(tenantId)}`)),
  );

  const uniquePhones = sessions.map((_, i) => `+90559${String(i).padStart(7, "0")}`);
  const writeResults = await Promise.all(
    sessions.map((session, i) =>
      request(session, "/api/v1/contacts", {
        body: {
          tenant_id: tenantId,
          name: `Eşzamanlı Müşteri ${i + 1}`,
          phone: uniquePhones[i],
          email: "",
        },
      }),
    ),
  );

  const dbUniqueCount = db
    .prepare("SELECT COUNT(*) n FROM customers WHERE tenant_id=? AND phone LIKE '+90559%'")
    .get(tenantId).n;

  const visibilityResults = await Promise.all(
    sessions.map(async (session) => {
      const result = await request(session, `/api/v1/workspace?tenant=${encodeURIComponent(tenantId)}`);
      if (!result.ok) return result;
      const seen = new Set((result.data?.customers || []).map((c) => c.phone));
      const missing = uniquePhones.filter((phone) => !seen.has(phone));
      if (missing.length) {
        return {
          ...result,
          ok: false,
          error: `${missing.length} eşzamanlı kayıt bu oturumda görünmedi`,
        };
      }
      return result;
    }),
  );

  const collisionPhone = "+905598888888";
  const collisionResults = await Promise.all(
    sessions.map((session, i) =>
      request(session, "/api/v1/contacts", {
        body: {
          tenant_id: tenantId,
          name: `Çakışma Testi ${i + 1}`,
          phone: collisionPhone,
          email: "",
        },
      }),
    ),
  );
  const collisionCount = db
    .prepare("SELECT COUNT(*) n FROM customers WHERE tenant_id=? AND phone=?")
    .get(tenantId, collisionPhone).n;
  const collisionIds = new Set(
    collisionResults.filter((r) => r.ok && r.data?.id).map((r) => r.data.id),
  );

  const result = {
    users,
    tenant_isolated: true,
    payment_bypassed_via_demo_tenant: true,
    concurrent_workspace_reads: phaseStats(readResults),
    concurrent_unique_writes: phaseStats(writeResults),
    all_sessions_observe_all_writes: phaseStats(visibilityResults),
    same_record_collision: phaseStats(collisionResults),
    db_unique_write_count: dbUniqueCount,
    expected_unique_write_count: users,
    collision_row_count: collisionCount,
    collision_returned_distinct_ids: collisionIds.size,
  };

  const passed =
    result.concurrent_workspace_reads.failed === 0 &&
    result.concurrent_unique_writes.failed === 0 &&
    result.all_sessions_observe_all_writes.failed === 0 &&
    result.same_record_collision.failed === 0 &&
    dbUniqueCount === users &&
    collisionCount === 1 &&
    collisionIds.size === 1;

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
    console.error("LOADTEST_CLEANUP_FAILED", error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
  db.close();
}
