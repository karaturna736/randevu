"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Building2, MapPin } from "lucide-react";
import { money } from "@/lib/types";
import styles from "./discover-center-carousel.module.css";

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

type CarouselItem = {
  key: string;
  node: ReactNode;
};

function CenterCarousel({ items, resetKey, label }: { items: CarouselItem[]; resetKey: string; label: string }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<number | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  function slides() {
    return Array.from(viewportRef.current?.querySelectorAll<HTMLElement>("[data-center-slide]") || []);
  }

  function scrollToIndex(index: number, smooth = true) {
    const viewport = viewportRef.current;
    const nodes = slides();
    if (!viewport || !nodes.length) return;
    const next = Math.max(0, Math.min(index, nodes.length - 1));
    const slide = nodes[next];
    const left = slide.offsetLeft - (viewport.clientWidth - slide.offsetWidth) / 2;
    viewport.scrollTo({ left: Math.max(0, left), behavior: smooth ? "smooth" : "auto" });
    setActiveIndex(next);
  }

  function syncActiveSlide() {
    if (frameRef.current != null) cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(() => {
      const viewport = viewportRef.current;
      const nodes = slides();
      if (!viewport || !nodes.length) return;
      const center = viewport.scrollLeft + viewport.clientWidth / 2;
      let closest = 0;
      let distance = Number.POSITIVE_INFINITY;
      nodes.forEach((node, index) => {
        const nodeCenter = node.offsetLeft + node.offsetWidth / 2;
        const nextDistance = Math.abs(nodeCenter - center);
        if (nextDistance < distance) {
          closest = index;
          distance = nextDistance;
        }
      });
      setActiveIndex(closest);
    });
  }

  useEffect(() => {
    setActiveIndex(0);
    const id = requestAnimationFrame(() => scrollToIndex(0, false));
    return () => {
      cancelAnimationFrame(id);
      if (frameRef.current != null) cancelAnimationFrame(frameRef.current);
    };
    // resetKey intentionally resets carousel position whenever filters/data change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey, items.length]);

  if (!items.length) return null;

  return (
    <div className={styles.mobileCarousel} aria-label={label}>
      <div ref={viewportRef} className={styles.viewport} onScroll={syncActiveSlide}>
        <div className={styles.track}>
          {items.map((item, index) => (
            <div
              key={item.key}
              data-center-slide
              className={`${styles.slide} ${index === activeIndex ? styles.slideActive : ""}`}
            >
              {item.node}
            </div>
          ))}
        </div>
      </div>

      {items.length > 1 ? (
        <>
          <button
            type="button"
            className={`${styles.navButton} ${styles.navLeft}`}
            aria-label="Önceki kart"
            onClick={() => scrollToIndex(activeIndex - 1)}
            disabled={activeIndex === 0}
          >
            <ArrowLeft size={19} />
          </button>
          <button
            type="button"
            className={`${styles.navButton} ${styles.navRight}`}
            aria-label="Sonraki kart"
            onClick={() => scrollToIndex(activeIndex + 1)}
            disabled={activeIndex === items.length - 1}
          >
            <ArrowRight size={19} />
          </button>
          <div className={styles.dots} aria-label={`${activeIndex + 1} / ${items.length}`}>
            {items.map((item, index) => (
              <button
                key={item.key}
                type="button"
                className={`${styles.dot} ${index === activeIndex ? styles.dotActive : ""}`}
                aria-label={`${index + 1}. karta git`}
                onClick={() => scrollToIndex(index)}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

function BusinessCover({ business, branch }: { business: BusinessRow; branch?: boolean }) {
  return (
    <span className={styles.cover} aria-hidden="true">
      <span className={styles.coverFallback}>{branch ? <MapPin size={34} /> : <Building2 size={34} />}</span>
      <img
        src={`/api/v1/business-image/${encodeURIComponent(business.id)}`}
        alt=""
        loading="lazy"
        onError={(event) => { event.currentTarget.style.display = "none"; }}
      />
      <span className={styles.coverShade} />
    </span>
  );
}

export function MobileBusinessCarousel({
  businesses,
  onSelect,
  resetKey,
}: {
  businesses: BusinessRow[];
  onSelect: (business: BusinessRow) => void;
  resetKey: string;
}) {
  const items = businesses.map((business) => ({
    key: business.id,
    node: (
      <button type="button" className={styles.carouselCard} onClick={() => onSelect(business)}>
        <BusinessCover business={business} />
        <span className={styles.cardBody}>
          <span className={styles.kicker}>{business.category}</span>
          <strong className={styles.title}>{business.name}</strong>
          <span className={styles.meta}><MapPin size={14} /> {business.city || "Konum belirtilmedi"}</span>
          <span className={styles.subline}>
            {business.min_price != null ? `${money(business.min_price)}’den başlayan` : "Hizmetleri ve şubeleri gör"}
          </span>
          <span className={styles.cta}>İşletmeyi seç <ArrowRight size={16} /></span>
        </span>
      </button>
    ),
  }));

  return <CenterCarousel items={items} resetKey={resetKey} label="İşletmeler" />;
}

export function MobileBranchCarousel({
  branches,
  business,
  resetKey,
}: {
  branches: BranchRow[];
  business: BusinessRow;
  resetKey: string;
}) {
  const items = branches.map((branch) => ({
    key: branch.id,
    node: (
      <a
        className={styles.carouselCard}
        href={`/randevu/${encodeURIComponent(business.slug)}?branch=${encodeURIComponent(branch.id)}`}
      >
        <BusinessCover business={business} branch />
        <span className={styles.cardBody}>
          <span className={styles.kicker}>ŞUBE</span>
          <strong className={styles.title}>{branch.name}</strong>
          <span className={styles.meta}><MapPin size={14} /> {[branch.city, branch.address].filter(Boolean).join(" · ") || "Adres bilgisi işletmeden alınacak"}</span>
          <span className={styles.subline}>{business.name}</span>
          <span className={styles.cta}>Bu şubeden randevu al <ArrowRight size={16} /></span>
        </span>
      </a>
    ),
  }));

  return <CenterCarousel items={items} resetKey={resetKey} label="Şubeler" />;
}
