import { z } from "zod";
import { all, one, q, tenant, uid, now, ApiError } from "./server";
import { appOrigin } from "./identity";

export const PHONE_OPERATOR_ADDON = "phone_operator";
const phoneNumber = z.string().trim().max(30).refine((value) => !value || /^\+?[0-9 ()-]{10,24}$/.test(value), "Geçerli bir telefon numarası girin.");
const settingsInput = z.object({
  inbound_number: phoneNumber.default(""),
  provider: z.enum(["demo", "netgsm"]).default("demo"),
  greeting: z.string().trim().min(10).max(280),
  info_transfer_number: phoneNumber.default(""),
  timeout_seconds: z.number().int().min(5).max(60),
  appointment_message: z.string().trim().min(10).max(280),
});

export async function phoneOperatorAddon(tenantId: string) {
  return !!(await one("SELECT 1 ok FROM tenant_addons WHERE tenant_id=? AND code=? AND enabled=1", tenantId, PHONE_OPERATOR_ADDON));
}

function appointmentLink(slug: string) {
  return `${appOrigin() || ""}/${slug}`;
}

async function ensureSettings(tenantId: string) {
  const existing = await one("SELECT * FROM phone_operator_settings WHERE tenant_id=?", tenantId);
  if (existing) return existing;
  const stamp = now();
  await q("INSERT INTO phone_operator_settings(tenant_id,updated_at) VALUES(?,?)", tenantId, stamp).run();
  return one("SELECT * FROM phone_operator_settings WHERE tenant_id=?", tenantId);
}

export async function phoneOperatorSnapshot(tenantId: string) {
  await tenant(tenantId);
  if (!(await phoneOperatorAddon(tenantId))) throw new ApiError("Telefon operatörü ek paketi bu işletmede etkin değil.", 402);
  const business = await one("SELECT id,name,slug,phone FROM businesses WHERE id=?", tenantId);
  if (!business) throw new ApiError("İşletme bulunamadı.", 404);
  const settings = await ensureSettings(tenantId);
  const calls = await all("SELECT id,caller_phone,digit,outcome,duration_seconds,provider_call_id,created_at FROM phone_operator_calls WHERE tenant_id=? ORDER BY created_at DESC LIMIT 100", tenantId);
  const totals = await one("SELECT COUNT(*) calls,COALESCE(SUM(duration_seconds),0) duration_seconds,COUNT(CASE WHEN digit='2' THEN 1 END) appointment_requests,COUNT(CASE WHEN digit='1' THEN 1 END) info_requests FROM phone_operator_calls WHERE tenant_id=?", tenantId);
  return { addon_enabled: true, business, settings, calls, totals, demo: { appointment_link: appointmentLink(business.slug), provider_status: settings.provider === "demo" ? "Demo sağlayıcı" : "Sağlayıcı bağlantısı bekleniyor" } };
}

export async function savePhoneOperator(tenantId: string, input: unknown) {
  await tenant(tenantId);
  if (!(await phoneOperatorAddon(tenantId))) throw new ApiError("Önce telefon operatörü ek paketini etkinleştirin.", 402);
  const x = settingsInput.parse(input);
  await q(`INSERT INTO phone_operator_settings(tenant_id,inbound_number,provider,greeting,info_transfer_number,timeout_seconds,appointment_message,updated_at)
    VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(tenant_id) DO UPDATE SET inbound_number=excluded.inbound_number,provider=excluded.provider,greeting=excluded.greeting,info_transfer_number=excluded.info_transfer_number,timeout_seconds=excluded.timeout_seconds,appointment_message=excluded.appointment_message,updated_at=excluded.updated_at`,
    tenantId, x.inbound_number, x.provider, x.greeting, x.info_transfer_number, x.timeout_seconds, x.appointment_message, now()).run();
  return phoneOperatorSnapshot(tenantId);
}

export async function simulatePhoneOperator(tenantId: string, input: unknown) {
  await tenant(tenantId);
  if (!(await phoneOperatorAddon(tenantId))) throw new ApiError("Önce telefon operatörü ek paketini etkinleştirin.", 402);
  const x = z.object({ caller_phone: phoneNumber.default(""), digit: z.enum(["1", "2", "timeout"]), duration_seconds: z.number().int().min(0).max(7200).default(8) }).parse(input);
  const business = await one("SELECT slug FROM businesses WHERE id=?", tenantId);
  if (!business) throw new ApiError("İşletme bulunamadı.", 404);
  const settings = await ensureSettings(tenantId);
  const outcome = x.digit === "1" ? (settings.info_transfer_number ? "info_transfer" : "info_callback") : x.digit === "2" ? "appointment_whatsapp" : "timeout_closed";
  const callId = uid();
  await q("INSERT INTO phone_operator_calls(id,tenant_id,caller_phone,digit,outcome,duration_seconds,provider_call_id,created_at) VALUES(?,?,?,?,?,?,?,?)", callId, tenantId, x.caller_phone, x.digit, outcome, x.duration_seconds, "demo-" + callId, now()).run();
  return {
    id: callId,
    digit: x.digit,
    outcome,
    message: outcome === "info_transfer" ? "Demo: çağrı işletme hattına kör aktarım için hazır." : outcome === "info_callback" ? "Demo: bilgi talebi kaydedildi; işletme geri arayacak." : outcome === "appointment_whatsapp" ? settings.appointment_message : "Demo: seçim yapılmadı ve çağrı kapatıldı.",
    appointment_link: x.digit === "2" ? appointmentLink(business.slug) : null,
  };
}

export async function adminPhoneOperatorCatalog() {
  return { code: PHONE_OPERATOR_ADDON, name: "Akıllı telefon operatörü", description: "Telefon menüsü, işletmeye bilgi aktarımı, WhatsApp randevu yönlendirmesi ve çağrı raporları.", price: (await one("SELECT price FROM addon_catalog WHERE code=?", PHONE_OPERATOR_ADDON))?.price ?? null };
}
