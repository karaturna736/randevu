import type { SeoPageConfig } from "@/lib/seo-pages";

const SITE_URL = "https://netarandevu.com";

export function SeoLandingPage({ page }: { page: SeoPageConfig }) {
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${SITE_URL}/${page.slug}#webpage`,
        url: `${SITE_URL}/${page.slug}`,
        name: page.title,
        description: page.description,
        inLanguage: "tr-TR",
        isPartOf: { "@id": `${SITE_URL}/#website` },
        about: { "@id": `${SITE_URL}/#software` },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Neta",
            item: SITE_URL,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: page.breadcrumb,
            item: `${SITE_URL}/${page.slug}`,
          },
        ],
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(schema).replace(/</g, "\\u003c"),
        }}
      />
      <main className="neta-home">
        <section className="neta-container neta-section">
          <span className="neta-eyebrow">{page.eyebrow}</span>
          <h1>{page.h1}</h1>
          <p>{page.intro}</p>

          <div className="neta-hero-actions">
            <a
              className="button primary"
              href="/kayit?rol=business&sonra=%2Fkurulum"
            >
              İşletmemi oluştur
            </a>
            <a className="button neta-outline" href="/demo">
              Canlı demoyu incele
            </a>
          </div>

          {page.sections.map((section) => (
            <section key={section.heading}>
              <h2>{section.heading}</h2>
              <p>{section.body}</p>
              {section.items?.length ? (
                <ul>
                  {section.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}

          <section>
            <h2>Sık sorulan sorular</h2>
            {page.faqs.map((faq) => (
              <article key={faq.question}>
                <h3>{faq.question}</h3>
                <p>{faq.answer}</p>
              </article>
            ))}
          </section>

          <section>
            <h2>İlgili Neta çözümleri</h2>
            <p>
              İşletmenize en yakın kullanım senaryosunu inceleyin. Bu sayfalar
              aynı Neta altyapısının farklı randevu akışlarını açıklar.
            </p>
            <ul>
              {page.related.map((item) => (
                <li key={item.href}>
                  <a href={item.href}>{item.label}</a>
                </li>
              ))}
              <li>
                <a href="/hakkimizda">Neta Randevu hakkında</a>
              </li>
            </ul>
          </section>
        </section>
      </main>
    </>
  );
}
