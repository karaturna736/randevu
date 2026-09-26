import AuthPage from '@/components/product/auth';
import TurnstileGate from '@/components/product/turnstile-gate';
export const dynamic='force-dynamic';
export const metadata={title:'Üye ol · Neta Randevu',description:'Neta Randevu hesabınızı Google ile güvenli biçimde oluşturun.'};
export default function Page(){return <><TurnstileGate/><AuthPage signup/></>}
