import {z} from 'zod';
import {all,one,q,db,tenant,hash,uid,now,date as dateSchema,ApiError} from './server';
import {available,range} from './booking';
import {today,addDays,time} from './types';
import {requirePlanModule,tenantPlan,PLAN_LIMITS} from './entitlements';

const keySchema=z.string().regex(/^[a-f0-9]{64}$/);
export async function startVisit(b:any,input:any){
 const key=keySchema.parse(input.visitor_key),stamp=now(),visitorHash=await hash(b.id+':'+key);
 const row=await one(`INSERT INTO demand_visits(id,tenant_id,visitor_hash,day,created_at,last_seen_at) VALUES(?,?,?,?,?,?)
 ON CONFLICT(tenant_id,visitor_hash,day) DO UPDATE SET last_seen_at=excluded.last_seen_at RETURNING id`,uid(),b.id,visitorHash,today(),stamp,stamp);
 return {visit_id:row.id};
}
export async function visitIdentity(tenantId:string,input:any,required=false){
 if(!input.visit_id&&!required)return undefined;
 const key=keySchema.parse(input.visitor_key),id=z.string().uuid().parse(input.visit_id);
 const v=await one('SELECT id FROM demand_visits WHERE tenant_id=? AND id=? AND visitor_hash=? AND day>=?',tenantId,id,await hash(tenantId+':'+key),addDays(today(),-1));
 if(!v)throw new ApiError('Rezervasyon oturumu yenilenmeli. Sayfayı yeniden açın.',409);
 return v.id as string;
}
export async function searchDemand(b:any,input:any){
 const x=z.object({service_id:z.string(),staff_id:z.string().default('any'),date:dateSchema,minute_from:z.number().int().min(0).max(1425).multipleOf(15),minute_to:z.number().int().min(15).max(1440).multipleOf(15)}).parse(input);
 if(x.minute_from>=x.minute_to||x.minute_to-x.minute_from>360)throw new ApiError('En fazla 6 saatlik bir aralık seçin.');
 if(new Date(x.date+'T'+time(x.minute_to-15)+':00+03:00').getTime()<Date.now()+300000)throw new ApiError('Gelecekte bir saat aralığı seçin.');
 const visitId=await visitIdentity(b.id,input,true),service=await one('SELECT * FROM services WHERE tenant_id=? AND id=? AND active=1',b.id,x.service_id);
 if(!service)throw new ApiError('Hizmet bulunamadı.',404);
 if(x.staff_id!=='any'&&!await one('SELECT id FROM staff WHERE tenant_id=? AND id=? AND active=1',b.id,x.staff_id))throw new ApiError('Personel bulunamadı.',404);
 const daySlots=await available(b,x.service_id,x.date,x.staff_id);
 const slots=daySlots.filter(s=>s.minute>=x.minute_from&&s.minute<x.minute_to);
 let reason='available';
 if(!slots.length){
  const k=String(new Date(x.date+'T12:00:00Z').getUTCDay()),h=JSON.parse(b.hours)[k];
  const fits=(r:any)=>r&&Math.max(x.minute_from,r[0])+service.duration<=r[1]&&Math.max(x.minute_from,r[0])<x.minute_to;
  if(!fits(h))reason='closed_hours';
  else{const team=await all('SELECT * FROM staff WHERE tenant_id=? AND active=1',b.id),eligible=team.filter(p=>(x.staff_id==='any'||p.id===x.staff_id)&&fits(range(b,p,x.date)));
   const closed=await all('SELECT staff_id FROM closures WHERE tenant_id=? AND date=?',b.id,x.date);
   reason=!eligible.length?'staff_hours':eligible.every(p=>closed.some(c=>!c.staff_id||c.staff_id===p.id))?'leave':'fully_booked';
  }
 }
 const stamp=now();await db().batch([
  q(`INSERT INTO demand_searches(id,tenant_id,visit_id,service_id,staff_key,requested_date,minute_from,minute_to,matched,reason,price,duration,searched_at)
  VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(tenant_id,visit_id,service_id,staff_key,requested_date,minute_from,minute_to)
  DO UPDATE SET matched=excluded.matched,reason=excluded.reason,price=excluded.price,duration=excluded.duration,searched_at=excluded.searched_at`,uid(),b.id,visitId,x.service_id,x.staff_id,x.date,x.minute_from,x.minute_to,slots.length?1:0,reason,service.price,service.duration,stamp),
  q('UPDATE demand_visits SET last_seen_at=? WHERE tenant_id=? AND id=?',stamp,b.id,visitId)
 ]);
 return {slots,alternatives:slots.length?[]:daySlots.slice(0,4),reason,recorded:true};
}

function period(raw:any){return z.coerce.number().refine(n=>[7,30,90].includes(n),'Geçerli dönem seçin.').parse(raw||7)}
const ranked=`WITH ranked AS (
 SELECT i.*,v.visitor_hash,ROW_NUMBER() OVER(PARTITION BY v.visitor_hash ORDER BY i.searched_at DESC,i.id DESC) rn
 FROM demand_searches i JOIN demand_visits v ON v.id=i.visit_id AND v.tenant_id=i.tenant_id
 WHERE i.tenant_id=? AND i.searched_at>=?
), unresolved AS (
 SELECT r.* FROM ranked r WHERE r.rn=1 AND r.matched=0 AND NOT EXISTS(
 SELECT 1 FROM demand_visits v2 WHERE v2.tenant_id=r.tenant_id AND v2.visitor_hash=r.visitor_hash AND v2.converted_at>=r.searched_at)
) `;
export async function demandAnalytics(id:string,raw:any){
 await tenant(id);await requirePlanModule(id,'demand');
 // Talep fırsatları pakette sınırlıdır: Pro son 30 güne kadar bakar; Plus 90 gün.
 const plan=await tenantPlan(id),maxDays=PLAN_LIMITS[plan].advancedReports?90:30,
   requested=period(raw),days=requested>maxDays?maxDays:requested,
   day=addDays(today(),1-days),since=new Date(day+'T00:00:00+03:00').toISOString(),window_limited=requested>maxDays;
 const totals=await one(`SELECT COUNT(DISTINCT visitor_hash) visits,COUNT(DISTINCT CASE WHEN converted_at IS NOT NULL THEN visitor_hash END) converted FROM demand_visits WHERE tenant_id=? AND day>=?`,id,day);
 const searches=await one(`SELECT COUNT(DISTINCT v.visitor_hash) searchers,COUNT(DISTINCT CASE WHEN i.matched=0 THEN v.visitor_hash END) encountered_empty FROM demand_searches i JOIN demand_visits v ON v.id=i.visit_id AND v.tenant_id=i.tenant_id WHERE i.tenant_id=? AND i.searched_at>=?`,id,since);
 const unresolved=await one(ranked+`SELECT COUNT(*) count,COALESCE(SUM(price),0) value,COUNT(CASE WHEN reason='closed_hours' THEN 1 END) outside_hours,COALESCE(SUM(CASE WHEN reason='closed_hours' THEN price ELSE 0 END),0) outside_value FROM unresolved`,id,since);
 const windows=await all(ranked+`SELECT CAST(strftime('%w',requested_date) AS INTEGER) weekday,minute_from,minute_to,reason,COUNT(*) count,SUM(price) value,AVG(duration) duration,COUNT(DISTINCT requested_date) distinct_dates,COUNT(CASE WHEN staff_key!='any' THEN 1 END) specific_staff FROM unresolved GROUP BY weekday,minute_from,minute_to,reason ORDER BY count DESC,value DESC LIMIT 100`,id,since);
 const topWindow=await one(ranked+`SELECT minute_from,minute_to,COUNT(*) count FROM unresolved GROUP BY minute_from,minute_to ORDER BY count DESC LIMIT 1`,id,since);
 const services=await all(ranked+`SELECT s.id,s.name,COUNT(*) count,SUM(u.price) value FROM unresolved u JOIN services s ON s.id=u.service_id AND s.tenant_id=u.tenant_id GROUP BY s.id ORDER BY count DESC LIMIT 10`,id,since);
 return {days,since:day,totals:{...totals,...searches,...unresolved},windows,top_window:topWindow,services,measured_at:now(),window_limited};
}
export async function serviceAnalytics(id:string,raw:any){
 await tenant(id);const days=period(raw),start=addDays(today(),1-days);
 const rows=await all(`SELECT s.id,s.name,s.active,COUNT(a.id) booked,COUNT(CASE WHEN a.status='completed' THEN 1 END) completed,COUNT(CASE WHEN a.status='cancelled' THEN 1 END) cancelled,COUNT(CASE WHEN a.status='no_show' THEN 1 END) no_show,COALESCE(SUM(CASE WHEN a.status='completed' THEN a.price ELSE 0 END),0) revenue,COALESCE(SUM(CASE WHEN a.status='completed' THEN a.duration ELSE 0 END),0) minutes FROM services s LEFT JOIN appointments a ON a.tenant_id=s.tenant_id AND a.service_id=s.id AND a.date>=? AND a.date<=? WHERE s.tenant_id=? GROUP BY s.id ORDER BY completed DESC,booked DESC`,start,today(),id);
 const staff=await all(`SELECT p.name staff_name,s.name service_name,COUNT(*) completed,SUM(a.price) revenue FROM appointments a JOIN staff p ON p.tenant_id=a.tenant_id AND p.id=a.staff_id JOIN services s ON s.tenant_id=a.tenant_id AND s.id=a.service_id WHERE a.tenant_id=? AND a.status='completed' AND a.date>=? AND a.date<=? GROUP BY a.staff_id,a.service_id ORDER BY completed DESC LIMIT 100`,id,start,today());
 return {days,since:start,services:rows,staff};
}
