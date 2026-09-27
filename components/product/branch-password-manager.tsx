"use client";

import { useEffect, useState } from "react";
import { Check, KeyRound, LockKeyhole, ShieldCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Busy, Field } from "./common";

async function request(path: string, init?: RequestInit) {
  const response = await fetch(path, {
    credentials: "same-origin",
    cache: "no-store",
    ...init,
  });
  const data: any = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "İşlem tamamlanamadı.");
  return data;
}

export default function BranchPasswordManager({
  tenantId,
  businessName,
}: {
  tenantId: string;
  businessName: string;
}) {
  const [branches, setBranches] = useState<any[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    setError("");
    try {
      const result = await request(
        "/api/v1/branch-password?tenant=" + encodeURIComponent(tenantId),
      );
      setBranches(result.branches || []);
    } catch (e: any) {
      setError(e?.message || "Şubeler yüklenemedi.");
    }
  }

  useEffect(() => {
    void load();
  }, [tenantId]);

  function start(branchId: string) {
    setEditing(branchId);
    setPassword("");
    setConfirm("");
    setError("");
    setMessage("");
  }

  async function save(event: React.FormEvent, branch: any) {
    event.preventDefault();
    setError("");
    setMessage("");
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
      await request("/api/v1/branch-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set",
          tenant_id: tenantId,
          branch_id: branch.id,
          password,
        }),
      });
      setEditing(null);
      setPassword("");
      setConfirm("");
      setMessage(`${branch.name} şifresi güncellendi.`);
      await load();
    } catch (e: any) {
      setError(e?.message || "Şube şifresi kaydedilemedi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="member-page">
      <div className="member-heading">
        <div>
          <span className="eyebrow">ŞUBE GÜVENLİĞİ</span>
          <h1>Her şubenin şifresi ayrı.</h1>
          <p>{businessName} içindeki müdür erişim şifrelerini buradan yönetin.</p>
        </div>
        <a className="button" href={"/panel?tenant=" + encodeURIComponent(tenantId)}>
          Panele dön
        </a>
      </div>

      <div className="notice">
        <ShieldCheck size={18} />
        Şifreler görüntülenemez; yalnızca yenisiyle değiştirilebilir. Veritabanında düz metin parola tutulmaz.
      </div>

      {message && <div className="notice success" role="status"><Check size={18} />{message}</div>}
      {error && <p className="error-message" role="alert">{error}</p>}

      <div className="form-stack" style={{ marginTop: 24 }}>
        {branches.map((branch) => (
          <section className="panel" key={branch.id}>
            <div className="section-heading">
              <div>
                <h2><LockKeyhole size={18} /> {branch.name}</h2>
                <p className="muted">
                  {branch.city || "Şehir belirtilmedi"} · {branch.is_primary ? "Merkez şube" : "Şube"}
                </p>
              </div>
              <span className={branch.has_password ? "badge success" : "badge neutral"}>
                {branch.has_password ? "Şifreli" : "Şifre bekliyor"}
              </span>
            </div>

            {editing === branch.id ? (
              <form className="form-stack" onSubmit={(event) => save(event, branch)}>
                <div className="form-grid">
                  <Field label="Yeni şube şifresi">
                    <Input
                      required
                      type="password"
                      autoComplete="new-password"
                      minLength={8}
                      maxLength={72}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                    />
                  </Field>
                  <Field label="Şifre tekrar">
                    <Input
                      required
                      type="password"
                      autoComplete="new-password"
                      minLength={8}
                      maxLength={72}
                      value={confirm}
                      onChange={(event) => setConfirm(event.target.value)}
                    />
                  </Field>
                </div>
                <div className="button-group">
                  <button className="button primary" disabled={busy}>
                    {busy ? <Busy /> : <KeyRound size={16} />}
                    Şifreyi kaydet
                  </button>
                  <button
                    type="button"
                    className="button"
                    disabled={busy}
                    onClick={() => setEditing(null)}
                  >
                    Vazgeç
                  </button>
                </div>
              </form>
            ) : (
              <button className="button" onClick={() => start(branch.id)}>
                <KeyRound size={16} />
                {branch.has_password ? "Şifreyi değiştir" : "Şifre belirle"}
              </button>
            )}
          </section>
        ))}
      </div>
    </main>
  );
}
