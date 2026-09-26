import { SeoLandingPage } from "@/components/seo/landing-page";
import { metadataForSeoPage, seoPages } from "@/lib/seo-pages";

const page = seoPages["whatsapp-randevu-sistemi"];

export const metadata = metadataForSeoPage(page);

export default function WhatsappRandevuSistemiPage() {
  return <SeoLandingPage page={page} />;
}
