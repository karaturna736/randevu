import {one,q,hash,now,ApiError} from './server';

export type PlanCode='normal'|'pro'|'plus';

/**
 * Neta paketlerinin kullanım sınırları. Hiçbir paket sınırsız dış sağlayıcı
 * kullanımı vaat etmez; sağlayıcı maliyeti ve kötüye kullanım kontrolü bu
 * sayaçlarla sunucu tarafında uygulanır.
 */
export const PLAN_LIMITS:Record<PlanCode,{whatsappMonthly:number;aiDaily:number;label:string}>={
  normal:{whatsappMonthly:100,aiDaily:10,label:'Normal'},
  pro:{whatsappMonthly:1000,aiDaily:50,label:'Pro'},
  plus:{whatsappMonthly:5000,aiDaily:200,label:'Plus'}
};

export const PLAN_CATALOG:Record<PlanCode,{name:string;amount:number;limits:{whatsappMonthly:number;aiDaily:number}}>={
  normal:{name:'Neta Normal',amount:99000,limits:PLAN_LIMITS.normal},
  pro:{name:'Neta Pro',amount:200000,limits:PLAN_LIMITS.pro},
  plus:{name:'Neta Plus',amount:350000,limits:PLAN_LIMITS.plus}
};

export async function tenantPlan(tenantId:string):Promise<PlanCode>{
  const row=await one('SELECT plan,state,test_mode,paid_until FROM recurring_subscriptions WHERE tenant_id=?',tenantId);
  if(!row||!['normal','pro','plus'].includes(row.plan))return 'normal';
  const paid=typeof row.paid_until==='string'&&row.paid_until>now();
  const test=Number(row.test_mode)===1&&['ACTIVE','PENDING','UPGRADED'].includes(String(row.state));
  return paid||test?row.plan as PlanCode:'normal';
}

function windowFor(feature:'whatsapp'|'ai'){
  const d=new Date();
  if(feature==='ai'){
    const end=new Date(d);end.setUTCHours(24,0,0,0);
    return {bucket:d.toISOString().slice(0,10),expires:end.getTime()};
  }
  const end=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,1));
  return {bucket:d.toISOString().slice(0,7),expires:end.getTime()};
}

/** Atomic, tenant-scoped quota reservation. A failed provider call still
 * consumes the attempt, preventing retry storms and unexpected overage. */
export async function consumePlanQuota(tenantId:string,feature:'whatsapp'|'ai'){
  const plan=await tenantPlan(tenantId),limit=PLAN_LIMITS[plan][feature==='ai'?'aiDaily':'whatsappMonthly'],window=windowFor(feature),key=await hash(`plan-quota:${tenantId}:${feature}:${window.bucket}`);
  const row=await one('INSERT INTO rate_limits(key,count,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1,expires_at=excluded.expires_at RETURNING count',key,window.expires);
  if(Number(row?.count||0)>limit){
    await q('UPDATE rate_limits SET count=CASE WHEN count>0 THEN count-1 ELSE 0 END WHERE key=?',key).run();
    const label=feature==='ai'?'AI yardım':'WhatsApp';
    throw new ApiError(`${PLAN_LIMITS[plan].label} paketinin ${label} kullanım kotası doldu. Paketinizi yükseltin veya sonraki dönemi bekleyin.`,429);
  }
  return {plan,limit,used:Number(row.count)};
}

