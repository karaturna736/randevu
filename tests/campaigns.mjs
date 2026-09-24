import { createRequire } from "node:module";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHmac, randomUUID } from "node:crypto";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const wranglerRequire = createRequire(require.resolve("wrangler/package.json"));
const { Miniflare, Response: TestResponse } = await import(
  wranglerRequire.resolve("miniflare")
);
const root = resolve("dist/server");
const files = [
  "index.js",
  ...readdirSync(root, { recursive: true }).filter(
    (path) => path.endsWith(".js") && path !== "index.js",
  ),
];
let providerBody;
const outboundService = async (request) => {
  const url = new URL(request.url);
  if (url.origin === "https://www.paytr.com" && url.pathname === "/odeme/api/get-token") {
    providerBody = new URLSearchParams(await request.text());
    return new TestResponse(
      JSON.stringify({ status: "success", token: "campaign_test_token_12345" }),
      { headers: { "content-type": "application/json" } },
    );
  }
  throw new Error("Unexpected external call: " + url);
};
const bindings = {
  PLATFORM_ADMIN_USER_IDS: "platform-admin",
  PUBLIC_APP_URL: "https://neta.test",
  PUBLIC_SITE_READY: "true",
  PAYTR_MERCHANT_ID: "merchant",
  PAYTR_MERCHANT_KEY: "campaign-secret",
  PAYTR_MERCHANT_SALT: "campaign-salt",
  PAYTR_TEST_MODE: "0",
};
const mf = new Miniflare({
  modules: files.map((path) => ({ type: "ESModule", path: resolve(root, path) })),
  modulesRoot: root,
  compatibilityDate: "2026-05-15",
  compatibilityFlags: ["nodejs_compat"],
  d1Databases: ["DB"],
  bindings,
  cf: false,
  outboundService,
});
let checks = 0;
const check = (value, label) => {
  assert.ok(value, label);
  checks++;
  console.log("PASS", label);
};
const headers = (user) => ({
  "oai-authenticated-user-id": user,
  "oai-authenticated-user-email": `${user}@example.test`,
});
async function api(path, user, body) {
  const response = await mf.dispatchFetch(`https://neta.test/api/v1/${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      ...headers(user),
      ...(body
        ? { "content-type": "application/json", origin: "https://neta.test" }
        : {}),
      ...(path === "checkout" ? { "cf-connecting-ip": "192.0.2.50" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: response.status, data: await response.json() };
}
const at = (days) => new Date(Date.now() + days * 86400000).toISOString();
async function createCampaign(overrides = {}) {
  const code = overrides.code || `NETA${randomUUID().slice(0, 8).toUpperCase()}`;
  const result = await api("campaigns", "platform-admin", {
    action: "create",
    name: overrides.name || code,
    code,
    description: "Otomatik kampanya testi",
    discount_type: "percentage",
    discount_value: 2000,
    target_type: "all",
    applicable_plans: ["normal", "pro", "plus"],
    starts_at: at(-1),
    ends_at: at(30),
    total_usage_limit: null,
    per_business_limit: null,
    first_payment_only: false,
    recurring_enabled: true,
    active: true,
    business_ids: [],
    ...overrides,
  });
  assert.equal(result.status, 200, JSON.stringify(result.data));
  return { id: result.data.id, code };
}
async function callback(id, amount = "200000") {
  const status = "success";
  const hash = createHmac("sha256", bindings.PAYTR_MERCHANT_KEY)
    .update(id + bindings.PAYTR_MERCHANT_SALT + status + amount)
    .digest("base64");
  return mf.dispatchFetch("https://neta.test/api/payments/paytr/callback", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      merchant_oid: id,
      status,
      total_amount: amount,
      hash,
    }).toString(),
  });
}

try {
  const db = await mf.getD1Database("DB");
  for (const file of readdirSync("drizzle").filter((path) => path.endsWith(".sql")).sort())
    for (const sql of readFileSync(`drizzle/${file}`, "utf8")
      .split("--> statement-breakpoint")
      .map((value) => value.trim())
      .filter(Boolean))
      await db.prepare(sql).run();
  const future = at(90);
  for (const business of [
    ["tenant-a", "A Studio", "owner-a", "pro"],
    ["tenant-b", "B Studio", "owner-b", "pro"],
    ["tenant-c", "C Studio", "owner-c", "normal"],
  ]) {
    await db
      .prepare("INSERT INTO businesses(id,name,slug,category,status,demo,hours,selected_plan,created_at) VALUES(?,?,?,'Kuaför & Berber','approved',0,'{}',?,?)")
      .bind(business[0], business[1], business[0], business[3], at(-100))
      .run();
    await db
      .prepare("INSERT INTO members(tenant_id,user_id,email,name,role) VALUES(?,?,?,?, 'owner')")
      .bind(business[0], business[2], `${business[2]}@example.test`, `${business[2]} sahibi`)
      .run();
    await db
      .prepare("INSERT INTO subscriptions(tenant_id,paid_until,updated_at) VALUES(?,?,?)")
      .bind(business[0], future, at(-1))
      .run();
    await db
      .prepare("INSERT INTO billing_profiles(tenant_id,name,address,phone,email,updated_at) VALUES(?,?,'Test adresi İstanbul','+905551112233',?,?)")
      .bind(business[0], business[1], `${business[2]}@example.test`, at(-1))
      .run();
  }
  await db
    .prepare("INSERT INTO billing_settings(id,amount,active,seller_name,support_email,seller_address,terms_url,updated_at) VALUES(1,250000,1,'Neta','support@neta.test','Test satıcı adresi','https://neta.test/kosullar',?)")
    .bind(at(-1))
    .run();

  const general = await createCampaign({ code: "GENEL20" });
  check(!!general.id, "Admin campaign creation succeeds");
  check(
    (await api("campaigns", "owner-a", { ...general, action: "delete" })).status === 403,
    "Business user cannot mutate campaigns",
  );
  const generalQuote = await api(
    "campaign-preview?tenant=tenant-a&plan=pro&code=genel20",
    "owner-a",
  );
  check(
    generalQuote.status === 200 &&
      generalQuote.data.original_amount === 250000 &&
      generalQuote.data.discount_amount === 50000 &&
      generalQuote.data.final_amount === 200000,
    "General campaign is normalized and calculated on the server",
  );

  await createCampaign({
    code: "SADECEA",
    target_type: "selected",
    business_ids: ["tenant-a"],
  });
  check(
    (await api("campaign-preview?tenant=tenant-a&plan=pro&code=SADECEA", "owner-a")).status === 200,
    "Selected business can use its campaign",
  );
  check(
    (await api("campaign-preview?tenant=tenant-b&plan=pro&code=SADECEA", "owner-b")).status === 403,
    "Another tenant cannot use a private campaign",
  );
  await createCampaign({ code: "BITTI", starts_at: at(-10), ends_at: at(-1) });
  check(
    (await api("campaign-preview?tenant=tenant-a&plan=pro&code=BITTI", "owner-a")).status === 409,
    "Expired campaign is rejected",
  );
  await createCampaign({ code: "PASIF", active: false });
  check(
    (await api("campaign-preview?tenant=tenant-a&plan=pro&code=PASIF", "owner-a")).status === 409,
    "Inactive campaign is rejected",
  );
  await createCampaign({ code: "STARTER", applicable_plans: ["normal"] });
  check(
    (await api("campaign-preview?tenant=tenant-a&plan=pro&code=STARTER", "owner-a")).status === 409,
    "Campaign for another plan is rejected",
  );
  const limited = await createCampaign({ code: "TEKHAK", total_usage_limit: 1, per_business_limit: 1 });
  const fakePriceCheckout = await api("checkout", "owner-a", {
    tenant_id: "tenant-a",
    idempotency_key: randomUUID(),
    terms_accepted: true,
    campaign_code: limited.code,
    amount: 1,
    price: 1,
    currency: "USD",
  });
  check(fakePriceCheckout.status === 200, "Eligible discounted PayTR checkout starts");
  check(
    providerBody.get("payment_amount") === "200000",
    "Forged client price is ignored and signed server total is used",
  );
  const orderId = fakePriceCheckout.data.order_id;
  const responses = await Promise.all([callback(orderId), callback(orderId)]);
  check(responses.every((response) => response.status === 200), "Duplicate provider callbacks remain idempotent");
  check(
    (await db.prepare("SELECT COUNT(*) n FROM campaign_redemptions WHERE payment_id=? AND status='succeeded'").bind(orderId).first()).n === 1,
    "One payment can create only one successful redemption",
  );
  check(
    (await api("checkout", "owner-b", {
      tenant_id: "tenant-b",
      idempotency_key: randomUUID(),
      terms_accepted: true,
      campaign_code: limited.code,
    })).status === 409,
    "Total usage limit is enforced before another payment",
  );
  const snapshot = await api("campaigns", "platform-admin");
  const metric = snapshot.data.campaigns.find((item) => item.id === limited.id);
  check(
    metric.usage_count === 1 &&
      metric.total_discount === 50000 &&
      metric.net_revenue === 200000 &&
      metric.top_plan === "pro",
    "Campaign analytics reflect verified financial values",
  );
  await api("campaigns", "platform-admin", { action: "delete", id: limited.id });
  check(
    (await db.prepare("SELECT COUNT(*) n FROM campaign_redemptions WHERE campaign_id=?").bind(limited.id).first()).n === 1,
    "Soft deletion preserves campaign financial history",
  );
  check(
    (await db.prepare("SELECT COUNT(*) n FROM audit WHERE action LIKE 'campaign.%'").first()).n >= 7,
    "Campaign administrator actions are written to audit log",
  );
  let duplicateCodeRejected = false;
  try {
    await db
      .prepare("INSERT INTO campaigns(id,name,code,discount_type,discount_value,target_type,applicable_plans,starts_at,ends_at,created_by,created_at,updated_at) VALUES('case-test','Case test','genel20','fixed',100,'all','[\"pro\"]',?,?, 'admin',?,?)")
      .bind(at(-1), at(1), at(-1), at(-1))
      .run();
  } catch {
    duplicateCodeRejected = true;
  }
  check(duplicateCodeRejected, "Database enforces case-insensitive campaign code uniqueness");
  check(
    (await db.prepare("PRAGMA foreign_key_check").all()).results.length === 0,
    "Campaign tables preserve database foreign keys",
  );
  console.log(JSON.stringify({ passed: checks, failed: 0 }));
} finally {
  await mf.dispose();
}
