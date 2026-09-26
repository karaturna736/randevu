import { SeoLandingPage } from "@/components/seo/landing-page";
import { metadataForSeoPage, seoPages } from "@/lib/seo-pages";

const page = seoPages["online-randevu-sistemi"];

export const metadata = metadataForSeoPage(page);

export default function OnlineRandevuSistemiPage() {
  return <SeoLandingPage page={page} />;
}
