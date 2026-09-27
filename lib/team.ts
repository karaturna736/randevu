import { z } from 'zod';
import { all, one, q, user, tenant, date, ApiError } from './server';
import { SELECT_APPOINTMENTS, change } from './booking';
import { today, addDays } from './types';
import { PLAN_LIMITS, tenantPlan } from './entitlements';
import { verifyBranchAccessPassword, validateBranchPasswordInput } from './branch-access';
import { waConnection, waReady } from './whatsapp';

export async function teamAccess(id: string) {
  await tenant(id);
  return { members: await all("SELECT m.user_id,m.email,m.name,m.staff_id,m.disabled,s.branch_id,br.name branch_name,CASE WHEN bp.password_hash IS NULL THEN 0 ELSE 1 END password_configured FROM members m LEFT JOIN staff s ON s.tenant_id=m.tenant_id AND s.id=m.staff_id LEFT JOIN branches br ON br.tenant_id=s.tenant_id AND br.id=s.branch_id LEFT JOIN branch_manager_passwords bp ON bp.tenant_id=s.tenant_id AND bp.branch_id=s.branch_id WHERE m.tenant_id=? AND m.role='staff'", id) };
}

export async function setTeamAccess(id: string, x: any) {
  await tenant(id);
  const person = z.string().parse(x.staff_id);
  const staff = await one('SELECT id,branch_id FROM staff WHERE tenant_id=? AND id=?', id, person);
  if (!staff) throw new ApiError('Personel bulunamadı.', 404);
  if (x.action === 'remove') {
    await q("UPDATE members SET disabled=1 WHERE tenant_id=? AND staff_id=? AND role='staff'", id, person).run();
    return { ok: true };
  }
  if (!staff.branch_id) throw new ApiError('Önce personeli bir şubeye bağlayın.', 409);
  if (!(await one('SELECT 1 ok FROM branch_manager_passwords WHERE tenant_id=? AND branch_id=?', id, staff.branch_id))) throw new ApiError('Çalışan hesabını bağlamadan önce bu şube için erişim şifresi belirleyin.', 409);
  const email = z.string().email().max(254).parse(x.email).toLowerCase();
  const matches = await all('SELECT user_id,name,email FROM profiles WHERE lower(email)=? AND disabled=0 LIMIT 2', email);
  if (matches.length !== 1) throw new ApiError('Personel önce bu e-posta ile üyeliğini tamamlamalı.');
  const p = matches[0], existing = await one('SELECT role FROM members WHERE tenant_id=? AND user_id=?', id, p.user_id);
  if (existing?.role === 'owner') throw new ApiError('İşletme sahibinin yetkisi personel erişimine dönüştürülemez.');
  if (existing?.role === 'manager') throw new ApiError('Müdür hesabı aynı anda çalışan hesabı olarak bağlanamaz.', 409);
  const assigned = await one("SELECT user_id FROM members WHERE tenant_id=? AND staff_id=? AND role='staff' AND disabled=0 AND user_id!=?", id, person, p.user_id);
  if (assigned) throw new ApiError('Bu personelin başka bir hesabı bağlı. Önce mevcut erişimi kaldırın.', 409);
  await q(`INSERT INTO members(tenant_id,user_id,email,name,role,staff_id,disabled) VALUES(?,?,?,?,'staff',?,0)
    ON CONFLICT(tenant_id,user_id) DO UPDATE SET staff_id=excluded.staff_id,email=excluded.email,name=excluded.name,disabled=0 WHERE members.role='staff'`, id, p.user_id, p.email, p.name, person).run();
  return { ok: true };
}

async function assignments() {
  const u = await user();
  return { u, rows: await all(`SELECT b.id,b.name,b.slug,b.category,m.staff_id,p.name staff_name,p.branch_id,br.name branch_name
    FROM members m JOIN businesses b ON b.id=m.tenant_id
    JOIN staff p ON p.tenant_id=m.tenant_id AND p.id=m.staff_id
    JOIN branches br ON br.tenant_id=p.tenant_id AND br.id=p.branch_id AND br.active=1
    WHERE m.user_id=? AND m.role='staff' AND m.disabled=0 AND p.active=1 AND b.status NOT IN ('deleted','suspended')`, u.userId) };
}

function operationalAppointment(a: any) {
  const row = { ...a };
  delete row.price; delete row.deposit_amount; delete row.payment_status; delete row.token_hash;
  return row;
}

export async function teamJobs(id: string, d: string) {
  const { u, rows } = await assignments();
  if (!rows.length) return { businesses: [], appointments: [], user: u, password_required: false };
  const b = id ? rows.find((row: any) => row.id === id) : rows[0];
  if (!b) throw new ApiError('Ekip erişimi reddedildi.', 403);
  if (d) date.parse(d);
  return { businesses: rows.map((row: any) => ({ id: row.id, name: row.name, branch_name: row.branch_name })), business: { id: b.id, name: b.name, branch_name: b.branch_name, staff_name: b.staff_name }, appointments: [], user: u, password_required: true };
}

export async function teamWorkspace(id: string, d: string, rawPassword: unknown) {
  const { u, rows } = await assignments();
  if (!rows.length) throw new ApiError('Bu hesaba bağlı çalışan erişimi yok.', 403);
  const b = id ? rows.find((row: any) => row.id === id) : rows[0];
  if (!b) throw new ApiError('Ekip erişimi reddedildi.', 403);
  await verifyBranchAccessPassword(b.id, b.branch_id, rawPassword);
  const day = date.parse(d || today());
  if (day < addDays(today(), -90) || day > addDays(today(), 90)) throw new ApiError('90 günlük aralıkta bir tarih seçin.');
  const plan = await tenantPlan(b.id), modules = PLAN_LIMITS[plan].modules;
  const appointments = (await all(SELECT_APPOINTMENTS + ' WHERE a.tenant_id=? AND a.branch_id=? AND a.date=? ORDER BY a.minute LIMIT 250', b.id, b.branch_id, day)).map(operationalAppointment);
  const customers = await all(`SELECT c.id,c.name,c.phone,c.email,MAX(a.date) last_visit FROM customers c JOIN appointments a ON a.tenant_id=c.tenant_id AND a.customer_id=c.id WHERE c.tenant_id=? AND a.branch_id=? GROUP BY c.id,c.name,c.phone,c.email ORDER BY c.name LIMIT 500`, b.id, b.branch_id);
  const services = await all('SELECT id,name,description,duration,price,active FROM services WHERE tenant_id=? AND active=1 ORDER BY name', b.id);
  const staff = await all('SELECT id,name,title,active FROM staff WHERE tenant_id=? AND branch_id=? AND active=1 ORDER BY name', b.id, b.branch_id);
  const journeys = modules.journeys ? await all(`SELECT DISTINCT j.id,j.customer_id,j.title,j.template,j.status,j.version,j.updated_at,c.name customer_name FROM journeys j JOIN customers c ON c.tenant_id=j.tenant_id AND c.id=j.customer_id WHERE j.tenant_id=? AND EXISTS(SELECT 1 FROM appointments a WHERE a.tenant_id=j.tenant_id AND a.customer_id=j.customer_id AND a.branch_id=?) ORDER BY j.updated_at DESC LIMIT 300`, b.id, b.branch_id) : [];
  const journeySteps = modules.journeys ? await all(`SELECT s.id,s.journey_id,s.position,s.title,s.due_date,s.completed_at FROM journey_steps s JOIN journeys j ON j.tenant_id=s.tenant_id AND j.id=s.journey_id WHERE s.tenant_id=? AND EXISTS(SELECT 1 FROM appointments a WHERE a.tenant_id=j.tenant_id AND a.customer_id=j.customer_id AND a.branch_id=?) ORDER BY s.journey_id,s.position`, b.id, b.branch_id) : [];
  const wa = waConnection(b.id);
  const whatsappAppointments = modules.whatsapp ? await all(`SELECT a.id,a.date,a.minute,a.status,c.name customer_name FROM appointments a JOIN customers c ON c.tenant_id=a.tenant_id AND c.id=a.customer_id WHERE a.tenant_id=? AND a.branch_id=? AND a.source='whatsapp' ORDER BY a.created_at DESC LIMIT 50`, b.id, b.branch_id) : [];
  return { businesses: rows.map((row: any) => ({ id: row.id, name: row.name, branch_name: row.branch_name })), business: { id: b.id, name: b.name, slug: b.slug, branch_id: b.branch_id, branch_name: b.branch_name, staff_id: b.staff_id, staff_name: b.staff_name }, user: u, date: day, appointments, customers, services, staff, journeys, journey_steps: journeySteps, whatsapp: { enabled: !!modules.whatsapp, connected: !!modules.whatsapp && waReady(b.id), number: modules.whatsapp ? (wa?.number || null) : null, appointments: whatsappAppointments }, permissions: { settings: false, services_write: false, staff_write: false, customers_write: false, journeys_write: false, whatsapp_settings: false } };
}

export async function finishTeamJob(id: string, x: any) {
  const { rows } = await assignments(), assignment = rows.find((b: any) => b.id === id);
  if (!assignment) throw new ApiError('Ekip erişimi reddedildi.', 403);
  validateBranchPasswordInput(x.branch_password);
  await verifyBranchAccessPassword(id, assignment.branch_id, x.branch_password);
  const a = await one(SELECT_APPOINTMENTS + ' WHERE a.tenant_id=? AND a.staff_id=? AND a.branch_id=? AND a.id=?', id, assignment.staff_id, assignment.branch_id, z.string().parse(x.id));
  if (!a) throw new ApiError('İşlem bulunamadı.', 404);
  const status = z.enum(['completed', 'no_show']).parse(x.status), b = await one('SELECT * FROM businesses WHERE id=?', id);
  return change(b, a, { status });
}
