"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Apple,
  ArrowLeft,
  ArrowRight,
  Brain,
  BriefcaseBusiness,
  Building2,
  Car,
  Check,
  Dumbbell,
  GraduationCap,
  Grid2X2,
  HeartPulse,
  MapPin,
  Scissors,
  Search,
  Sparkles,
  Stethoscope,
  Store,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { money } from "@/lib/types";
import { api, Busy, Pick } from "./common";
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

function normalizedCity(b: BusinessRow) {
  return (b.city || "").trim() || "Konum belirtilmemiş";
}

function categoryVisual(category: string) {
  switch (category) {
    case "Kuaför & Berber":
      return { Icon: Scissors, tone: styles.violet };
    case "Güzellik Salonu":
      return { Icon: Sparkles, tone: styles.pink };
    case "Spa & Masaj":
      return { Icon: HeartPulse, tone: styles.emerald };
    case "Klinik":
      return { Icon: Stethoscope, tone: styles.cyan };
    case "Diyetisyen":
      return { Icon: Apple, tone: styles.green };
    case "Psikolog":
      return { Icon: Brain, tone: styles.purple };
    case "Spor & Fitness":
      return { Icon: Dumbbell, tone: styles.amber };
    case "Özel Ders":
      return { Icon: GraduationCap, tone: styles.blue };
    case "Danışmanlık":
      return { Icon: BriefcaseBusiness, tone: styles.indigo };
    case "Oto Servis":
      return { Icon: Car, tone: styles.rose };
    default:
      return { Icon: Grid2X2, tone: styles.slate };
  }
}

function Stepper({ category, city, business }: { category: string; city: string; business: BusinessRow | null }) {
  const active = !category ? 1 : !city ? 2 : !business ? 3 : 4;
  const steps = [
    { n: 1, title: "Kategori", detail: category || "İhtiyacını seç", Icon: Grid2X2 },
    { n: 2, title: "Şehir", detail: city || "Şehrini belirle", Icon: MapPin },
    { n: 3, title: "İşletme", detail: business?.name || "İşletmeni seç", Icon: Building2 },
    { n: 4, title: "Şube", detail: "Şubeni seç", Icon: Store },
  ];

  return (
    <div className={styles.stepper} aria-label="Keşfet adımları">
      {steps.map((step, index) => {
        const complete = step.n < active;
        const current = step.n === active;
        return (
          <div className={styles.stepFragment} key={step.n}>
            <div className={`${styles.step} ${current ? styles.stepActive : ""} ${complete ? styles.stepComplete : ""}`}>
              <span className={styles.stepIcon}>{complete ? <Check size={18} /> : <step.Icon size={18} />}</span>
              <span className={styles.stepCopy}>
                <strong>{step.n}. {step.title}</strong>
                <small>{step.detail}</small>
              </span>
            </div>
            {index < steps.length - 1 ? <span className={`${styles.connector} ${complete ? styles.connectorDone : ""}`} /> : null}
          </div>
        );
      })}
    </div>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className={styles.emptyState}>
      <span className={styles.emptyIcon}><Sparkles size={20} /></span>
      <div>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
    </div>
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
      .then((r) => setRows(r.businesses || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const categories = useMemo(() => {
    const extras = Array.from(new Set(rows.map((b) => b.category).filter(Boolean))).filter(
      (item) => !DISCOVERY_CATEGORIES.includes(item),
    );
    return [...DISCOVERY_CATEGORIES, ...extras];
  }, [rows]);

  const availableCities = useMemo(() => {
    if (!category) return [];
    return Array.from(new Set(rows.filter((b) => b.category === category).map(normalizedCity)))
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
      if (b.category !== category || normalizedCity(b) !== city) return false;
      return !q || `${b.name} ${b.address || ""} ${b.description || ""}`.toLocaleLowerCase("tr-TR").includes(q);
    });
  }, [rows, category, city, search]);

  function chooseCategory(value: string) {
    setCategory(value);
    setCity("");
    setBusiness(null);
    setBusinessData(null);
    setSearch("");
    setError("");
  }

  function chooseCity(value: string) {
    setCity(value);
    setBusiness(null);
    setBusinessData(null);
    setSearch("");
    setError("");
  }

  async function chooseBusiness(next: BusinessRow) {
    setBusiness(next);
    setBusinessData(null);
    setBranchLoading(true);
    setError("");
    try {
      setBusinessData(await api("public/" + encodeURIComponent(next.slug)));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBranchLoading(false);
    }
  }

  const branches: BranchRow[] = businessData?.branches || [];

  return (
    <PublicShell>
      <main className={styles.premiumDiscover}>
        <div className={styles.ambient} aria-hidden="true">
          <span className={styles.ambientOne} />
          <span className={styles.ambientTwo} />
          <span className={styles.ambientThree} />
        </div>

        <div className={styles.pageInner}>
          <header className={styles.hero}>
            <div className={styles.kicker}><span /> NETA KEŞFET <span /></div>
            <h1>İhtiyacını seç, şehrini belirle, <em>işletmeni bul.</em></h1>
            <p>Güzellik salonu, spa, kuaför ve diğer hizmet kategorilerinden seçim yapın; ardından şehir, işletme ve şubeyi seçerek randevunuzu oluşturun.</p>
          </header>

          <Stepper category={category} city={city} business={business} />

          {loading ? (
            <div className={styles.loading}><Busy /> İşletmeler hazırlanıyor…</div>
          ) : error && !business ? (
            <div className={styles.error}>{error}</div>
          ) : !category ? (
            <section className={styles.contentPanel}>
              <div className={styles.sectionHeading}>
                <div>
                  <span className={styles.stepLabel}>1. ADIM</span>
                  <h2>Hangi hizmeti arıyorsunuz?</h2>
                </div>
                <span className={styles.helper}><Grid2X2 size={16} /> Kategori seçin</span>
              </div>

              <div className={styles.categoryGrid}>
                {categories.map((item) => {
                  const count = rows.filter((b) => b.category === item).length;
                  const { Icon, tone } = categoryVisual(item);
                  return (
                    <button key={item} type="button" className={styles.categoryCard} onClick={() => chooseCategory(item)}>
                      <span className={`${styles.categoryIcon} ${tone}`}><Icon size={23} /></span>
                      <span className={styles.cardCopy}>
                        <strong>{item}</strong>
                        <small>{count ? `${count} işletme` : "Yeni işletmeler yakında"}</small>
                      </span>
                      <span className={styles.cardArrow}><ArrowRight size={18} /></span>
                    </button>
                  );
                })}
              </div>
            </section>
          ) : !city ? (
            <section className={styles.contentPanel}>
              <button className={styles.backButton} type="button" onClick={() => chooseCategory("")}><ArrowLeft size={17} /> Kategorilere dön</button>
              <div className={styles.sectionHeading}>
                <div>
                  <span className={styles.stepLabel}>2. ADIM · {category}</span>
                  <h2>Hangi şehir?</h2>
                </div>
                <span className={styles.helper}>81 il arasından seçin</span>
              </div>

              <div className={styles.selectShell}>
                <span className={styles.selectIcon}><MapPin size={20} /></span>
                <div className={styles.selectControl}>
                  <Pick
                    label="Şehir seçin"
                    value={city}
                    onChange={chooseCity}
                    options={cityOptions.map((item) => ({ value: item, label: item }))}
                  />
                </div>
              </div>

              {availableCities.length ? (
                <div className={styles.citySection}>
                  <div className={styles.subHeading}>
                    <h3>Bu kategoride işletme bulunan şehirler</h3>
                    <span>{availableCities.length} şehir</span>
                  </div>
                  <div className={styles.cityGrid}>
                    {availableCities.map((item) => {
                      const count = rows.filter((b) => b.category === category && normalizedCity(b) === item).length;
                      return (
                        <button key={item} type="button" className={styles.cityCard} onClick={() => chooseCity(item)}>
                          <span className={`${styles.categoryIcon} ${styles.violet}`}><MapPin size={23} /></span>
                          <span className={styles.cardCopy}>
                            <span className={styles.microLabel}>ŞEHİR</span>
                            <strong>{item}</strong>
                            <small>{count} işletme</small>
                          </span>
                          <span className={styles.cardArrow}><ArrowRight size={18} /></span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <EmptyState title="Bu kategoride henüz işletme yok" description="Yukarıdan istediğiniz şehri seçebilirsiniz. Yeni işletmeler eklendikçe burada öne çıkacak." />
              )}
            </section>
          ) : !business ? (
            <section className={styles.contentPanel}>
              <button className={styles.backButton} type="button" onClick={() => chooseCity("")}><ArrowLeft size={17} /> Şehir seçimine dön</button>
              <div className={styles.sectionHeading}>
                <div>
                  <span className={styles.stepLabel}>3. ADIM · {category} · {city}</span>
                  <h2>İşletmeni seç</h2>
                </div>
                <span className={styles.helper}>{businesses.length} işletme</span>
              </div>

              <div className={styles.searchShell}>
                <Search size={19} />
                <Input aria-label="İşletme ara" placeholder="İşletme adı veya hizmet ara…" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>

              {businesses.length ? (
                <div className={styles.businessGrid}>
                  {businesses.map((b) => (
                    <button key={b.id} type="button" className={styles.businessCard} onClick={() => chooseBusiness(b)}>
                      <div className={styles.businessTop}>
                        <span className={`${styles.categoryIcon} ${styles.indigo}`}><Building2 size={23} /></span>
                        <span className={styles.cardArrow}><ArrowRight size={18} /></span>
                      </div>
                      <span className={styles.microLabel}>{b.category}</span>
                      <h3>{b.name}</h3>
                      <p><MapPin size={14} /> {b.city || "Konum belirtilmedi"}</p>
                      <small>{b.min_price != null ? `${money(b.min_price)}’den başlayan` : "Hizmetleri ve şubeleri gör"}</small>
                    </button>
                  ))}
                </div>
              ) : (
                <EmptyState title={`${city} · ${category} için henüz işletme yok`} description="Başka bir şehir veya kategori seçebilirsiniz. Yeni işletmeler eklendiğinde burada listelenecek." />
              )}

              <div className={styles.partnerCard}>
                <div>
                  <span className={styles.microLabel}>İŞLETMELER İÇİN</span>
                  <h3>Neta Keşfet’te daha görünür olun.</h3>
                  <p>Neta kullanan işletmeler organik olarak listelenir. Öne çıkan alanlar reklam ürünü olarak sunulabilir.</p>
                </div>
                <a href="/kayit">İşletmemi Neta’ya ekle <ArrowRight size={16} /></a>
              </div>
            </section>
          ) : (
            <section className={styles.contentPanel}>
              <button className={styles.backButton} type="button" onClick={() => { setBusiness(null); setBusinessData(null); setError(""); }}><ArrowLeft size={17} /> İşletmelere dön</button>
              <div className={styles.sectionHeading}>
                <div>
                  <span className={styles.stepLabel}>4. ADIM · {business.name}</span>
                  <h2>Şubeyi seç</h2>
                </div>
                <span className={styles.helper}>{branches.length} aktif şube</span>
              </div>

              {branchLoading ? (
                <div className={styles.loading}><Busy /> Şubeler hazırlanıyor…</div>
              ) : error ? (
                <div className={styles.error}>{error}</div>
              ) : branches.length ? (
                <div className={styles.branchGrid}>
                  {branches.map((branch) => (
                    <a key={branch.id} className={styles.branchCard} href={`/randevu/${encodeURIComponent(business.slug)}?branch=${encodeURIComponent(branch.id)}`}>
                      <span className={`${styles.categoryIcon} ${styles.violet}`}><MapPin size={23} /></span>
                      <span className={styles.cardCopy}>
                        <span className={styles.microLabel}>ŞUBE</span>
                        <strong>{branch.name}</strong>
                        <small>{[branch.city, branch.address].filter(Boolean).join(" · ") || "Adres bilgisi işletmeden alınacak"}</small>
                      </span>
                      <span className={styles.cardArrow}><ArrowRight size={18} /></span>
                    </a>
                  ))}
                </div>
              ) : (
                <EmptyState title="Şube kaydı bulunamadı" description="İşletmenin genel randevu sayfasından devam edebilirsiniz." />
              )}

              {!branchLoading && !error && !branches.length ? (
                <a className={styles.primaryAction} href={`/${business.slug}`}>Randevu sayfasına git <ArrowRight size={16} /></a>
              ) : null}
            </section>
          )}
        </div>
      </main>
    </PublicShell>
  );
}
