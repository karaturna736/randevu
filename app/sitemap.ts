import type { MetadataRoute } from "next";

const SITE_URL = "https://netarandevu.com";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/kesfet`,
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/demo`,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/gizlilik`,
      changeFrequency: "yearly",
      priority: 0.2,
    },
  ];
}
