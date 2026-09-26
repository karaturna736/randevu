import CampaignAdmin from "@/components/product/campaign-admin";
import CampaignTargetEnhancer from "@/components/product/campaign-target-enhancer";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <>
      <CampaignAdmin />
      <CampaignTargetEnhancer />
    </>
  );
}
