import {earlyOptions,earlyPreference,acceptEarly,declineEarly} from './early';
import {z} from 'zod';
import {getAppUser} from './identity';
import {all,one,q,user,isAdmin,now,name,phone,date,uid,ApiError} from './server';
import {SELECT_APPOINTMENTS,byToken,change,available} from './booking';

export async function accountSnapshot(){
 const identity=await getAppUser();
 if(!identity)return {authenticated:false,profile:null};
 const u=await user();
 const profile=await one('SELECT * FROM profiles WHERE user_id=?',u.userId);
 const businesses=await all("SELECT b.id,b.name,b.slug,b.status,b.demo FROM businesses b JOIN members m ON m.tenant_id=b.id WHERE m.user_id=? AND m.disabled=0 AND m.role='owner' AND b.status NOT IN ('deleted','suspended') ORDER BY b.created_at DESC",u.userId);
 const staffMemberships=await all("SELECT b.id,b.name FROM members m JOIN businesses b ON b.id=m.tenant_id JOIN staff p ON p.tenant_id=m.tenant_id AND p.id=m.staff_id WHERE m.user_id=? AND m.role='staff' AND m.disabled=0 AND p.active=1 AND b.status NOT IN ('deleted','suspended')",u.userId);
 return {authenticated:true,user:u,profile,businesses,staff_memberships:staffMemberships,isAdmin:await isAdmin(u)};
}

export async function saveProfile(input:unknown){
 const u=await user();
 const x=z.object({name,phone:phone.or(z.literal('')).default(''),city:z.string().trim().max(80).default(''),account_type:z.enum(['customer','business']),marketing_consent:z.boolean().default(false)}).parse(input);
 await q(`INSERT INTO profiles (user_id,name,email,phone,city,account_type,marketing_consent,created_at,updated_at)
 VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET name=excluded.name,email=excluded.email,phone=excluded.phone,city=excluded.city,account_type=excluded.account_type,marketing_consent=excluded.marketing_consent,updated_at=excluded.updated_at`,u.userId,x.name,u.email,x.phone,x.city,x.account_type,x.marketing_consent?1:0,now(),now()).run();
 return accountSnapshot();
}

async function member(){
 const u=await user();
 if(!await one('SELECT user_id FROM profiles WHERE user_id=? AND disabled=0',u.userId))throw new ApiError('Önce üyelik profilinizi tamamlayın.',409);
 return u;
}

export async function bookingAccount(){
 if(!await getAppUser())return undefined;
 const u=await user();
 return await one('SELECT user_id FROM profiles WHERE user_id=? AND disabled=0',u.userId)?u.userId:undefined;
}

export async function accountBookings(){
 const u=await member();
 const appointments=await all(SELECT_APPOINTMENTS+` JOIN account_bookings ab ON ab.appointment_id=a.id AND ab.tenant_id=a.tenant_id
 WHERE ab.user_id=? ORDER BY a.date DESC,a.minute LIMIT 200`,u.userId);
 const businesses=await all(`SELECT DISTINCT b.id,b.name,b.slug,b.address,b.city,b.phone,b.status,b.demo,b.cancellation_hours
 FROM businesses b JOIN account_bookings ab ON ab.tenant_id=b.id WHERE ab.user_id=?`,u.userId);
 const favorites=await favoriteList(u.userId);
 return {appointments,businesses,favorites};
}

export async function ownAppointment(id:string){
 const u=await member();
 const a=await one(SELECT_APPOINTMENTS+' JOIN account_bookings ab ON ab.tenant_id=a.tenant_id AND ab.appointment_id=a.id WHERE ab.user_id=? AND a.id=?',u.userId,id);
 if(!a)throw new ApiError('Randevu bulunamadı.',404);
 return a;
}

export async function appointmentDetails(a:any){
 const b=await one('SELECT * FROM businesses WHERE id=?',a.tenant_id);
 return {appointment:a,business:{name:b.name,phone:b.phone,slug:b.slug,address:b.address,cancellation_hours:b.cancellation_hours},early_offers:await earlyOptions(a,b),review:await one('SELECT rating,comment,status FROM reviews WHERE appointment_id=?',a.id)};
}

export async function claimAppointment(input:unknown){
 const u=await member();
 const {token}=z.object({token:z.string().regex(/^[a-f0-9]{64}$/)}).parse(input);
 const a=await byToken(token);
 const existing=await one('SELECT user_id FROM account_bookings WHERE appointment_id=?',a.id);
 if(existing&&existing.user_id!==u.userId)throw new ApiError('Bu randevu başka bir üyeliğe bağlı.',409);
 if(!existing)await q('INSERT INTO account_bookings (appointment_id,tenant_id,user_id,created_at) VALUES (?,?,?,?)',a.id,a.tenant_id,u.userId,now()).run();
 return {ok:true,id:a.id};
}

async function favoriteList(id:string){
 return all("SELECT b.id,b.name,b.slug,b.category,b.city,b.address FROM favorites f JOIN businesses b ON b.id=f.tenant_id WHERE f.user_id=? AND b.status='approved' AND b.demo=0 ORDER BY f.created_at DESC LIMIT 100",id);
}
export async function getFavorites(){const u=await member();return {favorites:await favoriteList(u.userId)}}
export async function setFavorite(input:unknown){
 const u=await member();
 const x=z.object({tenant_id:z.string().min(1),saved:z.boolean()}).parse(input);
 if(!x.saved){await q('DELETE FROM favorites WHERE user_id=? AND tenant_id=?',u.userId,x.tenant_id).run();return {saved:false}}
 if(!await one("SELECT id FROM businesses WHERE id=? AND status='approved' AND demo=0",x.tenant_id))throw new ApiError('İşletme bulunamadı.',404);
 if((await one('SELECT COUNT(*) n FROM favorites WHERE user_id=?',u.userId)).n>=100&&!await one('SELECT tenant_id FROM favorites WHERE user_id=? AND tenant_id=?',u.userId,x.tenant_id))throw new ApiError('En fazla 100 favori işletme kaydedebilirsiniz.');
 await q('INSERT OR IGNORE INTO favorites (user_id,tenant_id,created_at) VALUES (?,?,?)',u.userId,x.tenant_id,now()).run();
 return {saved:true};
}

// Both account and private-link flows use exactly the same booking rules.
export async function customerAction(a:any,x:any){
 const b=await one("SELECT * FROM businesses WHERE id=? AND status NOT IN ('deleted','suspended')",a.tenant_id);
 if(!b)throw new ApiError('İşletmeyle iletişime geçin.',403);
 if(x.action==='early_preference')return earlyPreference(b,a,x);
 if(x.action==='early_accept')return acceptEarly(b,a,x);
 if(x.action==='early_decline')return declineEarly(b,a,x);
 if(x.action==='slots')return {slots:await available(b,a.service_id,date.parse(x.date),a.staff_id,a.id,a.duration)};
 if(x.action==='review'){
  if(a.status!=='completed')throw new ApiError('Yalnızca tamamlanan randevular değerlendirilebilir.');
  await q('INSERT INTO reviews (id,tenant_id,appointment_id,rating,comment,created_at) VALUES (?,?,?,?,?,?)',uid(),a.tenant_id,a.id,z.number().int().min(1).max(5).parse(x.rating),z.string().trim().min(3).max(1000).parse(x.comment),now()).run();
  return {ok:true};
 }
 if(x.action==='complaint'){
  await q('INSERT INTO complaints (id,tenant_id,appointment_id,message,created_at) VALUES (?,?,?,?,?)',uid(),a.tenant_id,a.id,z.string().trim().min(10).max(2000).parse(x.message),now()).run();
  return {ok:true};
 }
 return change(b,a,x,true);
}
