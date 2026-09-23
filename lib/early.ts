import {z} from 'zod';
import {db,q,all,one,user,now,uid,ApiError} from './server';
import {available,change,SELECT_APPOINTMENTS} from './booking';
import {today,time} from './types';

export async function earlyOptions(a:any,b:any){
 if(a.status!=='confirmed'||a.early_from==null||a.early_from>=a.minute||new Date(a.date+'T'+time(a.minute)+':00+03:00').getTime()<=Date.now()||['deleted','suspended'].includes(b.status))return [];
 let slots:any[]=[];try{slots=(await available(b,a.service_id,a.date,a.staff_id,a.id,a.duration)).filter(s=>s.minute>=a.early_from&&s.minute<a.minute)}catch(e){if(e instanceof ApiError&&e.status===404)return [];throw e}
 const previous=await all('SELECT * FROM early_offers WHERE tenant_id=? AND appointment_id=? AND appointment_version=?',b.id,a.id,a.version);
 const options=slots.filter(s=>!previous.some(o=>o.minute===s.minute&&o.status==='dismissed')).slice(0,2);
 if(!options.length)return [];
 const stamp=now(),ops=options.map(s=>{
  const expires=new Date(Math.min(Date.now()+600000,new Date(a.date+'T'+time(s.minute)+':00+03:00').getTime()-300000)).toISOString();
  return q(`INSERT INTO early_offers(id,tenant_id,appointment_id,appointment_version,minute,created_at,expires_at) VALUES(?,?,?,?,?,?,?)
   ON CONFLICT(tenant_id,appointment_id,appointment_version,minute) DO UPDATE SET status='offered',expires_at=excluded.expires_at,created_at=excluded.created_at
   WHERE early_offers.status='offered' AND early_offers.expires_at<=?`,uid(),b.id,a.id,a.version,s.minute,stamp,expires,stamp);
 });await db().batch(ops);
 const rows=await all("SELECT id,minute,expires_at FROM early_offers WHERE tenant_id=? AND appointment_id=? AND appointment_version=? AND status='offered' AND expires_at>? ORDER BY minute",b.id,a.id,a.version,stamp);
 return rows.filter(o=>options.some(s=>s.minute===o.minute));
}
export async function earlyPreference(b:any,a:any,input:any){
 if(a.status!=='confirmed'||new Date(a.date+'T'+time(a.minute)+':00+03:00').getTime()<=Date.now())throw new ApiError('Yalnızca gelecekteki aktif randevunuz için erken geliş açabilirsiniz.');
 const from=z.number().int().min(0).max(1425).multipleOf(15).nullable().parse(input.early_from);
 if(from!=null&&from>=a.minute)throw new ApiError('Erken geliş saati mevcut randevunuzdan önce olmalı.');
 await db().batch([q('INSERT INTO mutations(tenant_id,appointment_id,version) VALUES(?,?,?)',b.id,a.id,a.version+1),q('UPDATE appointments SET early_from=?,version=version+1 WHERE tenant_id=? AND id=?',from,b.id,a.id),q("UPDATE early_offers SET status='withdrawn' WHERE tenant_id=? AND appointment_id=? AND status='offered'",b.id,a.id)]);
 return {ok:true};
}
export async function acceptEarly(b:any,a:any,input:any){
 const id=z.string().uuid().parse(input.offer_id),offer=await one("SELECT * FROM early_offers WHERE tenant_id=? AND appointment_id=? AND id=? AND status='offered' AND expires_at>?",b.id,a.id,id,now());
 if(!offer||a.early_from==null||offer.appointment_version!==a.version||offer.minute<a.early_from||offer.minute>=a.minute)throw new ApiError('Teklif artık geçerli değil. Güncel saatleri kontrol edin.',409);
 // Explicit opt-in permits only an earlier start on the same day, with the same
 // staff, service, saved price and duration. It never grants general owner access.
 return change(b,a,{action:'reschedule',date:a.date,minute:offer.minute,staff_id:a.staff_id},false,[
  q("UPDATE early_offers SET status='accepted' WHERE tenant_id=? AND appointment_id=? AND id=?",b.id,a.id,id),
  q("UPDATE early_offers SET status='withdrawn' WHERE tenant_id=? AND appointment_id=? AND status='offered'",b.id,a.id)
 ]);
}
export async function declineEarly(b:any,a:any,input:any){
 const id=z.string().uuid().parse(input.offer_id),r=await q("UPDATE early_offers SET status='dismissed' WHERE tenant_id=? AND appointment_id=? AND id=? AND status='offered'",b.id,a.id,id).run();
 if(!r.meta.changes)throw new ApiError('Teklif bulunamadı.',404);return {ok:true};
}
export async function earlyInbox(){
 const u=await user();const rows=await all(SELECT_APPOINTMENTS+` JOIN account_bookings ab ON ab.tenant_id=a.tenant_id AND ab.appointment_id=a.id WHERE ab.user_id=? AND a.status='confirmed' AND a.early_from IS NOT NULL AND a.date>=? ORDER BY a.date,a.minute LIMIT 20`,u.userId,today());
 const result:any[]=[];
 for(const a of rows){const b=await one('SELECT * FROM businesses WHERE id=?',a.tenant_id);for(const o of await earlyOptions(a,b))result.push({...o,appointment_id:a.id,date:a.date,original_minute:a.minute,service_name:a.service_name,business_name:b.name})}
 return {offers:result};
}
