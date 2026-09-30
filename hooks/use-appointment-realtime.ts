"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { toast } from "sonner";

export function playNotificationSound() {
  if (typeof window === "undefined") return;
  const soundEnabled = localStorage.getItem("neta_sound_enabled") !== "false";
  if (!soundEnabled) return;
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
    osc.frequency.exponentialRampToValueAtTime(659.25, ctx.currentTime + 0.15); // E5
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch {
    // Audio Context blocked or unsupported
  }
}

export function useAppointmentRealtime({
  tenantId,
  enabled = true,
  onRefresh,
  onHighlight,
}: {
  tenantId?: string;
  enabled?: boolean;
  onRefresh: (tenantId?: string) => Promise<void> | void;
  onHighlight?: (appointmentId: string) => void;
}) {
  const [isSSEConnected, setIsSSEConnected] = useState(false);
  const processedEventsRef = useRef<Set<string>>(new Set());
  const pollingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const refreshRunningRef = useRef(false);
  const refreshPendingRef = useRef(false);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeTenantRef = useRef(tenantId);
  const scheduleRefreshRef = useRef<() => void>(() => {});
  activeTenantRef.current = tenantId;

  const scheduleRefresh = useCallback(() => {
    if (!tenantId || activeTenantRef.current !== tenantId || document.visibilityState !== "visible") return;
    refreshPendingRef.current = true;
    if (refreshTimerRef.current || refreshRunningRef.current) return;
    refreshTimerRef.current = setTimeout(async () => {
      refreshTimerRef.current = null;
      if (!refreshPendingRef.current || document.visibilityState !== "visible") return;
      refreshPendingRef.current = false;
      refreshRunningRef.current = true;
      try {
        await onRefresh(tenantId);
      } catch (error) {
        console.error("Appointment refresh failed:", error);
      } finally {
        refreshRunningRef.current = false;
        if (refreshPendingRef.current) scheduleRefreshRef.current();
      }
    }, 250);
  }, [tenantId, onRefresh]);
  scheduleRefreshRef.current = scheduleRefresh;

  const startPolling = useCallback(() => {
    if (pollingTimerRef.current) return;
    pollingTimerRef.current = setInterval(() => {
      scheduleRefresh();
    }, 30000);
  }, [scheduleRefresh]);

  const stopPolling = useCallback(() => {
    if (pollingTimerRef.current) {
      clearInterval(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!enabled || !tenantId || tenantId === "demo") {
      setIsSSEConnected(false);
      stopPolling();
      return;
    }

    let isMounted = true;
    let openedOnce = false;
    const url = `/api/v1/events?tenant=${encodeURIComponent(tenantId)}`;
    const es = new EventSource(url);
    eventSourceRef.current = es;
    const connectionFallbackTimer = window.setTimeout(() => {
      if (isMounted && es.readyState !== EventSource.OPEN) {
        startPolling();
      }
    }, 10000);

    es.onopen = () => {
      if (!isMounted) return;
      window.clearTimeout(connectionFallbackTimer);
      setIsSSEConnected(true);
      stopPolling();
      // Initial page load already fetches the workspace. Reconcile only when
      // reconnecting after an interruption.
      if (openedOnce) scheduleRefresh();
      openedOnce = true;
    };

    const handleEvent = (e: MessageEvent, type: string) => {
      if (!isMounted) return;
      try {
        const payload = JSON.parse(e.data);
        const eventId = payload.id || e.lastEventId;
        const appointmentId = payload.appointmentId;

        // Duplicate protection by event ID
        if (eventId && processedEventsRef.current.has(eventId)) {
          return;
        }
        if (eventId) {
          processedEventsRef.current.add(eventId);
          // Keep set manageable
          if (processedEventsRef.current.size > 500) {
            const first = processedEventsRef.current.values().next().value;
            if (first) processedEventsRef.current.delete(first);
          }
        }

        // Trigger refetch
        scheduleRefresh();

        if (appointmentId && onHighlight) {
          onHighlight(appointmentId);
        }

        const data = payload.data || {};

        if (type === "appointment.created") {
          playNotificationSound();
          toast.success("Yeni randevu alındı", {
            description: [
              data.customer_name ? `Müşteri: ${data.customer_name}` : "",
              data.service_name ? `Hizmet: ${data.service_name}` : "",
              data.time ? `Saat: ${data.time} (${data.date || ""})` : "",
              data.staff_name ? `Personel: ${data.staff_name}` : "",
              data.branch_name ? `Şube: ${data.branch_name}` : "",
            ]
              .filter(Boolean)
              .join(" • "),
            duration: 6000,
          });
        } else if (type === "appointment.updated") {
          toast.info("Randevu güncellendi", {
            description: `${data.customer_name || "Müşteri"} - ${data.service_name || "Hizmet"} (${data.time || ""})`,
            duration: 4000,
          });
        } else if (type === "appointment.cancelled") {
          toast.error("Randevu iptal edildi", {
            description: `${data.customer_name || "Müşteri"} - ${data.service_name || "Hizmet"}`,
            duration: 4000,
          });
        } else if (type === "appointment.payment_updated") {
          toast.info("Randevu ödeme durumu güncellendi", {
            description: `${data.customer_name || "Müşteri"}`,
            duration: 4000,
          });
        }
      } catch (err) {
        console.error("SSE message parsing error:", err);
      }
    };

    es.addEventListener("connected", () => {
      if (!isMounted) return;
      setIsSSEConnected(true);
      stopPolling();
    });

    es.addEventListener("appointment.created", (e) =>
      handleEvent(e as MessageEvent, "appointment.created"),
    );
    es.addEventListener("appointment.updated", (e) =>
      handleEvent(e as MessageEvent, "appointment.updated"),
    );
    es.addEventListener("appointment.cancelled", (e) =>
      handleEvent(e as MessageEvent, "appointment.cancelled"),
    );
    es.addEventListener("appointment.payment_updated", (e) =>
      handleEvent(e as MessageEvent, "appointment.payment_updated"),
    );

    es.onerror = () => {
      if (!isMounted) return;
      setIsSSEConnected(false);
      startPolling();
    };

    return () => {
      isMounted = false;
      window.clearTimeout(connectionFallbackTimer);
      stopPolling();
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
      refreshPendingRef.current = false;
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [tenantId, enabled, onHighlight, scheduleRefresh, startPolling, stopPolling]);

  // Handle visibility change tab return
  useEffect(() => {
    if (!enabled || !tenantId || tenantId === "demo") return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        scheduleRefresh();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [tenantId, enabled, scheduleRefresh]);

  return { isSSEConnected };
}
