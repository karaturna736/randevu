"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bell,
  CalendarClock,
  CheckCheck,
  CircleAlert,
  CircleCheck,
  Clock3,
  X,
} from "lucide-react";
import { toast } from "sonner";

type NotificationType =
  | "appointment.created"
  | "appointment.updated"
  | "appointment.cancelled"
  | "appointment.payment_updated"
  | "waitlist.slot_available";

type Item = {
  id: string;
  appointment_id?: string | null;
  waitlist_id?: string | null;
  type: NotificationType;
  title: string;
  message: string;
  created_at: string;
  read: boolean;
  data?: Record<string, any>;
};

type Snapshot = { unread_count: number; notifications: Item[] };
type Scope = "business" | "customer";

async function requestJson(url: string, init?: RequestInit): Promise<any> {
  const response = await fetch(url, {
    cache: "no-store",
    credentials: "same-origin",
    ...init,
  });
  const data: any = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || "Bildirimler yüklenemedi.");
  return data;
}

function systemTitle(item: Item) {
  if (item.type === "waitlist.slot_available") return "İstediğiniz saat boşaldı";
  if (item.type === "appointment.updated") return "Randevunuz değiştirildi";
  if (item.type === "appointment.cancelled") return "Randevu iptal edildi";
  if (item.type === "appointment.created") return "Yeni randevu";
  return "Randevu bilgisi güncellendi";
}

function notifyDevice(item: Item) {
  if (typeof window === "undefined") return;
  if ("Notification" in window && Notification.permission === "granted") {
    try {
      const n = new Notification(systemTitle(item), {
        body: item.message,
        icon: "/neta-logo.png",
        tag: item.id,
      });
      n.onclick = () => {
        window.focus();
        window.location.assign(
          item.type === "waitlist.slot_available" ? "/randevularim" : window.location.href,
        );
      };
      return;
    } catch {}
  }
  if (document.visibilityState === "visible") {
    toast.info(systemTitle(item), { description: item.message, duration: 6000 });
  }
}

export function NotificationCenter() {
  const [scope, setScope] = useState<Scope | null>(null);
  const [tenantId, setTenantId] = useState("");
  const [open, setOpen] = useState(false);
  const [snapshot, setSnapshot] = useState<Snapshot>({
    unread_count: 0,
    notifications: [],
  });
  const [error, setError] = useState("");
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(
    "unsupported",
  );
  const [pushReady, setPushReady] = useState(false);
  const [pushActive, setPushActive] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [accepting, setAccepting] = useState("");
  const known = useRef(new Set<string>());
  const initialized = useRef(false);

  useEffect(() => {
    const path = window.location.pathname;
    if ("Notification" in window) setPermission(Notification.permission);

    if (path.startsWith("/panel") && path !== "/panel/ek-paketler") {
      setScope("business");
      const tenant = new URLSearchParams(window.location.search).get("tenant") || "";
      if (tenant) {
        setTenantId(tenant);
        return;
      }
      void requestJson("/api/v1/workspace")
        .then((workspace) => {
          if (workspace?.business?.id && !workspace.business.demo) {
            setTenantId(String(workspace.business.id));
          }
        })
        .catch(() => {});
      return;
    }

    if (
      path.startsWith("/randevularim") ||
      path.startsWith("/hesabim") ||
      path.startsWith("/kesfet")
    ) {
      setScope("customer");
    }
  }, []);

  const endpoint = scope === "business" ? "/api/business-notifications" : "/api/customer-notifications";

  useEffect(() => {
    if (scope !== "business" || !tenantId) return;
    void requestJson(`/api/push-subscriptions?tenant=${encodeURIComponent(tenantId)}`)
      .then(async settings => {
        setPushReady(!!settings.configured);
        const registration = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration('/neta-push-sw.js') : null;
        const subscription = await registration?.pushManager.getSubscription();
        setPushActive(!!subscription && !!settings.endpoints?.includes(subscription.endpoint));
      })
      .catch(() => {});
  }, [scope, tenantId]);

  const load = useCallback(
    async (announce = false) => {
      if (!scope || (scope === "business" && !tenantId)) return;
      try {
        const url =
          scope === "business"
            ? `${endpoint}?tenant=${encodeURIComponent(tenantId)}`
            : endpoint;
        const next = (await requestJson(url)) as Snapshot;
        const rows = Array.isArray(next?.notifications) ? next.notifications : [];

        if (announce && initialized.current) {
          for (const item of rows.slice().reverse()) {
            if (!item.read && !known.current.has(item.id)) notifyDevice(item);
          }
        }
        known.current = new Set(rows.map((item) => item.id));
        initialized.current = true;
        setSnapshot({
          unread_count: Number(next?.unread_count || 0),
          notifications: rows,
        });
        setError("");
      } catch (err: any) {
        if (scope === "customer" && /Giriş yapmanız gerekiyor/.test(err?.message || "")) {
          setScope(null);
          return;
        }
        setError(err?.message || "Bildirimler yüklenemedi.");
      }
    },
    [scope, tenantId, endpoint],
  );

  useEffect(() => {
    if (!scope || (scope === "business" && !tenantId)) return;
    void load(false);
    const timer = window.setInterval(() => void load(true), scope === "customer" ? 15000 : 30000);
    const onFocus = () => void load(false);
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [scope, tenantId, load]);

  useEffect(() => {
    if (scope !== "business" || !tenantId) return;
    const source = new EventSource(`/api/v1/events?tenant=${encodeURIComponent(tenantId)}`);
    const types = [
      "appointment.created",
      "appointment.updated",
      "appointment.cancelled",
      "appointment.payment_updated",
    ];
    const handler = () => window.setTimeout(() => void load(true), 100);
    for (const type of types) source.addEventListener(type, handler);
    source.onerror = () => {};
    return () => {
      for (const type of types) source.removeEventListener(type, handler);
      source.close();
    };
  }, [scope, tenantId, load]);

  const write = useCallback(
    async (payload: Record<string, unknown>) => {
      if (!scope) return;
      await requestJson(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          scope === "business" ? { tenant_id: tenantId, ...payload } : payload,
        ),
      });
      await load(false);
    },
    [scope, tenantId, endpoint, load],
  );

  async function acceptOffer(item: Item) {
    const offerId = String(item.data?.offer_id || "");
    if (!offerId || accepting) return;
    setAccepting(item.id);
    try {
      await requestJson("/api/customer-notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "accept-offer", offer_id: offerId }),
      });
      await write({ action: "read", id: item.id });
      toast.success("Saat sizin için ayrıldı.", {
        description: "Yeni randevunuz Randevularım alanına eklendi.",
      });
    } catch (err: any) {
      toast.error(err?.message || "Bu saat artık alınamıyor.");
      await load(false);
    } finally {
      setAccepting("");
    }
  }

  async function requestPermission() {
    if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setPermission("unsupported");
      toast.error("Bu tarayıcı kilit ekranı bildirimlerini desteklemiyor.");
      return;
    }
    if (scope !== "business" || !tenantId) return;
    setPushBusy(true);
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result !== "granted") {
        toast.error(result === "denied" ? "Bildirim izni engellenmiş. Telefonun site ayarlarından izin verin." : "Bildirim izni verilmedi.");
        return;
      }
      const settings = await requestJson(`/api/push-subscriptions?tenant=${encodeURIComponent(tenantId)}`);
      if (!settings.configured || !settings.public_key) throw new Error("Kilit ekranı bildirimleri sunucuda henüz yapılandırılmadı.");
      const registration = await navigator.serviceWorker.register('/neta-push-sw.js');
      const bytes = Uint8Array.from(atob(settings.public_key.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(settings.public_key.length / 4) * 4, '=')), c => c.charCodeAt(0));
      const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes });
      const json = subscription.toJSON();
      await requestJson('/api/push-subscriptions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: tenantId, endpoint: subscription.endpoint, keys: json.keys }),
      });
      setPushActive(true);
      toast.success('Kilit ekranı bildirimleri açıldı.');
    } catch (error: any) {
      toast.error(error?.message || "Bildirimler etkinleştirilemedi.");
      setPermission(Notification.permission);
    } finally {
      setPushBusy(false);
    }
  }

  if (!scope || (scope === "business" && !tenantId)) return null;

  const unread = snapshot.unread_count;
  return (
    <>
      <button
        type="button"
        aria-label={`Bildirimler${unread ? `, ${unread} okunmamış` : ""}`}
        title="Bildirimler"
        onClick={() => setOpen(true)}
        style={{
          position: "fixed",
          right: 18,
          bottom: 20,
          zIndex: 90,
          width: 48,
          height: 48,
          borderRadius: 16,
          border: "1px solid rgba(255,255,255,.15)",
          background: "rgba(17,20,25,.96)",
          color: "inherit",
          display: "grid",
          placeItems: "center",
          cursor: "pointer",
          boxShadow: "0 14px 34px rgba(0,0,0,.36)",
        }}
      >
        <Bell size={20} />
        {unread > 0 && (
          <span
            style={{
              position: "absolute",
              right: -5,
              top: -6,
              minWidth: 21,
              height: 21,
              padding: "0 5px",
              borderRadius: 999,
              background: "#e85d5d",
              color: "#fff",
              fontSize: 11,
              fontWeight: 800,
              display: "grid",
              placeItems: "center",
              border: "2px solid #111419",
            }}
          >
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="presentation"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setOpen(false);
          }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 150,
            background: "rgba(0,0,0,.48)",
            backdropFilter: "blur(3px)",
          }}
        >
          <aside
            aria-label="Bildirimler"
            style={{
              position: "absolute",
              top: 12,
              right: 12,
              bottom: 12,
              width: "min(430px, calc(100vw - 24px))",
              borderRadius: 22,
              border: "1px solid rgba(255,255,255,.12)",
              background: "#111419",
              color: "#f5f5f5",
              boxShadow: "0 24px 70px rgba(0,0,0,.46)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: 18,
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                alignItems: "center",
                borderBottom: "1px solid rgba(255,255,255,.08)",
              }}
            >
              <div>
                <div style={{ fontSize: 18, fontWeight: 800 }}>Bildirimler</div>
                <div style={{ opacity: 0.62, fontSize: 12, marginTop: 3 }}>
                  {scope === "business"
                    ? "Yeni randevu, değişiklik ve iptaller burada toplanır."
                    : "Randevu değişiklikleri ve boşalan saat fırsatları burada toplanır."}
                </div>
              </div>
              <button
                type="button"
                aria-label="Kapat"
                onClick={() => setOpen(false)}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,.1)",
                  background: "transparent",
                  color: "inherit",
                  display: "grid",
                  placeItems: "center",
                  cursor: "pointer",
                }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: 14, borderBottom: "1px solid rgba(255,255,255,.08)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <span style={{ fontSize: 13 }}><strong>{unread}</strong> okunmamış</span>
                {unread > 0 && (
                  <button
                    type="button"
                    onClick={() => void write({ action: "read-all" })}
                    style={{ border: 0, background: "transparent", color: "#b7d4ad", cursor: "pointer", fontWeight: 700 }}
                  >
                    <CheckCheck size={15} style={{ verticalAlign: "middle", marginRight: 5 }} />
                    Tümünü okundu yap
                  </button>
                )}
              </div>
              {scope === 'business' && <button
                type="button"
                onClick={() => void requestPermission()}
                disabled={pushActive || pushBusy}
                style={{
                  marginTop: 10,
                  width: "100%",
                  padding: 10,
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,.08)",
                  background: "rgba(255,255,255,.035)",
                  color: "inherit",
                  cursor: pushActive || pushBusy ? "default" : "pointer",
                  textAlign: "left",
                }}
              >
                {pushActive ? (
                  <><CircleCheck size={15} style={{ verticalAlign: "middle", marginRight: 7 }} />Kilit ekranı bildirimleri açık</>
                ) : pushBusy ? (
                  <>Bildirimler açılıyor…</>
                ) : permission === "unsupported" ? (
                  <><CircleAlert size={15} style={{ verticalAlign: "middle", marginRight: 7 }} />Bu tarayıcı bildirim desteklemiyor</>
                ) : (
                  <><Bell size={15} style={{ verticalAlign: "middle", marginRight: 7 }} />{pushReady ? 'Kilit ekranı bildirimlerini aç' : 'Bildirimleri etkinleştir'}</>
                )}
              </button>}
            </div>

            <div style={{ overflowY: "auto", flex: 1, padding: 12 }}>
              {error && (
                <div style={{ padding: 11, borderRadius: 12, background: "rgba(232,93,93,.13)", marginBottom: 10, fontSize: 12 }}>
                  {error}
                </div>
              )}
              {!snapshot.notifications.length && !error && (
                <div style={{ padding: "48px 20px", textAlign: "center", opacity: 0.55 }}>
                  <Bell size={28} style={{ margin: "0 auto 10px" }} />
                  Henüz bildirim yok.
                </div>
              )}
              {snapshot.notifications.map((item) => {
                const offer = item.type === "waitlist.slot_available";
                const expires = item.data?.expires_at ? Date.parse(String(item.data.expires_at)) : 0;
                const offerActive = offer && !!item.data?.offer_id && (!expires || expires > Date.now());
                return (
                  <div
                    key={item.id}
                    style={{
                      padding: 13,
                      borderRadius: 15,
                      border: "1px solid rgba(255,255,255,.08)",
                      background: item.read ? "rgba(255,255,255,.025)" : "rgba(169,201,159,.09)",
                      marginBottom: 9,
                    }}
                  >
                    <div style={{ display: "flex", gap: 10 }}>
                      <span style={{ width: 34, height: 34, borderRadius: 11, background: "rgba(255,255,255,.06)", display: "grid", placeItems: "center", flex: "0 0 auto" }}>
                        {offer ? <Clock3 size={17} /> : <CalendarClock size={17} />}
                      </span>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <strong style={{ fontSize: 13 }}>{item.title}</strong>
                        <div style={{ fontSize: 12, opacity: 0.72, lineHeight: 1.45, marginTop: 4 }}>{item.message}</div>
                        <div style={{ fontSize: 10, opacity: 0.45, marginTop: 6 }}>
                          {new Date(item.created_at).toLocaleString("tr-TR")}
                        </div>
                      </div>
                    </div>
                    {offer && (
                      <div style={{ marginTop: 10 }}>
                        {offerActive ? (
                          <button
                            type="button"
                            disabled={!!accepting}
                            onClick={() => void acceptOffer(item)}
                            style={{
                              width: "100%",
                              border: 0,
                              borderRadius: 11,
                              padding: "10px 12px",
                              background: "#d7f2cd",
                              color: "#142012",
                              fontWeight: 800,
                              cursor: accepting ? "wait" : "pointer",
                            }}
                          >
                            {accepting === item.id ? "Saat ayrılıyor…" : "Bu saati al"}
                          </button>
                        ) : (
                          <div style={{ fontSize: 11, opacity: 0.55 }}>Bu saat teklifinin süresi doldu.</div>
                        )}
                      </div>
                    )}
                    {!item.read && (
                      <button
                        type="button"
                        onClick={() => void write({ action: "read", id: item.id })}
                        style={{ marginTop: 9, border: 0, background: "transparent", color: "#b7d4ad", padding: 0, cursor: "pointer", fontSize: 11, fontWeight: 700 }}
                      >
                        Okundu yap
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
