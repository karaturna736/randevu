'use client';
import {createContext,useCallback,useContext,useEffect,useState} from 'react';
import {UserRound,CalendarDays,Store,LogOut,ChevronDown,ShieldCheck,ArrowRight} from 'lucide-react';
import {DropdownMenu,DropdownMenuTrigger,DropdownMenuContent,DropdownMenuLabel,DropdownMenuSeparator,DropdownMenuItem} from '@/components/ui/dropdown-menu';
import {useEarlyNotice} from './early-arrival';
import {api,Avatar,Busy} from './common';
type Session={ready:boolean;data:any;error:string;reload:()=>Promise<void>};
const Context=createContext<Session>({ready:false,data:null,error:'',reload:async()=>{}});
export function SessionProvider({children}:{children:React.ReactNode}){
 const [ready,setReady]=useState(false),[data,setData]=useState<any>(null),[error,setError]=useState('');
 const reload=useCallback(async()=>{try{setData(await api('account'));setError('')}catch(e:any){setError(e.message);setData(null)}finally{setReady(true)}},[]);
 useEffect(()=>{reload()},[reload]);
 return <Context.Provider value={{ready,data,error,reload}}>{children}</Context.Provider>;
}
export const useSession=()=>useContext(Context);
export function AccountMenu(){
 const {ready,data}=useSession();useEarlyNotice(!!data?.profile);
 if(!ready)return <span className="account-loading"><Busy/></span>;
 if(!data?.authenticated)return <div className="account-entry"><a className="text-button" href="/giris">Giriş yap</a><a className="button primary" href="/kayit">Üye ol <ArrowRight size={15}/></a></div>;
 const title=data.profile?.name||data.user.displayName;
 return <DropdownMenu><DropdownMenuTrigger className="account-menu-trigger" aria-label="Hesap menüsü"><Avatar name={title}/><span>{title.split(' ')[0].split('@')[0]}</span><ChevronDown size={14}/></DropdownMenuTrigger><DropdownMenuContent align="end" className="account-dropdown"><DropdownMenuLabel><strong>{title}</strong><small>{data.user.email}</small></DropdownMenuLabel><DropdownMenuSeparator/><DropdownMenuItem asChild><a href={data.profile?'/hesabim':'/kayit'}><UserRound size={16}/>{data.profile?'Hesabım':'Üyeliğimi tamamla'}</a></DropdownMenuItem><DropdownMenuItem asChild><a href="/randevularim"><CalendarDays size={16}/>Randevularım</a></DropdownMenuItem>{data.businesses?.length>0&&<DropdownMenuItem asChild><a href="/panel"><Store size={16}/>İşletme paneli</a></DropdownMenuItem>}{data.staff_memberships?.length>0&&<DropdownMenuItem asChild><a href="/ekibim"><UserRound size={16}/>Çalışan paneli</a></DropdownMenuItem>}{data.isAdmin&&<DropdownMenuItem asChild><a href="/admin"><ShieldCheck size={16}/>Platform yönetimi</a></DropdownMenuItem>}<DropdownMenuSeparator/><DropdownMenuItem asChild><a href="/cikis" target="_top"><LogOut size={16}/>Çıkış yap</a></DropdownMenuItem></DropdownMenuContent></DropdownMenu>;
}
export function AccountGate({children,returnTo='/randevularim'}:{children:React.ReactNode;returnTo?:string}){
 const {ready,data,error,reload}=useSession();
 if(!ready)return <div className="loading-row"><Busy/>Hesabınız hazırlanıyor…</div>;
 if(error)return <section className="panel account-gate"><ShieldCheck size={30}/><h2>Hesabınıza erişilemiyor</h2><p>{error}</p><button className="button" onClick={reload}>Tekrar dene</button></section>;
 if(!data?.authenticated||!data.profile)return <section className="panel account-gate"><span className="account-gate-icon"><UserRound size={28}/></span><h2>{data?.authenticated?'Üyeliğinizi tamamlayın':['/kurulum','/panel','/erisim-bekliyor'].includes(returnTo)?'İşletmenize giriş yapın.':returnTo==='/ekibim'?'Ekibinizdeki yeriniz hazır.':'Randevularınız için bir hesabınız olsun.'}</h2><p>{['/kurulum','/panel','/erisim-bekliyor'].includes(returnTo)?'Giriş yapın; işletme hesabınız yönetici onayından sonra açılır.':returnTo==='/ekibim'?'İşletme sahibinin yetkilendirdiği hesabınızla giriş yapın; ardından şube şifresini doğrulayın.':'Randevularınızı tek yerden yönetin, favori işletmelerinizi kaydedin ve tekrar kolayca randevu alın.'}</p><a className="button primary" href={(data?.authenticated?'/kayit':'/giris')+'?rol='+(returnTo==='/ekibim'?'staff':['/kurulum','/panel','/erisim-bekliyor'].includes(returnTo)?'business':'customer')+'&sonra='+encodeURIComponent(returnTo)}>{data?.authenticated?'Profilimi tamamla':'Giriş yap'} <ArrowRight size={16}/></a><a className="text-button" href="/kesfet">Üye olmadan işletmeleri keşfet</a></section>;
 return <>{children}</>;
}
