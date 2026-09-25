import { z } from "zod";
import { all, one, q, db, tenant, uid, now, ApiError } from "./server";
import {
  PLAN_LIMITS,
  tenantPlan,
  requirePlanModule,
} from "./entitlements";

const monthSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Geçerli bir ay seçin.");
const branchSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2).max(80),
  city: z.string().trim().max(80).default(""),
  address: z.string().trim().max(300).default(""),
  phone: z.string().trim().max(30).default(""),
  active: z.coerce.number().int().min(0).max(1).default(1),
});
const expenseSchema = z.object({
  id: z.string().optional(),
  branch_id: z.string().min(1),
  month: monthSchema,
  category: z.enum([
    "kira",
    "personel",
    "malzeme",
    "fatura",
    "pazarlama",
    "vergi",
    "diger",
  ]),
  amount: z.coerce.number().int().min(1).max(1000000000),
  catalog_item_id: z.string().nullable().optional(),
  quantity: z.coerce.number().positive().max(100000).default(1),
  unit: z.string().trim().min(1).max(20).default("adet"),
  note: z.string().trim().max(300).default(""),
});
const catalogSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2).max(80),
  category: z.enum([
    "kira",
    "personel",
    "malzeme",
    "fatura",
    "pazarlama",
    "vergi",
    "diger",
  ]),
  unit: z.string().trim().min(1).max(20).default("adet"),
  default_unit_amount: z.coerce.number().int().min(0).max(1000000000),
  note: z.string().trim().max(300).default(""),
  apply_to_branch_id: z.string().min(1).optional(),
  apply_month: monthSchema.optional(),
  quantity: z.coerce.number().positive().max(100000).default(1),
});

async function ownedBranch(tenantId: string, branchId: string) {
  const branch = await one(
    "SELECT * FROM branches WHERE tenant_id=? AND id=?",
    tenantId,
    branchId,
  );
  if (!branch) throw new ApiError("Şube bulunamadı.", 404);
  return branch;
}

export async function branchSnapshot(tenantId: string, monthInput?: string) {
  await tenant(tenantId);
  const month = monthSchema.parse(
      monthInput || new Date().toISOString().slice(0, 7),
    ),
    plan = await tenantPlan(tenantId),
    limits = PLAN_LIMITS[plan];
  const branches = await all(
    `SELECT b.*,
  COALESCE((SELECT SUM(a.price) FROM appointments a WHERE a.tenant_id=b.tenant_id AND a.branch_id=b.id AND a.status='completed' AND substr(a.date,1,7)=?),0) revenue,
  COALESCE((SELECT SUM(e.amount) FROM branch_expenses e WHERE e.tenant_id=b.tenant_id AND e.branch_id=b.id AND e.month=?),0) expenses,
  COALESCE((SELECT COUNT(*) FROM appointments a WHERE a.tenant_id=b.tenant_id AND a.branch_id=b.id AND a.status='completed' AND substr(a.date,1,7)=?),0) completed,
  COALESCE((SELECT expenses_confirmed FROM branch_month_closings c WHERE c.tenant_id=b.tenant_id AND c.branch_id=b.id AND c.month=?),0) expenses_confirmed
 FROM branches b WHERE b.tenant_id=? ORDER BY b.is_primary DESC,b.name`,
    month,
    month,
    month,
    month,
    tenantId,
  );
  const expenses = await all(
    "SELECT e.*,b.name branch_name,c.name catalog_name FROM branch_expenses e JOIN branches b ON b.tenant_id=e.tenant_id AND b.id=e.branch_id LEFT JOIN expense_catalog_items c ON c.tenant_id=e.tenant_id AND c.id=e.catalog_item_id WHERE e.tenant_id=? AND e.month=? ORDER BY e.created_at DESC",
    tenantId,
    month,
  );
  const catalog = limits.modules.accounting
    ? await all(
        "SELECT * FROM expense_catalog_items WHERE tenant_id=? AND active=1 ORDER BY category,name",
        tenantId,
      )
    : [];
  const rows = branches.map((b: any) => ({
    ...b,
    revenue: Number(b.revenue),
    expenses: Number(b.expenses),
    net: Number(b.revenue) - Number(b.expenses),
    completed: Number(b.completed),
    estimated: Number(b.expenses_confirmed) !== 1,
  }));
  return {
    month,
    plan,
    limits,
    branches: rows,
    expenses,
    catalog,
    summary: {
      revenue: rows.reduce((n: number, b: any) => n + b.revenue, 0),
      expenses: rows.reduce((n: number, b: any) => n + b.expenses, 0),
      net: rows.reduce((n: number, b: any) => n + b.net, 0),
      estimated: rows.some((b: any) => b.estimated),
    },
  };
}

export async function saveBranch(tenantId: string, input: any) {
  await tenant(tenantId);
  const x = branchSchema.parse(input),
    plan = await tenantPlan(tenantId),
    limit = PLAN_LIMITS[plan].branches;
  if (x.id) {
    await ownedBranch(tenantId, x.id);
    const r = await q(
      "UPDATE branches SET name=?,city=?,address=?,phone=?,active=? WHERE tenant_id=? AND id=?",
      x.name,
      x.city,
      x.address,
      x.phone,
      x.active,
      tenantId,
      x.id,
    ).run();
    if (!r.meta.changes) throw new ApiError("Şube bulunamadı.", 404);
    return { ok: true, id: x.id };
  }
  const count = Number(
    (
      await one(
        "SELECT COUNT(*) n FROM branches WHERE tenant_id=? AND active=1",
        tenantId,
      )
    ).n,
  );
  if (limit !== null && count >= limit)
    throw new ApiError(
      `${PLAN_LIMITS[plan].label} paketi en fazla ${limit} şube destekler. Yeni şube için paketinizi yükseltin.`,
      403,
    );
  const id = uid();
  await q(
    "INSERT INTO branches(id,tenant_id,name,city,address,phone,active,is_primary,created_at) VALUES(?,?,?,?,?,?,1,0,?)",
    id,
    tenantId,
    x.name,
    x.city,
    x.address,
    x.phone,
    now(),
  ).run();
  return { ok: true, id };
}

export async function saveBranchExpense(tenantId: string, input: any) {
  await requirePlanModule(tenantId, "branchProfit");
  const x = expenseSchema.parse(input);
  await ownedBranch(tenantId, x.branch_id);
  if (x.catalog_item_id) {
    const item = await one(
      "SELECT id FROM expense_catalog_items WHERE tenant_id=? AND id=? AND active=1",
      tenantId,
      x.catalog_item_id,
    );
    if (!item) throw new ApiError("Kayıtlı gider kalemi bulunamadı.", 404);
  }
  const id = x.id || uid(),
    stamp = now();
  const r = x.id
    ? await q(
        "UPDATE branch_expenses SET branch_id=?,month=?,category=?,amount=?,catalog_item_id=?,quantity=?,unit=?,note=?,updated_at=? WHERE tenant_id=? AND id=?",
        x.branch_id,
        x.month,
        x.category,
        x.amount,
        x.catalog_item_id || null,
        x.quantity,
        x.unit,
        x.note,
        stamp,
        tenantId,
        x.id,
      ).run()
    : await q(
        "INSERT INTO branch_expenses(id,tenant_id,branch_id,month,category,amount,catalog_item_id,quantity,unit,note,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
        id,
        tenantId,
        x.branch_id,
        x.month,
        x.category,
        x.amount,
        x.catalog_item_id || null,
        x.quantity,
        x.unit,
        x.note,
        stamp,
        stamp,
      ).run();
  if (!r.meta.changes) throw new ApiError("Gider kaydı bulunamadı.", 404);
  await q(
    "INSERT INTO branch_month_closings(tenant_id,branch_id,month,expenses_confirmed) VALUES(?,?,?,0) ON CONFLICT(tenant_id,branch_id,month) DO UPDATE SET expenses_confirmed=0,confirmed_at=NULL",
    tenantId,
    x.branch_id,
    x.month,
  ).run();
  return { ok: true, id };
}

export async function saveExpenseCatalogItem(tenantId: string, input: any) {
  // Muhasebe kataloğu: tekrar kullanılabilir gider kalemleri yalnızca Plus paketinde.
  await requirePlanModule(tenantId, "accounting");
  const x = catalogSchema.parse(input),
    id = x.id || uid(),
    stamp = now();
  if (!x.id && (!x.apply_to_branch_id || !x.apply_month))
    throw new ApiError("Giderin ekleneceği şube ve ay seçilmelidir.", 400);
  if (!x.id) await ownedBranch(tenantId, x.apply_to_branch_id!);
  try {
    if (x.id) {
      const result = await q(
          "UPDATE expense_catalog_items SET name=?,category=?,unit=?,default_unit_amount=?,note=?,updated_at=? WHERE tenant_id=? AND id=?",
          x.name,
          x.category,
          x.unit,
          x.default_unit_amount,
          x.note,
          stamp,
          tenantId,
          x.id,
        ).run();
      if (!result.meta.changes)
        throw new ApiError("Gider kalemi bulunamadı.", 404);
    } else {
      const expenseId = uid();
      await db().batch([
        q(
          "INSERT INTO expense_catalog_items(id,tenant_id,name,category,unit,default_unit_amount,note,active,created_at,updated_at) VALUES(?,?,?,?,?,?,?,1,?,?)",
          id,
          tenantId,
          x.name,
          x.category,
          x.unit,
          x.default_unit_amount,
          x.note,
          stamp,
          stamp,
        ),
        q(
          "INSERT INTO branch_expenses(id,tenant_id,branch_id,month,category,amount,catalog_item_id,quantity,unit,note,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
          expenseId,
          tenantId,
          x.apply_to_branch_id,
          x.apply_month,
          x.category,
          Math.round(x.default_unit_amount * x.quantity),
          id,
          x.quantity,
          x.unit,
          x.note,
          stamp,
          stamp,
        ),
        q(
          "INSERT INTO branch_month_closings(tenant_id,branch_id,month,expenses_confirmed) VALUES(?,?,?,0) ON CONFLICT(tenant_id,branch_id,month) DO UPDATE SET expenses_confirmed=0,confirmed_at=NULL",
          tenantId,
          x.apply_to_branch_id,
          x.apply_month,
        ),
      ]);
      return { ok: true, id, expense_id: expenseId };
    }
    return { ok: true, id };
  } catch (error: any) {
    if (String(error?.message || error).includes("UNIQUE"))
      throw new ApiError("Bu isimde bir gider kalemi zaten var.", 409);
    throw error;
  }
}

export async function branchAction(tenantId: string, input: any) {
  await tenant(tenantId);
  const x = z
    .discriminatedUnion("action", [
      z.object({ action: z.literal("delete-expense"), id: z.string().min(1) }),
      z.object({
        action: z.literal("confirm-expenses"),
        branch_id: z.string().min(1),
        month: monthSchema,
      }),
    ])
    .parse(input);
  if (x.action === "delete-expense") {
    const row = await one(
      "SELECT branch_id,month FROM branch_expenses WHERE tenant_id=? AND id=?",
      tenantId,
      x.id,
    );
    if (!row) throw new ApiError("Gider kaydı bulunamadı.", 404);
    await db().batch([
      q(
        "DELETE FROM branch_expenses WHERE tenant_id=? AND id=?",
        tenantId,
        x.id,
      ),
      q(
        "INSERT INTO branch_month_closings(tenant_id,branch_id,month,expenses_confirmed) VALUES(?,?,?,0) ON CONFLICT(tenant_id,branch_id,month) DO UPDATE SET expenses_confirmed=0,confirmed_at=NULL",
        tenantId,
        row.branch_id,
        row.month,
      ),
    ]);
    return { ok: true };
  }
  await ownedBranch(tenantId, x.branch_id);
  await q(
    "INSERT INTO branch_month_closings(tenant_id,branch_id,month,expenses_confirmed,confirmed_at) VALUES(?,?,?,1,?) ON CONFLICT(tenant_id,branch_id,month) DO UPDATE SET expenses_confirmed=1,confirmed_at=excluded.confirmed_at",
    tenantId,
    x.branch_id,
    x.month,
    now(),
  ).run();
  return { ok: true };
}
