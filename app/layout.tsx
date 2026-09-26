import type { Metadata } from "next";
import "./globals.css";
import "./membership.css";
import "./insights.css";
import "./neta.css";
import "./operations.css";
import "./branches.css";
import "./landing-premium.css";
import "./landing-dashboard.css";
import { ReferralCapture } from "@/components/product/growth";
import { SessionProvider } from "@/components/product/session";
import { AutomaticCampaign } from "@/components/product/automatic-campaign";

const SITE_URL = "https://netarandevu.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Neta | Online Randevu ve İşletme Yönetimi",
    template: "%s | Neta",
  },
  description:
    "Neta; kuaför, berber, güzellik salonu ve randevuyla çalışan işletmeler için online randevu, WhatsApp randevu, ekip, müşteri ve talep yönetim sistemidir.",
  applicationName: "Neta",
  creator: "Neta",
  publisher: "Neta",
  category: "business software",
  referrer: "no-referrer",
  verification: {
    google: "1hnJ476D3u8p2fGOXouJHeqrGjkkR7TO1qa-Bb7OmF8",
  },
  openGraph: {
    siteName: "Neta",
    locale: "tr_TR",
    type: "website",
    url: SITE_URL,
    title: "Neta | Online Randevu ve İşletme Yönetimi",
    description:
      "Neta ile online randevu, WhatsApp randevu, ekip, müşteri ve talep yönetimini tek yerde yönetin.",
    images: [
      {
        url: "/neta-logo.png",
        alt: "Neta online randevu ve işletme yönetim sistemi",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Neta | Online Randevu ve İşletme Yönetimi",
    description:
      "Neta ile online randevu, WhatsApp randevu, ekip, müşteri ve talep yönetimini tek yerde yönetin.",
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
  icons: {
    icon: "/favicon-white.svg",
    shortcut: "/favicon-white.svg",
    apple: "/neta-logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" className="dark" suppressHydrationWarning>
      <body className="antialiased">
        <SessionProvider>
          <ReferralCapture />
          <AutomaticCampaign />
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}
