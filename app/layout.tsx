import type { Metadata } from "next";
import "./globals.css";
import "./membership.css";
import "./insights.css";
import "./neta.css";
import "./operations.css";
import "./branches.css";
import { ReferralCapture } from "@/components/product/growth";
import { SessionProvider } from "@/components/product/session";

const SITE_URL = "https://netarandevu.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Neta | Online Randevu ve İşletme Yönetim Sistemi",
  description:
    "Neta; kuaför, berber, güzellik salonu ve randevuyla çalışan işletmeler için online randevu, ekip, müşteri ve talep yönetim sistemidir.",
  applicationName: "Neta",
  creator: "Neta",
  publisher: "Neta",
  referrer: "no-referrer",
  openGraph: {
    siteName: "Neta",
    locale: "tr_TR",
    type: "website",
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
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}
