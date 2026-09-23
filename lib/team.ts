import {z} from 'zod';
import {all,one,q,user,tenant,date,ApiError} from './server';
import {SELECT_APPOINTMENTS,change} from './booking';
import {today,addDays} from './types';

export async function teamAccess(id:string){await tenant(id);return {members:await all("SELECT m.user_id,m.email,m.name,m.staff_id,m.disabled FROM members m WHERE m.tenant_id=? AND m.role='staff'",id)}}
export async function setTeamAccess(id:string,x:any){
 await tenant(id);const person=z.string().parse(x.staff_id);
 if(!await one('SELECT id FROM staff WHERE tenant_id=? AND id=?',id,person))throw new ApiError('Personel bulunamadı.',404);
 if(x.action==='remove'){await q("UPDATE members SET disabled=1 WHERE tenant_id=? AND staff_id=? AND role='staff'",id,person).run();return {ok:true}}
 const email=z.string().email().max(254).parse(x.email).toLowerCase();
 const matches=await all('SELECT user_id,name,email FROM profiles WHERE lower(email)=? AND disabled=0 LIMIT 2',email);
 if(matches.length!==1)throw new ApiError('Personel önce bu e-posta ile üyeliğini tamamlamalı.');
 const p=matches[0],existing=await one('SELECT role FROM members WHERE tenant_id=? AND user_id=?',id,p.user_id);
 if(existing?.role==='owner')throw new ApiError('İşletme sahibinin yetkisi personel erişimine dönüştürülemez.');
 const assigned=await one("SELECT user_id FROM members WHERE tenant_id=? AND staff_id=? AND role='staff' AND disabled=0 AND user_id!=?",id,person,p.user_id);
 if(assigned)throw new ApiError('Bu personelin başka bir hesabı bağlı. Önce mevcut erişimi kaldırın.',409);
 await q(`INSERT INTO members(tenant_id,user_id,email,name,role,staff_id,disabled) VALUES(?,?,?,?,'staff',?,0)
 ON CONFLICT(tenant_id,user_id) DO UPDATE SET staff_id=excluded.staff_id,email=excluded.email,name=excluded.name,disabled=0 WHERE members.role='staff'`,id,p.user_id,p.email,p.name,person).run();return {ok:true};
}
async function assignments(){const u=await user();return {u,rows:await all("SELECT b.id,b.name,b.slug,m.staff_id,p.name staff_name FROM members m JOIN businesses b ON b.id=m.tenant_id JOIN staff p ON p.tenant_id=m.tenant_id AND p.id=m.staff_id WHERE m.user_id=? AND m.role='staff' AND m.disabled=0 AND p.active=1 AND b.status NOT IN ('deleted','suspended')",u.userId)}}
export async function teamJobs(id:string,d:string){
 const {u,rows}=await assignments();if(!rows.length)return {businesses:[],appointments:[],user:u};
 const b=id?rows.find(b=>b.id===id):rows[0];if(!b)throw new ApiError('Ekip erişimi reddedildi.',403);
 const day=date.parse(d||today());if(day<addDays(today(),-90)||day>addDays(today(),90))throw new ApiError('90 günlük aralıkta bir tarih seçin.');
 return {businesses:rows,business:b,user:u,appointments:await all(SELECT_APPOINTMENTS+' WHERE a.tenant_id=? AND a.staff_id=? AND a.date=? ORDER BY a.minute LIMIT 100',b.id,b.staff_id,day)};
}
export async function finishTeamJob(id:string,x:any){
 const {rows}=await assignments(),assignment=rows.find(b=>b.id===id);if(!assignment)throw new ApiError('Ekip erişimi reddedildi.',403);
 const a=await one(SELECT_APPOINTMENTS+' WHERE a.tenant_id=? AND a.staff_id=? AND a.id=?',id,assignment.staff_id,z.string().parse(x.id));
 if(!a)throw new ApiError('İşlem bulunamadı.',404);
 const status=z.enum(['completed','no_show']).parse(x.status),b=await one('SELECT * FROM businesses WHERE id=?',id);
 return change(b,a,{status});
}
