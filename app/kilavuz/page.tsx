import type {Metadata} from 'next';
import {HelpCenter} from '@/components/product/growth';
import {PublicShell} from '@/components/product/public';

export const metadata: Metadata = {
  title: 'Neta Kılavuz | Randevu sistemini adım adım kullanın',
  description: 'Neta Randevu için personel, hizmet, randevu, WhatsApp, veresiye, raporlar ve diğer özelliklerin adım adım kullanım kılavuzu.',
};

export default function Page(){
  return <PublicShell><main className="member-page"><HelpCenter w={{preview:true}}/></main></PublicShell>;
}
