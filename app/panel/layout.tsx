import type {ReactNode} from 'react';
import {redirect} from 'next/navigation';
import {getAppUser} from '@/lib/identity';
import {accountPaymentState} from '@/lib/onboarding-payment';

export const dynamic='force-dynamic';

export default async function PanelLayout({children}:{children:ReactNode}){
 const current=await getAppUser();
 if(!current)redirect('/giris?rol=business&sonra=%2Fpanel');
 const payment=await accountPaymentState(current.userId);
 if(payment.state==='payment_processing')redirect('/odeme/bekleniyor');
 if(payment.state!=='active')redirect('/odeme');
 return children;
}
