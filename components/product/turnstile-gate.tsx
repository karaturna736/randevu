"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import { ShieldCheck } from "lucide-react";
import styles from "./turnstile-gate.module.css";

const SITE_KEY = "0x4AAAAAAFEvYrCvGUGdg-xb";

declare global {
  interface Window {
    turnstile?: {
      render: (element: HTMLElement, options: Record<string, unknown>) => string;
      reset: (id?: string) => void;
    };
  }
}

export default function TurnstileGate() {
  const host = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const [ready, setReady] = useState(false);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState("");

  function renderWidget() {
    if (!host.current || !window.turnstile || widgetId.current) return;
    widgetId.current = window.turnstile.render(host.current, {
      sitekey: SITE_KEY,
      action: "auth",
      theme: "auto",
      size: "flexible",
      callback: async (token: string) => {
        setError("");
        try {
          const response = await fetch("/api/auth/turnstile", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token }),
          });
          if (!response.ok) throw new Error("verification failed");
          setVerified(true);
        } catch {
          setError("Doğrulama tamamlanamadı. Lütfen yeniden deneyin.");
          window.turnstile?.reset(widgetId.current || undefined);
        }
      },
      "expired-callback": () => window.turnstile?.reset(widgetId.current || undefined),
      "error-callback": () => setError("Güvenlik doğrulaması yüklenemedi. Sayfayı yenileyin."),
    });
  }

  useEffect(() => {
    if (ready) renderWidget();
  }, [ready]);

  if (verified) return null;

  return (
    <div className={styles.gate} role="dialog" aria-modal="true" aria-label="Güvenlik doğrulaması">
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onLoad={() => setReady(true)}
      />
      <div className={styles.card}>
        <span className={styles.icon}><ShieldCheck size={24} /></span>
        <h2>Güvenlik kontrolü</h2>
        <p>Girişe devam etmek için kısa bot kontrolünü tamamlayın.</p>
        <div ref={host} className={styles.widget} />
        {error && <p className={styles.error} role="alert">{error}</p>}
      </div>
    </div>
  );
}
