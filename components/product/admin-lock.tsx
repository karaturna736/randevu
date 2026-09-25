"use client";

import { useState } from "react";
import { KeyRound, LockKeyhole } from "lucide-react";
import { Input } from "@/components/ui/input";
import { PublicShell } from "./public";
import { Busy } from "./common";

type AdminAccessResponse = { error?: string };

export default function AdminLock() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = (await response.json().catch(() => ({}))) as AdminAccessResponse;
      if (!response.ok) throw new Error(data.error || "Giriş doğrulanamadı.");
      location.replace("/admin");
    } catch (e: any) {
      setError(e.message || "Giriş doğrulanamadı.");
      setPassword("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <PublicShell>
      <main className="auth-main" style={{ minHeight: "75vh" }}>
        <section className="panel" style={{ width: "min(520px, 100%)", margin: "auto" }}>
          <div className="section-heading">
            <span className="module-icon"><LockKeyhole /></span>
            <div>
              <span className="eyebrow">NETA · YÖNETİCİ KİLİDİ</span>
              <h1>Yönetim merkezini açın.</h1>
              <p className="muted">Google ile yetkili hesabınıza giriş yaptıktan sonra yalnızca sizin bildiğiniz ikinci şifre istenir.</p>
            </div>
          </div>
          <form className="form-stack margin-top" onSubmit={submit}>
            <label className="field">
              <span>Yönetici şifresi</span>
              <Input
                type="password"
                autoComplete="current-password"
                minLength={12}
                maxLength={256}
                required
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            {error && <p className="error-message" role="alert">{error}</p>}
            <button className="button primary full" disabled={busy || password.length < 12}>
              {busy ? <Busy /> : <KeyRound size={17} />} Yönetim merkezini aç
            </button>
          </form>
          <p className="helper margin-top">Bu şifre GitHub koduna yazılmaz. Sunucuda yalnızca doğrulama özeti tutulur ve yönetici kilidi 8 saat sonra yeniden sorulur.</p>
        </section>
      </main>
    </PublicShell>
  );
}
