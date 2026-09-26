import PaymentOnboarding from '@/components/product/payment-onboarding';
import CampaignAutoApply from '@/components/product/campaign-auto-apply';
export const dynamic='force-dynamic';export const metadata={title:'Hesabınızı aktifleştirin · Neta'};
export default function Page(){return <><PaymentOnboarding/><CampaignAutoApply mode="onboarding"/></>}
