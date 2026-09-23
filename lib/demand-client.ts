import {api} from '@/components/product/common';
import {today} from './types';
const pending=new Map<string,Promise<{visit_id:string;visitor_key:string}>>();
const memory=new Map<string,string>();
export function bookingVisit(slug:string){
 const cacheKey=slug+':'+today();if(pending.has(cacheKey))return pending.get(cacheKey)!;
 const promise=(async()=>{const storageKey='randevu-visit:'+slug;let key=memory.get(storageKey);try{key=key||sessionStorage.getItem(storageKey)||undefined}catch{}
  if(!key||!/^[a-f0-9]{64}$/.test(key))key=Array.from(crypto.getRandomValues(new Uint8Array(32))).map(x=>x.toString(16).padStart(2,'0')).join('');
  memory.set(storageKey,key);try{sessionStorage.setItem(storageKey,key)}catch{}
  const r=await api('visit',{slug,visitor_key:key});return {visit_id:r.visit_id,visitor_key:key};
 })();pending.set(cacheKey,promise);promise.catch(()=>pending.delete(cacheKey));return promise;
}
