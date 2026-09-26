import BusinessMediaSetup from '@/components/product/business-media-setup';
import CampaignAutoApply from '@/components/product/campaign-auto-apply';
export const dynamic='force-dynamic';export const metadata={title:'Hesabınızı aktifleştirin · Neta'};
export default function Page(){return <><BusinessMediaSetup/><CampaignAutoApply mode="onboarding"/></>}
