export async function seedPaidBusiness(
  db,
  {
    id,
    userId,
    name,
    slug,
    category = "Kuaför & Berber",
    city = "",
    status = "pending",
    plan = "pro",
    paidForMs = 90 * 86400000,
  },
) {
  const createdAt = new Date().toISOString();
  const paidUntil = new Date(Date.now() + paidForMs).toISOString();

  await db.batch([
    db
      .prepare(
        "INSERT INTO businesses(id,name,slug,category,city,status,demo,hours,selected_plan,created_at) VALUES(?,?,?,?,?,?,0,'{}',?,?)",
      )
      .bind(id, name, slug, category, city, status, plan, createdAt),
    db
      .prepare(
        "INSERT INTO members(tenant_id,user_id,email,name,role) VALUES(?,?,?,?, 'owner')",
      )
      .bind(id, userId, `${userId}@example.test`, `${name} sahibi`),
    db
      .prepare(
        "INSERT INTO subscriptions(tenant_id,paid_until,updated_at) VALUES(?,?,?)",
      )
      .bind(id, paidUntil, createdAt),
  ]);

  return id;
}
