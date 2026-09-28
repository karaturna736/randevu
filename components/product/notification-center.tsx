"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bell,
  CalendarDays,
  CheckCheck,
  CircleAlert,
  CircleCheck,
  X,
} from "lucide-react";

type NotificationItem = {
  id: string;
  appointment_id?: string | null;
  type:
    | "appointment.created"
    | "appointment.updated"
    | "appointment.cancelled"
    | "appointment.payment_updated";
  title: string;
  message: string;
  created_at: string;
  read: boolean;
  data?: Record<string, any>;
};

type NotificationData = {
  unread_count: number;
  notifications: NotificationItem[];
};

function eventTitle(type: NotificationItem["type"]) {
  if (type === "appointment.created") return "Yeni randevu oluşturuldu";
  if (type === "appointment.cancelled") return "Randevu iptal edildi";
  if (type === "appointment.updated") return "Randevu değiştirildi";
  return "Randevu ödeme durumu değişti";
}

function eventBody(payload: any) {
  const data = payload?.data || {};
  return [
    data.customer_name,
    data.service_name,
    data.date && data.time ? `${data.date} ${data.time}` : data.date,
  ]
    .filter(Boolean)
    .join(" · ");
}

async function jsonRequest(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    cache: "no-store",
    credentials: "same-origin",
    ...init,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || "Bildirimler yüklenemedi.");
  return data;
}

export function NotificationCenter() {
  const [enabled, setEnabled] = useState(false);
  const [tenantId, setTenantId] = useState("");
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<NotificationData>({
    unread_count: 0,
    notifications: [],
  });
  const [error, setError] = useState("");
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(
    "unsupported",
  );
  const seenEventIds = useRef(new Set<string>());

  useEffect(() => {
    const path = window.location.pathname;
    const active = path.startsWith("/panel") && path !== "/panel/ek-paketler";
    setEnabled(active);
    if (!active) return;

    if ("Notification" in window) setPermission(Notification.permission);
    const query = new URLSearchParams(window.location.search);
    const requestedTenant = query.get("tenant") || "";
    if (requestedTenant) {
      setTenantId(requestedTenant);
      return;
    }

    void jsonRequest("/api/v1/workspace")
      .then((workspace) => {
        if (workspace?.business?.id && !workspace?.business?.demo) {
          setTenantId(String(workspace.business.id));
        }
      })
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    if (!tenantId) return;
    try {
      const next = await jsonRequest(
        `/api/notification-center?tenant=${encodeURIComponent(tenantId)}`,
      );
      setData({
        unread_count: Number(next?.unread_count || 0),
        notifications: Array.isArray(next?.notifications) ? next.notifications : [],
      });
      setError("");
    } catch (err: any) {
      setError(err?.message || "Bildirimler yüklenemedi.");
    }
  }, [tenantId]);

  useEffect(() => {
    if (!enabled || !tenantId) return;
    void load();
    const timer = window.setInterval(() => void load(), 30000);
    const onFocus = () => void load();
    const onVisibility = () => {
      if (document.visibilityState === "visible") void load();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled, tenantId, load]);

  useEffect(() => {
    if (!enabled || !tenantId) return;
    const source = new EventSource(
      `/api/v1/events?tenant=${encodeURIComponent(tenantId)}`,
    );
    const types: NotificationItem["type"][] = [
      "appointment.created",
      "appointment.updated",
      "appointment.cancelled",
      "appointment.payment_updated",
    ];

    const listeners = types.map((type) => {
      const handler = (event: Event) => {
        const message = event as MessageEvent;
        let payload: any = {};
        try {
          payload = JSON.parse(message.data || "{}");
        } catch {}
        const eventId = String(payload?.id || message.lastEventId || "");
        if (eventId && seenEventIds.current.has(eventId)) return;
        if (eventId) {
          seenEventIds.current.add(eventId);
          if (seenEventIds.current.size > 250) {
            const first = seenEventIds.current.values().next().value;
            if (first) seenEventIds.current.delete(first);
          }
        }
        window.setTimeout(() => void load(), 120);

        if (
          "Notification" in window &&
          Notification.permission === "granted" &&
          document.visibilityState !== "visible"
        ) {
          try {
            const notification = new Notification(eventTitle(type), {
              body: eventBody(payload) || "Randevu hareketi var.",
              icon: "/neta-logo.png",
              tag: eventId || `${type}-${Date.now()}`,
            });
            notification.onclick = () => {
              window.focus();
              window.location.assign(
                `/panel?tenant=${encodeURIComponent(tenantId)}&view=appointments`,
              );
            };
          } catch {}
        }
      };
      source.addEventListener(type, handler);
      return { type, handler };
    });

    return () => {
      for (const { type, handler } of listeners) {
        source.removeEventListener(type, handler);
      }
      source.close();
    };
  }, [enabled, tenantId, load]);

  const write = useCallback(
    async (payload: Record<string, unknown>) => {
      if (!tenantId) return;
      await jsonRequest("/api/notification-center", {
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
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
    } catch {
      setPermission(Notification.permission);
    }
  }

  if (!enabled || !tenantId) return null;

  const unread = data.unread_count;
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
          backdropFilter: "blur(12px)",
        }}
      >
        <Bell size={19} />
        {unread > 0 && (
          <span
            style={{
              position: "absolute",
              right: -4,
              top: -5,
              minWidth: 20,
              height: 20,
              padding: "0 5px",
              borderRadius: 999,
              background: "#e85d5d",
              color: "white",
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
            zIndex: 120,
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
              boxShadow: "0 24px 70px rgba(0,0,0,.46)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "18px 18px 14px",
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                alignItems: "center",
                borderBottom: "1px solid rgba(255,255,255,.08)",
              }}
            >
              <div>
                <div style={{ fontSize: 18, fontWeight: 800 }}>Bildirimler</div>
                <div style={{ opacity: 0.65, fontSize: 12, marginTop: 3 }}>
                  Randevu oluşturma, değişiklik ve iptaller burada toplanır.
                </div>
              </div>
              <button
                type="button"
                aria-label="Bildirimleri kapat"
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
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                }}
              >
                <div style={{ fontSize: 13 }}>
                  <strong>{unread}</strong> okunmamış bildirim
                </div>
                {unread > 0 && (
                  <button
                    type="button"
                    onClick={() => void write({ action: "read-all" })}
                    style={{
                      border: 0,
                      background: "transparent",
                      color: "#a9c99f",
                      fontSize: 12,
                      fontWeight: 700,
                      display: "inline-flex",
                      gap: 6,
                      alignItems: "center",
                      cursor: "pointer",
                    }}
                  >
                    <CheckCheck size={15} /> Tümünü okundu yap
                  </button>
                )}
              </div>

              <div
                style={{
                  marginTop: 12,
                  padding: 12,
                  borderRadius: 14,
                  border: "1px solid rgba(255,255,255,.08)",
                  background: "rgba(255,255,255,.035)",
                  fontSize: 12,
                  lineHeight: 1.5,
                }}
              >
                {permission === "granted" ? (
                  <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <CircleCheck size={16} /> Tarayıcı bildirimleri açık.
                  </span>
                ) : permission === "unsupported" ? (
                  <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <CircleAlert size={16} /> Bu tarayıcı doğrudan bildirim desteklemiyor.
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => void requestPermission()}
                    style={{
                      width: "100%",
                      border: 0,
                      background: "transparent",
                      color: "inherit",
                      padding: 0,
                      textAlign: "left",
                      cursor: "pointer",
                      display: "flex",
                      gap: 8,
                      alignItems: "center",
                    }}
                  >
                    <Bell size={16} /> Telefonda / bilgisayarda bildirim izni ver
                  </button>
                )}
                <div style={{ opacity: 0.58, marginTop: 7 }}>
                  Telefon ekranı kapalıyken en güvenilir uyarı için Neta WhatsApp bağlantısında işletme sahibi bildirim numarası tanımlı olmalıdır.
                </div>
              </div>
            </div>

            <div style={{ overflowY: "auto", padding: 12, flex: 1 }}>
              {error && (
                <div
                  style={{
                    marginBottom: 10,
                    padding: 10,
                    borderRadius: 12,
                    background: "rgba(232,93,93,.12)",
                    fontSize: 12,
                  }}
                >
                  {error}
                </div>
              )}
              {!data.notifications.length && !error ? (
                <div style={{ padding: "42px 18px", textAlign: "center", opacity: 0.58 }}>
                  <Bell size={28} style={{ margin: "0 auto 12px" }} />
                  Henüz bildirim yok.
                </div>
              ) : (
                data.notifications.map((item) => {
                  const cancelled = item.type === "appointment.cancelled";
                  const created = item.type === "appointment.created";
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        if (!item.read) void write({ action: "read", id: item.id });
                      }}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        border: "1px solid rgba(255,255,255,.08)",
                        background: item.read
                          ? "rgba(255,255,255,.025)"
                          : "rgba(169,201,159,.09)",
                        color: "inherit",
                        borderRadius: 15,
                        padding: 13,
                        marginBottom: 9,
                        cursor: "pointer",
                        display: "flex",
                        gap: 11,
                      }}
                    >
                      <span
                        style={{
                          flex: "0 0 auto",
                          width: 34,
                          height: 34,
                          borderRadius: 11,
                          display: "grid",
                          placeItems: "center",
                          background: cancelled
                            ? "rgba(232,93,93,.14)"
                            : created
                              ? "rgba(96,183,126,.14)"
                              : "rgba(255,255,255,.06)",
                        }}
                      >
                        {cancelled ? <CircleAlert size={17} /> : <CalendarDays size={17} />}
                      </span>
                      <span style={{ minWidth: 0, flex: 1 }}>
                        <span style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                          <strong style={{ fontSize: 13 }}>{item.title}</strong>
                          {!item.read && (
                            <span
                              aria-label="Okunmamış"
                              style={{
                                width: 8,
                                height: 8,
                                marginTop: 5,
                                borderRadius: 999,
                                background: "#a9c99f",
                                flex: "0 0 auto",
                              }}
                            />
                          )}
                        </span>
                        <span style={{ display: "block", fontSize: 12, opacity: 0.72, marginTop: 5 }}>
                          {item.message}
                        </span>
                        <span style={{ display: "block", fontSize: 11, opacity: 0.46, marginTop: 7 }}>
                          {new Date(item.created_at).toLocaleString("tr-TR", {
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
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
