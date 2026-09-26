import { SeoLandingPage } from "@/components/seo/landing-page";
import { metadataForSeoPage, seoPages } from "@/lib/seo-pages";

const page = seoPages["kuafor-randevu-sistemi"];

export const metadata = metadataForSeoPage(page);

export default function KuaforRandevuSistemiPage() {
  return <SeoLandingPage page={page} />;
}
