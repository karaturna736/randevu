import type { Metadata } from "next";
import Landing from "@/components/product/landing";

const SITE_URL = "https://netarandevu.com";
const TITLE = "Neta | Online Randevu ve İşletme Yönetimi";
const DESCRIPTION =
  "Neta; kuaför, berber, güzellik salonu ve randevuyla çalışan işletmeler için online randevu, WhatsApp randevu, ekip, müşteri ve talep yönetim sistemidir.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "/",
    siteName: "Neta",
    locale: "tr_TR",
    type: "website",
    images: [
      {
        url: "/neta-logo.png",
        alt: "Neta online randevu ve işletme yönetim sistemi",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/neta-logo.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

const brandSchema = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "Neta",
      alternateName: ["Neta Randevu", "Neta Yazılım"],
      url: SITE_URL,
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/neta-logo.png`,
      },
      description: DESCRIPTION,
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      name: "Neta",
      alternateName: "Neta Randevu",
      url: SITE_URL,
      inLanguage: "tr-TR",
      description: DESCRIPTION,
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
    {
      "@type": "WebPage",
      "@id": `${SITE_URL}/#webpage`,
      url: SITE_URL,
      name: TITLE,
      description: DESCRIPTION,
      inLanguage: "tr-TR",
      isPartOf: { "@id": `${SITE_URL}/#website` },
      about: { "@id": `${SITE_URL}/#software` },
      primaryImageOfPage: {
        "@type": "ImageObject",
        url: `${SITE_URL}/neta-logo.png`,
      },
    },
    {
      "@type": "SoftwareApplication",
      "@id": `${SITE_URL}/#software`,
      name: "Neta",
      alternateName: "Neta Randevu",
      url: SITE_URL,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      inLanguage: "tr-TR",
      description: DESCRIPTION,
      brand: { "@id": `${SITE_URL}/#organization` },
      publisher: { "@id": `${SITE_URL}/#organization` },
      featureList: [
        "Online randevu yönetimi",
        "WhatsApp randevu otomasyonu",
        "Personel ve şube yönetimi",
        "Müşteri takibi",
        "Talep ve kaçan gelir analizi",
        "Bekleme listesi ve gelir kurtarma",
      ],
    },
  ],
};

export default function Page() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(brandSchema).replace(/</g, "\\u003c"),
        }}
      />
      <Landing />
    </>
  );
}
