'use client';
import {useEffect} from 'react';
import {useSession} from './session';
import {Busy} from './common';

export default function PanelRoleGate({children}:{children:React.ReactNode}){
 const {ready,data}=useSession();
 const owns=!!data?.businesses?.length;
 const manager=!!data?.manager_memberships?.length;
 const staff=!!data?.staff_memberships?.length;
 useEffect(()=>{
  if(!ready||owns)return;
  if(manager)location.replace('/mudur');
  else if(staff)location.replace('/ekibim');
 },[ready,owns,manager,staff]);
 if(!ready)return <div className="loading-row"><Busy/>Yetkiniz kontrol ediliyor…</div>;
 if(!owns&&(manager||staff))return <div className="loading-row"><Busy/>Doğru çalışma alanına yönlendiriliyorsunuz…</div>;
 return <>{children}</>;
}
