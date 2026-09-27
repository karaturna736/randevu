"use client";

import { useState } from "react";
import { ArrowRight, KeyRound, ShieldCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Busy, Field } from "./common";

export default function BranchPasswordSetup({ target }: { target: any }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Şube şifresi en az 8 karakter olmalıdır.");
      return;
    }
    if (password !== confirm) {
      setError("Şifreler birbiriyle eşleşmiyor.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/v1/branch-password", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set",
          tenant_id: target.tenant_id,
          branch_id: target.branch_id,
          password,
        }),
      });
      const result: any = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Şube şifresi kaydedilemedi.");
      setPassword("");
      setConfirm("");
      location.replace("/panel?tenant=" + encodeURIComponent(target.tenant_id));
    } catch (e: any) {
      setError(e?.message || "Şube şifresi kaydedilemedi.");
      setBusy(false);
    }
  }

  return (
    <main className="member-page">
      <section className="panel form-stack" style={{ maxWidth: 620, margin: "48px auto" }}>
        <span className="account-gate-icon"><KeyRound size={30} /></span>
        <span className="eyebrow">ŞUBE GÜVENLİĞİ</span>
        <h1>Merkez şubeniz için bir şifre belirleyin.</h1>
        <p className="muted">
          {target.business_name} · {target.branch_name}. Müdür erişiminde bu şube diğer şubelerden ayrı doğrulanacak.
        </p>
        <form className="form-stack" onSubmit={submit}>
          <Field label="Şube şifresi">
            <Input
              required
              type="password"
              autoComplete="new-password"
              minLength={8}
              maxLength={72}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="En az 8 karakter"
            />
          </Field>
          <Field label="Şube şifresi tekrar">
            <Input
              required
              type="password"
              autoComplete="new-password"
              minLength={8}
              maxLength={72}
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              placeholder="Şifreyi tekrar girin"
            />
          </Field>
          <div className="notice">
            <ShieldCheck size={18} />
            Şifre düz metin olarak saklanmaz. Sunucuda benzersiz salt ile PBKDF2-SHA256 kullanılarak hashlenir.
          </div>
          {error && <p className="error-message" role="alert">{error}</p>}
          <button className="button primary full" disabled={busy}>
            {busy ? <Busy /> : <KeyRound size={17} />}
            Şifreyi kaydet ve panele geç
            {!busy && <ArrowRight size={16} />}
          </button>
        </form>
      </section>
    </main>
  );
}
