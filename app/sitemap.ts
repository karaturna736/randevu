import type { MetadataRoute } from "next";

const SITE_URL = "https://netarandevu.com";
const LAST_UPDATED = new Date("2026-09-26T00:00:00+03:00");

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL,
      lastModified: LAST_UPDATED,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/hakkimizda`,
      lastModified: LAST_UPDATED,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/online-randevu-sistemi`,
      lastModified: LAST_UPDATED,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/whatsapp-randevu-sistemi`,
      lastModified: LAST_UPDATED,
      changeFrequency: "monthly",
      priority: 0.85,
    },
    {
      url: `${SITE_URL}/kuafor-randevu-sistemi`,
      lastModified: LAST_UPDATED,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/berber-randevu-sistemi`,
      lastModified: LAST_UPDATED,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/guzellik-salonu-randevu-sistemi`,
      lastModified: LAST_UPDATED,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/kesfet`,
      lastModified: LAST_UPDATED,
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/demo`,
      lastModified: LAST_UPDATED,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/gizlilik`,
      lastModified: LAST_UPDATED,
      changeFrequency: "yearly",
      priority: 0.2,
    },
  ];
}
