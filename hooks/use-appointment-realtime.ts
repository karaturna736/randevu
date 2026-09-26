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

  const startPolling = useCallback(() => {
    if (pollingTimerRef.current) return;
    pollingTimerRef.current = setInterval(() => {
      if (tenantId) {
        onRefresh(tenantId);
      }
    }, 30000);
  }, [tenantId, onRefresh]);

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
    const url = `/api/v1/events?tenant=${encodeURIComponent(tenantId)}`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onopen = () => {
      if (!isMounted) return;
      setIsSSEConnected(true);
      stopPolling();
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
        onRefresh(tenantId);

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
      stopPolling();
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [tenantId, enabled, onRefresh, onHighlight, startPolling, stopPolling]);

  // Handle visibility change tab return
  useEffect(() => {
    if (!enabled || !tenantId || tenantId === "demo") return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        onRefresh(tenantId);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [tenantId, enabled, onRefresh]);

  return { isSSEConnected };
}
