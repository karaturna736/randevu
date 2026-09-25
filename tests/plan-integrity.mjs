// Paket kapsamı, AI/WhatsApp kotaları ve Plus-only özellikleri izole ortamda doğrular.
// Gerçek Meta/AI trafiği gönderilmez; Graph API yanıtı bu süreçte sahte olarak üretilir.
import { createRequire } from "node:module";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash, createHmac, randomUUID } from "node:crypto";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const wr = createRequire(require.resolve("wrangler/package.json"));
const { Miniflare, Response: TestResponse } = await import(wr.resolve("miniflare"));
const root = resolve("dist/server");
const files = [
  "index.js",
  ...readdirSync(root, { recursive: true }).filter(
    (p) => p.endsWith(".js") && p !== "index.js",
  ),
];

const APP_SECRET = "plan-integrity-meta-secret";
const PHONE_ID = "123456789012345";
let graphCalls = 0;
const outboundService = async (request) => {
  const url = new URL(request.url);
  if (
    url.origin === "https://graph.facebook.com" &&
    url.pathname === `/v23.0/${PHONE_ID}/messages`
  ) {
    graphCalls++;
    return new TestResponse(
      JSON.stringify({ messages: [{ id: `wamid-plan-${graphCalls}` }] }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }
  throw new Error(`Unexpected external call: ${url.origin}${url.pathname}`);
};

const bindings = {
  PLATFORM_ADMIN_USER_IDS: "qa-admin",
  CHATGPT_AUTH_ENABLED: "true",
  PUBLIC_APP_URL: "https://neta.test",
  PUBLIC_SITE_READY: "true",
  META_APP_SECRET: APP_SECRET,
  META_VERIFY_TOKEN: "verify-plan-integrity",
  WHATSAPP_GRAPH_VERSION: "v23.0",
  APP_ENCRYPTION_KEY: "a".repeat(64),
  WHATSAPP_CONNECTIONS_JSON: JSON.stringify([
    {
      tenant_id: "plan-pro",
      phone_id: PHONE_ID,
      number: "+905551112233",
      token: "test-meta-token-1234567890",
      language: "tr",
    },
  ]),
};

const mf = new Miniflare({
  modules: files.map((p) => ({ type: "ESModule", path: resolve(root, p) })),
  modulesRoot: root,
  compatibilityDate: "2026-05-15",
  compatibilityFlags: ["nodejs_compat"],
  d1Databases: ["DB"],
  cf: false,
  bindings,
  outboundService,
});

let checks = 0;
function check(value, label) {
  assert.ok(value, label);
  checks++;
  console.log("PASS", label);
}
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const future = () => new Date(Date.now() + 86400000).toISOString();

async function call(path, { user, body } = {}) {
  const response = await mf.dispatchFetch(`https://neta.test/api/v1/${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      ...(user
        ? {
            "oai-authenticated-user-id": user,
            "oai-authenticated-user-email": `${user}@example.test`,
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

async function webhook(messageId, text) {
  const raw = JSON.stringify({
    object: "whatsapp_business_account",
    entry: [
      {
        changes: [
          {
            value: {
              metadata: { phone_number_id: PHONE_ID },
              messages: [
                {
                  id: messageId,
                  from: "905550001122",
                  timestamp: String(Math.floor(Date.now() / 1000)),
                  text: { body: text },
                },
              ],
            },
          },
        ],
      },
    ],
  });
  const signature = createHmac("sha256", APP_SECRET).update(raw).digest("hex");
  return mf.dispatchFetch("https://neta.test/api/integrations/whatsapp", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-hub-signature-256": `sha256=${signature}`,
    },
    body: raw,
  });
}

try {
  const db = await mf.getD1Database("DB");
  for (const file of readdirSync("drizzle").filter((p) => p.endsWith(".sql")).sort())
    for (const sql of readFileSync(`drizzle/${file}`, "utf8")
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean))
      await db.prepare(sql).run();

  const created = new Date().toISOString();
  const plans = [
    ["plan-normal", "normal-owner", "normal", 60000],
    ["plan-pro", "pro-owner", "pro", 99900],
    ["plan-plus", "plus-owner", "plus", 250000],
  ];
  for (const [tenantId, userId, plan, amount] of plans) {
    await db
      .prepare(
        "INSERT INTO businesses(id,name,slug,category,status,demo,hours,created_at) VALUES(?,?,?,?, 'approved',0,'{}',?)",
      )
      .bind(tenantId, `Test ${plan}`, tenantId, "Kuaför & Berber", created)
      .run();
    await db
      .prepare(
        "INSERT INTO members(tenant_id,user_id,email,name) VALUES(?,?,?,?)",
      )
      .bind(tenantId, userId, `${userId}@example.test`, userId)
      .run();
    await db
      .prepare(
        "INSERT INTO recurring_subscriptions(tenant_id,plan_reference,plan,amount,state,request_id,test_mode,paid_until,created_at,updated_at) VALUES(?,?,?,?, 'ACTIVE',?,0,?,?,?)",
      )
      .bind(
        tenantId,
        `integrity-${plan}`,
        plan,
        amount,
        randomUUID(),
        future(),
        created,
        created,
      )
      .run();
  }

  const normal = (await call("workspace?tenant=plan-normal", { user: "normal-owner" })).data;
  const pro = (await call("workspace?tenant=plan-pro", { user: "pro-owner" })).data;
  const plus = (await call("workspace?tenant=plan-plus", { user: "plus-owner" })).data;

  check(
    normal.entitlements.plan === "normal" &&
      normal.entitlements.whatsappMonthly === 0 &&
      normal.entitlements.aiDaily === 0 &&
      normal.entitlements.branches === 1 &&
      normal.entitlements.staff === 5,
    "Standart limits match the sold package",
  );
  check(
    pro.entitlements.plan === "pro" &&
      pro.entitlements.whatsappMonthly === 1000 &&
      pro.entitlements.aiDaily === 50 &&
      pro.entitlements.branches === 3 &&
      pro.entitlements.staff === null,
    "Pro limits are 1000 WhatsApp/month, 50 AI/day, 3 branches and unlimited staff",
  );
  check(
    plus.entitlements.plan === "plus" &&
      plus.entitlements.whatsappMonthly === 5000 &&
      plus.entitlements.aiDaily === 200 &&
      plus.entitlements.branches === null &&
      plus.entitlements.staff === null,
    "Plus limits are 5000 WhatsApp/month, 200 AI/day and unlimited branches/staff",
  );
  check(
    pro.entitlements.modules.receivables &&
      pro.entitlements.modules.journeys &&
      pro.entitlements.modules.growth &&
      pro.entitlements.modules.recovery &&
      pro.entitlements.modules.demand &&
      pro.entitlements.modules.branchProfit &&
      pro.entitlements.modules.whatsapp &&
      !pro.entitlements.modules.accounting &&
      !pro.entitlements.modules.referral &&
      !pro.entitlements.modules.setupCenter,
    "Pro receives Pro modules but not Plus-only accounting/referral/setup",
  );
  check(
    plus.entitlements.modules.accounting &&
      plus.entitlements.modules.referral &&
      plus.entitlements.modules.setupCenter,
    "Plus unlocks accounting, referral and setup center",
  );
  check(
    (await call("receivables?tenant=plan-normal", { user: "normal-owner" })).status === 402,
    "Standart cannot bypass Pro debt ledger from the API",
  );
  check(
    (await call("setup-center?tenant=plan-pro", { user: "pro-owner" })).status === 402,
    "Pro cannot bypass Plus setup center from the API",
  );
  check(
    (await call("expense-catalog", { user: "pro-owner", body: { tenant_id: "plan-pro" } })).status === 402,
    "Pro cannot bypass Plus reusable accounting catalog from the API",
  );
  check(
    (await call("setup-center?tenant=plan-plus", { user: "plus-owner" })).status === 200,
    "Plus setup center is operational",
  );

  // Panel randevu asistanı da Pro/Plus AI günlük kotasından tüketir.
  const aiBucket = new Date().toISOString().slice(0, 10);
  const aiKey = sha256(`plan-quota:plan-pro:ai:${aiBucket}`);
  await db
    .prepare("INSERT INTO rate_limits(key,count,expires_at) VALUES(?,49,?)")
    .bind(aiKey, Date.now() + 86400000)
    .run();
  const ai50 = await call("assistant", {
    user: "pro-owner",
    body: { tenant_id: "plan-pro", message: "saç kesimi için saat" },
  });
  const ai51 = await call("assistant", {
    user: "pro-owner",
    body: { tenant_id: "plan-pro", message: "saç kesimi için saat" },
  });
  check(ai50.status === 200 && ai51.status === 429, "Pro AI daily limit is enforced at 50 uses");

  // Çift yönlü WhatsApp cevapları da paket kotasından geçmeli.
  const waBucket = new Date().toISOString().slice(0, 7);
  const waKey = sha256(`plan-quota:plan-pro:whatsapp:${waBucket}`);
  await db
    .prepare("INSERT INTO rate_limits(key,count,expires_at) VALUES(?,999,?)")
    .bind(waKey, Date.now() + 32 * 86400000)
    .run();
  const firstWa = await webhook("incoming-plan-1", "link");
  check(firstWa.status === 200 && graphCalls === 1, "The 1000th Pro WhatsApp send reaches Meta once");
  const firstState = await db.prepare("SELECT status FROM wa_messages WHERE id='incoming-plan-1'").first();
  check(firstState?.status === "accepted", "Successful WhatsApp reply is recorded as accepted");

  const secondWa = await webhook("incoming-plan-2", "link");
  const secondState = await db.prepare("SELECT status FROM wa_messages WHERE id='incoming-plan-2'").first();
  const waCounter = await db.prepare("SELECT count FROM rate_limits WHERE key=?").bind(waKey).first();
  check(
    secondWa.status === 200 && graphCalls === 1 && secondState?.status === "quota" && Number(waCounter?.count) === 1000,
    "The 1001st Pro WhatsApp send is blocked, not sent, and recorded as quota",
  );

  check((await db.prepare("PRAGMA foreign_key_check").all()).results.length === 0, "Package audit leaves foreign keys valid");
  console.log(JSON.stringify({ passed: checks, failed: 0 }));
} finally {
  await mf.dispose();
}
