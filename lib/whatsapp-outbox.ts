import {env} from 'cloudflare:workers';
import {all,one,q,ApiError} from './server';
import {waConnection,waReady} from './whatsapp';
import {appOrigin} from './identity';
import {money,time} from './types';
import {seal,equalSecret} from './security';
import {consumePlanQuota} from './entitlements';

const cfg=()=>env as any;
const isoNow=()=>new Date().toISOString();

function phone(value:string){
  const digits=String(value||'').replace(/\D/g,'');
  return digits.length>=10&&digits.length<=15?digits:null;
}

async function graph(c:any,to:string,body:string){
  const response=await fetch('https://graph.facebook.com/'+cfg().WHATSAPP_GRAPH_VERSION+'/'+c.phone_id+'/messages',{method:'POST',redirect:'manual',signal:AbortSignal.timeout(12000),headers:{'Content-Type':'application/json',Authorization:'Bearer '+c.token},body:JSON.stringify({messaging_product:'whatsapp',recipient_type:'individual',to,type:'text',text:{preview_url:false,body}})});
  let result:any;try{result=await response.json()}catch{result=null}
  if(!response.ok||!result?.messages?.[0]?.id)throw new ApiError('WHATSAPP_PROVIDER_REJECTED',502);
  return String(result.messages[0].id);
}

function messageFor(row:any){
  const when=`${row.date} ${time(row.minute)}`;
  const link=appOrigin()+'/'+row.slug;
  if(row.event==='created')return `Neta Randevu\nRandevunuz oluşturuldu.\n${row.service_name} · ${money(row.price)}\n${when} · ${row.staff_name}\nİşletme sayfası: ${link}\nRandevu yönetim bağlantınız onay ekranında gösterildi.`;
  if(row.event==='rescheduled')return `Neta Randevu\nRandevunuz güncellendi.\n${row.service_name} · ${money(row.price)}\nYeni zaman: ${when} · ${row.staff_name}\nİşletme sayfası: ${link}\nYönetim bağlantınız ilk onay mesajınızdadır.`;
  if(row.event==='cancelled')return `Neta Randevu\nRandevunuz iptal edildi.\n${row.service_name} · ${when}\nYeni randevu: ${appOrigin()}/${row.slug}`;
  return `Neta Randevu\nHatırlatma: yarın ${when} saatinde ${row.service_name} randevunuz var.\n${row.staff_name} · ${money(row.price)}\nİşletme sayfası: ${link}`;
}

async function send(c:any,tenantId:string,appointmentId:string,to:string,body:string){
  await consumePlanQuota(tenantId,'whatsapp');
  const id=crypto.randomUUID();
  await q('INSERT INTO wa_messages(id,tenant_id,phone,reply,status,appointment_id,created_at) VALUES(?,?,?,?,?,?,?)',id,tenantId,to,await seal(body,cfg().APP_ENCRYPTION_KEY),'sending',appointmentId,Date.now()).run();
  try{
    const provider=await graph(c,to,body);
    await q("UPDATE wa_messages SET status='accepted',provider_id=?,sent_at=? WHERE id=? AND status='sending'",provider,Date.now(),id).run();
    return true;
  }catch(e){
    await q("UPDATE wa_messages SET status=? WHERE id=? AND status='sending'",e instanceof ApiError?'failed':'unknown',id).run();
    return false;
  }
}

/**
 * Sends appointment lifecycle notifications created by lib/booking.ts. It is
 * intentionally a separately authenticated worker: public requests can create
 * outbox rows but can never trigger provider calls.
 */
export async function runAppointmentNotifications(req:Request){
  const secret=String(cfg().AUTOMATION_SECRET||'');
  if(!secret||!equalSecret(req.headers.get('authorization')||'','Bearer '+secret))throw new ApiError('UNAUTHORIZED',403);
  const rows=await all(`SELECT o.id,o.tenant_id,o.appointment_id,o.event,o.scheduled_at,
    a.date,a.minute,a.price,a.status,a.token_hash,c.phone customer_phone,
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
    const c=waConnection(row.tenant_id);
    if(!c||!waReady(row.tenant_id)){await q("UPDATE outbox SET state='not_configured' WHERE id=? AND state='sending'",row.id).run();skipped++;continue;}
    if(row.event!=='reminder'&&Date.parse(row.scheduled_at)<Date.now()-7*86400000){await q("UPDATE outbox SET state='skipped' WHERE id=? AND state='sending'",row.id).run();skipped++;continue;}
    if(row.event==='reminder'&&row.status!=='confirmed'){await q("UPDATE outbox SET state='skipped' WHERE id=? AND state='sending'",row.id).run();skipped++;continue;}
    // The WhatsApp bot already sends a confirmation while creating a booking.
    // Avoid a duplicate created notification for that same appointment.
    if(row.event==='created'&&await one('SELECT id FROM wa_messages WHERE tenant_id=? AND appointment_id=?',row.tenant_id,row.appointment_id)){await q("UPDATE outbox SET state='skipped' WHERE id=? AND state='sending'",row.id).run();skipped++;continue;}
    const body=messageFor(row);
    const recipients=[phone(row.customer_phone),phone((c as any).owner_number)].filter((v,i,a):v is string=>!!v&&a.indexOf(v)===i);
    if(!recipients.length){await q("UPDATE outbox SET state='skipped' WHERE id=? AND state='sending'",row.id).run();skipped++;continue;}
    let sent=0,quotaHit=false;
    for(const recipient of recipients){try{if(await send(c,row.tenant_id,row.appointment_id,recipient,body))sent++;}catch(e){if(e instanceof ApiError&&e.status===429){quotaHit=true;break}throw e;}}
    if(quotaHit){await q("UPDATE outbox SET state='quota' WHERE id=? AND state='sending'",row.id).run();quota++;continue;}
    if(sent){await q("UPDATE outbox SET state='accepted' WHERE id=? AND state='sending'",row.id).run();accepted++;}
    else{await q("UPDATE outbox SET state='failed' WHERE id=? AND state='sending'",row.id).run();failed++;}
  }
  return {processed:rows.length,accepted,failed,skipped,quota};
}
