"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  CalendarDays,
  Database,
  History,
  Link2,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
  Users,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { PublicShell } from "./public";
import { api, Blank, Busy, Confirm, Field, Modal } from "./common";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { dateLabel, STATUS, time } from "@/lib/types";

type View = "businesses" | "users" | "appointments" | "customers" | "audit";

async function systemApi(body?: any) {
  const r = await fetch("/api/admin-system", {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json().catch(() => ({ error: "Bağlantı kurulamadı." }));
  if (!r.ok) throw new Error(data.error || "İşlem tamamlanamadı.");
  return data;
}

function contains(query: string, ...values: any[]) {
  if (!query) return true;
  const text = values
    .filter((value) => value !== null && value !== undefined)
    .join(" ")
    .toLocaleLowerCase("tr-TR");
  return text.includes(query.toLocaleLowerCase("tr-TR"));
}

export default function AdminSystemControl() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<View>("businesses");
  const [search, setSearch] = useState("");
  const [confirm, setConfirm] = useState<any>(null);
  const [editCustomer, setEditCustomer] = useState<any>(null);
  const [linkAppointment, setLinkAppointment] = useState<any>(null);

  async function load() {
    try {
      setData(await systemApi());
      setError("");
    } catch (e: any) {
      setError(e.message || "Kontrol merkezi yüklenemedi.");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function runExisting(body: any) {
    setBusy(true);
    try {
      await api("admin", body);
      toast.success("İşlem kaydedildi.");
      setConfirm(null);
      await load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function runSystem(body: any) {
    setBusy(true);
    try {
      await systemApi(body);
      toast.success("İşlem kaydedildi.");
      setConfirm(null);
      setEditCustomer(null);
      setLinkAppointment(null);
      await load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  const filtered = useMemo(() => {
    if (!data) return [];
    if (view === "businesses")
      return data.businesses.filter((b: any) =>
        contains(search, b.name, b.slug, b.category, b.city, b.status, b.id),
      );
    if (view === "users")
      return data.users.filter((u: any) =>
        contains(search, u.name, u.email, u.phone, u.account_type, u.user_id),
      );
    if (view === "appointments")
      return data.appointments.filter((a: any) =>
        contains(
          search,
          a.id,
          a.business_name,
          a.customer_name,
          a.customer_phone,
          a.account_email,
          a.status,
          a.source,
          a.date,
        ),
      );
    if (view === "customers")
      return data.customers.filter((c: any) =>
        contains(search, c.name, c.phone, c.email, c.business_name, c.id),
      );
    return data.recent_audit.filter((a: any) =>
      contains(search, a.actor_name, a.actor_email, a.action, a.target_id),
    );
  }, [data, search, view]);

  const integrityProblems = data
    ? Number(data.diagnostics?.orphan_account_bookings || 0) +
      Number(data.diagnostics?.orphan_account_profiles || 0) +
      Number(data.diagnostics?.orphan_slots || 0) +
      Number(data.diagnostics?.orphan_appointment_customers || 0)
    : 0;

  return (
    <PublicShell>
      <main className="admin-page">
        <div className="page-heading">
          <div>
            <span className="eyebrow">SİSTEM KONTROL MERKEZİ</span>
            <h1>Admin araç kutusu.</h1>
            <p>
              Yapay zekâya ihtiyaç duymadan kayıtları bul, güvenli düzeltmeleri yap ve
              sistem durumunu kontrol et.
            </p>
          </div>
          <div className="button-group">
            <Link className="button" href="/admin">
              <ArrowLeft size={16} /> Admin ana sayfa
            </Link>
            <button className="button primary" onClick={load} disabled={busy}>
              <RefreshCw size={16} /> Yenile
            </button>
          </div>
        </div>

        {error ? (
          <section className="panel">
            <Blank title="Kontrol merkezi açılamadı" description={error} />
            <button className="button primary" onClick={load}>
              Tekrar dene
            </button>
          </section>
        ) : !data ? (
          <div className="loading-row">
            <Busy /> Sistem verileri yükleniyor…
          </div>
        ) : (
          <>
            <div className="stats-grid">
              {[
                { label: "İşletmeler", value: data.counts.businesses, icon: Building2 },
                { label: "Kullanıcılar", value: data.counts.users, icon: Users },
                { label: "Randevular", value: data.counts.appointments, icon: CalendarDays },
                { label: "Müşteri kayıtları", value: data.counts.customers, icon: UserRound },
              ].map((item) => (
                <section className="stat-card" key={item.label}>
                  <div className="stat-top">
                    {item.label}
                    <item.icon size={19} />
                  </div>
                  <strong className="stat-value">{item.value}</strong>
                </section>
              ))}
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))",
                gap: 16,
                marginTop: 16,
              }}
            >
              <section className="panel">
                <div className="stat-top">
                  <strong>Sistem sağlığı</strong>
                  <Database size={18} />
                </div>
                <p>
                  Veritabanı: <strong>{data.health.database === "ok" ? "Çalışıyor" : "Sorun"}</strong>
                </p>
                <p>
                  Admin doğrulaması: <strong>{data.health.admin === "ok" ? "Çalışıyor" : "Sorun"}</strong>
                </p>
                <span className={integrityProblems ? "badge" : "badge neutral"}>
                  {integrityProblems ? (
                    <AlertTriangle size={14} />
                  ) : (
                    <ShieldCheck size={14} />
                  )}
                  {integrityProblems
                    ? `${integrityProblems} veri bütünlüğü uyarısı`
                    : "Veri bütünlüğü temiz"}
                </span>
              </section>

              <section className="panel">
                <div className="stat-top">
                  <strong>Dikkat isteyenler</strong>
                  <Wrench size={18} />
                </div>
                <p>Onay bekleyen işletme: <strong>{data.counts.pending_businesses}</strong></p>
                <p>Devre dışı kullanıcı: <strong>{data.counts.disabled_users}</strong></p>
                <p>Ödeme kontrolü gereken kayıt: <strong>{data.counts.payment_attention}</strong></p>
              </section>

              <section className="panel">
                <div className="stat-top">
                  <strong>Veri kontrolü</strong>
                  <ShieldCheck size={18} />
                </div>
                <p>Bozuk randevu-hesap bağlantısı: <strong>{data.diagnostics.orphan_account_bookings}</strong></p>
                <p>Eksik kullanıcı profili bağlantısı: <strong>{data.diagnostics.orphan_account_profiles}</strong></p>
                <p>Boşta takvim slotu: <strong>{data.diagnostics.orphan_slots}</strong></p>
                <p>Eksik müşteri bağlantısı: <strong>{data.diagnostics.orphan_appointment_customers}</strong></p>
              </section>
            </div>

            <section className="panel" style={{ marginTop: 16 }}>
              <div className="stat-top">
                <strong>Diğer admin araçları</strong>
                <Wrench size={18} />
              </div>
              <div className="button-group" style={{ flexWrap: "wrap" }}>
                <Link className="button small" href="/admin/kayitlar">Kayıtlar</Link>
                <Link className="button small" href="/admin/kampanyalar">Kampanyalar</Link>
                <Link className="button small" href="/admin/odemeler">Ödemeler</Link>
                <Link className="button small" href="/admin/gecici-odeme">Geçici ödeme</Link>
                <Link className="button small" href="/admin/yardim-sorulari">Yardım soruları</Link>
                <Link className="button small" href="/admin/referanslar">Referanslar</Link>
                <Link className="button small" href="/admin/demo-plus">Demo Plus</Link>
              </div>
            </section>

            <section className="panel" style={{ marginTop: 16 }}>
              <div
                style={{
                  display: "flex",
                  gap: 12,
                  alignItems: "end",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                }}
              >
                <div className="button-group" style={{ flexWrap: "wrap" }}>
                  {(
                    [
                      ["businesses", "İşletmeler"],
                      ["users", "Kullanıcılar"],
                      ["appointments", "Randevular"],
                      ["customers", "Müşteriler"],
                      ["audit", "İşlem geçmişi"],
                    ] as [View, string][]
                  ).map(([key, label]) => (
                    <button
                      className={view === key ? "button primary small" : "button small"}
                      key={key}
                      onClick={() => setView(key)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <label className="field" style={{ minWidth: 260, margin: 0 }}>
                  <span>Her alanda ara</span>
                  <div style={{ position: "relative" }}>
                    <Search
                      size={16}
                      style={{ position: "absolute", left: 10, top: 12, opacity: 0.65 }}
                    />
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Ad, telefon, e-posta, ID…"
                      style={{ paddingLeft: 34 }}
                    />
                  </div>
                </label>
              </div>

              <div style={{ marginTop: 16, overflowX: "auto" }}>
                {view === "businesses" && (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>İşletme</TableHead>
                        <TableHead>Konum / sektör</TableHead>
                        <TableHead>Durum</TableHead>
                        <TableHead className="right">Hızlı işlem</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((b: any) => (
                        <TableRow key={b.id}>
                          <TableCell>
                            <strong>{b.name}</strong>
                            <small>/{b.slug} · {b.id}</small>
                          </TableCell>
                          <TableCell>{b.city || "—"}<small>{b.category}</small></TableCell>
                          <TableCell><span className="badge neutral">{b.status}</span></TableCell>
                          <TableCell>
                            <div className="button-group right-group">
                              {b.status !== "approved" && b.status !== "deleted" && (
                                <button
                                  className="button small"
                                  disabled={busy}
                                  onClick={() =>
                                    setConfirm({
                                      title: `${b.name} onaylansın mı?`,
                                      description: "İşletme yeniden aktif ve erişilebilir olur.",
                                      source: "admin",
                                      body: { action: "business-status", id: b.id, status: "approved" },
                                    })
                                  }
                                >
                                  Onayla
                                </button>
                              )}
                              {b.status === "approved" && (
                                <button
                                  className="button small"
                                  disabled={busy}
                                  onClick={() =>
                                    setConfirm({
                                      title: `${b.name} askıya alınsın mı?`,
                                      description: "İşletmenin panel erişimi ve yayındaki durumu etkilenir.",
                                      source: "admin",
                                      body: { action: "business-status", id: b.id, status: "suspended" },
                                    })
                                  }
                                >
                                  Askıya al
                                </button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}

                {view === "users" && (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Kullanıcı</TableHead>
                        <TableHead>Tür</TableHead>
                        <TableHead>Durum</TableHead>
                        <TableHead className="right">Hızlı işlem</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((u: any) => (
                        <TableRow key={u.user_id}>
                          <TableCell>
                            <strong>{u.name}</strong>
                            <small>{u.email} · {u.phone || "telefon yok"}</small>
                            <small style={{ userSelect: "all" }}>{u.user_id}</small>
                          </TableCell>
                          <TableCell>{u.account_type === "business" ? "İşletme" : "Müşteri"}</TableCell>
                          <TableCell>{u.disabled ? "Devre dışı" : "Aktif"}</TableCell>
                          <TableCell>
                            <div className="button-group right-group">
                              <button
                                className="button small"
                                disabled={busy}
                                onClick={() =>
                                  setConfirm({
                                    title: u.disabled ? "Kullanıcı etkinleştirilsin mi?" : "Kullanıcı devre dışı bırakılsın mı?",
                                    description: u.disabled
                                      ? "Kullanıcı yeniden giriş yapabilir."
                                      : "Kullanıcının platform erişimi durdurulur.",
                                    source: "admin",
                                    body: { action: "user-status", id: u.user_id, disabled: !u.disabled },
                                  })
                                }
                              >
                                {u.disabled ? "Etkinleştir" : "Devre dışı bırak"}
                              </button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}

                {view === "appointments" && (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Randevu</TableHead>
                        <TableHead>Tarih</TableHead>
                        <TableHead>Durum</TableHead>
                        <TableHead>Neta hesabı</TableHead>
                        <TableHead className="right">Düzelt</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((a: any) => (
                        <TableRow key={a.id}>
                          <TableCell>
                            <strong>{a.customer_name}</strong>
                            <small>{a.business_name} · {a.customer_phone}</small>
                            <small style={{ userSelect: "all" }}>{a.id}</small>
                          </TableCell>
                          <TableCell>{dateLabel(a.date)} · {time(a.minute)}</TableCell>
                          <TableCell>{STATUS[a.status] || a.status}</TableCell>
                          <TableCell>
                            {a.account_email ? (
                              <>
                                <strong>{a.account_name || "Kullanıcı"}</strong>
                                <small>{a.account_email}</small>
                              </>
                            ) : (
                              <span className="badge neutral">Hesaba bağlı değil</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="button-group right-group" style={{ flexWrap: "wrap" }}>
                              <button
                                className="button small"
                                onClick={() =>
                                  setLinkAppointment({ ...a, user_id: a.account_user_id || "" })
                                }
                              >
                                <Link2 size={14} /> Hesap bağlantısı
                              </button>
                              {a.status === "confirmed" && (
                                <>
                                  <button
                                    className="button small"
                                    disabled={busy}
                                    onClick={() =>
                                      setConfirm({
                                        title: "Randevu tamamlandı olarak işaretlensin mi?",
                                        description: "Bu işlem yalnızca randevu saati bittikten sonra kabul edilir.",
                                        source: "system",
                                        body: { action: "appointment-status", id: a.id, status: "completed" },
                                      })
                                    }
                                  >
                                    Tamamlandı
                                  </button>
                                  <button
                                    className="button small"
                                    disabled={busy}
                                    onClick={() =>
                                      setConfirm({
                                        title: "Müşteri gelmedi olarak işaretlensin mi?",
                                        description: "Bu işlem yalnızca randevu saati bittikten sonra kabul edilir.",
                                        source: "system",
                                        body: { action: "appointment-status", id: a.id, status: "no_show" },
                                      })
                                    }
                                  >
                                    Gelmedi
                                  </button>
                                  <button
                                    className="button small"
                                    disabled={busy}
                                    onClick={() =>
                                      setConfirm({
                                        title: "Randevu iptal edilsin mi?",
                                        description: "Takvim slotları güvenli biçimde boşaltılır ve gelir kurtarma akışı tetiklenebilir.",
                                        source: "system",
                                        body: { action: "appointment-status", id: a.id, status: "cancelled" },
                                      })
                                    }
                                  >
                                    İptal
                                  </button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}

                {view === "customers" && (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Müşteri</TableHead>
                        <TableHead>İşletme</TableHead>
                        <TableHead>Randevu sayısı</TableHead>
                        <TableHead className="right">Düzelt</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((c: any) => (
                        <TableRow key={`${c.tenant_id}:${c.id}`}>
                          <TableCell>
                            <strong>{c.name}</strong>
                            <small>{c.phone} · {c.email || "e-posta yok"}</small>
                            <small style={{ userSelect: "all" }}>{c.id}</small>
                          </TableCell>
                          <TableCell>{c.business_name}</TableCell>
                          <TableCell>{c.appointment_count}</TableCell>
                          <TableCell>
                            <div className="button-group right-group">
                              <button
                                className="button small"
                                onClick={() => setEditCustomer({ ...c })}
                              >
                                Düzenle
                              </button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}

                {view === "audit" && (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Yönetici</TableHead>
                        <TableHead>İşlem</TableHead>
                        <TableHead>Hedef</TableHead>
                        <TableHead>Tarih</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((a: any) => (
                        <TableRow key={a.id}>
                          <TableCell>
                            <strong>{a.actor_name}</strong>
                            <small>{a.actor_email}</small>
                          </TableCell>
                          <TableCell>{a.action}</TableCell>
                          <TableCell><small style={{ userSelect: "all" }}>{a.target_id}</small></TableCell>
                          <TableCell>{new Date(a.created_at).toLocaleString("tr-TR")}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}

                {!filtered.length && (
                  <Blank
                    title="Kayıt bulunamadı"
                    description="Arama metnini değiştirin veya başka bir bölüme geçin."
                  />
                )}
              </div>
            </section>
          </>
        )}

        <Modal
          open={!!editCustomer}
          onClose={() => setEditCustomer(null)}
          title="Müşteri kaydını düzelt"
          description="Bu değişiklik yalnızca seçili işletmenin CRM kaydını etkiler."
        >
          {editCustomer && (
            <form
              className="form-stack"
              onSubmit={(e) => {
                e.preventDefault();
                runSystem({
                  action: "customer-update",
                  id: editCustomer.id,
                  tenant_id: editCustomer.tenant_id,
                  name: editCustomer.name,
                  phone: editCustomer.phone,
                  email: editCustomer.email || "",
                });
              }}
            >
              <Field label="Ad soyad">
                <input
                  value={editCustomer.name}
                  onChange={(e) => setEditCustomer({ ...editCustomer, name: e.target.value })}
                />
              </Field>
              <Field label="Telefon">
                <input
                  value={editCustomer.phone}
                  onChange={(e) => setEditCustomer({ ...editCustomer, phone: e.target.value })}
                />
              </Field>
              <Field label="E-posta">
                <input
                  type="email"
                  value={editCustomer.email || ""}
                  onChange={(e) => setEditCustomer({ ...editCustomer, email: e.target.value })}
                />
              </Field>
              <button className="button primary" disabled={busy} type="submit">
                {busy ? <Busy /> : "Kaydet"}
              </button>
            </form>
          )}
        </Modal>

        <Modal
          open={!!linkAppointment}
          onClose={() => setLinkAppointment(null)}
          title="Randevu - Neta hesabı bağlantısı"
          description="Bu yalnızca randevunun hangi Neta hesabında görüneceğini değiştirir. İşletmenin müşteri kaydı başka işletmelerle paylaşılmaz."
        >
          {linkAppointment && data && (
            <form
              className="form-stack"
              onSubmit={(e) => {
                e.preventDefault();
                runSystem({
                  action: "booking-account",
                  id: linkAppointment.id,
                  user_id: linkAppointment.user_id || null,
                });
              }}
            >
              <Field label="Neta hesabı">
                <select
                  value={linkAppointment.user_id || ""}
                  onChange={(e) =>
                    setLinkAppointment({ ...linkAppointment, user_id: e.target.value })
                  }
                >
                  <option value="">Hesap bağlantısı yok</option>
                  {data.users
                    .filter((u: any) => !u.disabled)
                    .map((u: any) => (
                      <option key={u.user_id} value={u.user_id}>
                        {u.name} — {u.email}
                      </option>
                    ))}
                </select>
              </Field>
              <div className="notice">
                Bir müşteriyi başka işletmeye otomatik kaydetmez. Sadece bu randevunun hesap görünürlüğünü düzeltir.
              </div>
              <button className="button primary" disabled={busy} type="submit">
                {busy ? <Busy /> : "Bağlantıyı kaydet"}
              </button>
            </form>
          )}
        </Modal>

        <Confirm
          open={!!confirm}
          onClose={() => setConfirm(null)}
          title={confirm?.title || "İşlem onaylansın mı?"}
          description={confirm?.description || "Bu değişiklik kaydedilecek."}
          onConfirm={() =>
            confirm?.source === "admin"
              ? runExisting(confirm.body)
              : runSystem(confirm?.body)
          }
        />
      </main>
    </PublicShell>
  );
}
