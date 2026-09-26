import { SeoLandingPage } from "@/components/seo/landing-page";
import { metadataForSeoPage, seoPages } from "@/lib/seo-pages";

const page = seoPages["berber-randevu-sistemi"];

export const metadata = metadataForSeoPage(page);

export default function BerberRandevuSistemiPage() {
  return <SeoLandingPage page={page} />;
}
