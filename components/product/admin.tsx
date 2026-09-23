"use client";
import { useState, useEffect } from "react";
import {
  Shield,
  Store,
  Users,
  Wallet,
  ArrowRight,
  Check,
  Pause,
  Trash2,
  EyeOff,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { toast } from "sonner";
import { PublicShell } from "./public";
import { api, Blank, Busy, Confirm } from "./common";
import { money, dateLabel, time, STATUS } from "@/lib/types";
const labels: Record<string, string> = {
  pending: "Onay bekliyor",
  approved: "Onaylandı",
  suspended: "Askıya alındı",
  deleted: "Silindi",
  published: "Yayında",
  hidden: "Gizli",
  open: "Açık",
  resolved: "Çözüldü",
  paid: "Ödendi",
  contacted: "İletişime geçildi",
  scheduled: "Planlandı",
  completed: "Tamamlandı",
  cancelled: "İptal edildi",
};
export default function Admin() {
  const [data, setData] = useState<any>(null),
    [error, setError] = useState(""),
    [denied, setDenied] = useState(false),
    [view, setView] = useState("businesses"),
    [confirm, setConfirm] = useState<any>(null),
    [busy, setBusy] = useState(false);
  async function refresh() {
    try {
      setData(await api("admin"));
      setError("");
      setDenied(false);
    } catch (e: any) {
      setError(e.message);
      setDenied(e.status === 401 || e.status === 403);
    }
  }
  useEffect(() => {
    refresh();
  }, []);
  async function act(x: any) {
    setBusy(true);
    try {
      await api("admin", x);
      toast.success("İşlem kaydedildi.");
      setConfirm(null);
      await refresh();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <PublicShell>
      <main className="admin-page">
        <div className="page-heading">
          <div>
            <span className="eyebrow">PLATFORM YÖNETİMİ</span>
            <h1>Platformun nabzı.</h1>
            <p>İşletmeler, kullanıcılar ve müşteri deneyimi.</p>
          </div>
          <span className="badge neutral">
            <Shield size={14} />
            Yetkili erişim
          </span>
        </div>
        {error ? (
          <section className="panel">
            <Blank
              title={
                denied ? "Yönetici erişimi gerekli" : "Bağlantı kurulamadı"
              }
              description={error}
            />
            {denied ? (
              <a
                className="button primary"
                target="_top"
                href="/signin-with-chatgpt?return_to=%2Fadmin"
              >
                Yetkili hesapla giriş yap <ArrowRight size={15} />
              </a>
            ) : (
              <button className="button" onClick={refresh}>
                Tekrar dene
              </button>
            )}
          </section>
        ) : !data ? (
          <div className="loading-row">
            <Busy />
            Platform yükleniyor…
          </div>
        ) : (
          <>
            <div className="stats-grid">
              {[
                {
                  label: "İşletmeler",
                  value: data.businesses.filter(
                    (b: any) => b.status !== "deleted" && !b.demo,
                  ).length,
                  icon: Store,
                },
                {
                  label: "Onay bekleyen",
                  value: data.businesses.filter(
                    (b: any) => b.status === "pending",
                  ).length,
                  icon: Shield,
                },
                {
                  label: "İşletme kullanıcıları",
                  value: data.users.length,
                  icon: Users,
                },
                {
                  label: "Platform geliri",
                  value: money(
                    data.payments
                      .filter(
                        (p: any) =>
                          p.status === "paid" && p.kind === "subscription",
                      )
                      .reduce((s: number, p: any) => s + p.amount, 0),
                  ),
                  icon: Wallet,
                },
              ].map((x) => (
                <section className="stat-card" key={x.label}>
                  <div className="stat-top">
                    {x.label}
                    <x.icon size={19} />
                  </div>
                  <strong className="stat-value">{x.value}</strong>
                </section>
              ))}
            </div>
            <section className="panel">
              <Tabs value={view} onValueChange={setView}>
                <TabsList className="filter-tabs admin-tabs">
                  {[
                    ["businesses", "İşletmeler"],
                    ["users", "Kullanıcılar"],
                    ["appointments", "Randevular"],
                    ["reviews", "Değerlendirmeler"],
                    ["complaints", "Şikâyetler"],
                    ["training", "Eğitim talepleri"],
                    ["payments", "Ödemeler"],
                  ].map(([k, l]) => (
                    <TabsTrigger value={k} key={k}>
                      {l}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
              {view === "businesses" && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>İşletme</TableHead>
                      <TableHead>Sektör</TableHead>
                      <TableHead>Durum</TableHead>
                      <TableHead className="right">İşlem</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.businesses.map((b: any) => (
                      <TableRow key={b.id}>
                        <TableCell>
                          <strong>{b.name}</strong>
                          <small>
                            /{b.slug}
                            {b.demo ? " · Deneme" : ""}
                          </small>
                        </TableCell>
                        <TableCell>
                          {b.category}
                          <small>{b.city}</small>
                        </TableCell>
                        <TableCell>
                          <span className="badge neutral">
                            {labels[b.status]}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="button-group right-group">
                            {b.status !== "approved" &&
                              b.status !== "deleted" && (
                                <button
                                  className="button small"
                                  disabled={busy}
                                  onClick={() =>
                                    act({
                                      action: "business-status",
                                      id: b.id,
                                      status: "approved",
                                    })
                                  }
                                >
                                  <Check size={14} />
                                  Onayla
                                </button>
                              )}
                            {b.status === "approved" && (
                              <button
                                className="icon-button"
                                aria-label={b.name + " askıya al"}
                                onClick={() =>
                                  setConfirm({
                                    action: "business-status",
                                    id: b.id,
                                    status: "suspended",
                                    title: b.name + " askıya alınsın mı?",
                                  })
                                }
                              >
                                <Pause size={16} />
                              </button>
                            )}
                            {b.status !== "deleted" && (
                              <button
                                className="icon-button danger"
                                aria-label={b.name + " sil"}
                                onClick={() =>
                                  setConfirm({
                                    action: "business-status",
                                    id: b.id,
                                    status: "deleted",
                                    title: b.name + " silinsin mi?",
                                  })
                                }
                              >
                                <Trash2 size={16} />
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
                      <TableHead>İşletme</TableHead>
                      <TableHead>Durum</TableHead>
                      <TableHead>İşlem</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.users.map((u: any) => (
                      <TableRow key={u.user_id}>
                        <TableCell>
                          {u.name}
                          <small>{u.email}</small>
                        </TableCell>
                        <TableCell>{u.businesses}</TableCell>
                        <TableCell>
                          {u.disabled ? "Devre dışı" : "Aktif"}
                        </TableCell>
                        <TableCell>
                          <button
                            className="button small"
                            disabled={busy}
                            onClick={() =>
                              setConfirm({
                                action: "user-status",
                                id: u.user_id,
                                disabled: !u.disabled,
                                title: "Kullanıcının erişimi değiştirilsin mi?",
                              })
                            }
                          >
                            {u.disabled ? "Etkinleştir" : "Devre dışı bırak"}
                          </button>
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
                      <TableHead>Müşteri</TableHead>
                      <TableHead>Hizmet</TableHead>
                      <TableHead>Tarih</TableHead>
                      <TableHead>Durum</TableHead>
                      <TableHead>Tutar</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.appointments.map((a: any) => (
                      <TableRow key={a.id}>
                        <TableCell>
                          {a.customer_name}
                          <small>
                            {
                              data.businesses.find(
                                (b: any) => b.id === a.tenant_id,
                              )?.name
                            }
                          </small>
                        </TableCell>
                        <TableCell>{a.service_name}</TableCell>
                        <TableCell>
                          {dateLabel(a.date)} · {time(a.minute)}
                        </TableCell>
                        <TableCell>{STATUS[a.status]}</TableCell>
                        <TableCell>{money(a.price)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              {view === "reviews" &&
                data.reviews.map((r: any) => (
                  <div className="moderation-row" key={r.id}>
                    <div>
                      <strong>
                        {r.business_name} · {r.rating}/5
                      </strong>
                      <p>{r.comment}</p>
                      <small>{labels[r.status]}</small>
                    </div>
                    <div className="button-group">
                      <button
                        className="button small"
                        disabled={busy || r.status === "published"}
                        onClick={() =>
                          act({
                            action: "review-status",
                            id: r.id,
                            status: "published",
                          })
                        }
                      >
                        <Check size={14} />
                        Yayınla
                      </button>
                      <button
                        className="button small"
                        disabled={busy || r.status === "hidden"}
                        onClick={() =>
                          act({
                            action: "review-status",
                            id: r.id,
                            status: "hidden",
                          })
                        }
                      >
                        <EyeOff size={14} />
                        Gizle
                      </button>
                    </div>
                  </div>
                ))}
              {view === "complaints" &&
                data.complaints.map((r: any) => (
                  <div className="moderation-row" key={r.id}>
                    <div>
                      <strong>{r.business_name}</strong>
                      <p>{r.message}</p>
                      <small>{labels[r.status]}</small>
                    </div>
                    <button
                      className="button small"
                      disabled={busy || r.status === "resolved"}
                      onClick={() =>
                        act({ action: "complaint-resolve", id: r.id })
                      }
                    >
                      Çözüldü olarak işaretle
                    </button>
                  </div>
                ))}
              {view === "training" &&
                data.training.map((r: any) => (
                  <div className="moderation-row" key={r.id}>
                    <div>
                      <strong>{r.business_name} · {r.owner_name || "İşletme sahibi"}</strong>
                      <p>{r.owner_email || "E-posta yok"} · {r.business_phone || "Telefon yok"}</p>
                      <small>{r.preferred_date ? `Tercih: ${dateLabel(r.preferred_date)} · ` : ""}{r.note || "Not bırakılmadı"} · {labels[r.status] || r.status}</small>
                    </div>
                    <div className="button-group">
                      <button className="button small" disabled={busy || r.status === "contacted"} onClick={()=>act({action:"training-status",id:r.id,status:"contacted"})}>İletişime geçildi</button>
                      <button className="button small" disabled={busy || r.status === "scheduled"} onClick={()=>act({action:"training-status",id:r.id,status:"scheduled"})}>Planlandı</button>
                      <button className="button small" disabled={busy || r.status === "completed"} onClick={()=>act({action:"training-status",id:r.id,status:"completed"})}><Check size={14}/>Tamamlandı</button>
                    </div>
                  </div>
                ))}
              {view === "payments" && (
                <>
                  <div className="notice margin-top">
                    Ödeme sağlayıcısı bağlı değil. Bu sürüm tahsilat yapmaz.
                  </div>
                  {data.payments.length > 0 && (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>İşletme</TableHead>
                          <TableHead>Tutar</TableHead>
                          <TableHead>Durum</TableHead>
                          <TableHead>Tarih</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.payments.map((p: any) => (
                          <TableRow key={p.id}>
                            <TableCell>
                              {
                                data.businesses.find(
                                  (b: any) => b.id === p.tenant_id,
                                )?.name
                              }
                            </TableCell>
                            <TableCell>{money(p.amount)}</TableCell>
                            <TableCell>
                              {labels[p.status] || p.status}
                            </TableCell>
                            <TableCell>
                              {dateLabel(p.created_at.slice(0, 10))}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </>
              )}
              {!data[view]?.length && (
                <Blank
                  title="Henüz kayıt yok"
                  description="Bu bölüme ait kayıtlar burada görünecek."
                />
              )}
            </section>
            <p className="helper margin-top">
              En fazla 500 işletme/kullanıcı, son 200 randevu ve son 100
              ödeme/değerlendirme/şikâyet gösterilir. Silinen işletme erişime
              kapatılır; ilişkili kayıtlar korunur.
            </p>
          </>
        )}
        <Confirm
          open={!!confirm}
          onClose={() => setConfirm(null)}
          title={confirm?.title}
          description="İşletme ve kullanıcı erişimi etkilenebilir. İşlem yönetim günlüğüne kaydedilir."
          onConfirm={() => act(confirm)}
        />
      </main>
    </PublicShell>
  );
}
