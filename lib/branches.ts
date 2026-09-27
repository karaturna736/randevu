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

const EXPENSE_CATEGORIES = [
  "kira",
  "personel",
  "malzeme",
  "fatura",
  "pazarlama",
  "vergi",
  "diger",
] as const;
const EXPENSE_LABELS: Record<(typeof EXPENSE_CATEGORIES)[number], string> = {
  kira: "Kira gideri farkı",
  personel: "Personel gideri farkı",
  malzeme: "Malzeme gideri farkı",
  fatura: "Fatura gideri farkı",
  pazarlama: "Pazarlama gideri farkı",
  vergi: "Vergi gideri farkı",
  diger: "Diğer gider farkı",
};

async function ownedBranch(tenantId: string, branchId: string) {
  const branch = await one(
    "SELECT * FROM branches WHERE tenant_id=? AND id=?",
    tenantId,
    branchId,
  );
  if (!branch) throw new ApiError("Şube bulunamadı.", 404);
  return branch;
}

function percentage(value: number) {
  return Math.round(value * 1000) / 10;
}

export async function branchSnapshot(tenantId: string, monthInput?: string) {
  await tenant(tenantId);
  const month = monthSchema.parse(
      monthInput || new Date().toISOString().slice(0, 7),
    ),
    plan = await tenantPlan(tenantId),
    limits = PLAN_LIMITS[plan],
    monthStart = month + "-01";

  const branches = await all(
    `SELECT b.*,
  COALESCE((SELECT SUM(a.price) FROM appointments a WHERE a.tenant_id=b.tenant_id AND a.branch_id=b.id AND a.status='completed' AND substr(a.date,1,7)=?),0) revenue,
  COALESCE((SELECT SUM(e.amount) FROM branch_expenses e WHERE e.tenant_id=b.tenant_id AND e.branch_id=b.id AND e.month=?),0) expenses,
  COALESCE((SELECT COUNT(*) FROM appointments a WHERE a.tenant_id=b.tenant_id AND a.branch_id=b.id AND a.status='completed' AND substr(a.date,1,7)=?),0) completed,
  COALESCE((SELECT SUM(a.duration) FROM appointments a WHERE a.tenant_id=b.tenant_id AND a.branch_id=b.id AND a.status='completed' AND substr(a.date,1,7)=?),0) completed_minutes,
  COALESCE((SELECT COUNT(*) FROM appointments a WHERE a.tenant_id=b.tenant_id AND a.branch_id=b.id AND a.status='no_show' AND substr(a.date,1,7)=?),0) no_show,
  COALESCE((SELECT COUNT(*) FROM appointments a WHERE a.tenant_id=b.tenant_id AND a.branch_id=b.id AND a.status='cancelled' AND substr(a.date,1,7)=?),0) cancelled,
  COALESCE((SELECT COUNT(DISTINCT a.customer_id) FROM appointments a WHERE a.tenant_id=b.tenant_id AND a.branch_id=b.id AND a.status='completed' AND substr(a.date,1,7)=?),0) unique_customers,
  COALESCE((SELECT COUNT(*) FROM staff s WHERE s.tenant_id=b.tenant_id AND s.branch_id=b.id),0) staff_count,
  COALESCE((SELECT expenses_confirmed FROM branch_month_closings c WHERE c.tenant_id=b.tenant_id AND c.branch_id=b.id AND c.month=?),0) expenses_confirmed
 FROM branches b WHERE b.tenant_id=? ORDER BY b.is_primary DESC,b.name`,
    month,
    month,
    month,
    month,
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
  const serviceStats = await all(
    `SELECT a.branch_id,a.service_id,COALESCE(s.name,'Hizmet') service_name,COUNT(*) completed,COALESCE(SUM(a.price),0) revenue
     FROM appointments a
     LEFT JOIN services s ON s.tenant_id=a.tenant_id AND s.id=a.service_id
     WHERE a.tenant_id=? AND a.status='completed' AND substr(a.date,1,7)=?
     GROUP BY a.branch_id,a.service_id,s.name`,
    tenantId,
    month,
  );
  const expenseStats = await all(
    "SELECT branch_id,category,COALESCE(SUM(amount),0) amount FROM branch_expenses WHERE tenant_id=? AND month=? GROUP BY branch_id,category",
    tenantId,
    month,
  );
  const returningStats = await all(
    `SELECT a.branch_id,COUNT(DISTINCT a.customer_id) returning_customers
     FROM appointments a
     WHERE a.tenant_id=? AND a.status='completed' AND substr(a.date,1,7)=?
       AND EXISTS (
         SELECT 1 FROM appointments previous
         WHERE previous.tenant_id=a.tenant_id
           AND previous.customer_id=a.customer_id
           AND previous.status='completed'
           AND previous.date<?
       )
     GROUP BY a.branch_id`,
    tenantId,
    month,
    monthStart,
  );

  const catalog = limits.modules.accounting
    ? await all(
        "SELECT * FROM expense_catalog_items WHERE tenant_id=? AND active=1 ORDER BY category,name",
        tenantId,
      )
    : [];

  const expenseByBranch = new Map<string, Record<string, number>>();
  for (const row of expenseStats) {
    const current = expenseByBranch.get(String(row.branch_id)) || {};
    current[String(row.category)] = Number(row.amount || 0);
    expenseByBranch.set(String(row.branch_id), current);
  }
  const servicesByBranch = new Map<string, any[]>();
  for (const row of serviceStats) {
    const key = String(row.branch_id || "");
    const current = servicesByBranch.get(key) || [];
    current.push({
      id: row.service_id,
      name: row.service_name,
      completed: Number(row.completed || 0),
      revenue: Number(row.revenue || 0),
    });
    servicesByBranch.set(key, current);
  }
  const returningByBranch = new Map(
    returningStats.map((row: any) => [
      String(row.branch_id),
      Number(row.returning_customers || 0),
    ]),
  );

  const rows = branches.map((b: any) => {
    const revenue = Number(b.revenue || 0),
      expensesTotal = Number(b.expenses || 0),
      completed = Number(b.completed || 0),
      completedMinutes = Number(b.completed_minutes || 0),
      noShow = Number(b.no_show || 0),
      uniqueCustomers = Number(b.unique_customers || 0),
      returningCustomers = returningByBranch.get(String(b.id)) || 0,
      serviceRows = servicesByBranch.get(String(b.id)) || [],
      topService = [...serviceRows].sort(
        (a, c) => c.revenue - a.revenue || c.completed - a.completed,
      )[0],
      expenseMap = EXPENSE_CATEGORIES.reduce(
        (acc, category) => {
          acc[category] = Number(
            expenseByBranch.get(String(b.id))?.[category] || 0,
          );
          return acc;
        },
        {} as Record<string, number>,
      ),
      net = revenue - expensesTotal,
      avgTicketRaw = completed ? revenue / completed : 0,
      noShowBase = completed + noShow;
    return {
      ...b,
      revenue,
      expenses: expensesTotal,
      net,
      completed,
      completed_minutes: completedMinutes,
      no_show: noShow,
      cancelled: Number(b.cancelled || 0),
      unique_customers: uniqueCustomers,
      returning_customers: returningCustomers,
      staff_count: Number(b.staff_count || 0),
      avg_ticket: Math.round(avgTicketRaw),
      revenue_per_hour: completedMinutes
        ? Math.round((revenue * 60) / completedMinutes)
        : 0,
      no_show_rate: noShowBase ? percentage(noShow / noShowBase) : 0,
      returning_rate: uniqueCustomers
        ? percentage(returningCustomers / uniqueCustomers)
        : 0,
      net_margin: revenue ? percentage(net / revenue) : 0,
      expense_by_category: expenseMap,
      top_service: topService
        ? {
            ...topService,
            revenue_share: revenue
              ? percentage(Number(topService.revenue) / revenue)
              : 0,
          }
        : null,
      estimated: Number(b.expenses_confirmed) !== 1,
      _avg_ticket_raw: avgTicketRaw,
    };
  });

  const ordered = [...rows].sort(
    (a: any, b: any) => b.net - a.net || b.revenue - a.revenue,
  );
  const leader = ordered[0] || null;
  const comparisons = leader
    ? ordered.slice(1).map((target: any) => {
        const volumeEffect = Math.round(
            (leader.completed - target.completed) *
              ((leader._avg_ticket_raw + target._avg_ticket_raw) / 2),
          ),
          ticketEffect = Math.round(
            (leader._avg_ticket_raw - target._avg_ticket_raw) *
              ((leader.completed + target.completed) / 2),
          ),
          factors: any[] = [
            {
              key: "volume",
              label: "Tamamlanan işlem sayısı",
              amount: volumeEffect,
              leader_value: leader.completed,
              target_value: target.completed,
              unit: "işlem",
            },
            {
              key: "ticket",
              label: "Ortalama işlem tutarı / hizmet karması",
              amount: ticketEffect,
              leader_value: leader.avg_ticket,
              target_value: target.avg_ticket,
              unit: "money",
            },
          ];
        for (const category of EXPENSE_CATEGORIES) {
          const leaderExpense = Number(
              leader.expense_by_category?.[category] || 0,
            ),
            targetExpense = Number(target.expense_by_category?.[category] || 0),
            amount = targetExpense - leaderExpense;
          if (amount)
            factors.push({
              key: "expense:" + category,
              label: EXPENSE_LABELS[category],
              amount,
              leader_value: leaderExpense,
              target_value: targetExpense,
              unit: "money",
            });
        }
        const net_difference = leader.net - target.net,
          explained = factors.reduce(
            (sum: number, factor: any) => sum + Number(factor.amount || 0),
            0,
          ),
          remainder = net_difference - explained;
        if (Math.abs(remainder) > 1)
          factors.push({
            key: "other",
            label: "Diğer / yuvarlama farkı",
            amount: remainder,
            leader_value: null,
            target_value: null,
            unit: "money",
          });
        const signals: string[] = [];
        if (target.no_show_rate - leader.no_show_rate >= 2)
          signals.push(
            `${leader.name} şubesinin gelmeme oranı daha düşük (%${leader.no_show_rate} / %${target.no_show_rate}).`,
          );
        if (leader.returning_rate - target.returning_rate >= 5)
          signals.push(
            `${leader.name} şubesinde geri dönen müşteri oranı daha yüksek (%${leader.returning_rate} / %${target.returning_rate}).`,
          );
        if (
          target.revenue_per_hour > 0 &&
          leader.revenue_per_hour >= target.revenue_per_hour * 1.05
        )
          signals.push(
            `${leader.name} tamamlanan hizmet saati başına daha fazla ciro üretiyor.`,
          );
        if (leader.top_service)
          signals.push(
            `${leader.name} şubesinde en çok ciro üreten hizmet ${leader.top_service.name}; şube cirosunun %${leader.top_service.revenue_share} payına sahip.`,
          );
        return {
          leader: {
            id: leader.id,
            name: leader.name,
            net: leader.net,
            revenue: leader.revenue,
            expenses: leader.expenses,
          },
          target: {
            id: target.id,
            name: target.name,
            net: target.net,
            revenue: target.revenue,
            expenses: target.expenses,
          },
          net_difference,
          factors: factors
            .filter((factor: any) => factor.amount !== 0)
            .sort(
              (a: any, b: any) => Math.abs(b.amount) - Math.abs(a.amount),
            ),
          signals: signals.slice(0, 4),
        };
      })
    : [];

  const publicRows = rows.map(({ _avg_ticket_raw, ...row }: any) => row);
  return {
    month,
    plan,
    limits,
    branches: publicRows,
    expenses,
    catalog,
    analysis: {
      method: "deterministic",
      leader: leader
        ? {
            id: leader.id,
            name: leader.name,
            net: leader.net,
          }
        : null,
      comparisons,
    },
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