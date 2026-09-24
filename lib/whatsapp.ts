import { env } from "cloudflare:workers";
import { z } from "zod";
import { db, q, all, one, tenant, uid, now, ApiError } from "./server";
import { book, assistant, available } from "./booking";
import { appOrigin } from "./identity";
import { money, time } from "./types";
import { hmacHex, equalSecret, seal, unseal } from "./security";
import { defaultGrowth, recallCandidates } from "./growth";
import { requirePlanModule } from "./entitlements";
const cfg = () => env as any;
const connections = z.array(
  z.object({
    tenant_id: z.string().min(1),
    phone_id: z.string().regex(/^\d+$/),
    number: z.string().regex(/^\+?\d{10,15}$/),
    owner_number: z
      .string()
      .regex(/^\+?\d{10,15}$/)
      .optional(),
    token: z.string().min(10),
    recall_template: z
      .string()
      .regex(/^[a-z0-9_]+$/)
      .optional(),
    waitlist_template: z
      .string()
      .regex(/^[a-z0-9_]+$/)
      .optional(),
    language: z.string().default("tr"),
  }),
);
export function waConnections() {
  try {
    const rows = connections.parse(
      JSON.parse(cfg().WHATSAPP_CONNECTIONS_JSON || "[]"),
    );
    if (
      new Set(rows.map((x) => x.phone_id)).size !== rows.length ||
      new Set(rows.map((x) => x.tenant_id)).size !== rows.length
    )
      return [];
    return rows;
  } catch {
    return [];
  }
}
export function waConnection(id: string) {
  return waConnections().find((c) => c.tenant_id === id);
}
export function waReady(id: string) {
  return !!(
    waConnection(id) &&
    cfg().META_APP_SECRET &&
    cfg().META_VERIFY_TOKEN &&
    /^v\d+\.0$/.test(cfg().WHATSAPP_GRAPH_VERSION || "") &&
    /^[a-f0-9]{64}$/i.test(cfg().APP_ENCRYPTION_KEY || "") &&
    cfg().PUBLIC_SITE_READY === "true" &&
    appOrigin()
  );
}
export async function waSnapshot(id: string) {
  await tenant(id);
  await requirePlanModule(id, "whatsapp");
  const c = waConnection(id);
  return {
    connected: waReady(id),
    number: c?.number || null,
    owner_number: c?.owner_number || null,
    recall_ready: !!(
      waReady(id) &&
      c?.recall_template &&
      cfg().RECALL_SCHEDULER_READY === "true"
    ),
    recovery_ready: !!(
      waReady(id) &&
      c?.waitlist_template &&
      cfg().RECOVERY_SCHEDULER_READY === "true"
    ),
    automation_ready: !!(waReady(id) && cfg().AUTOMATION_SECRET),
    recall_cost: recallCost(),
    welcome:
      (await one("SELECT welcome FROM growth_settings WHERE tenant_id=?", id))
        ?.welcome || defaultGrowth.welcome,
    outbox: await one(
      "SELECT COUNT(CASE WHEN state='not_configured' THEN 1 END) pending,COUNT(CASE WHEN state IN ('failed','unknown','quota') THEN 1 END) failed FROM outbox WHERE tenant_id=?",
      id,
    ),
    messages: await all(
      "SELECT id,'•••• '||substr(phone,-4) phone,status,appointment_id,created_at,sent_at FROM wa_messages WHERE tenant_id=? ORDER BY created_at DESC LIMIT 50",
      id,
    ),
    webhook_path: "/api/integrations/whatsapp",
  };
}
export async function verifyWa(req: Request) {
  const u = new URL(req.url);
  if (
    !cfg().META_VERIFY_TOKEN ||
    u.searchParams.get("hub.mode") !== "subscribe" ||
    !equalSecret(
      u.searchParams.get("hub.verify_token") || "",
      cfg().META_VERIFY_TOKEN,
    )
  )
    throw new ApiError("INVALID_VERIFICATION", 403);
  return new Response(u.searchParams.get("hub.challenge") || "", {
    headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" },
  });
}
async function graph(c: any, payload: any) {
  const r = await fetch(
    "https://graph.facebook.com/" +
      cfg().WHATSAPP_GRAPH_VERSION +
      "/" +
      c.phone_id +
      "/messages",
    {
      method: "POST",
      redirect: "manual",
      signal: AbortSignal.timeout(12000),
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + c.token,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        ...payload,
      }),
    },
  );
  const j: any = await r.json();
  if (!r.ok || !j.messages?.[0]?.id)
    throw new ApiError("PROVIDER_REJECTED", 502);
  return j.messages[0].id as string;
}
export async function sendRecoveryTemplate(
  id: string,
  to: string,
  x: {
    name: string;
    business: string;
    service: string;
    date: string;
    time: string;
    link: string;
  },
) {
  const c = waConnection(id);
  if (!c?.waitlist_template || !waReady(id))
    throw new ApiError("RECOVERY_NOT_CONFIGURED", 503);
  return graph(c, {
    to: to.replace(/^\+/, ""),
    type: "template",
    template: {
      name: c.waitlist_template,
      language: { code: c.language },
      components: [
        {
          type: "body",
          parameters: [
            x.name,
            x.business,
            x.service,
            x.date,
            x.time,
            x.link,
          ].map((text) => ({ type: "text", text })),
        },
      ],
    },
  });
}
async function deliver(c: any, id: string) {
  const row = await one(
    "SELECT * FROM wa_messages WHERE id=? AND tenant_id=?",
    id,
    c.tenant_id,
  );
  if (!row || row.status !== "pending") return;
  const lock = await q(
    "UPDATE wa_messages SET status='sending' WHERE id=? AND status='pending'",
    id,
  ).run();
  if (!lock.meta.changes) return;
  try {
    const provider = await graph(c, {
      to: row.phone,
      type: "text",
      text: {
        preview_url: false,
        body: await unseal(row.reply, cfg().APP_ENCRYPTION_KEY),
      },
    });
    await q(
      "UPDATE wa_messages SET status='accepted',provider_id=?,sent_at=? WHERE id=?",
      provider,
      Date.now(),
      id,
    ).run();
  } catch (e) {
    await q(
      "UPDATE wa_messages SET status=? WHERE id=?",
      e instanceof ApiError ? "failed" : "unknown",
      id,
    ).run();
  }
}
async function receive(c: any, m: any) {
  if (!waReady(c.tenant_id)) throw new ApiError("WHATSAPP_NOT_CONFIGURED", 503);
  const x = z
    .object({
      id: z.string().min(1).max(300),
      from: z.string().regex(/^\d{10,15}$/),
      timestamp: z.string().regex(/^\d+$/),
    })
    .parse(m);
  if (
    Number(x.timestamp) * 1000 < Date.now() - 23 * 3600000 ||
    Number(x.timestamp) * 1000 > Date.now() + 300000
  )
    return;
  if (await one("SELECT id FROM wa_messages WHERE id=?", x.id)) {
    await deliver(c, x.id);
    return;
  }
  const b = await one(
    "SELECT * FROM businesses WHERE id=? AND demo=0 AND status='approved'",
    c.tenant_id,
  );
  if (!b) return;
  const count = await one(
    "SELECT COUNT(*) n FROM wa_messages WHERE tenant_id=? AND phone=? AND created_at>?",
    b.id,
    x.from,
    Date.now() - 3600000,
  );
  if (count.n >= 40) return;
  await q(
    "INSERT INTO wa_threads(tenant_id,phone,state,version,updated_at) VALUES(?,?,'{}',0,?) ON CONFLICT DO NOTHING",
    b.id,
    x.from,
    Date.now(),
  ).run();
  const t = await one(
      "SELECT * FROM wa_threads WHERE tenant_id=? AND phone=?",
      b.id,
      x.from,
    ),
    old = t.updated_at > Date.now() - 1800000 ? JSON.parse(t.state) : {},
    text = String(
      m.text?.body ||
        m.interactive?.button_reply?.title ||
        m.interactive?.list_reply?.title ||
        "",
    )
      .slice(0, 500)
      .trim(),
    lower = text.toLocaleLowerCase("tr-TR");
  let next: any = { ...old },
    reply = "",
    bookingId: string | null = null;
  const makeOps = async (r: string, state: any, aid: string | null = null) => [
    q("INSERT INTO wa_mutations VALUES(?,?,?)", b.id, x.from, t.version + 1),
    q(
      "UPDATE wa_threads SET state=?,version=version+1,updated_at=? WHERE tenant_id=? AND phone=?",
      JSON.stringify(state),
      Date.now(),
      b.id,
      x.from,
    ),
    q(
      "INSERT INTO wa_messages(id,tenant_id,phone,reply,appointment_id,created_at) VALUES(?,?,?,?,?,?)",
      x.id,
      b.id,
      x.from,
      await seal(r, cfg().APP_ENCRYPTION_KEY),
      aid,
      Date.now(),
    ),
  ];
  if (["dur", "stop", "istemiyorum"].includes(lower)) {
    next = {};
    reply =
      "Otomatik geri çağırma mesajları kapatıldı. Randevu almak için istediğiniz zaman yazabilirsiniz.";
    await db().batch([
      ...(await makeOps(reply, next)),
      q(
        "UPDATE customers SET consent=0 WHERE tenant_id=? AND phone=?",
        b.id,
        "+" + x.from,
      ),
    ]);
    await deliver(c, x.id);
    return;
  }
  if (["iptal", "baştan", "menü"].includes(lower)) {
    next = {};
    reply =
      "Seçimler sıfırlandı. Mevcut randevunuz iptal edilmedi. Yeni randevu için hizmet ve gün yazın; mevcut randevuyu özel bağlantısından yönetin.";
  } else if (old.stage === "confirm" && lower === "onayla") {
    const s = await one(
      "SELECT * FROM services WHERE tenant_id=? AND id=? AND active=1",
      b.id,
      old.service_id,
    );
    if (!s || s.price !== old.price || s.duration !== old.duration) {
      next = {};
      reply =
        "Hizmet bilgisi değişti. Güncel fiyat ve saat için tekrar hizmet adını yazın.";
    } else {
      try {
        await book(
          b,
          {
            ...old.slot,
            service_id: old.service_id,
            date: old.date,
            name: old.name,
            phone: "+" + x.from,
            consent: false,
          },
          undefined,
          undefined,
          async (id, token) =>
            makeOps(
              `Randevunuz onaylandı.\n${s.name} · ${money(s.price)}\n${old.date} ${time(old.slot.minute)} · ${old.slot.staff_name}\nİptal / değişiklik: ${appOrigin()}/randevum#${token}`,
              {},
              id,
            ),
          "whatsapp",
        );
        await deliver(c, x.id);
        return;
      } catch (e) {
        if (
          (e instanceof ApiError && e.status === 409) ||
          String(e).includes("BOOKING_CONFLICT") ||
          String(e).includes("UNIQUE constraint")
        ) {
          if (await one("SELECT id FROM wa_messages WHERE id=?", x.id)) {
            await deliver(c, x.id);
            return;
          }
          next = {};
          reply =
            "Seçtiğiniz saat bu sırada doldu. Yeni saatleri görmek için hizmet ve günü tekrar yazın.";
        } else throw e;
      }
    }
  } else if (old.stage === "name") {
    if (text.length < 2 || text.length > 100) {
      reply = "Randevu için adınızı ve soyadınızı yazın.";
    } else {
      next = { ...old, name: text, stage: "confirm" };
      reply = `${b.name}\n${old.service_name} · ${money(old.price)} · ${old.duration} dk\n${old.date} ${time(old.slot.minute)} · ${old.slot.staff_name}\nAd: ${text}\nBilgilendirme: ${appOrigin()}/gizlilik\nBu randevuyu oluşturmak için ONAYLA, vazgeçmek için BAŞTAN yazın. Ödeme işletmeye yapılır.`;
    }
  } else if (old.stage === "slots" && /^\d{1,2}$/.test(text)) {
    const slot = old.slots[Number(text) - 1];
    if (!slot) reply = "Listede görünen bir saat numarasını yazın.";
    else {
      next = { ...old, slot, stage: "name" };
      delete next.slots;
      reply = "Randevuyu kimin adına oluşturalım? Ad ve soyad yazın.";
    }
  } else if (old.stage === "confirm") {
    reply =
      "Randevu oluşturmak için ONAYLA, seçimleri değiştirmek için BAŞTAN yazın.";
  } else {
    const services = await all(
      "SELECT id,name,price,duration FROM services WHERE tenant_id=? AND active=1 ORDER BY name LIMIT 30",
      b.id,
    );
    let query = text;
    if (old.stage === "date") query = old.service_name + " " + text;
    const selected =
      old.stage === "services" && /^\d{1,2}$/.test(text)
        ? services[Number(text) - 1]
        : null;
    if (selected) {
      next = { stage: "date", service_name: selected.name };
      reply =
        "Hangi gün uygun? Örneğin “yarın”, “cumartesi öğleden sonra” veya “2026-10-15” yazın.";
    } else {
      const a = await assistant(b, query);
      if (a.slots.length) {
        const s = services.find((s) => s.id === a.service_id)!;
        next = {
          stage: "slots",
          service_id: s.id,
          service_name: s.name,
          price: s.price,
          duration: s.duration,
          date: a.date,
          slots: a.slots,
        };
        reply =
          `${s.name} · ${money(s.price)} · ${s.duration} dk\n${a.date} için müsait saatler:\n` +
          a.slots
            .map(
              (slot: any, i: number) =>
                `${i + 1}. ${slot.time} · ${slot.staff_name}`,
            )
            .join("\n") +
          "\nSeçmek için saat numarasını yazın. Saatiniz son onayda ayrılır.";
      } else {
        next = { stage: "services" };
        reply =
          (a.service_id
            ? a.message
            : "Merhaba! " +
              ((
                await one(
                  "SELECT welcome FROM growth_settings WHERE tenant_id=?",
                  b.id,
                )
              )?.welcome || defaultGrowth.welcome)) +
          "\n" +
          services
            .map(
              (s: any, i: number) => `${i + 1}. ${s.name} · ${money(s.price)}`,
            )
            .join("\n") +
          "\nHizmet numarası veya “hizmet adı + gün” yazın. İnternetten: " +
          appOrigin() +
          "/" +
          b.slug;
      }
    }
  }
  await db().batch(await makeOps(reply, next, bookingId));
  await deliver(c, x.id);
}
export async function whatsappWebhook(req: Request) {
  if (!cfg().META_APP_SECRET) throw new ApiError("NOT_CONFIGURED", 503);
  const raw = await req.text();
  if (raw.length > 262144) throw new ApiError("TOO_LARGE", 413);
  const sig = req.headers.get("x-hub-signature-256") || "";
  if (
    !equalSecret(sig, "sha256=" + (await hmacHex(raw, cfg().META_APP_SECRET)))
  )
    throw new ApiError("INVALID_SIGNATURE", 403);
  let payload: any;
  try {
    payload = JSON.parse(raw);
  } catch {
    throw new ApiError("INVALID_BODY");
  }
  if (payload.object !== "whatsapp_business_account")
    throw new ApiError("INVALID_EVENT");
  for (const e of (payload.entry || []).slice(0, 20))
    for (const change of (e.changes || []).slice(0, 20)) {
      const v = change.value,
        c = waConnections().find(
          (c) => c.phone_id === v?.metadata?.phone_number_id,
        );
      if (!c) continue;
      for (const s of (v.statuses || []).slice(0, 100)) {
        if (["delivered", "read", "failed"].includes(s.status))
          await q(
            "UPDATE wa_messages SET status=? WHERE tenant_id=? AND provider_id=? AND status NOT IN ('read','delivered')",
            s.status,
            c.tenant_id,
            String(s.id),
          ).run();
      }
      for (const m of (v.messages || []).slice(0, 20)) await receive(c, m);
    }
  return new Response("OK", { headers: { "Cache-Control": "no-store" } });
}
export function recallCost() {
  const n = Number(cfg().WHATSAPP_RECALL_CREDIT_KURUS || 0);
  return Number.isSafeInteger(n) && n >= 0 && n <= 100000 ? n : 0;
}
export async function runRecalls(req: Request) {
  if (
    !cfg().AUTOMATION_SECRET ||
    !equalSecret(
      req.headers.get("authorization") || "",
      "Bearer " + cfg().AUTOMATION_SECRET,
    )
  )
    throw new ApiError("UNAUTHORIZED", 403);
  if (cfg().RECALL_SCHEDULER_READY !== "true")
    throw new ApiError("NOT_CONFIGURED", 503);
  let accepted = 0;
  for (const g of await all(
    "SELECT g.*,b.name,b.slug FROM growth_settings g JOIN businesses b ON b.id=g.tenant_id WHERE g.autopilot=1 AND b.status='approved' AND b.demo=0 LIMIT 100",
  )) {
    const c = waConnection(g.tenant_id);
    if (!c?.recall_template || !waReady(g.tenant_id)) continue;
    for (const customer of await recallCandidates(g.tenant_id, g.recall_days)) {
      if (
        await one(
          "SELECT id FROM recall_jobs WHERE tenant_id=? AND customer_id=? AND last_visit=?",
          g.tenant_id,
          customer.id,
          customer.last_visit,
        )
      )
        continue;
      const id = uid(),
        cost = recallCost();
      try {
        await db().batch([
          q(
            "INSERT INTO recall_jobs(id,tenant_id,customer_id,last_visit,created_at) VALUES(?,?,?,?,?)",
            id,
            g.tenant_id,
            customer.id,
            customer.last_visit,
            now(),
          ),
          ...(cost
            ? [
                q(
                  "INSERT INTO credit_ledger VALUES(?,?,?,?,?,?,?)",
                  uid(),
                  g.tenant_id,
                  -cost,
                  "message_reservation",
                  "recall:" + id,
                  "WhatsApp mesajı için ayrılan kredi",
                  now(),
                ),
              ]
            : []),
        ]);
      } catch (e) {
        if (
          String(e).includes("CREDIT_CONFLICT") ||
          String(e).includes("UNIQUE")
        )
          continue;
        throw e;
      }
      // Recheck permission immediately before sending. No campaign uses appointment confirmation as consent.
      if (
        !(await one(
          "SELECT id FROM customers WHERE tenant_id=? AND id=? AND consent=1",
          g.tenant_id,
          customer.id,
        ))
      ) {
        await refundRecall(id, g.tenant_id, cost, "cancelled");
        continue;
      }
      try {
        const provider = await graph(c, {
          to: customer.phone.replace(/\D/g, ""),
          type: "template",
          template: {
            name: c.recall_template,
            language: { code: c.language },
            components: [
              {
                type: "body",
                parameters: [
                  { type: "text", text: customer.name },
                  { type: "text", text: g.name },
                  { type: "text", text: appOrigin() + "/" + g.slug },
                ],
              },
            ],
          },
        });
        await q(
          "UPDATE recall_jobs SET status='accepted',provider_id=? WHERE id=?",
          provider,
          id,
        ).run();
        accepted++;
      } catch (e) {
        if (e instanceof ApiError)
          await refundRecall(id, g.tenant_id, cost, "failed");
        else
          await q(
            "UPDATE recall_jobs SET status='unknown' WHERE id=?",
            id,
          ).run();
      }
    }
  }
  return { accepted };
}
async function refundRecall(
  id: string,
  tenantId: string,
  cost: number,
  status: string,
) {
  await db().batch([
    q("UPDATE recall_jobs SET status=? WHERE id=?", status, id),
    ...(cost
      ? [
          q(
            "INSERT INTO credit_ledger VALUES(?,?,?,?,?,?,?) ON CONFLICT(reference) DO NOTHING",
            uid(),
            tenantId,
            cost,
            "message_refund",
            "recall-refund:" + id,
            "Gönderilmeyen mesaj için kredi iadesi",
            now(),
          ),
        ]
      : []),
  ]);
}
