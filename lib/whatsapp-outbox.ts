import {env} from 'cloudflare:workers';
import {all,one,q,ApiError} from './server';
import {waConnection,waReady} from './whatsapp';
import {appOrigin} from './identity';
import {money,time} from './types';
import {seal,equalSecret} from './security';
import {consumePlanQuota} from './entitlements';

const cfg=()=>env as any;
const isoNow=()=>new Date().toISOString();
const RESCHEDULE_TEMPLATE_DEFAULT='neta_randevu_degistirildi';

function phone(value:string){
  const raw=String(value||'').trim();
  let digits=raw.replace(/\D/g,'');
  if(!raw.startsWith('+')){
    if(/^05\d{9}$/.test(digits))digits='90'+digits.slice(1);
    else if(/^5\d{9}$/.test(digits))digits='90'+digits;
  }
  return digits.length>=10&&digits.length<=15?digits:null;
}

function displayDate(value:string){
  const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value||''));
  return match?`${match[3]}.${match[2]}.${match[1]}`:String(value||'');
}

async function graph(c:any,to:string,payload:any){
  const response=await fetch('https://graph.facebook.com/'+cfg().WHATSAPP_GRAPH_VERSION+'/'+c.phone_id+'/messages',{method:'POST',redirect:'manual',signal:AbortSignal.timeout(12000),headers:{'Content-Type':'application/json',Authorization:'Bearer '+c.token},body:JSON.stringify({messaging_product:'whatsapp',recipient_type:'individual',to,...payload})});
  let result:any;try{result=await response.json()}catch{result=null}
  if(!response.ok||!result?.messages?.[0]?.id)throw new ApiError('WHATSAPP_PROVIDER_REJECTED',502);
  return String(result.messages[0].id);
}

function customerMessageFor(row:any){
  const when=`${displayDate(row.date)} ${time(row.minute)}`;
  const link=appOrigin()+'/'+row.slug;
  if(row.event==='created')return `Neta Randevu\nRandevunuz oluşturuldu.\n${row.service_name} · ${money(row.price)}\n${when} · ${row.staff_name}\nİşletme sayfası: ${link}\nRandevu yönetim bağlantınız onay ekranında gösterildi.`;
  if(row.event==='rescheduled')return `Neta Randevu\nMerhaba ${row.customer_name||'Müşterimiz'}, randevunuz işletme tarafından değiştirildi.\n${row.business_name} · ${row.service_name}\nYeni tarih ve saat: ${when}\nPersonel: ${row.staff_name}\nDetay: ${link}`;
  if(row.event==='cancelled')return `Neta Randevu\nRandevunuz iptal edildi.\n${row.service_name} · ${when}\nYeni randevu: ${appOrigin()}/${row.slug}`;
  return `Neta Randevu\nHatırlatma: yarın ${when} saatinde ${row.service_name} randevunuz var.\n${row.staff_name} · ${money(row.price)}\nİşletme sayfası: ${link}`;
}

function ownerMessageFor(row:any){
  const when=`${displayDate(row.date)} ${time(row.minute)}`;
  if(row.event==='created')return `Neta Yönetici Bildirimi\nYeni randevu oluşturuldu.\nMüşteri: ${row.customer_name||'Müşteri'}\nHizmet: ${row.service_name}\nTarih: ${when}\nPersonel: ${row.staff_name}`;
  if(row.event==='cancelled')return `Neta Yönetici Bildirimi\nRandevu iptal edildi.\nMüşteri: ${row.customer_name||'Müşteri'}\nHizmet: ${row.service_name}\nTarih: ${when}\nPersonel: ${row.staff_name}`;
  return '';
}

function payloadFor(c:any,row:any,body:string){
  if(row.event!=='rescheduled')return {type:'text',text:{preview_url:false,body}};
  const template=String(cfg().WHATSAPP_RESCHEDULE_TEMPLATE||RESCHEDULE_TEMPLATE_DEFAULT).trim();
  if(!/^[a-z0-9_]+$/.test(template))throw new ApiError('WHATSAPP_RESCHEDULE_TEMPLATE_INVALID',503);
  return {
    type:'template',
    template:{
      name:template,
      language:{code:String(c.language||'tr')},
      components:[{
        type:'body',
        parameters:[
          row.customer_name||'Müşterimiz',
          row.business_name,
          row.service_name,
          displayDate(row.date),
          time(row.minute),
          row.staff_name,
          appOrigin()+'/'+row.slug,
        ].map((text)=>({type:'text',text:String(text)})),
      }],
    },
  };
}

async function send(c:any,row:any,to:string,body:string){
  await consumePlanQuota(row.tenant_id,'whatsapp');
  const id=crypto.randomUUID();
  await q('INSERT INTO wa_messages(id,tenant_id,phone,reply,status,appointment_id,created_at) VALUES(?,?,?,?,?,?,?)',id,row.tenant_id,to,await seal(body,cfg().APP_ENCRYPTION_KEY),'sending',row.appointment_id,Date.now()).run();
  try{
    const provider=await graph(c,to,payloadFor(c,row,body));
    await q("UPDATE wa_messages SET status='accepted',provider_id=?,sent_at=? WHERE id=? AND status='sending'",provider,Date.now(),id).run();
    return true;
  }catch(e){
    await q("UPDATE wa_messages SET status=? WHERE id=? AND status='sending'",e instanceof ApiError?'failed':'unknown',id).run();
    return false;
  }
}

async function processAppointmentNotifications(){
  const rows=await all(`SELECT o.id,o.tenant_id,o.appointment_id,o.event,o.scheduled_at,
    a.date,a.minute,a.price,a.status,a.token_hash,c.name customer_name,c.phone customer_phone,
    s.name service_name,p.name staff_name,b.slug,b.name business_name
    FROM outbox o JOIN appointments a ON a.tenant_id=o.tenant_id AND a.id=o.appointment_id
    JOIN customers c ON c.tenant_id=a.tenant_id AND c.id=a.customer_id
    JOIN services s ON s.tenant_id=a.tenant_id AND s.id=a.service_id
    JOIN staff p ON p.tenant_id=a.tenant_id AND p.id=a.staff_id
    JOIN businesses b ON b.id=a.tenant_id
    WHERE b.status='approved' AND o.state='not_configured' AND o.scheduled_at<=?
    ORDER BY o.scheduled_at LIMIT 100`,isoNow());
  let accepted=0,failed=0,skipped=0,quota=0;
  for(const row of rows){
    const claim=await q("UPDATE outbox SET state='sending' WHERE id=? AND state='not_configured'",row.id).run();
    if(!claim.meta.changes)continue;
    const age=Math.max(0,Date.now()-Date.parse(row.scheduled_at));
    const c=waConnection(row.tenant_id);
    if(!c||!waReady(row.tenant_id)){
      const nextState=age>10*60000?'skipped':'not_configured';
      await q("UPDATE outbox SET state=? WHERE id=? AND state='sending'",nextState,row.id).run();
      skipped++;
      continue;
    }
    if(row.event==='rescheduled'&&age>60*60000){await q("UPDATE outbox SET state='skipped' WHERE id=? AND state='sending'",row.id).run();skipped++;continue;}
    if(row.event!=='reminder'&&age>7*86400000){await q("UPDATE outbox SET state='skipped' WHERE id=? AND state='sending'",row.id).run();skipped++;continue;}
    if(row.event==='reminder'&&row.status!=='confirmed'){await q("UPDATE outbox SET state='skipped' WHERE id=? AND state='sending'",row.id).run();skipped++;continue;}

    const customer=phone(row.customer_phone);
    const owner=phone((c as any).owner_number);
    const customerAlreadyNotified=row.event==='created'&&!!(await one('SELECT id FROM wa_messages WHERE tenant_id=? AND appointment_id=? AND phone=?',row.tenant_id,row.appointment_id,customer||''));
    const deliveries:{to:string;body:string}[]=[];

    if(customer&&!customerAlreadyNotified)deliveries.push({to:customer,body:customerMessageFor(row)});
    if((row.event==='created'||row.event==='cancelled')&&owner&&owner!==customer){
      deliveries.push({to:owner,body:ownerMessageFor(row)});
    }

    if(!deliveries.length){
      await q("UPDATE outbox SET state='skipped' WHERE id=? AND state='sending'",row.id).run();
      skipped++;
      continue;
    }

    let sent=0,quotaHit=false;
    for(const delivery of deliveries){
      try{if(await send(c,row,delivery.to,delivery.body))sent++;}
      catch(e){if(e instanceof ApiError&&e.status===429){quotaHit=true;break}throw e;}
    }
    if(quotaHit){await q("UPDATE outbox SET state='quota' WHERE id=? AND state='sending'",row.id).run();quota++;continue;}
    if(sent){await q("UPDATE outbox SET state='accepted' WHERE id=? AND state='sending'",row.id).run();accepted++;}
    else{await q("UPDATE outbox SET state='failed' WHERE id=? AND state='sending'",row.id).run();failed++;}
  }
  return {processed:rows.length,accepted,failed,skipped,quota};
}

/**
 * Sends appointment lifecycle notifications created by lib/booking.ts. It is
 * intentionally authenticated even when called over loopback by the bundled
 * VPS worker; public requests can create outbox rows but can never trigger
 * provider calls without the server-only secret.
 */
export async function runAppointmentNotifications(req:Request){
  const secret=String(cfg().AUTOMATION_SECRET||'');
  if(!secret||!equalSecret(req.headers.get('authorization')||'','Bearer '+secret))throw new ApiError('UNAUTHORIZED',403);
  return processAppointmentNotifications();
}
