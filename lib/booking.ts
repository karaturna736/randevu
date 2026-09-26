import { assertBookingPlan } from "./billing";
import { z } from "zod";
import {
  q,
  one,
  all,
  db,
  ApiError,
  uid,
  now,
  secret,
  hash,
  name,
  phone,
  date as dateSchema,
} from "./server";
import { today, addDays, time } from "./types";
export const SELECT_APPOINTMENTS = `SELECT a.id,a.tenant_id,a.customer_id,a.service_id,a.staff_id,a.date,a.minute,a.duration,a.price,a.status,a.source,a.meeting_url,a.deposit_amount,a.payment_status,a.version,a.early_from,a.customer_note,a.service_description_snapshot service_description,c.name customer_name,c.phone customer_phone,COALESCE(NULLIF(a.service_name_snapshot,''),s.name) service_name,p.name staff_name,p.color staff_color FROM appointments a JOIN customers c ON c.tenant_id=a.tenant_id AND c.id=a.customer_id JOIN services s ON s.tenant_id=a.tenant_id AND s.id=a.service_id JOIN staff p ON p.tenant_id=a.tenant_id AND p.id=a.staff_id`;
export async function publicBusiness(slug: string) {
  const b = await one(
    "SELECT * FROM businesses WHERE slug=? AND status='approved' AND demo=0",
    slug,
  );
  if (!b) throw new ApiError("İşletme henüz randevuya açık değil.", 404);
  return b;
}
export function range(b: any, p: any, d: string) {
  const k = String(new Date(d + "T12:00:00Z").getUTCDay()),
    bh = JSON.parse(b.hours)[k],
    ph = JSON.parse(p.hours)[k];
  return bh && ph ? [Math.max(bh[0], ph[0]), Math.min(bh[1], ph[1])] : null;
}
export async function available(
  b: any,
  serviceId: string,
  d: string,
  person = "any",
  exclude = "",
  durationOverride?: number,
  branchId?: string,
) {
  dateSchema.parse(d);
  if (d < today() || d > addDays(today(), 90))
    throw new ApiError("Önümüzdeki 90 gün içinde bir tarih seçin.");
  const s = await one(
    "SELECT * FROM services WHERE tenant_id=? AND id=? AND active=1",
    b.id,
    serviceId,
  );
  if (!s) throw new ApiError("Hizmet bulunamadı.", 404);
  const duration = durationOverride ?? s.duration;
  if (
    branchId &&
    !(await one("SELECT 1 ok FROM branches WHERE tenant_id=? AND id=? AND active=1", b.id, branchId))
  )
    throw new ApiError("Şube bulunamadı.", 404);
  const team = await all(
      "SELECT * FROM staff WHERE tenant_id=? AND active=1 AND (? IS NULL OR branch_id IS NULL OR branch_id=?)",
      b.id,
      branchId || null,
      branchId || null,
    ),
    closed = await all(
      "SELECT staff_id FROM closures WHERE tenant_id=? AND date=?",
      b.id,
      d,
    ),
    busy = await all(
      "SELECT minute,staff_id FROM slots WHERE tenant_id=? AND date=? AND appointment_id!=?",
      b.id,
      d,
      exclude,
    ),
    occupied = new Set(busy.map((s) => s.staff_id + ":" + s.minute));
  const slots: any[] = [];
  for (const p of team) {
    if (
      (person !== "any" && person !== p.id) ||
      closed.some((c) => !c.staff_id || c.staff_id === p.id)
    )
      continue;
    const r = range(b, p, d);
    if (!r) continue;
    for (let m = r[0]; m + duration <= r[1]; m += 15) {
      if (
        new Date(d + "T" + time(m) + ":00+03:00").getTime() <
        Date.now() + 300000
      )
        continue;
      let free = true;
      for (let t = m; t < m + duration; t += 15)
        if (occupied.has(p.id + ":" + t)) free = false;
      if (free)
        slots.push({
          minute: m,
          time: time(m),
          staff_id: p.id,
          staff_name: p.name,
        });
    }
  }
  return slots.sort((a, b) => a.minute - b.minute);
}
const booking = z.object({
  branch_id: z.string().min(1).optional(),
  service_id: z.string(),
  staff_id: z.string(),
  date: dateSchema,
  minute: z.number().int().min(0).max(1425).multipleOf(15),
  name,
  phone,
  email: z
    .string()
    .email("Geçerli e-posta girin.")
    .or(z.literal(""))
    .default(""),
  consent: z.boolean().default(false),
  customer_note: z.string().trim().max(500).default(""),
  early_from: z
    .number()
    .int()
    .min(0)
    .max(1425)
    .multipleOf(15)
    .nullable()
    .optional(),
});
function event(t: string, a: string, type: string, at = now()) {
  return q(
    "INSERT INTO outbox (id,tenant_id,appointment_id,event,state,scheduled_at) VALUES (?,?,?,?,?,?)",
    uid(),
    t,
    a,
    type,
    "not_configured",
    at,
  );
}
function blocks(
  t: string,
  p: string,
  d: string,
  m: number,
  duration: number,
  id: string,
) {
  const list = [];
  for (let n = m; n < m + duration; n += 15)
    list.push(
      q(
        "INSERT INTO slots (tenant_id,staff_id,date,minute,appointment_id) VALUES (?,?,?,?,?)",
        t,
        p,
        d,
        n,
        id,
      ),
    );
  return list;
}
export async function book(
  b: any,
  input: any,
  accountId?: string,
  visitId?: string,
  extra?: (id: string, token: string) => Promise<any[]>,
  source = "web",
) {
  await assertBookingPlan(b);
  const x = booking.parse(input),
    service = await one(
      "SELECT * FROM services WHERE tenant_id=? AND id=? AND active=1",
      b.id,
      x.service_id,
    );
  if (!service) throw new ApiError("Hizmet bulunamadı.", 404);
  const staff = await one(
    "SELECT * FROM staff WHERE tenant_id=? AND id=? AND active=1",
    b.id,
    x.staff_id,
  );
  if (!staff) throw new ApiError("Uzman bulunamadı.", 404);
  const branch = x.branch_id
    ? await one("SELECT id FROM branches WHERE tenant_id=? AND id=? AND active=1", b.id, x.branch_id)
    : staff.branch_id
      ? { id: staff.branch_id }
      : await one("SELECT id FROM branches WHERE tenant_id=? AND active=1 ORDER BY is_primary DESC LIMIT 1", b.id);
  if (!branch || (staff.branch_id && staff.branch_id !== branch.id))
    throw new ApiError("Uzman bu şubede çalışmıyor.", 404);
  if (x.early_from != null && x.early_from >= x.minute)
    throw new ApiError("Erken geliş saati randevunuzdan önce olmalı.");
  const slots = await available(
    b,
    x.service_id,
    x.date,
    x.staff_id,
    "",
    service.duration,
    branch.id,
  );
  if (!slots.some((s) => s.minute === x.minute))
    throw new ApiError("Bu saat dolu. Başka bir saat seçin.", 409);
  const id = uid(),
    token = secret(),
    channel = z.enum(["web", "panel", "whatsapp", "recovery", "api"]).parse(source),
    meetingUrl =
      b.online_enabled && service.delivery_mode !== "in_person"
        ? service.meeting_url
        : "";
  const ops = [
    q(
      "INSERT INTO customers (id,tenant_id,name,phone,email,consent,created_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(tenant_id,phone) DO NOTHING",
      uid(),
      b.id,
      x.name,
      x.phone,
      x.email,
      x.consent ? 1 : 0,
      now(),
    ),
    q(
      "INSERT INTO appointments (id,tenant_id,branch_id,customer_id,service_id,staff_id,date,minute,duration,price,status,source,meeting_url,token_hash,created_at,service_name_snapshot,service_description_snapshot,customer_note,early_from) VALUES (?,?,?,(SELECT id FROM customers WHERE tenant_id=? AND phone=?),?,?,?,?,?,?,'confirmed',?,?,?,?,?,?,?,?)",
      id,
      b.id,
      branch.id,
      b.id,
      x.phone,
      x.service_id,
      x.staff_id,
      x.date,
      x.minute,
      service.duration,
      service.price,
      channel,
      meetingUrl,
      await hash(token),
      now(),
      service.name,
      service.description || "",
      x.customer_note,
      x.early_from ?? null,
    ),
    ...blocks(b.id, x.staff_id, x.date, x.minute, service.duration, id),
    event(b.id, id, "created"),
  ];
  if (visitId)
    ops.push(
      q(
        "UPDATE demand_visits SET converted_at=?,appointment_id=?,last_seen_at=? WHERE tenant_id=? AND id=?",
        now(),
        id,
        now(),
        b.id,
        visitId,
      ),
    );
  if (accountId)
    ops.push(
      q(
        "INSERT INTO account_bookings (appointment_id,tenant_id,user_id,created_at) VALUES (?,?,?,?)",
        id,
        b.id,
        accountId,
        now(),
      ),
    );
  const reminder = new Date(
    new Date(x.date + "T" + time(x.minute) + ":00+03:00").getTime() - 86400000,
  );
  if (+reminder > Date.now())
    ops.push(event(b.id, id, "reminder", reminder.toISOString()));
  if (extra) ops.push(...(await extra(id, token)));
  await db().batch(ops);
  return {
    id,
    token,
    date: x.date,
    time: time(x.minute),
    service: service.name,
    price: service.price,
    delivery_mode: service.delivery_mode,
    meeting_url: meetingUrl,
    saved_to_account: !!accountId,
  };
}
export async function byToken(token: string) {
  if (!/^[a-f0-9]{64}$/.test(token))
    throw new ApiError("Geçersiz randevu bağlantısı.", 404);
  const a = await one(
    SELECT_APPOINTMENTS + " WHERE a.token_hash=?",
    await hash(token),
  );
  if (!a || a.date < addDays(today(), -90))
    throw new ApiError("Bağlantı bulunamadı veya süresi doldu.", 404);
  return a;
}
export async function change(
  b: any,
  a: any,
  x: any,
  guest = false,
  extraOps: any[] = [],
) {
  if (a.status !== "confirmed")
    throw new ApiError("Yalnızca aktif randevular değiştirilebilir.");
  const starts = +new Date(a.date + "T" + time(a.minute) + ":00+03:00");
  if (guest && starts - Date.now() < b.cancellation_hours * 3600000)
    throw new ApiError(
      `En az ${b.cancellation_hours} saat önce işlem yapmalısınız. İşletmeyle iletişime geçin.`,
    );
  const guard = q(
      "INSERT INTO mutations (tenant_id,appointment_id,version) VALUES (?,?,?)",
      b.id,
      a.id,
      a.version + 1,
    ),
    cancelPending = q(
      "UPDATE outbox SET state='cancelled' WHERE tenant_id=? AND appointment_id=? AND state='not_configured'",
      b.id,
      a.id,
    );
  if (x.action === "reschedule") {
    const d = dateSchema.parse(x.date),
      m = z.number().int().min(0).max(1425).multipleOf(15).parse(x.minute),
      p = String(x.staff_id || a.staff_id);
    const options = await available(b, a.service_id, d, p, a.id, a.duration);
    if (!options.some((s) => s.minute === m))
      throw new ApiError("Bu saat artık müsait değil.", 409);
    const ops = [
      guard,
      q("DELETE FROM slots WHERE tenant_id=? AND appointment_id=?", b.id, a.id),
      ...blocks(b.id, p, d, m, a.duration, a.id),
      q(
        "UPDATE appointments SET date=?,minute=?,staff_id=?,early_from=NULL,version=version+1 WHERE tenant_id=? AND id=?",
        d,
        m,
        p,
        b.id,
        a.id,
      ),
      cancelPending,
      event(b.id, a.id, "rescheduled"),
    ];
    const reminder = new Date(
      new Date(d + "T" + time(m) + ":00+03:00").getTime() - 86400000,
    );
    if (+reminder > Date.now())
      ops.push(event(b.id, a.id, "reminder", reminder.toISOString()));
    await db().batch([...ops, ...extraOps]);
    return { ok: true };
  }
  const status = z.enum(["cancelled", "completed", "no_show"]).parse(x.status);
  if (guest && status !== "cancelled")
    throw new ApiError("Yetkisiz işlem.", 403);
  if (status !== "cancelled" && starts + a.duration * 60000 > Date.now())
    throw new ApiError("Randevu bitişinden önce bu işlem yapılamaz.");
  const ops = [
    guard,
    q(
      "UPDATE appointments SET status=?,early_from=NULL,version=version+1 WHERE tenant_id=? AND id=?",
      status,
      b.id,
      a.id,
    ),
    cancelPending,
  ];
  if (status === "cancelled")
    ops.push(
      q("DELETE FROM slots WHERE tenant_id=? AND appointment_id=?", b.id, a.id),
      q(
        "INSERT OR IGNORE INTO recovery_slots(id,tenant_id,source_appointment_id,service_id,staff_id,date,minute,duration,price,status,created_at) VALUES(?,?,?,?,?,?,?,?,?,'queued',?)",
        uid(),
        b.id,
        a.id,
        a.service_id,
        a.staff_id,
        a.date,
        a.minute,
        a.duration,
        a.price,
        now(),
      ),
      event(b.id, a.id, "cancelled"),
    );
  await db().batch([...ops, ...extraOps]);
  return { ok: true };
}
export async function assistant(b: any, message: string) {
  const text = message.toLocaleLowerCase("tr-TR"),
    services = await all(
      "SELECT * FROM services WHERE tenant_id=? AND active=1",
      b.id,
    );
  const s =
    services.find((s) => text.includes(s.name.toLocaleLowerCase("tr-TR"))) ||
    services.find((s) =>
      s.name
        .toLocaleLowerCase("tr-TR")
        .split(" ")
        .some((w: string) => w.length > 3 && text.includes(w)),
    );
  if (!s)
    return {
      message:
        "Hangi hizmet için saat arıyorsunuz? " +
        services.map((s) => s.name).join(", "),
      slots: [],
    };
  let d = today();
  const iso = text.match(/\d{4}-\d{2}-\d{2}/)?.[0];
  if (iso) d = dateSchema.parse(iso);
  else if (text.includes("yarın")) d = addDays(d, 1);
  else {
    const days = [
        "pazar",
        "pazartesi",
        "salı",
        "çarşamba",
        "perşembe",
        "cuma",
        "cumartesi",
      ]
        .map((v, i) => ({ v, i }))
        .sort((a, b) => b.v.length - a.v.length),
      day = days.find((day) => text.includes(day.v));
    if (day)
      d = addDays(
        d,
        (day.i - new Date(d + "T12:00:00Z").getUTCDay() + 7) % 7 || 7,
      );
  }
  let slots = await available(b, s.id, d);
  if (text.includes("öğleden sonra"))
    slots = slots.filter((s) => s.minute >= 720);
  if (text.includes("sabah")) slots = slots.filter((s) => s.minute < 720);
  if (text.includes("akşam")) slots = slots.filter((s) => s.minute >= 1020);
  slots = slots
    .filter((s, i, a) => i === a.findIndex((v) => v.minute === s.minute))
    .slice(0, 6);
  return {
    message: slots.length
      ? `${d} · ${s.name}: ${slots.map((s) => s.time).join(", ")} müsait.`
      : "Bu aralıkta boş saat bulunamadı. Başka bir gün deneyin.",
    date: d,
    service_id: s.id,
    slots,
    mode: "rule_based",
  };
}
