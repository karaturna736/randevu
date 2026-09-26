import type { MetadataRoute } from "next";

const SITE_URL = "https://netarandevu.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/admin/",
          "/panel",
          "/giris",
          "/kayit",
          "/kurulum",
          "/odeme",
          "/abonelik",
          "/hesabim",
          "/ekibim",
          "/randevularim",
          "/yolculugum",
          "/bekleme",
          "/cikis",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
