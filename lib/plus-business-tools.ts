import { z } from "zod";
import { all, one, q, tenant, uid, now, hash, secret, ApiError } from "./server";
import { PLAN_LIMITS, requirePlanModule, tenantPlan } from "./entitlements";
import { available, book } from "./booking";

const optionalUrl = z.union([z.string().trim().url().max(500), z.literal("")]).default("");
const websiteSchema = z.object({
  headline: z.string().trim().max(120).default(""),
  intro: z.string().trim().max(600).default(""),
  contact_phone: z.string().trim().max(30).default(""),
  instagram_url: optionalUrl,
  cover_url: optionalUrl,
  published: z.coerce.boolean().default(false),
});
const apiKeySchema = z.object({ name: z.string().trim().min(2).max(60) });
const automationSchema = z.object({
  id: z.string().optional(),
  source_branch_id: z.string().min(1),
  target_branch_id: z.string().min(1),
  enabled: z.coerce.boolean().default(true),
});

async function ownedBranch(tenantId: string, branchId: string) {
  const row = await one(
    "SELECT id,name,city,address,phone FROM branches WHERE tenant_id=? AND id=? AND active=1",
    tenantId,
    branchId,
  );
  if (!row) throw new ApiError("Şube bulunamadı.", 404);
  return row;
}

export async function publicWebsite(tenantId: string) {
  const plan = await tenantPlan(tenantId);
  if (!PLAN_LIMITS[plan].modules.website) return null;
  const row = await one(
    "SELECT headline,intro,contact_phone,instagram_url,cover_url,published,updated_at FROM website_settings WHERE tenant_id=?",
    tenantId,
  );
  return row && Number(row.published) === 1 ? { ...row, published: true } : null;
}

export async function plusToolsSnapshot(tenantId: string) {
  const business = await tenant(tenantId);
  await requirePlanModule(tenantId, "website");
  await requirePlanModule(tenantId, "managementApi");
  await requirePlanModule(tenantId, "branchAutomation");
  const website = await one(
      "SELECT headline,intro,contact_phone,instagram_url,cover_url,published,updated_at FROM website_settings WHERE tenant_id=?",
      tenantId,
    ),
    apiKeys = await all(
      "SELECT id,name,prefix,last_used_at,revoked_at,created_at FROM api_keys WHERE tenant_id=? ORDER BY created_at DESC",
      tenantId,
    ),
    automations = await all(
      `SELECT a.id,a.source_branch_id,a.target_branch_id,a.enabled,a.created_at,a.updated_at,
        s.name source_branch_name,t.name target_branch_name
       FROM branch_automations a
       JOIN branches s ON s.tenant_id=a.tenant_id AND s.id=a.source_branch_id
       JOIN branches t ON t.tenant_id=a.tenant_id AND t.id=a.target_branch_id
       WHERE a.tenant_id=? AND a.kind='overflow' ORDER BY a.created_at DESC`,
      tenantId,
    ),
    branches = await all(
      "SELECT id,name,city,address,phone,is_primary FROM branches WHERE tenant_id=? AND active=1 ORDER BY is_primary DESC,name",
      tenantId,
    );
  return {
    business: { id: business.id, name: business.name, slug: business.slug },
    website: website
      ? { ...website, published: Number(website.published) === 1 }
      : {
          headline: business.name,
          intro: business.description || "",
          contact_phone: business.phone || "",
          instagram_url: "",
          cover_url: "",
          published: false,
        },
    api_keys: apiKeys,
    automations: automations.map((x: any) => ({ ...x, enabled: Number(x.enabled) === 1 })),
    branches,
  };
}

export async function plusToolsAction(tenantId: string, input: any) {
  await tenant(tenantId);
  const action = z.string().parse(input?.action);
  if (action === "save-website") {
    await requirePlanModule(tenantId, "website");
    const x = websiteSchema.parse(input);
    await q(
      `INSERT INTO website_settings(tenant_id,headline,intro,contact_phone,instagram_url,cover_url,published,updated_at)
       VALUES(?,?,?,?,?,?,?,?)
       ON CONFLICT(tenant_id) DO UPDATE SET headline=excluded.headline,intro=excluded.intro,
       contact_phone=excluded.contact_phone,instagram_url=excluded.instagram_url,cover_url=excluded.cover_url,
       published=excluded.published,updated_at=excluded.updated_at`,
      tenantId,
      x.headline,
      x.intro,
      x.contact_phone,
      x.instagram_url,
      x.cover_url,
      x.published ? 1 : 0,
      now(),
    ).run();
    return { ok: true };
  }
  if (action === "create-api-key") {
    await requirePlanModule(tenantId, "managementApi");
    const x = apiKeySchema.parse(input),
      token = "neta_live_" + secret(),
      id = uid();
    await q(
      "INSERT INTO api_keys(id,tenant_id,name,token_hash,prefix,created_at) VALUES(?,?,?,?,?,?)",
      id,
      tenantId,
      x.name,
      await hash(token),
      token.slice(0, 18),
      now(),
    ).run();
    return { ok: true, id, token, warning: "Bu anahtar yalnızca şimdi gösterilir. Güvenli bir yerde saklayın." };
  }
  if (action === "revoke-api-key") {
    await requirePlanModule(tenantId, "managementApi");
    const id = z.string().min(1).parse(input.id),
      result = await q(
        "UPDATE api_keys SET revoked_at=? WHERE tenant_id=? AND id=? AND revoked_at IS NULL",
        now(),
        tenantId,
        id,
      ).run();
    if (!result.meta.changes) throw new ApiError("API anahtarı bulunamadı veya zaten iptal edilmiş.", 404);
    return { ok: true };
  }
  if (action === "save-overflow") {
    await requirePlanModule(tenantId, "branchAutomation");
    const x = automationSchema.parse(input);
    if (x.source_branch_id === x.target_branch_id)
      throw new ApiError("Kaynak ve hedef şube aynı olamaz.", 400);
    await ownedBranch(tenantId, x.source_branch_id);
    await ownedBranch(tenantId, x.target_branch_id);
    const id = x.id || uid(), stamp = now();
    if (x.id) {
      const result = await q(
        "UPDATE branch_automations SET source_branch_id=?,target_branch_id=?,enabled=?,updated_at=? WHERE tenant_id=? AND id=? AND kind='overflow'",
        x.source_branch_id,
        x.target_branch_id,
        x.enabled ? 1 : 0,
        stamp,
        tenantId,
        x.id,
      ).run();
      if (!result.meta.changes) throw new ApiError("Otomasyon bulunamadı.", 404);
    } else {
      await q(
        "INSERT INTO branch_automations(id,tenant_id,name,kind,source_branch_id,target_branch_id,enabled,config_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,'{}',?,?)",
        id,
        tenantId,
        "Doluluk yönlendirmesi",
        "overflow",
        x.source_branch_id,
        x.target_branch_id,
        x.enabled ? 1 : 0,
        stamp,
        stamp,
      ).run();
    }
    return { ok: true, id };
  }
  if (action === "delete-overflow") {
    await requirePlanModule(tenantId, "branchAutomation");
    const id = z.string().min(1).parse(input.id),
      result = await q(
        "DELETE FROM branch_automations WHERE tenant_id=? AND id=? AND kind='overflow'",
        tenantId,
        id,
      ).run();
    if (!result.meta.changes) throw new ApiError("Otomasyon bulunamadı.", 404);
    return { ok: true };
  }
  throw new ApiError("Geçersiz Plus araçları işlemi.", 400);
}

export async function branchOverflowAlternatives(
  business: any,
  serviceId: string,
  date: string,
  sourceBranchId: string,
) {
  const plan = await tenantPlan(business.id);
  if (!PLAN_LIMITS[plan].modules.branchAutomation) return [];
  const rules = await all(
    `SELECT a.target_branch_id,b.name target_branch_name
     FROM branch_automations a
     JOIN branches b ON b.tenant_id=a.tenant_id AND b.id=a.target_branch_id AND b.active=1
     WHERE a.tenant_id=? AND a.kind='overflow' AND a.enabled=1 AND a.source_branch_id=?
     ORDER BY a.created_at ASC LIMIT 5`,
    business.id,
    sourceBranchId,
  );
  const result: any[] = [];
  for (const rule of rules) {
    const slots = await available(
      business,
      serviceId,
      date,
      "any",
      "",
      undefined,
      rule.target_branch_id,
    );
    for (const slot of slots.slice(0, 6))
      result.push({
        ...slot,
        branch_id: rule.target_branch_id,
        branch_name: rule.target_branch_name,
      });
    if (result.length >= 12) break;
  }
  return result.slice(0, 12);
}

export async function authenticateManagementKey(req: Request) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  if (!/^neta_live_[a-f0-9]{64}$/.test(token)) throw new ApiError("Geçersiz API anahtarı.", 401);
  const row = await one(
    "SELECT id,tenant_id FROM api_keys WHERE token_hash=? AND revoked_at IS NULL",
    await hash(token),
  );
  if (!row) throw new ApiError("API anahtarı bulunamadı veya iptal edilmiş.", 401);
  await requirePlanModule(row.tenant_id, "managementApi");
  await q("UPDATE api_keys SET last_used_at=? WHERE id=?", now(), row.id).run();
  return String(row.tenant_id);
}

export async function managementApiGet(req: Request, resource: string) {
  const tenantId = await authenticateManagementKey(req),
    u = new URL(req.url);
  if (resource === "business") {
    const business = await one(
      "SELECT id,name,slug,category,city,address,description,phone,status FROM businesses WHERE id=?",
      tenantId,
    );
    return {
      business,
      branches: await all("SELECT id,name,city,address,phone,is_primary,active FROM branches WHERE tenant_id=? ORDER BY is_primary DESC,name", tenantId),
      services: await all("SELECT id,name,description,duration,price,delivery_mode,active FROM services WHERE tenant_id=? ORDER BY name", tenantId),
      staff: await all("SELECT id,branch_id,name,title,active FROM staff WHERE tenant_id=? ORDER BY name", tenantId),
    };
  }
  if (resource === "appointments") {
    const from = u.searchParams.get("from") || "0000-01-01",
      to = u.searchParams.get("to") || "9999-12-31";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to))
      throw new ApiError("from ve to YYYY-AA-GG biçiminde olmalı.", 400);
    return {
      appointments: await all(
        `SELECT a.id,a.branch_id,a.customer_id,a.service_id,a.staff_id,a.date,a.minute,a.duration,a.price,a.status,a.source,a.created_at,
         c.name customer_name,c.phone customer_phone,s.name service_name,p.name staff_name
         FROM appointments a
         JOIN customers c ON c.tenant_id=a.tenant_id AND c.id=a.customer_id
         JOIN services s ON s.tenant_id=a.tenant_id AND s.id=a.service_id
         JOIN staff p ON p.tenant_id=a.tenant_id AND p.id=a.staff_id
         WHERE a.tenant_id=? AND a.date BETWEEN ? AND ? ORDER BY a.date,a.minute LIMIT 1000`,
        tenantId,
        from,
        to,
      ),
    };
  }
  if (resource === "customers")
    return {
      customers: await all(
        "SELECT id,name,phone,email,consent,created_at FROM customers WHERE tenant_id=? ORDER BY created_at DESC LIMIT 1000",
        tenantId,
      ),
    };
  throw new ApiError("API kaynağı bulunamadı.", 404);
}

export async function managementApiPost(req: Request, resource: string) {
  const tenantId = await authenticateManagementKey(req);
  if (resource !== "appointments") throw new ApiError("API kaynağı bulunamadı.", 404);
  const business = await one("SELECT * FROM businesses WHERE id=? AND status='approved'", tenantId);
  if (!business) throw new ApiError("İşletme aktif değil.", 404);
  const raw = await req.json();
  return book(business, raw, undefined, undefined, undefined, "api");
}
