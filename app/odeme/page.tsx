import {redirect} from 'next/navigation';
import {getAppUser} from '@/lib/identity';
import {accountPaymentState} from '@/lib/onboarding-payment';
export const dynamic='force-dynamic';export const metadata={title:'Panel erişimi · Neta'};
export default async function Page(){
 const user=await getAppUser();
 if(!user)redirect('/giris?rol=business&sonra=%2Ferisim-bekliyor');
 const access=await accountPaymentState(user.userId);
 redirect(access.state==='active'?'/panel':'/erisim-bekliyor');
}
