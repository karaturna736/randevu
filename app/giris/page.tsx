import AuthPage from '@/components/product/auth';
import TurnstileGate from '@/components/product/turnstile-gate';
export const dynamic='force-dynamic';
export const metadata={title:'Giriş yap · Neta Randevu',description:'Neta Randevu hesabınıza Google ile güvenli giriş yapın.'};
export default function Page(){return <><TurnstileGate/><AuthPage/></>}
