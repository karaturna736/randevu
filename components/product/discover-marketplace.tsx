"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Building2, MapPin, Search, Store } from "lucide-react";
import { Input } from "@/components/ui/input";
import { CATEGORIES, money } from "@/lib/types";
import { api, Blank, Busy } from "./common";
import { PublicShell } from "./public";

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

const cardStyle = {
  width: "100%",
  cursor: "pointer",
  textAlign: "left" as const,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 14,
};

function normalizedCity(b: BusinessRow) {
  return (b.city || "").trim() || "Konum belirtilmemiş";
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
    const seen = new Set(rows.map((b) => b.category).filter(Boolean));
    return [...CATEGORIES.filter((x) => seen.has(x)), ...Array.from(seen).filter((x) => !CATEGORIES.includes(x))];
  }, [rows]);

  const cities = useMemo(() => {
    if (!category) return [];
    return Array.from(
      new Set(rows.filter((b) => b.category === category).map(normalizedCity)),
    ).sort((a, b) => a.localeCompare(b, "tr-TR"));
  }, [rows, category]);

  const businesses = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("tr-TR");
    return rows.filter((b) => {
      if (b.category !== category || normalizedCity(b) !== city) return false;
      if (!q) return true;
      return `${b.name} ${b.address || ""} ${b.description || ""}`
        .toLocaleLowerCase("tr-TR")
        .includes(q);
    });
  }, [rows, category, city, search]);

  function resetFrom(level: "category" | "city" | "business") {
    setError("");
    setBusinessData(null);
    setBusiness(null);
    if (level === "category") {
      setCategory("");
      setCity("");
      setSearch("");
    } else if (level === "city") {
      setCity("");
      setSearch("");
    }
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
      <main className="discover-page">
        <div className="discover-hero">
          <span className="eyebrow">NETA KEŞFET</span>
          <h1>İhtiyacını seç, yakındaki işletmeyi bul, randevunu al.</h1>
          <p>İşletme türünden şubeye kadar adım adım ilerleyin. Doğru şubeyi seçtiğinizde randevu formu o şubeyle açılır.</p>
        </div>

        <div className="panel" style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
          <strong>1. {category || "İşletme türü"}</strong>
          <ArrowRight size={15} />
          <strong>2. {city || "Şehir"}</strong>
          <ArrowRight size={15} />
          <strong>3. {business?.name || "İşletme"}</strong>
          <ArrowRight size={15} />
          <strong>4. Şube</strong>
        </div>

        {loading ? (
          <div className="loading-row"><Busy /> İşletmeler yükleniyor…</div>
        ) : error && !business ? (
          <p className="error-message">{error}</p>
        ) : !category ? (
          <section>
            <div className="section-heading">
              <div>
                <span className="eyebrow">1. ADIM</span>
                <h2>Ne arıyorsunuz?</h2>
              </div>
              <span className="muted">İşletme türünü seçin</span>
            </div>
            {categories.length ? (
              <div className="business-cards">
                {categories.map((item) => {
                  const count = rows.filter((b) => b.category === item).length;
                  return (
                    <button
                      key={item}
                      type="button"
                      className="panel business-card"
                      style={cardStyle}
                      onClick={() => { setCategory(item); setCity(""); setBusiness(null); setSearch(""); }}
                    >
                      <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                        <span className="service-icon"><Store /></span>
                        <div>
                          <span className="eyebrow">KATEGORİ</span>
                          <h2>{item}</h2>
                          <p className="muted">{count} işletme</p>
                        </div>
                      </div>
                      <ArrowRight size={20} />
                    </button>
                  );
                })}
              </div>
            ) : (
              <Blank title="Henüz keşfedilecek işletme yok" description="Onaylanan işletmeler burada kategori bazında listelenecek." />
            )}
          </section>
        ) : !city ? (
          <section>
            <button className="text-button" type="button" onClick={() => resetFrom("category")}><ArrowLeft size={16} /> İşletme türüne dön</button>
            <div className="section-heading">
              <div>
                <span className="eyebrow">2. ADIM · {category}</span>
                <h2>Hangi şehir?</h2>
              </div>
              <span className="muted">{cities.length} şehir</span>
            </div>
            <div className="business-cards">
              {cities.map((item) => {
                const count = rows.filter((b) => b.category === category && normalizedCity(b) === item).length;
                return (
                  <button key={item} type="button" className="panel business-card" style={cardStyle} onClick={() => { setCity(item); setBusiness(null); setSearch(""); }}>
                    <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                      <span className="service-icon"><MapPin /></span>
                      <div><span className="eyebrow">ŞEHİR</span><h2>{item}</h2><p className="muted">{count} işletme</p></div>
                    </div>
                    <ArrowRight size={20} />
                  </button>
                );
              })}
            </div>
          </section>
        ) : !business ? (
          <section>
            <button className="text-button" type="button" onClick={() => resetFrom("city")}><ArrowLeft size={16} /> Şehir seçimine dön</button>
            <div className="section-heading">
              <div><span className="eyebrow">3. ADIM · {category} · {city}</span><h2>İşletmeni seç</h2></div>
              <span className="muted">{businesses.length} işletme</span>
            </div>
            <div className="discover-search">
              <div className="search-input">
                <Search size={19} />
                <Input aria-label="İşletme ara" placeholder="İşletme adı ara…" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
            </div>
            {businesses.length ? (
              <div className="business-cards">
                {businesses.map((b) => (
                  <button key={b.id} type="button" className="panel business-card" style={cardStyle} onClick={() => chooseBusiness(b)}>
                    <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                      <span className="service-icon"><Building2 /></span>
                      <div>
                        <span className="eyebrow">{b.category}</span>
                        <h2>{b.name}</h2>
                        <p className="muted"><MapPin size={14} /> {b.city || "Konum belirtilmedi"}</p>
                        <small>{b.min_price != null ? `${money(b.min_price)}’den başlayan` : "Hizmetleri ve şubeleri gör"}</small>
                      </div>
                    </div>
                    <ArrowRight size={20} />
                  </button>
                ))}
              </div>
            ) : (
              <Blank title="Bu seçimde işletme bulunamadı" description="Aramayı temizleyin veya başka bir şehir seçin." />
            )}
            <div className="panel" style={{ marginTop: 20 }}>
              <span className="eyebrow">İŞLETMELER İÇİN</span>
              <h3>Neta Keşfet’te görünür olun.</h3>
              <p className="muted">Organik listeleme randevu sistemine bağlı işletmeler için çalışır. Sponsorlu / öne çıkan reklam alanları ayrı bir reklam ürünü olarak eklenebilir.</p>
              <a className="button" href="/kayit">İşletmemi Neta’ya ekle <ArrowRight size={16} /></a>
            </div>
          </section>
        ) : (
          <section>
            <button className="text-button" type="button" onClick={() => { setBusiness(null); setBusinessData(null); setError(""); }}><ArrowLeft size={16} /> İşletmelere dön</button>
            <div className="section-heading">
              <div><span className="eyebrow">4. ADIM · {business.name}</span><h2>Şubeyi seç</h2></div>
              <span className="muted">{branches.length} aktif şube</span>
            </div>
            {branchLoading ? (
              <div className="loading-row"><Busy /> Şubeler yükleniyor…</div>
            ) : error ? (
              <p className="error-message">{error}</p>
            ) : branches.length ? (
              <div className="business-cards">
                {branches.map((branch) => (
                  <a key={branch.id} className="panel business-card" style={cardStyle} href={`/randevu/${encodeURIComponent(business.slug)}?branch=${encodeURIComponent(branch.id)}`}>
                    <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                      <span className="service-icon"><MapPin /></span>
                      <div>
                        <span className="eyebrow">ŞUBE</span>
                        <h2>{branch.name}</h2>
                        <p className="muted">{[branch.city, branch.address].filter(Boolean).join(" · ") || "Adres bilgisi işletmeden alınacak"}</p>
                        <strong>Bu şubeden randevu al</strong>
                      </div>
                    </div>
                    <ArrowRight size={20} />
                  </a>
                ))}
              </div>
            ) : (
              <div className="panel">
                <h3>Şube kaydı bulunamadı</h3>
                <p className="muted">İşletmenin genel randevu sayfasından devam edebilirsiniz.</p>
                <a className="button primary" href={`/${business.slug}`}>Randevu sayfasına git <ArrowRight size={16} /></a>
              </div>
            )}
          </section>
        )}
      </main>
    </PublicShell>
  );
}
