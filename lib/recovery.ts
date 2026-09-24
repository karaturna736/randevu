import { env } from "cloudflare:workers";
import { z } from "zod";
import {
  all,
  db,
  one,
  q,
  tenant,
  uid,
  now,
  hash,
  secret,
  ApiError,
  name,
  phone,
  date as dateSchema,
} from "./server";
import { publicBusiness, book } from "./booking";
import { addDays, time, today } from "./types";
import { equalSecret } from "./security";
import { sendRecoveryTemplate, waConnection, waReady } from "./whatsapp";
import { requirePlanModule } from "./entitlements";

const joinSchema = z.object({
  slug: z.string().min(1),
  service_id: z.string().min(1),
  staff_id: z.string().nullable().optional(),
  date: dateSchema,
  minute_from: z.number().int().min(0).max(1425).multipleOf(15),
  minute_to: z.number().int().min(15).max(1440).multipleOf(15),
  name,
  phone,
  email: z
    .string()
    .email("Geçerli e-posta girin.")
    .or(z.literal(""))
    .default(""),
  consent: z.literal(true, {
    errorMap: () => ({
      message: "WhatsApp saat teklifi için izin vermelisiniz.",
    }),
  }),
});

export async function joinWaitlist(input: any) {
  const x = joinSchema.parse(input),
    b = await publicBusiness(x.slug);
  if (
    x.date < today() ||
    x.date > addDays(today(), 90) ||
    x.minute_from >= x.minute_to
  )
    throw new ApiError("Tarih ve saat aralığını kontrol edin.");
  const s = await one(
    "SELECT id FROM services WHERE tenant_id=? AND id=? AND active=1",
    b.id,
    x.service_id,
  );
  if (!s) throw new ApiError("Hizmet bulunamadı.", 404);
  const staff = x.staff_id && x.staff_id !== "any" ? x.staff_id : null;
  if (
    staff &&
    !(await one(
      "SELECT id FROM staff WHERE tenant_id=? AND id=? AND active=1",
      b.id,
      staff,
    ))
  )
    throw new ApiError("Personel bulunamadı.", 404);
  const existing = await one(
    "SELECT id FROM waitlist_entries WHERE tenant_id=? AND phone=? AND service_id=? AND requested_date=? AND status='waiting'",
    b.id,
    x.phone,
    x.service_id,
    x.date,
  );
  if (existing) {
    await q(
      "UPDATE waitlist_entries SET staff_id=?,minute_from=?,minute_to=?,name=?,email=?,consent=1 WHERE id=? AND tenant_id=?",
      staff,
      x.minute_from,
      x.minute_to,
      x.name,
      x.email,
      existing.id,
      b.id,
    ).run();
    return { id: existing.id, status: "waiting", updated: true };
  }
  const id = uid();
  await q(
    "INSERT INTO waitlist_entries(id,tenant_id,service_id,staff_id,requested_date,minute_from,minute_to,name,phone,email,consent,status,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,1,'waiting',?)",
    id,
    b.id,
    x.service_id,
    staff,
    x.date,
    x.minute_from,
    x.minute_to,
    x.name,
    x.phone,
    x.email,
    now(),
  ).run();
  return { id, status: "waiting" };
}

export async function waitlistSnapshot(id: string) {
  await tenant(id);
  return {
    requests: await all(
      "SELECT w.id,w.requested_date date,w.minute_from,w.minute_to,w.name,'•••• '||substr(w.phone,-4) phone,w.status,s.name service_name,COALESCE(p.name,'Fark etmez') staff_name,w.created_at FROM waitlist_entries w JOIN services s ON s.tenant_id=w.tenant_id AND s.id=w.service_id LEFT JOIN staff p ON p.tenant_id=w.tenant_id AND p.id=w.staff_id WHERE w.tenant_id=? ORDER BY CASE w.status WHEN 'waiting' THEN 0 ELSE 1 END,w.requested_date,w.minute_from LIMIT 500",
      id,
    ),
  };
}

export async function updateWaitlist(id: string, input: any) {
  await tenant(id);
  const x = z
    .object({
      id: z.string().min(1),
      status: z.enum(["waiting", "contacted", "booked", "cancelled"]),
    })
    .parse(input);
  const result = await q(
    "UPDATE waitlist_entries SET status=? WHERE tenant_id=? AND id=?",
    x.status,
    id,
    x.id,
  ).run();
  if (!result.meta.changes)
    throw new ApiError("Bekleme kaydı bulunamadı.", 404);
  return { ok: true };
}

export async function recoverySnapshot(id: string) {
  await tenant(id);
  await requirePlanModule(id, "recovery");
  const month = today().slice(0, 7) + "-01";
  const totals = await one(
    "SELECT COUNT(*) filled_slots,COUNT(DISTINCT recovered_customer_id) recovered_customers,COALESCE(SUM(recovered_amount),0) recovered_revenue FROM recovery_slots WHERE tenant_id=? AND status='filled' AND filled_at>=?",
    id,
    month,
  );
  const recall = await one(
    "SELECT COUNT(DISTINCT customer_id) recovered_customers,COALESCE(SUM(amount),0) recovered_revenue FROM recovery_attributions WHERE tenant_id=? AND kind='recall' AND created_at>=?",
    id,
    month,
  );
  const waiting = await all(
    "SELECT w.id,w.requested_date,w.minute_from,w.minute_to,w.name,'•••• '||substr(w.phone,-4) phone,w.status,s.name service_name,COALESCE(p.name,'Fark etmez') staff_name,w.created_at FROM waitlist_entries w JOIN services s ON s.tenant_id=w.tenant_id AND s.id=w.service_id LEFT JOIN staff p ON p.tenant_id=w.tenant_id AND p.id=w.staff_id WHERE w.tenant_id=? AND w.status='waiting' ORDER BY w.created_at LIMIT 100",
    id,
  );
  const recent = await all(
    "SELECT r.id,r.date,r.minute,r.price,r.status,s.name service_name,p.name staff_name,r.filled_at FROM recovery_slots r JOIN services s ON s.tenant_id=r.tenant_id AND s.id=r.service_id JOIN staff p ON p.tenant_id=r.tenant_id AND p.id=r.staff_id WHERE r.tenant_id=? ORDER BY r.created_at DESC LIMIT 30",
    id,
  );
  const c = waConnection(id);
  return {
    totals: {
      filled_slots: Number(totals.filled_slots || 0),
      recovered_customers:
        Number(totals.recovered_customers || 0) +
        Number(recall.recovered_customers || 0),
      recovered_revenue:
        Number(totals.recovered_revenue || 0) +
        Number(recall.recovered_revenue || 0),
    },
    waiting,
    recent,
    automation_ready: !!(
      waReady(id) &&
      c?.waitlist_template &&
      (env as any).AUTOMATION_SECRET &&
      (env as any).RECOVERY_SCHEDULER_READY === "true"
    ),
  };
}

export async function recoveryOffer(token: string) {
  if (!/^[a-f0-9]{64}$/.test(token))
    throw new ApiError("Teklif bağlantısı geçersiz.", 404);
  const r = await one(
    "SELECT o.id,o.status,o.expires_at,w.name,w.phone,w.email,w.service_id,w.staff_id,b.name business_name,s.name service_name,s.price,s.duration,p.name staff_name,r.date,r.minute,r.tenant_id FROM recovery_offers o JOIN recovery_slots r ON r.id=o.recovery_slot_id JOIN waitlist_entries w ON w.id=o.waitlist_id JOIN businesses b ON b.id=r.tenant_id JOIN services s ON s.tenant_id=r.tenant_id AND s.id=r.service_id JOIN staff p ON p.tenant_id=r.tenant_id AND p.id=r.staff_id WHERE o.token_hash=?",
    await hash(token),
  );
  if (!r) throw new ApiError("Teklif bağlantısı bulunamadı.", 404);
  return { ...r, available: r.status === "offered" && r.expires_at > now() };
}

export async function acceptRecovery(token: string) {
  const o = await recoveryOffer(token);
  if (!o.available)
    throw new ApiError(
      "Bu teklif süresi dolmuş veya başka bir müşteri tarafından alınmış.",
      409,
    );
  const b = await one(
    "SELECT * FROM businesses WHERE id=? AND status='approved'",
    o.tenant_id,
  );
  if (!b) throw new ApiError("İşletme randevuya açık değil.", 409);
  try {
    return await book(
      b,
      {
        service_id: o.service_id,
        staff_id: o.staff_id,
        date: o.date,
        minute: o.minute,
        name: o.name,
        phone: o.phone,
        email: o.email,
        consent: true,
      },
      undefined,
      undefined,
      async (id) => [
        q(
          "UPDATE recovery_offers SET status='booked',accepted_at=? WHERE id=? AND status='offered' AND expires_at>?",
          now(),
          o.id,
          now(),
        ),
        q(
          "UPDATE recovery_offers SET status='expired' WHERE recovery_slot_id=(SELECT recovery_slot_id FROM recovery_offers WHERE id=?) AND id!=? AND status='offered'",
          o.id,
          o.id,
        ),
        q(
          "UPDATE waitlist_entries SET status='booked' WHERE id=(SELECT waitlist_id FROM recovery_offers WHERE id=?)",
          o.id,
        ),
        q(
          "UPDATE recovery_slots SET status='filled',recovered_appointment_id=?,recovered_customer_id=(SELECT id FROM customers WHERE tenant_id=? AND phone=?),recovered_amount=price,filled_at=? WHERE id=(SELECT recovery_slot_id FROM recovery_offers WHERE id=?) AND status IN ('queued','offering')",
          id,
          o.tenant_id,
          o.phone,
          now(),
          o.id,
        ),
        q(
          "INSERT INTO recovery_attributions(id,tenant_id,appointment_id,customer_id,kind,amount,created_at) SELECT ?,?,?,id,'waitlist',?,? FROM customers WHERE tenant_id=? AND phone=?",
          uid(),
          o.tenant_id,
          id,
          o.price,
          now(),
          o.tenant_id,
          o.phone,
        ),
      ],
      "recovery",
    );
  } catch (e) {
    if (
      (e instanceof ApiError && e.status === 409) ||
      String(e).includes("UNIQUE")
    )
      throw new ApiError(
        "Bu saat az önce doldu. İşletme yeni bir yer açıldığında tekrar haber verebilir.",
        409,
      );
    throw e;
  }
}

export async function runRecovery(req: Request) {
  const cfg = env as any;
  if (
    !cfg.AUTOMATION_SECRET ||
    !equalSecret(
      req.headers.get("authorization") || "",
      "Bearer " + cfg.AUTOMATION_SECRET,
    )
  )
    throw new ApiError("UNAUTHORIZED", 403);
  if (cfg.RECOVERY_SCHEDULER_READY !== "true")
    throw new ApiError("NOT_CONFIGURED", 503);
  await q(
    "UPDATE recovery_offers SET status='expired' WHERE status='offered' AND expires_at<=?",
    now(),
  ).run();
  let offered = 0,
    expired = 0;
  for (const slot of await all(
    "SELECT r.*,b.slug,b.name business_name,s.name service_name,p.name staff_name FROM recovery_slots r JOIN businesses b ON b.id=r.tenant_id JOIN services s ON s.tenant_id=r.tenant_id AND s.id=r.service_id JOIN staff p ON p.tenant_id=r.tenant_id AND p.id=r.staff_id WHERE r.status IN ('queued','offering') AND r.date>=? ORDER BY r.created_at LIMIT 100",
    today(),
  )) {
    const active = await one(
      "SELECT id FROM recovery_offers WHERE recovery_slot_id=? AND status='offered' AND expires_at>?",
      slot.id,
      now(),
    );
    if (active) continue;
    const w = await one(
      "SELECT * FROM waitlist_entries w WHERE w.tenant_id=? AND w.service_id=? AND w.requested_date=? AND w.status='waiting' AND w.consent=1 AND (w.staff_id IS NULL OR w.staff_id=?) AND w.minute_from<=? AND w.minute_to>=? AND NOT EXISTS(SELECT 1 FROM recovery_offers o WHERE o.recovery_slot_id=? AND o.waitlist_id=w.id) ORDER BY CASE WHEN w.staff_id=? THEN 0 ELSE 1 END,w.created_at LIMIT 1",
      slot.tenant_id,
      slot.service_id,
      slot.date,
      slot.staff_id,
      slot.minute,
      slot.minute + slot.duration,
      slot.id,
      slot.staff_id,
    );
    if (!w) {
      await q(
        "UPDATE recovery_slots SET status='expired' WHERE id=?",
        slot.id,
      ).run();
      expired++;
      continue;
    }
    const token = secret(),
      id = uid(),
      expires = new Date(Date.now() + 600000).toISOString();
    await q(
      "INSERT INTO recovery_offers(id,tenant_id,recovery_slot_id,waitlist_id,token_hash,status,expires_at,created_at) VALUES(?,?,?,?,?,'sending',?,?)",
      id,
      slot.tenant_id,
      slot.id,
      w.id,
      await hash(token),
      expires,
      now(),
    ).run();
    try {
      const provider = await sendRecoveryTemplate(slot.tenant_id, w.phone, {
        name: w.name,
        business: slot.business_name || "",
        service: slot.service_name,
        date: slot.date,
        time: time(slot.minute),
        link: (await import("./identity")).appOrigin() + "/bekleme#" + token,
      });
      await db().batch([
        q(
          "UPDATE recovery_offers SET status='offered',provider_id=? WHERE id=?",
          provider,
          id,
        ),
        q("UPDATE recovery_slots SET status='offering' WHERE id=?", slot.id),
      ]);
      offered++;
    } catch {
      await q(
        "UPDATE recovery_offers SET status='failed' WHERE id=?",
        id,
      ).run();
    }
  }
  return { offered, expired };
}
