"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, CalendarDays, CheckCheck, CircleAlert, CircleCheck, X } from "lucide-react";

type NotificationType =
  | "appointment.created"
  | "appointment.updated"
  | "appointment.cancelled"
  | "appointment.payment_updated";

type NotificationItem = {
  id: string;
  appointment_id?: string | null;
  type: NotificationType;
  title: string;
  message: string;
  created_at: string;
  read: boolean;
  data?: Record<string, unknown>;
};

type NotificationData = {
  unread_count: number;
  notifications: NotificationItem[];
};

type WorkspaceResponse = {
  business?: { id?: string; demo?: boolean };
};

type ApiErrorResponse = { error?: string };

type EventPayload = {
  id?: string;
  data?: {
    customer_name?: string;
    service_name?: string;
    date?: string;
    time?: string;
  };
};

async function jsonRequest<T = unknown>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    credentials: "same-origin",
    ...init,
  });
  const data: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = data as ApiErrorResponse;
    throw new Error(error.error || "Bildirimler yüklenemedi.");
  }
  return data as T;
}

function systemTitle(type: NotificationType) {
  if (type === "appointment.created") return "Yeni randevu oluşturuldu";
  if (type === "appointment.cancelled") return "Randevu iptal edildi";
  if (type === "appointment.updated") return "Randevu değiştirildi";
  return "Randevu ödeme durumu değişti";
}

function systemBody(payload: EventPayload) {
  return [
    payload.data?.customer_name,
    payload.data?.service_name,
    payload.data?.date && payload.data?.time
      ? `${payload.data.date} ${payload.data.time}`
      : payload.data?.date,
  ]
    .filter(Boolean)
    .join(" · ");
}

const panelStyle: React.CSSProperties = {
  position: "fixed",
  top: 12,
  right: 12,
  bottom: 12,
  width: "min(430px, calc(100vw - 24px))",
  borderRadius: 22,
  border: "1px solid rgba(255,255,255,.12)",
  background: "#111419",
  boxShadow: "0 24px 70px rgba(0,0,0,.46)",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
};

export function NotificationCenter() {
  const [active, setActive] = useState(false);
  const [tenantId, setTenantId] = useState("");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("unsupported");
  const [data, setData] = useState<NotificationData>({ unread_count: 0, notifications: [] });
  const seenEvents = useRef(new Set<string>());

  useEffect(() => {
    const isPanel = window.location.pathname.startsWith("/panel");
    setActive(isPanel);
    if (!isPanel) return;

    if ("Notification" in window) setPermission(Notification.permission);

    const queryTenant = new URLSearchParams(window.location.search).get("tenant") || "";
    if (queryTenant) {
      setTenantId(queryTenant);
      return;
    }

    void jsonRequest<WorkspaceResponse>("/api/v1/workspace")
      .then((workspace) => {
        if (workspace.business?.id && !workspace.business.demo) {
          setTenantId(workspace.business.id);
        }
      })
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    if (!tenantId) return;
    try {
      const next = await jsonRequest<NotificationData>(
        `/api/notification-center?tenant=${encodeURIComponent(tenantId)}`,
      );
      setData({
        unread_count: Number(next.unread_count || 0),
        notifications: Array.isArray(next.notifications) ? next.notifications : [],
      });
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bildirimler yüklenemedi.");
    }
  }, [tenantId]);

  useEffect(() => {
    if (!active || !tenantId) return;
    void load();
    const timer = window.setInterval(() => void load(), 30000);
    const refresh = () => void load();
    const visibility = () => document.visibilityState === "visible" && void load();
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [active, tenantId, load]);

  useEffect(() => {
    if (!active || !tenantId) return;
    const source = new EventSource(`/api/v1/events?tenant=${encodeURIComponent(tenantId)}`);
    const types: NotificationType[] = [
      "appointment.created",
      "appointment.updated",
      "appointment.cancelled",
      "appointment.payment_updated",
    ];

    const handlers = types.map((type) => {
      const handler = (event: Event) => {
        const message = event as MessageEvent<string>;
        let payload: EventPayload = {};
        try {
          payload = JSON.parse(message.data || "{}") as EventPayload;
        } catch {}

        const eventId = String(payload.id || message.lastEventId || "");
        if (eventId && seenEvents.current.has(eventId)) return;
        if (eventId) {
          seenEvents.current.add(eventId);
          if (seenEvents.current.size > 250) {
            const oldest = seenEvents.current.values().next().value as string | undefined;
            if (oldest) seenEvents.current.delete(oldest);
          }
        }

        window.setTimeout(() => void load(), 100);

        if (
          "Notification" in window &&
          Notification.permission === "granted" &&
          document.visibilityState !== "visible"
        ) {
          try {
            const notice = new Notification(systemTitle(type), {
              body: systemBody(payload) || "Randevu hareketi var.",
              icon: "/neta-logo.png",
              tag: eventId || `${type}-${Date.now()}`,
            });
            notice.onclick = () => {
              window.focus();
              window.location.assign(`/panel?tenant=${encodeURIComponent(tenantId)}&view=appointments`);
            };
          } catch {}
        }
      };
      source.addEventListener(type, handler);
      return { type, handler };
    });

    return () => {
      for (const { type, handler } of handlers) source.removeEventListener(type, handler);
      source.close();
    };
  }, [active, tenantId, load]);

  const mark = useCallback(
    async (payload: { action: "read-all" } | { action: "read"; id: string }) => {
      if (!tenantId) return;
      await jsonRequest<{ ok: boolean }>("/api/notification-center", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenant_id: tenantId, ...payload }),
      });
      await load();
    },
    [tenantId, load],
  );

  async function requestPermission() {
    if (!("Notification" in window)) {
      setPermission("unsupported");
      return;
    }
    const result = await Notification.requestPermission().catch(() => Notification.permission);
    setPermission(result);
  }

  if (!active || !tenantId) return null;

  return (
    <>
      <button
        type="button"
        aria-label={`Bildirimler${data.unread_count ? `, ${data.unread_count} okunmamış` : ""}`}
        title="Bildirimler"
        onClick={() => setOpen(true)}
        style={{
          position: "fixed",
          right: 18,
          top: 82,
          zIndex: 70,
          width: 44,
          height: 44,
          borderRadius: 14,
          border: "1px solid rgba(255,255,255,.13)",
          background: "rgba(15,18,22,.94)",
          color: "inherit",
          display: "grid",
          placeItems: "center",
          cursor: "pointer",
          boxShadow: "0 12px 30px rgba(0,0,0,.28)",
        }}
      >
        <Bell size={19} />
        {data.unread_count > 0 && (
          <span style={{ position: "absolute", right: -5, top: -6, minWidth: 20, height: 20, padding: "0 5px", borderRadius: 999, background: "#e85d5d", color: "white", fontSize: 11, fontWeight: 800, display: "grid", placeItems: "center", border: "2px solid #111419" }}>
            {data.unread_count > 99 ? "99+" : data.unread_count}
          </span>
        )}
      </button>

      {open && (
        <div
          role="presentation"
          onMouseDown={(event) => event.currentTarget === event.target && setOpen(false)}
          style={{ position: "fixed", inset: 0, zIndex: 120, background: "rgba(0,0,0,.48)", backdropFilter: "blur(3px)" }}
        >
          <aside aria-label="Bildirimler" style={panelStyle}>
            <header style={{ padding: 18, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, borderBottom: "1px solid rgba(255,255,255,.08)" }}>
              <div>
                <strong style={{ fontSize: 18 }}>Bildirimler</strong>
                <div style={{ opacity: 0.62, fontSize: 12, marginTop: 4 }}>Randevu oluşturma, değişiklik ve iptaller burada toplanır.</div>
              </div>
              <button type="button" aria-label="Kapat" onClick={() => setOpen(false)} style={{ width: 36, height: 36, borderRadius: 12, border: "1px solid rgba(255,255,255,.1)", background: "transparent", color: "inherit", display: "grid", placeItems: "center", cursor: "pointer" }}>
                <X size={18} />
              </button>
            </header>

            <div style={{ padding: 14, borderBottom: "1px solid rgba(255,255,255,.08)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, fontSize: 13 }}>
                <span><strong>{data.unread_count}</strong> okunmamış bildirim</span>
                {data.unread_count > 0 && (
                  <button type="button" onClick={() => void mark({ action: "read-all" })} style={{ border: 0, background: "transparent", color: "#a9c99f", fontSize: 12, fontWeight: 700, display: "inline-flex", gap: 6, alignItems: "center", cursor: "pointer" }}>
                    <CheckCheck size={15} /> Tümünü okundu yap
                  </button>
                )}
              </div>

              <div style={{ marginTop: 12, padding: 12, borderRadius: 14, border: "1px solid rgba(255,255,255,.08)", background: "rgba(255,255,255,.035)", fontSize: 12, lineHeight: 1.5 }}>
                {permission === "granted" ? (
                  <span style={{ display: "flex", gap: 8, alignItems: "center" }}><CircleCheck size={16} /> Tarayıcı bildirimleri açık.</span>
                ) : permission === "unsupported" ? (
                  <span style={{ display: "flex", gap: 8, alignItems: "center" }}><CircleAlert size={16} /> Bu tarayıcı doğrudan bildirim desteklemiyor.</span>
                ) : (
                  <button type="button" onClick={() => void requestPermission()} style={{ width: "100%", border: 0, background: "transparent", color: "inherit", padding: 0, textAlign: "left", cursor: "pointer", display: "flex", gap: 8, alignItems: "center" }}>
                    <Bell size={16} /> Telefonda / bilgisayarda bildirim izni ver
                  </button>
                )}
                <div style={{ opacity: 0.58, marginTop: 7 }}>Telefon ekranı kapalıyken en güvenilir uyarı için Neta WhatsApp bağlantısında işletme sahibi bildirim numarası tanımlı olmalıdır.</div>
              </div>
            </div>

            <div style={{ overflowY: "auto", padding: 12, flex: 1 }}>
              {error && <div style={{ marginBottom: 10, padding: 10, borderRadius: 12, background: "rgba(232,93,93,.12)", fontSize: 12 }}>{error}</div>}
              {!data.notifications.length && !error ? (
                <div style={{ padding: "42px 18px", textAlign: "center", opacity: 0.58 }}><Bell size={28} style={{ margin: "0 auto 12px" }} />Henüz bildirim yok.</div>
              ) : (
                data.notifications.map((item) => {
                  const cancelled = item.type === "appointment.cancelled";
                  const created = item.type === "appointment.created";
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => !item.read && void mark({ action: "read", id: item.id })}
                      style={{ width: "100%", textAlign: "left", border: "1px solid rgba(255,255,255,.08)", background: item.read ? "rgba(255,255,255,.025)" : "rgba(169,201,159,.09)", color: "inherit", borderRadius: 15, padding: 13, marginBottom: 9, cursor: "pointer", display: "flex", gap: 11 }}
                    >
                      <span style={{ flex: "0 0 auto", width: 34, height: 34, borderRadius: 11, display: "grid", placeItems: "center", background: cancelled ? "rgba(232,93,93,.14)" : created ? "rgba(96,183,126,.14)" : "rgba(255,255,255,.06)" }}>
                        {cancelled ? <CircleAlert size={17} /> : <CalendarDays size={17} />}
                      </span>
                      <span style={{ minWidth: 0, flex: 1 }}>
                        <span style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                          <strong style={{ fontSize: 13 }}>{item.title}</strong>
                          {!item.read && <span aria-label="Okunmamış" style={{ width: 8, height: 8, marginTop: 5, borderRadius: 999, background: "#a9c99f", flex: "0 0 auto" }} />}
                        </span>
                        <span style={{ display: "block", fontSize: 12, opacity: 0.72, marginTop: 5 }}>{item.message}</span>
                        <span style={{ display: "block", fontSize: 11, opacity: 0.46, marginTop: 7 }}>
                          {new Date(item.created_at).toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
