import { SeoLandingPage } from "@/components/seo/landing-page";
import { metadataForSeoPage, seoPages } from "@/lib/seo-pages";

const page = seoPages["guzellik-salonu-randevu-sistemi"];

export const metadata = metadataForSeoPage(page);

export default function GuzellikSalonuRandevuSistemiPage() {
  return <SeoLandingPage page={page} />;
}
