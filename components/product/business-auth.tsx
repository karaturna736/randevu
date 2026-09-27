"use client";

import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  Check,
  Eye,
  EyeOff,
  LockKeyhole,
  ShieldCheck,
  UserRound,
  Users,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Brand, Busy, Field, ThemeToggle } from "./common";

type Role = "owner" | "manager" | "employee";

const ROLE_COPY: Record<Role, { title: string; description: string; icon: any }> = {
  owner: {
    title: "Yönetici",
    description: "İşletmenin tamamı, finans, şubeler, ekip ve tüm yönetim araçları.",
    icon: ShieldCheck,
  },
  manager: {
    title: "Müdür / Sorumlu",
    description: "Atandığınız şubenin operasyonu, randevuları, ekibi ve finans görünümü.",
    icon: BriefcaseBusiness,
  },
  employee: {
    title: "Çalışan",
    description: "Randevular, takvim ve müşteri işlemleri. Finans ve kârlılık görünmez.",
    icon: Users,
  },
};

async function postAuth(path: string, payload: unknown) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.error) throw new Error(data?.error || "İşlem tamamlanamadı.");
  return data;
}

export function BusinessLogin() {
  const [role, setRole] = useState<Role>("owner");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const copy = ROLE_COPY[role];

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await postAuth("/api/auth/business-login", { role, email, password });
      location.assign(result.next || "/panel");
    } catch (e: any) {
      setError(e.message || "Giriş yapılamadı.");
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-story">
        <Brand />
        <div className="auth-story-main">
          <span className="auth-eyebrow">NETA İŞLETME ERİŞİMİ</span>
          <h1>
            Her görev için
            <br />
            <em>doğru panel, doğru yetki.</em>
          </h1>
          <div className="auth-benefits">
            {(Object.keys(ROLE_COPY) as Role[]).map((key) => {
              const item = ROLE_COPY[key];
              const Icon = item.icon;
              return (
                <div key={key}>
                  <span><Icon size={20} /></span>
                  <div><strong>{item.title}</strong><p>{item.description}</p></div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="auth-story-footer">
          <span><LockKeyhole size={17} /> Rol ve şube bazlı güvenli erişim</span>
          <span>Neta Randevu</span>
        </div>
      </section>

      <section className="auth-main">
        <header>
          <a className="text-button" href="/"><ArrowLeft size={16} /> Ana sayfaya dön</a>
          <ThemeToggle />
        </header>
        <div className="auth-form-wrap">
          <span className="eyebrow">PANELE GİRİŞ</span>
          <h2>Hangi görevle giriş yapıyorsunuz?</h2>
          <p className="auth-intro">Rolünüz yalnızca ekranı değiştirmez; sunucu tarafındaki yetkilerinizi de belirler.</p>

          <Tabs value={role} onValueChange={(value) => { setRole(value as Role); setError(""); }}>
            <TabsList className="role-tabs">
              <TabsTrigger value="owner"><ShieldCheck size={17} /> Yönetici</TabsTrigger>
              <TabsTrigger value="manager"><BriefcaseBusiness size={17} /> Müdür</TabsTrigger>
              <TabsTrigger value="employee"><UserRound size={17} /> Çalışan</TabsTrigger>
            </TabsList>
          </Tabs>
          <p className="role-description"><strong>{copy.title}:</strong> {copy.description}</p>

          <form className="form-stack" onSubmit={submit}>
            <Field label="E-posta">
              <Input
                type="email"
                autoComplete="username"
                required
                maxLength={254}
                placeholder="ad@isletme.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
            <Field label="Şifre">
              <div style={{ position: "relative" }}>
                <Input
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  maxLength={128}
                  placeholder="Şifreniz"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ paddingRight: 46 }}
                />
                <button
                  type="button"
                  className="icon-button"
                  aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}
                  onClick={() => setShowPassword((value) => !value)}
                  style={{ position: "absolute", right: 5, top: "50%", transform: "translateY(-50%)" }}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </Field>
            {error && <p role="alert" className="error-message">{error}</p>}
            <button className="button primary full large-button" disabled={busy}>
              {busy ? <Busy /> : <ArrowRight size={18} />} {copy.title} paneline gir
            </button>
          </form>

          {role === "owner" && (
            <>
              <div className="auth-security-note">
                <ShieldCheck size={18} />
                <p>İlk kez Neta kullanacaksanız <a href="/panel-kayit"><strong>yönetici hesabı oluşturun</strong></a>. Müdür ve çalışan hesaplarını işletme yöneticisi panelden oluşturur.</p>
              </div>
              <a className="button google-provider" target="_top" href="/api/auth/google?sonra=%2Fpanel">
                Mevcut Google yönetici hesabımla giriş yap <ArrowRight size={17} />
              </a>
            </>
          )}
          {role !== "owner" && (
            <div className="auth-security-note">
              <ShieldCheck size={18} />
              <p>Bu hesap işletme yöneticiniz tarafından oluşturulur ve belirli bir şubeye atanır.</p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

export function BusinessSignup() {
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (form.password !== form.confirm) {
      setError("Şifreler aynı değil.");
      return;
    }
    setBusy(true);
    try {
      const result = await postAuth("/api/auth/business-signup", {
        name: form.name,
        email: form.email,
        password: form.password,
      });
      location.assign(result.next || "/erisim-bekliyor");
    } catch (e: any) {
      setError(e.message || "Kayıt tamamlanamadı.");
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-story">
        <Brand />
        <div className="auth-story-main">
          <span className="auth-eyebrow">YÖNETİCİ HESABI</span>
          <h1>İşletmenizin ana hesabını <em>güvenle oluşturun.</em></h1>
          <div className="auth-benefits">
            <div><span><ShieldCheck size={20} /></span><div><strong>Tam yönetim</strong><p>Şubeler, müdürler, çalışanlar, raporlar ve ayarlar.</p></div></div>
            <div><span><Users size={20} /></span><div><strong>Yetkiyi siz dağıtın</strong><p>Her müdür ve çalışan için ayrı güvenli hesap oluşturun.</p></div></div>
            <div><span><Check size={20} /></span><div><strong>Kontrollü erişim</strong><p>Yeni işletme hesabınız Neta yönetici onayından sonra açılır.</p></div></div>
          </div>
        </div>
        <div className="auth-story-footer"><span><LockKeyhole size={17} /> Şifreler güvenli hash olarak saklanır</span><span>Neta Randevu</span></div>
      </section>
      <section className="auth-main">
        <header><a className="text-button" href="/panel-giris"><ArrowLeft size={16} /> Panel girişine dön</a><ThemeToggle /></header>
        <div className="auth-form-wrap">
          <span className="eyebrow">YENİ YÖNETİCİ</span>
          <h2>Yönetici hesabınızı oluşturun.</h2>
          <p className="auth-intro">Bu hesap işletmenin en yüksek yetkili hesabıdır. Müdür ve çalışan hesaplarını daha sonra siz oluşturacaksınız.</p>
          <form className="form-stack" onSubmit={submit}>
            <Field label="Ad soyad"><Input autoComplete="name" required minLength={2} maxLength={100} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="E-posta"><Input type="email" autoComplete="username" required maxLength={254} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
            <Field label="Şifre">
              <div style={{ position: "relative" }}>
                <Input type={showPassword ? "text" : "password"} autoComplete="new-password" required minLength={10} maxLength={128} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} style={{ paddingRight: 46 }} />
                <button type="button" className="icon-button" aria-label="Şifre görünürlüğü" onClick={() => setShowPassword((value) => !value)} style={{ position: "absolute", right: 5, top: "50%", transform: "translateY(-50%)" }}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button>
              </div>
            </Field>
            <Field label="Şifre tekrar"><Input type={showPassword ? "text" : "password"} autoComplete="new-password" required minLength={10} maxLength={128} value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} /></Field>
            <p className="helper">En az 10 karakter, en az bir harf ve bir rakam kullanın.</p>
            {error && <p role="alert" className="error-message">{error}</p>}
            <button className="button primary full large-button" disabled={busy}>{busy ? <Busy /> : <Check size={18} />} Yönetici hesabını oluştur</button>
          </form>
        </div>
      </section>
    </main>
  );
}
