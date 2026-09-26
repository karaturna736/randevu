"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  CarFront,
  Check,
  Dumbbell,
  GraduationCap,
  Grid3X3,
  HeartPulse,
  Leaf,
  MapPin,
  Scissors,
  Search,
  Sparkles,
  Stethoscope,
  Store,
  UserRound,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { money } from "@/lib/types";
import { api, Blank, Busy, Pick } from "./common";
import { PublicShell } from "./public";
import styles from "./discover-marketplace.module.css";

type BusinessRow = {
  id: string;
  name: string;
  slug: string;
  category: string;
  city: string;
  address?: string;
  description?: string;
  min_price?: number | null;
};

type BranchRow = {
  id: string;
  name: string;
  city?: string;
  address?: string;
};

const DISCOVERY_CATEGORIES = [
  "Kuaför & Berber",
  "Güzellik Salonu",
  "Spa & Masaj",
  "Klinik",
  "Diyetisyen",
  "Psikolog",
  "Spor & Fitness",
  "Özel Ders",
  "Danışmanlık",
  "Oto Servis",
  "Diğer",
];

const CATEGORY_ALIASES: Record<string, string> = {
  "Kuaför / Berber": "Kuaför & Berber",
  "Kuaför-Berber": "Kuaför & Berber",
  "Berber & Kuaför": "Kuaför & Berber",
};

const TURKEY_CITIES = [
  "Adana", "Adıyaman", "Afyonkarahisar", "Ağrı", "Aksaray", "Amasya", "Ankara", "Antalya", "Ardahan", "Artvin",
  "Aydın", "Balıkesir", "Bartın", "Batman", "Bayburt", "Bilecik", "Bingöl", "Bitlis", "Bolu", "Burdur",
  "Bursa", "Çanakkale", "Çankırı", "Çorum", "Denizli", "Diyarbakır", "Düzce", "Edirne", "Elazığ", "Erzincan",
  "Erzurum", "Eskişehir", "Gaziantep", "Giresun", "Gümüşhane", "Hakkari", "Hatay", "Iğdır", "Isparta", "İstanbul",
  "İzmir", "Kahramanmaraş", "Karabük", "Karaman", "Kars", "Kastamonu", "Kayseri", "Kilis", "Kırıkkale", "Kırklareli",
  "Kırşehir", "Kocaeli", "Konya", "Kütahya", "Malatya", "Manisa", "Mardin", "Mersin", "Muğla", "Muş",
  "Nevşehir", "Niğde", "Ordu", "Osmaniye", "Rize", "Sakarya", "Samsun", "Siirt", "Sinop", "Sivas",
  "Şanlıurfa", "Şırnak", "Tekirdağ", "Tokat", "Trabzon", "Tunceli", "Uşak", "Van", "Yalova", "Yozgat", "Zonguldak",
];

const CATEGORY_META: Record<string, { icon: any; tone?: string }> = {
  "Kuaför & Berber": { icon: Scissors },
  "Güzellik Salonu": { icon: Sparkles, tone: styles.tonePink },
  "Spa & Masaj": { icon: Leaf, tone: styles.toneGreen },
  Klinik: { icon: Stethoscope, tone: styles.toneBlue },
  Diyetisyen: { icon: HeartPulse, tone: styles.toneGreen },
  Psikolog: { icon: UserRound, tone: styles.toneOrange },
  "Spor & Fitness": { icon: Dumbbell, tone: styles.toneGold },
  "Özel Ders": { icon: GraduationCap, tone: styles.toneBlue },
  Danışmanlık: { icon: BriefcaseBusiness, tone: styles.toneOrange },
  "Oto Servis": { icon: CarFront, tone: styles.toneBlue },
  Diğer: { icon: Grid3X3, tone: styles.toneCyan },
};

function canonicalCategory(value: string) {
  const category = (value || "").trim();
  return CATEGORY_ALIASES[category] || category;
}

function normalizedCity(b: BusinessRow) {
  return (b.city || "").trim() || "Konum belirtilmemiş";
}

function Progress({ category, city, business }: { category: string; city: string; business: BusinessRow | null }) {
  const active = business ? 4 : city ? 3 : category ? 2 : 1;
  const steps = [
    { n: 1, short: "Kategori", title: category || "Kategori", subtitle: category ? "Seçildi" : "İhtiyacını seç", icon: Grid3X3 },
    { n: 2, short: "Şehir", title: city || "Şehir", subtitle: city ? "Seçildi" : "Şehrini belirle", icon: MapPin },
    { n: 3, short: "İşletme", title: business?.name || "İşletme", subtitle: business ? "Seçildi" : "İşletmeni seç", icon: Building2 },
    { n: 4, short: "Şube", title: "Şube", subtitle: "Şubeni seç", icon: Store },
  ];
  return (
    <div className={styles.stepper} aria-label="Keşfet adımları">
      {steps.map((step) => {
        const Icon = step.icon;
        const done = step.n < active;
        const isActive = step.n === active;
        return (
          <div key={step.n} className={`${styles.step} ${done ? styles.stepDone : isActive ? styles.stepActive : styles.stepInactive}`}>
            <span className={styles.stepIcon}>{done ? <Check size={20} /> : <Icon size={20} />}</span>
            <span className={styles.stepText}><strong>{step.n}. {step.title}</strong><span>{step.subtitle}</span></span>
            <span className={styles.stepShort}>{step.n}. {step.short}</span>
          </div>
        );
      })}
    </div>
  );
}

function CardArrow() {
  return <span className={styles.arrow}><ArrowRight size={18} /></span>;
}

function BusinessVisual({ business }: { business: BusinessRow }) {
  return (
    <span
      aria-hidden="true"
      style={{
        position: "relative",
        width: 76,
        height: 66,
        flex: "0 0 auto",
        display: "grid",
        placeItems: "center",
        overflow: "hidden",
        borderRadius: 15,
        color: "#87cfff",
        background: "linear-gradient(145deg,rgba(47,142,202,.25),rgba(37,71,111,.24))",
        border: "1px solid rgba(112,128,180,.24)",
      }}
    >
      <Building2 size={24} />
      <img
        src={`/api/v1/business-image/${encodeURIComponent(business.id)}`}
        alt=""
        loading="lazy"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
        onError={(event) => { event.currentTarget.style.display = "none"; }}
      />
    </span>
  );
}

export function DiscoverMarketplace() {
  const [rows, setRows] = useState<BusinessRow[]>([]);
  const [category, setCategory] = useState("");
  const [city, setCity] = useState("");
  const [business, setBusiness] = useState<BusinessRow | null>(null);
  const [businessData, setBusinessData] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [branchLoading, setBranchLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api("businesses")
      .then((r) => setRows((r.businesses || []).map((item: BusinessRow) => ({ ...item, category: canonicalCategory(item.category) }))))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const categories = useMemo(() => {
    const extras = Array.from(new Set(rows.map((b) => canonicalCategory(b.category)).filter(Boolean))).filter((item) => !DISCOVERY_CATEGORIES.includes(item));
    return [...DISCOVERY_CATEGORIES, ...extras];
  }, [rows]);

  const availableCities = useMemo(() => {
    if (!category) return [];
    return Array.from(new Set(rows.filter((b) => canonicalCategory(b.category) === category).map(normalizedCity)))
      .filter((item) => item !== "Konum belirtilmemiş")
      .sort((a, b) => a.localeCompare(b, "tr-TR"));
  }, [rows, category]);

  const cityOptions = useMemo(() => {
    const extras = availableCities.filter((item) => !TURKEY_CITIES.includes(item));
    return [...TURKEY_CITIES, ...extras];
  }, [availableCities]);

  const businesses = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("tr-TR");
    return rows.filter((b) => {
      if (canonicalCategory(b.category) !== category || normalizedCity(b) !== city) return false;
      return !q || `${b.name} ${b.address || ""} ${b.description || ""}`.toLocaleLowerCase("tr-TR").includes(q);
    });
  }, [rows, category, city, search]);

  function chooseCategory(value: string) {
    setCategory(canonicalCategory(value)); setCity(""); setBusiness(null); setBusinessData(null); setSearch(""); setError("");
  }
  function chooseCity(value: string) {
    setCity(value); setBusiness(null); setBusinessData(null); setSearch(""); setError("");
  }
  async function chooseBusiness(next: BusinessRow) {
    setBusiness(next); setBusinessData(null); setBranchLoading(true); setError("");
    try { setBusinessData(await api("public/" + encodeURIComponent(next.slug))); }
    catch (e: any) { setError(e.message); }
    finally { setBranchLoading(false); }
  }

  const branches: BranchRow[] = businessData?.branches || [];

  return (
    <PublicShell>
      <main className={styles.page}>
        <div className={styles.hero}>
          <span className={styles.kicker}>NETA KEŞFET</span>
          <h1>İhtiyacını seç, şehrini belirle, <span>işletmeni bul.</span></h1>
          <p>Güzellik salonu, spa, kuaför ve diğer hizmet kategorilerinden seçim yapın; ardından şehir, işletme ve şubeyi seçerek randevunuzu oluşturun.</p>
        </div>
        <Progress category={category} city={city} business={business} />
        <div className={styles.shell}>
          {loading ? (
            <div className="loading-row"><Busy /> İşletmeler yükleniyor…</div>
          ) : error && !business ? (
            <p className="error-message">{error}</p>
          ) : !category ? (
            <section>
              <div className={styles.sectionHead}>
                <div><span className={styles.eyebrow}>1. ADIM</span><h2>Hangi hizmeti arıyorsunuz?</h2></div>
                <span className={styles.sectionMeta}>Kategori seçin</span>
                <span className={styles.mobileSwipeHint}>Yana kaydır <ArrowRight size={14} /></span>
              </div>
              <div className={styles.categoryGrid}>
                {categories.map((item, index) => {
                  const count = rows.filter((b) => canonicalCategory(b.category) === item).length;
                  const meta = CATEGORY_META[item] || { icon: Store, tone: styles.toneCyan };
                  const Icon = meta.icon;
                  return (
                    <button key={item} type="button" className={`${styles.card} ${index === 0 && count ? styles.cardActive : ""}`} onClick={() => chooseCategory(item)}>
                      <span className={styles.cardMain}><span className={`${styles.iconChip} ${meta.tone || ""}`}><Icon size={23} /></span><span className={styles.cardCopy}><strong>{item}</strong><span>{count ? `${count} işletme` : "Yeni işletmeler yakında"}</span></span></span>
                      <CardArrow />
                    </button>
                  );
                })}
              </div>
            </section>
          ) : !city ? (
            <section>
              <button className={styles.backButton} type="button" onClick={() => chooseCategory("")}><ArrowLeft size={17} /> Kategorilere dön</button>
              <div className={styles.sectionHead}><div><span className={styles.eyebrow}>2. ADIM · {category}</span><h2>Hangi şehir?</h2></div><span className={styles.sectionMeta}>81 il arasından seçin</span></div>
              <div className={styles.citySelectWrap}><span className={styles.cityIcon}><MapPin size={21} /></span><div className={styles.citySelect}><Pick label="Şehir seçin" value={city} onChange={chooseCity} options={cityOptions.map((item) => ({ value: item, label: item }))} /></div></div>
              {availableCities.length ? (
                <>
                  <div className={styles.sectionHead}><h3>Bu kategoride işletme bulunan şehirler</h3><span className={styles.sectionMeta}>{availableCities.length} şehir</span><span className={styles.mobileSwipeHint}>Yana kaydır <ArrowRight size={14} /></span></div>
                  <div className={styles.cityGrid}>
                    {availableCities.map((item) => {
                      const count = rows.filter((b) => canonicalCategory(b.category) === category && normalizedCity(b) === item).length;
                      return <button key={item} type="button" className={`${styles.card} ${styles.cardActive}`} onClick={() => chooseCity(item)}><span className={styles.cardMain}><span className={styles.iconChip}><MapPin size={23} /></span><span className={styles.cardCopy}><span className={styles.eyebrow}>ŞEHİR</span><strong>{item}</strong><span>{count} işletme</span></span></span><CardArrow /></button>;
                    })}
                  </div>
                </>
              ) : <Blank title="Bu kategoride henüz işletme yok" description="Yukarıdaki şehir seçicisinden istediğiniz ili seçebilirsiniz. Yeni işletmeler eklendikçe burada görünecek." />}
            </section>
          ) : !business ? (
            <section>
              <button className={styles.backButton} type="button" onClick={() => chooseCity("")}><ArrowLeft size={17} /> Şehir seçimine dön</button>
              <div className={styles.sectionHead}><div><span className={styles.eyebrow}>3. ADIM · {category} · {city}</span><h2>İşletmeni seç</h2></div><span className={styles.sectionMeta}>{businesses.length} işletme</span>{businesses.length > 1 ? <span className={styles.mobileSwipeHint}>Yana kaydır <ArrowRight size={14} /></span> : null}</div>
              <div className={styles.searchBox}><Search size={18} /><Input aria-label="İşletme ara" placeholder="İşletme adı ara…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
              {businesses.length ? (
                <div className={styles.businessGrid}>
                  {businesses.map((b) => (
                    <button key={b.id} type="button" className={styles.card} onClick={() => chooseBusiness(b)}>
                      <span className={styles.cardMain}><BusinessVisual business={b} /><span className={styles.cardCopy}><strong>{b.name}</strong><span>{b.city || "Konum belirtilmedi"}</span><span>{b.min_price != null ? `${money(b.min_price)}’den başlayan` : "Hizmetleri ve şubeleri gör"}</span></span></span>
                      <CardArrow />
                    </button>
                  ))}
                </div>
              ) : <Blank title={`${city} · ${category} için henüz işletme yok`} description="Bu şehir ve kategoride yeni işletmeler eklendiğinde burada listelenecek. Başka bir şehir veya kategori seçebilirsiniz." />}
              <div className={styles.promo}><span className={styles.eyebrow}>İŞLETMELER İÇİN</span><h3>Neta Keşfet’te görünür olun.</h3><p>Neta kullanan işletmeler organik olarak listelenir. Öne çıkan işletme alanları daha sonra ayrı reklam ürünü olarak kullanılabilir.</p><a className="button" href="/kayit">İşletmemi Neta’ya ekle <ArrowRight size={16} /></a></div>
            </section>
          ) : (
            <section>
              <button className={styles.backButton} type="button" onClick={() => { setBusiness(null); setBusinessData(null); setError(""); }}><ArrowLeft size={17} /> İşletmelere dön</button>
              <div className={styles.sectionHead}><div><span className={styles.eyebrow}>4. ADIM · {business.name}</span><h2>Şubeyi seç</h2></div><span className={styles.sectionMeta}>{branches.length} aktif şube</span>{branches.length > 1 ? <span className={styles.mobileSwipeHint}>Yana kaydır <ArrowRight size={14} /></span> : null}</div>
              {branchLoading ? <div className="loading-row"><Busy /> Şubeler yükleniyor…</div> : error ? <p className="error-message">{error}</p> : branches.length ? (
                <div className={styles.branchGrid}>
                  {branches.map((branch) => <a key={branch.id} className={styles.card} href={`/randevu/${encodeURIComponent(business.slug)}?branch=${encodeURIComponent(branch.id)}`}><span className={styles.cardMain}><span className={`${styles.iconChip} ${styles.toneGreen}`}><MapPin size={23} /></span><span className={styles.cardCopy}><strong>{branch.name}</strong><span>{[branch.city, branch.address].filter(Boolean).join(" · ") || "Adres bilgisi işletmeden alınacak"}</span><span>Bu şubeden randevu al</span></span></span><CardArrow /></a>)}
                </div>
              ) : <div className={styles.promo}><h3>Şube kaydı bulunamadı</h3><p>İşletmenin genel randevu sayfasından devam edebilirsiniz.</p><a className="button primary" href={`/${business.slug}`}>Randevu sayfasına git <ArrowRight size={16} /></a></div>}
            </section>
          )}
        </div>
      </main>
    </PublicShell>
  );
}
