"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Building2, Shield, UserRound, Users } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { PublicShell } from "./public";
import { api, Blank, Busy, Confirm } from "./common";

type RegistrationGroup = "with-business" | "without-business";

export default function AdminRegistrations() {
  const [data, setData] = useState<any>(null),
    [error, setError] = useState(""),
    [denied, setDenied] = useState(false),
    [group, setGroup] = useState<RegistrationGroup>("with-business"),
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
    void refresh();
  }, []);

  async function changeUserStatus() {
    if (!confirm) return;
    setBusy(true);
    try {
      await api("admin", confirm);
      toast.success("Kullanıcı erişimi güncellendi.");
      setConfirm(null);
      await refresh();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  const groups = useMemo(() => {
    const users = Array.isArray(data?.users) ? data.users : [];
    const byEmail = (a: any, b: any) =>
      String(a.email || "").localeCompare(String(b.email || ""), "tr");
    return {
      withBusiness: users.filter((u: any) => Number(u.businesses || 0) > 0).sort(byEmail),
      withoutBusiness: users.filter((u: any) => Number(u.businesses || 0) === 0).sort(byEmail),
    };
  }, [data]);

  const visibleUsers =
    group === "with-business" ? groups.withBusiness : groups.withoutBusiness;

  return (
    <PublicShell>
      <main className="admin-page">
        <div className="page-heading">
          <div>
            <span className="eyebrow">PLATFORM YÖNETİMİ · KAYITLAR</span>
            <h1>Kayıtlı hesaplar.</h1>
            <p>
              E-posta kayıtları artık işletmesi olan ve henüz işletmesi olmayan hesaplar olarak ayrı gösterilir.
            </p>
          </div>
          <span className="badge neutral">
            <Shield size={14} /> Yetkili erişim
          </span>
          <Link className="button" href="/admin">
            <ArrowLeft size={16} /> Yönetim merkezi
          </Link>
        </div>

        {error ? (
          <section className="panel">
            <Blank
              title={denied ? "Yönetici erişimi gerekli" : "Kayıtlar açılamadı"}
              description={error}
            />
            {denied ? (
              <a
                className="button primary"
                target="_top"
                href="/signin-with-chatgpt?return_to=%2Fadmin%2Fkayitlar"
              >
                Yetkili hesapla giriş yap
              </a>
            ) : (
              <button className="button" onClick={refresh}>
                Tekrar dene
              </button>
            )}
          </section>
        ) : !data ? (
          <div className="loading-row">
            <Busy /> Kayıtlar yükleniyor…
          </div>
        ) : (
          <>
            <div className="stats-grid">
              <section className="stat-card">
                <div className="stat-top">
                  Toplam kayıt <Users size={19} />
                </div>
                <strong className="stat-value">{data.users.length}</strong>
              </section>
              <section className="stat-card">
                <div className="stat-top">
                  İşletmesi olan <Building2 size={19} />
                </div>
                <strong className="stat-value">{groups.withBusiness.length}</strong>
              </section>
              <section className="stat-card">
                <div className="stat-top">
                  İşletmesi olmayan <UserRound size={19} />
                </div>
                <strong className="stat-value">{groups.withoutBusiness.length}</strong>
              </section>
            </div>

            <section className="panel">
              <div className="panel-header">
                <div>
                  <h2>E-posta / hesap kayıtları</h2>
                  <p className="muted">
                    Hesaplar sahip oldukları işletme sayısına göre otomatik ayrılır.
                  </p>
                </div>
                <span className="badge neutral">{visibleUsers.length} kayıt</span>
              </div>

              <Tabs
                value={group}
                onValueChange={(value) => setGroup(value as RegistrationGroup)}
              >
                <TabsList className="filter-tabs admin-tabs margin-top">
                  <TabsTrigger value="with-business">
                    İşletmesi olanlar · {groups.withBusiness.length}
                  </TabsTrigger>
                  <TabsTrigger value="without-business">
                    İşletmesi olmayanlar · {groups.withoutBusiness.length}
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              {visibleUsers.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Kullanıcı</TableHead>
                      <TableHead>Hesap türü</TableHead>
                      <TableHead>İşletme sayısı</TableHead>
                      <TableHead>Durum</TableHead>
                      <TableHead>İşlem</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleUsers.map((u: any) => (
                      <TableRow key={u.user_id}>
                        <TableCell>
                          <strong>{u.name || "İsimsiz hesap"}</strong>
                          <small>{u.email || "E-posta yok"}</small>
                        </TableCell>
                        <TableCell>
                          <span className="badge neutral">
                            {u.account_type === "business" ? "İşletme" : "Müşteri"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <strong>{Number(u.businesses || 0)}</strong>
                        </TableCell>
                        <TableCell>{u.disabled ? "Devre dışı" : "Aktif"}</TableCell>
                        <TableCell>
                          <button
                            className="button small"
                            disabled={busy}
                            onClick={() =>
                              setConfirm({
                                action: "user-status",
                                id: u.user_id,
                                disabled: !u.disabled,
                                title: `${u.email || u.name || "Kullanıcı"} erişimi değiştirilsin mi?`,
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
              ) : (
                <Blank
                  title={
                    group === "with-business"
                      ? "İşletmesi olan kayıt yok"
                      : "İşletmesi olmayan kayıt yok"
                  }
                  description="Bu gruba giren hesaplar olduğunda burada otomatik görünecek."
                />
              )}
            </section>
          </>
        )}

        <Confirm
          open={!!confirm}
          onClose={() => setConfirm(null)}
          title={confirm?.title}
          description="Bu işlem kullanıcının Neta hesabına erişimini değiştirir."
          onConfirm={changeUserStatus}
        />
      </main>
    </PublicShell>
  );
}
