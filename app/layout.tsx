import type { Metadata } from "next";
import "./globals.css";
import "./membership.css";
import "./insights.css";
import "./neta.css";
import "./operations.css";
import "./branches.css";
import { ReferralCapture } from "@/components/product/growth";
import { SessionProvider } from "@/components/product/session";

export const metadata: Metadata = {
  title: "Neta Randevu | Randevunuz net. İşiniz yolunda.",
  referrer: "no-referrer",
  description: "İşletmenizin randevuları, ekibi ve müşterileri bir arada.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
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
