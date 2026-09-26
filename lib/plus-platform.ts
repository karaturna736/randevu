import { z } from "zod";
import { all, one, q, tenant, uid, now, ApiError, hash, secret } from "./server";
import { PLAN_LIMITS, tenantPlan, requirePlanModule } from "./entitlements";
import { available } from "./booking";

const urlField = z.union([z.literal(""), z.string().url().max(300)]);
const websiteSchema = z.object({
  eyebrow: z.string().max(80).default(""),
  hero_title: z.string().max(120).default(""),
  hero_text: z.string().max(500).default(""),
  about_text: z.string().max(1200).default(""),
  instagram_url: urlField.default(""),
  contact_phone: z.string().max(40).default(""),
  seo_title: z.string().max(70).default(""),
  seo_description: z.string().max(170).default(""),
  show_reviews: z.boolean().default(true),
});

function websiteDefaults(b: any) {
  return {
    eyebrow: b.category || "ONLINE RANDEVU",
    hero_title: b.name || "Randevunuzu planlayın",
    hero_text: b.description || "Hizmetinizi seçin ve size uygun saati ayırtın.",
    about_text: "",
    instagram_url: "",
    contact_phone: b.phone || "",
    seo_title: b.name ? `${b.name} | Online Randevu` : "Online Randevu",
    seo_description: b.description || `${b.name || "İşletme"} için online randevu alın.`,
    show_reviews: true,
  };
}

export async function websiteSnapshot(tenantId: string) {
  const b = await tenant(tenantId);
  await requirePlanModule(tenantId, "website");
  const row = await one("SELECT * FROM business_sites WHERE tenant_id=?", tenantId);
  return {
    ...websiteDefaults(b),
    ...(row || {}),
    show_reviews: row ? Number(row.show_reviews) === 1 : true,
    page_path: `/${b.slug}`,
  };
}

export async function saveWebsite(tenantId: string, input: unknown) {
  const b = await tenant(tenantId);
  await requirePlanModule(tenantId, "website");
  const x = websiteSchema.parse(input), t = now();
  await q(
    `INSERT INTO business_sites
      (tenant_id,eyebrow,hero_title,hero_text,about_text,instagram_url,contact_phone,seo_title,seo_description,show_reviews,updated_at)
     VALUES(?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(tenant_id) DO UPDATE SET
      eyebrow=excluded.eyebrow,hero_title=excluded.hero_title,hero_text=excluded.hero_text,
      about_text=excluded.about_text,instagram_url=excluded.instagram_url,contact_phone=excluded.contact_phone,
      seo_title=excluded.seo_title,seo_description=excluded.seo_description,
      show_reviews=excluded.show_reviews,updated_at=excluded.updated_at`,
    tenantId, x.eyebrow, x.hero_title, x.hero_text, x.about_text, x.instagram_url,
    x.contact_phone, x.seo_title, x.seo_description, x.show_reviews ? 1 : 0, t,
  ).run();
  return { ok: true, page_path: `/${b.slug}` };
}

export async function publicWebsite(tenantId: string) {
  const plan = await tenantPlan(tenantId);
  if (!PLAN_LIMITS[plan].modules.website) return null;
  const b = await one("SELECT name,slug,category,phone,description FROM businesses WHERE id=?", tenantId);
  if (!b) return null;
  const row = await one("SELECT * FROM business_sites WHERE tenant_id=?", tenantId);
  return {
    ...websiteDefaults(b),
    ...(row || {}),
    show_reviews: row ? Number(row.show_reviews) === 1 : true,
  };
}

export async function managementApiSnapshot(tenantId: string) {
  await tenant(tenantId);
  await requirePlanModule(tenantId, "managementApi");
  return {
    keys: await all(
      "SELECT id,name,key_prefix,created_at,last_used_at,revoked_at FROM management_api_keys WHERE tenant_id=? ORDER BY created_at DESC LIMIT 50",
      tenantId,
    ),
    base_path: "/api/management/v1",
    docs_path: "/docs/management-api",
  };
}

export async function createManagementApiKey(tenantId: string, input: unknown) {
  await tenant(tenantId);
  await requirePlanModule(tenantId, "managementApi");
  const x = z.object({ name: z.string().trim().min(2).max(60) }).parse(input);
  const plain = `neta_live_${secret()}`;
  const id = uid(), created = now();
  await q(
    "INSERT INTO management_api_keys(id,tenant_id,name,key_hash,key_prefix,created_at) VALUES(?,?,?,?,?,?)",
    id, tenantId, x.name, await hash(plain), plain.slice(0, 18), created,
  ).run();
  return {
    id,
    name: x.name,
    key: plain,
    key_prefix: plain.slice(0, 18),
    created_at: created,
    warning: "Bu anahtar yalnızca bir kez gösterilir. Güvenli bir yerde saklayın.",
  };
}

export async function revokeManagementApiKey(tenantId: string, input: unknown) {
  await tenant(tenantId);
  await requirePlanModule(tenantId, "managementApi");
  const x = z.object({ id: z.string().min(1) }).parse(input);
  const r = await q(
    "UPDATE management_api_keys SET revoked_at=? WHERE id=? AND tenant_id=? AND revoked_at IS NULL",
    now(), x.id, tenantId,
  ).run();
  if (!r.meta.changes) throw new ApiError("API anahtarı bulunamadı veya daha önce iptal edildi.", 404);
  return { ok: true };
}

export async function authenticateManagementApi(req: Request) {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!/^neta_live_[a-f0-9]{64}$/i.test(token)) throw new ApiError("Geçerli bir yönetim API anahtarı gerekli.", 401);
  const row = await one(
    "SELECT id,tenant_id,name FROM management_api_keys WHERE key_hash=? AND revoked_at IS NULL",
    await hash(token),
  );
  if (!row) throw new ApiError("Yönetim API anahtarı geçersiz veya iptal edilmiş.", 401);
  const plan = await tenantPlan(row.tenant_id);
  if (!PLAN_LIMITS[plan].modules.managementApi) throw new ApiError("Yönetim API erişimi aktif Plus aboneliği gerektirir.", 402);
  await q("UPDATE management_api_keys SET last_used_at=? WHERE id=?", now(), row.id).run();
  return { tenant_id: String(row.tenant_id), key_id: String(row.id), name: String(row.name) };
}

export async function branchAutomationSnapshot(tenantId: string) {
  await tenant(tenantId);
  await requirePlanModule(tenantId, "branchAutomation");
  const row = await one("SELECT * FROM branch_automation_settings WHERE tenant_id=?", tenantId);
  return {
    fallback_enabled: row ? Number(row.fallback_enabled) === 1 : true,
    max_alternatives: Number(row?.max_alternatives || 3),
  };
}

export async function saveBranchAutomation(tenantId: string, input: unknown) {
  await tenant(tenantId);
  await requirePlanModule(tenantId, "branchAutomation");
  const x = z.object({
    fallback_enabled: z.boolean(),
    max_alternatives: z.coerce.number().int().min(1).max(5),
  }).parse(input);
  await q(
    `INSERT INTO branch_automation_settings(tenant_id,fallback_enabled,max_alternatives,updated_at)
     VALUES(?,?,?,?) ON CONFLICT(tenant_id) DO UPDATE SET
     fallback_enabled=excluded.fallback_enabled,max_alternatives=excluded.max_alternatives,updated_at=excluded.updated_at`,
    tenantId, x.fallback_enabled ? 1 : 0, x.max_alternatives, now(),
  ).run();
  return { ok: true };
}

export async function crossBranchAlternatives(
  b: any,
  serviceId: string,
  date: string,
  person: string,
  preferredBranchId: string,
) {
  const plan = await tenantPlan(b.id);
  if (!PLAN_LIMITS[plan].modules.branchAutomation) return [];
  const setting = await one("SELECT fallback_enabled,max_alternatives FROM branch_automation_settings WHERE tenant_id=?", b.id);
  if (setting && Number(setting.fallback_enabled) !== 1) return [];
  const max = Math.max(1, Math.min(5, Number(setting?.max_alternatives || 3)));
  const branches = await all(
    "SELECT id,name,city,address FROM branches WHERE tenant_id=? AND active=1 AND id<>? ORDER BY is_primary DESC,name",
    b.id, preferredBranchId,
  );
  const results: any[] = [];
  for (const branch of branches) {
    const slots = await available(b, serviceId, date, person || "any", "", undefined, branch.id);
    if (slots.length) {
      results.push({ branch, slots: slots.slice(0, 6) });
      if (results.length >= max) break;
    }
  }
  return results;
}

export async function plusToolsSnapshot(tenantId: string) {
  await tenant(tenantId);
  const plan = await tenantPlan(tenantId);
  if (plan !== "plus") throw new ApiError("Plus araçları aktif Neta Plus aboneliği gerektirir.", 402);
  return {
    website: await websiteSnapshot(tenantId),
    management_api: await managementApiSnapshot(tenantId),
    branch_automation: await branchAutomationSnapshot(tenantId),
  };
}
