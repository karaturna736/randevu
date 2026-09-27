import { z } from "zod";
import { all, one, q, user, tenant, date, ApiError } from "./server";
import { SELECT_APPOINTMENTS, change } from "./booking";
import { today, addDays } from "./types";
import { branchPasswordConfigured, verifyBranchAccessPassword } from "./branch-access";
import { PLAN_LIMITS, tenantPlan } from "./entitlements";
import { waConnection, waReady } from "./whatsapp";

const passwordInput = z.string().min(8).max(72);

function sanitizeAppointment(a: any) {
  const operational = { ...a };
  delete operational.price;
  delete operational.deposit_amount;
  delete operational.payment_status;
  return operational;
}

export async function teamAccess(id: string) {
  await tenant(id);
  return {
    members: await all(
      `SELECT m.user_id,m.email,m.name,m.staff_id,m.branch_id,m.disabled,
        p.name staff_name,br.name branch_name
       FROM members m
       LEFT JOIN staff p ON p.tenant_id=m.tenant_id AND p.id=m.staff_id
       LEFT JOIN branches br ON br.tenant_id=m.tenant_id AND br.id=COALESCE(m.branch_id,p.branch_id)
       WHERE m.tenant_id=? AND m.role='staff'`,
      id,
    ),
  };
}

export async function setTeamAccess(id: string, x: any) {
  await tenant(id);
  const person = z.string().parse(x.staff_id);
  const staffRow = await one(
    "SELECT id,branch_id FROM staff WHERE tenant_id=? AND id=?",
    id,
    person,
  );
  if (!staffRow) throw new ApiError("Personel bulunamadı.", 404);
  if (x.action === "remove") {
    await q(
      "UPDATE members SET disabled=1 WHERE tenant_id=? AND staff_id=? AND role='staff'",
      id,
      person,
    ).run();
    return { ok: true };
  }

  const branchId =
    staffRow.branch_id ||
    (await one(
      "SELECT id FROM branches WHERE tenant_id=? AND active=1 ORDER BY is_primary DESC,name LIMIT 1",
      id,
    ))?.id;
  if (!branchId)
    throw new ApiError("Personeli önce aktif bir şubeye bağlayın.", 409);
  if (!(await branchPasswordConfigured(id, branchId)))
    throw new ApiError(
      "Personel hesabını bağlamadan önce bu şube için erişim şifresi belirleyin.",
      409,
    );

  const email = z.string().email().max(254).parse(x.email).toLowerCase();
  const matches = await all(
    "SELECT user_id,name,email FROM profiles WHERE lower(email)=? AND disabled=0 LIMIT 2",
    email,
  );
  if (matches.length !== 1)
    throw new ApiError("Personel önce bu e-posta ile üyeliğini tamamlamalı.");
  const p = matches[0],
    existing = await one(
      "SELECT role FROM members WHERE tenant_id=? AND user_id=?",
      id,
      p.user_id,
    );
  if (existing?.role === "owner")
    throw new ApiError(
      "İşletme sahibinin yetkisi personel erişimine dönüştürülemez.",
    );
  const assigned = await one(
    "SELECT user_id FROM members WHERE tenant_id=? AND staff_id=? AND role='staff' AND disabled=0 AND user_id!=?",
    id,
    person,
    p.user_id,
  );
  if (assigned)
    throw new ApiError(
      "Bu personelin başka bir hesabı bağlı. Önce mevcut erişimi kaldırın.",
      409,
    );
  await q(
    `INSERT INTO members(tenant_id,user_id,email,name,role,staff_id,branch_id,disabled)
     VALUES(?,?,?,?,'staff',?,?,0)
     ON CONFLICT(tenant_id,user_id) DO UPDATE SET
       staff_id=excluded.staff_id,branch_id=excluded.branch_id,email=excluded.email,
       name=excluded.name,disabled=0 WHERE members.role='staff'`,
    id,
    p.user_id,
    p.email,
    p.name,
    person,
    branchId,
  ).run();
  return { ok: true };
}

async function assignments() {
  const u = await user();
  return {
    u,
    rows: await all(
      `SELECT b.id,b.name,b.slug,m.staff_id,p.name staff_name,
        COALESCE(m.branch_id,p.branch_id) branch_id,br.name branch_name,
        CASE WHEN bp.password_hash IS NULL THEN 0 ELSE 1 END password_configured
       FROM members m
       JOIN businesses b ON b.id=m.tenant_id
       JOIN staff p ON p.tenant_id=m.tenant_id AND p.id=m.staff_id
       LEFT JOIN branches br ON br.tenant_id=m.tenant_id AND br.id=COALESCE(m.branch_id,p.branch_id)
       LEFT JOIN branch_manager_passwords bp ON bp.tenant_id=m.tenant_id AND bp.branch_id=COALESCE(m.branch_id,p.branch_id)
       WHERE m.user_id=? AND m.role='staff' AND m.disabled=0 AND p.active=1
         AND b.status NOT IN ('deleted','suspended')`,
      u.userId,
    ),
  };
}

async function staffAccess(id: string, password?: string) {
  const { u, rows } = await assignments();
  if (!rows.length) throw new ApiError("Ekip erişimi bulunamadı.", 403);
  const assignment = rows.find((b: any) => b.id === id);
  if (!assignment) throw new ApiError("Ekip erişimi reddedildi.", 403);
  if (!assignment.branch_id)
    throw new ApiError("Personel hesabı bir şubeye bağlı değil.", 409);
  await verifyBranchAccessPassword(id, assignment.branch_id, password);
  return { u, rows, assignment };
}

export async function teamJobs(id: string, d: string, password?: string) {
  const { u, rows, assignment } = await staffAccess(id, password);
  const day = date.parse(d || today());
  if (day < addDays(today(), -90) || day > addDays(today(), 90))
    throw new ApiError("90 günlük aralıkta bir tarih seçin.");
  const appointments = await all(
    SELECT_APPOINTMENTS +
      " WHERE a.tenant_id=? AND a.staff_id=? AND a.branch_id=? AND a.date=? ORDER BY a.minute LIMIT 100",
    id,
    assignment.staff_id,
    assignment.branch_id,
    day,
  );
  return {
    businesses: rows,
    business: assignment,
    user: u,
    appointments: appointments.map(sanitizeAppointment),
  };
}

export async function staffWorkspace(
  id: string,
  d: string,
  password?: string,
) {
  const { u, rows, assignment } = await staffAccess(id, password);
  const day = date.parse(d || today());
  if (day < addDays(today(), -90) || day > addDays(today(), 90))
    throw new ApiError("90 günlük aralıkta bir tarih seçin.");

  const branchId = String(assignment.branch_id);
  const appointments = (
    await all(
      SELECT_APPOINTMENTS +
        " WHERE a.tenant_id=? AND a.branch_id=? AND a.date=? ORDER BY a.minute LIMIT 300",
      id,
      branchId,
      day,
    )
  ).map(sanitizeAppointment);
  const customers = await all(
    `SELECT c.id,c.name,c.phone,MAX(a.date) last_visit,COUNT(*) appointment_count
     FROM customers c JOIN appointments a ON a.tenant_id=c.tenant_id AND a.customer_id=c.id
     WHERE c.tenant_id=? AND a.branch_id=?
     GROUP BY c.id,c.name,c.phone ORDER BY MAX(a.date) DESC,c.name LIMIT 500`,
    id,
    branchId,
  );
  const services = await all(
    "SELECT id,name,duration,active FROM services WHERE tenant_id=? AND active=1 ORDER BY name LIMIT 300",
    id,
  );
  const staff = await all(
    `SELECT id,name,title,active FROM staff
     WHERE tenant_id=? AND active=1 AND (branch_id=? OR id=?)
     ORDER BY name LIMIT 300`,
    id,
    branchId,
    assignment.staff_id,
  );

  const plan = await tenantPlan(id);
  const modules = PLAN_LIMITS[plan].modules;
  const journeys = modules.journeys
    ? await all(
        `SELECT j.id,j.customer_id,j.title,j.status,j.updated_at,c.name customer_name
         FROM journeys j JOIN customers c ON c.tenant_id=j.tenant_id AND c.id=j.customer_id
         WHERE j.tenant_id=? AND EXISTS(
           SELECT 1 FROM appointments a
           WHERE a.tenant_id=j.tenant_id AND a.customer_id=j.customer_id AND a.branch_id=?
         ) ORDER BY j.updated_at DESC LIMIT 300`,
        id,
        branchId,
      )
    : [];
  const journeySteps = modules.journeys
    ? await all(
        `SELECT s.id,s.journey_id,s.position,s.title,s.due_date,s.completed_at
         FROM journey_steps s JOIN journeys j ON j.tenant_id=s.tenant_id AND j.id=s.journey_id
         WHERE s.tenant_id=? AND EXISTS(
           SELECT 1 FROM appointments a
           WHERE a.tenant_id=j.tenant_id AND a.customer_id=j.customer_id AND a.branch_id=?
         ) ORDER BY s.journey_id,s.position LIMIT 1500`,
        id,
        branchId,
      )
    : [];

  const connection = modules.whatsapp ? waConnection(id) : undefined;
  const whatsappMessages = modules.whatsapp
    ? await all(
        `SELECT wm.id,'•••• '||substr(wm.phone,-4) phone,wm.status,wm.appointment_id,wm.created_at,wm.sent_at
         FROM wa_messages wm JOIN appointments a ON a.tenant_id=wm.tenant_id AND a.id=wm.appointment_id
         WHERE wm.tenant_id=? AND a.branch_id=? ORDER BY wm.created_at DESC LIMIT 50`,
        id,
        branchId,
      )
    : [];

  return {
    businesses: rows,
    business: assignment,
    user: u,
    date: day,
    appointments,
    customers,
    services,
    staff,
    journeys: {
      enabled: modules.journeys,
      rows: journeys,
      steps: journeySteps,
    },
    whatsapp: {
      enabled: modules.whatsapp,
      connected: modules.whatsapp ? waReady(id) : false,
      number: connection?.number || null,
      messages: whatsappMessages,
    },
    permissions: {
      settings: false,
      financials: false,
      manage_staff: false,
      manage_services: false,
      manage_customers: false,
      manage_journeys: false,
      manage_whatsapp: false,
      can_finish_own_appointments: true,
    },
  };
}

export async function finishTeamJob(id: string, x: any) {
  const password = passwordInput.parse(x.branch_password);
  const { assignment } = await staffAccess(id, password);
  const a = await one(
    SELECT_APPOINTMENTS +
      " WHERE a.tenant_id=? AND a.staff_id=? AND a.branch_id=? AND a.id=?",
    id,
    assignment.staff_id,
    assignment.branch_id,
    z.string().parse(x.id),
  );
  if (!a) throw new ApiError("İşlem bulunamadı.", 404);
  const status = z.enum(["completed", "no_show"]).parse(x.status),
    b = await one("SELECT * FROM businesses WHERE id=?", id);
  return change(b, a, { status });
}
