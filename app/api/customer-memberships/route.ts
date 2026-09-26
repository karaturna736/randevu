import { admin, all, fail, ok, one } from "@/lib/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await admin();

    const [memberships, totals] = await Promise.all([
      all(`
        SELECT
          cm.tenant_id,
          cm.user_id,
          cm.customer_id,
          cm.joined_at,
          cm.updated_at,
          b.name business_name,
          b.slug business_slug,
          b.category business_category,
          b.city business_city,
          b.status business_status,
          p.name account_name,
          p.email account_email,
          p.phone account_phone,
          p.disabled account_disabled,
          c.name customer_name,
          c.phone customer_phone,
          c.email customer_email,
          (SELECT COUNT(*)
             FROM appointments a
            WHERE a.tenant_id=cm.tenant_id AND a.customer_id=cm.customer_id) appointment_count,
          (SELECT COUNT(*)
             FROM account_bookings ab
            WHERE ab.tenant_id=cm.tenant_id AND ab.user_id=cm.user_id) linked_booking_count,
          (SELECT MAX(a.date)
             FROM appointments a
            WHERE a.tenant_id=cm.tenant_id AND a.customer_id=cm.customer_id) last_appointment_date,
          COALESCE((SELECT SUM(a.price)
             FROM appointments a
            WHERE a.tenant_id=cm.tenant_id AND a.customer_id=cm.customer_id AND a.status='completed'),0) completed_revenue
        FROM customer_memberships cm
        JOIN businesses b ON b.id=cm.tenant_id
        JOIN profiles p ON p.user_id=cm.user_id
        JOIN customers c ON c.tenant_id=cm.tenant_id AND c.id=cm.customer_id
        ORDER BY p.name COLLATE NOCASE,b.name COLLATE NOCASE
        LIMIT 2000
      `),
      one(`
        SELECT
          (SELECT COUNT(*) FROM customer_memberships) memberships,
          (SELECT COUNT(DISTINCT user_id) FROM customer_memberships) accounts,
          (SELECT COUNT(*) FROM (
             SELECT user_id FROM customer_memberships GROUP BY user_id HAVING COUNT(*)>1
           )) multi_business_accounts,
          (SELECT COALESCE(MAX(n),0) FROM (
             SELECT COUNT(*) n FROM customer_memberships GROUP BY user_id
           )) max_businesses_per_account
      `),
    ]);

    return ok({ memberships, totals });
  } catch (e) {
    return fail(e);
  }
}
