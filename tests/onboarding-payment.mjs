// Isolated payment-first integration test. All iyzico traffic is mocked.
import {createRequire} from 'node:module';
import {readdirSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHmac} from 'node:crypto';
import assert from 'node:assert/strict';

const require=createRequire(import.meta.url),wranglerRequire=createRequire(require.resolve('wrangler/package.json'));
const {Miniflare,Response:TestResponse}=await import(wranglerRequire.resolve('miniflare'));
const root=resolve('dist/server'),files=['index.js',...readdirSync(root,{recursive:true}).filter(p=>p.endsWith('.js')&&p!=='index.js')];
const subscription='subscription_ref_123',customer='customer_ref_123',order='order_ref_123';
const periodStart=new Date().toISOString(),periodEnd=new Date(Date.now()+30*86400000).toISOString();
const outboundService=async(request)=>{
 const url=new URL(request.url);
 if(!url.hostname.includes('iyzipay.com'))throw new Error('Unexpected external call: '+url);
 if(url.pathname==='/v2/subscription/pricing-plans/plan_standard')return json({status:'success',data:{price:990,currencyCode:'TRY',paymentInterval:'MONTHLY',paymentIntervalCount:1,trialPeriodDays:0,recurrenceCount:0}});
 if(url.pathname==='/v2/subscription/checkoutform/initialize')return json({status:'success',token:'checkout_token_123',checkoutFormContent:'<form id="iyzico-checkout"></form>'});
 if(url.pathname==='/v2/subscription/checkoutform/checkout_token_123')return json({status:'success',conversationId:paymentId,data:{referenceCode:subscription,customerReferenceCode:customer,pricingPlanReferenceCode:'plan_standard'}});
 if(url.pathname==='/v2/subscription/subscriptions/'+subscription)return json({status:'success',data:{referenceCode:subscription,customerReferenceCode:customer,pricingPlanReferenceCode:'plan_standard',subscriptionStatus:'ACTIVE',orders:[{referenceCode:order,orderStatus:'SUCCESS',currencyCode:'TRY',price:990,startPeriod:periodStart,endPeriod:periodEnd}]}});
 throw new Error('Unexpected iyzico path: '+url.pathname);
};
const json=value=>new TestResponse(JSON.stringify(value),{headers:{'content-type':'application/json'}});
const secret='test-secret',merchant='test-merchant';
const bindings={PLATFORM_ADMIN_USER_IDS:'owner',PUBLIC_APP_URL:'https://neta.test',PUBLIC_SITE_READY:'true',RECURRING_SALES_ENABLED:'true',IYZICO_LIVE:'false',IYZICO_API_KEY:'test-key',IYZICO_SECRET_KEY:secret,IYZICO_MERCHANT_ID:merchant,NETA_SELLER_NAME:'Neta',NETA_SELLER_ADDRESS:'Test adresi',NETA_SUPPORT_EMAIL:'destek@neta.test',NETA_SUBSCRIPTION_TERMS_URL:'https://neta.test/kosullar',NETA_PLANS_JSON:JSON.stringify([{code:'normal',name:'Standart',amount:99000,reference:'plan_standard'}])};
const mf=new Miniflare({modules:files.map(path=>({type:'ESModule',path:resolve(root,path)})),modulesRoot:root,compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],bindings,cf:false,outboundService});
const headers={'oai-authenticated-user-id':'owner','oai-authenticated-user-email':'owner@example.test'};
let paymentId='',checks=0;
function check(value,label){assert.ok(value,label);checks++;console.log('PASS',label)}
async function api(path,body){const response=await mf.dispatchFetch('https://neta.test/api/v1/'+path,{method:body?'POST':'GET',headers:{...headers,...(body?{'content-type':'application/json',origin:'https://neta.test'}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:response.status,data:await response.json()}}

try{
 const db=await mf.getD1Database('DB');
 for(const file of readdirSync('drizzle').filter(path=>path.endsWith('.sql')).sort())for(const sql of readFileSync('drizzle/'+file,'utf8').split('--> statement-breakpoint').map(value=>value.trim()).filter(Boolean))await db.prepare(sql).run();
 const hours=Object.fromEntries([0,1,2,3,4,5,6].map(day=>[day,[540,1080]]));
 const business={name:'Ödeme Test Studio',slug:'odeme-test-studio',category:'Kuaför & Berber',city:'İstanbul',address:'Test adresi',phone:'05551112233',description:'',plan:'normal',starter:{service_name:'Online danışma',duration:30,price:50000,staff_name:'Test Uzman',staff_title:'Uzman',hours}};
 check((await api('businesses',business)).status===402,'Real business cannot be created before verified payment');
 check((await api('workspace')).status===402,'Workspace API is closed before payment');
 const started=await api('onboarding-payment',{business,buyer:{name:'Test',surname:'Sahibi',identity:'11111111111',city:'İstanbul',terms_accepted:true,privacy_accepted:true}});
 if(started.status!==200)console.error('CHECKOUT_RESPONSE',started);
 check(started.status===200&&started.data.form.includes('iyzico-checkout'),'Server creates an iyzico checkout using its own plan');
 paymentId=started.data.payment_id;
 check(!(await db.prepare('SELECT 1 ok FROM businesses WHERE slug=?').bind(business.slug).first()),'Checkout initialization does not create or activate a business');
 const pending=await api('payment-status');
 check(pending.data.account.state==='payment_processing','Account remains payment_processing until provider verification');
 const callback=await mf.dispatchFetch('https://neta.test/api/integrations/iyzico/onboarding-callback',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:'token=checkout_token_123',redirect:'manual'});
 check(callback.status===303&&callback.headers.get('location').includes('/panel'),'Verified iyzico result activates and redirects to panel');
 const activated=await api('payment-status');
 check(activated.data.account.state==='active','Only verified payment grants active state');
 check((await api('workspace')).status===200,'Backend workspace opens after activation');
 const workspace=(await api('workspace')).data,date=new Date(Date.now()+2*86400000).toISOString().slice(0,10),serviceId=workspace.services[0].id,staffId=workspace.staff[0].id;
 check((await api('settings',{tenant_id:workspace.business.id,name:business.name,category:business.category,city:business.city,address:business.address,phone:business.phone,description:'',hours,cancellation_hours:2,terminology:'Seans',online_enabled:1})).status===200,'Business can enable sector terminology and online appointments');
 check((await api('services',{tenant_id:workspace.business.id,id:serviceId,name:'Online danışma',duration:30,price:50000,description:'',color:'#789c74',delivery_mode:'online',meeting_url:'https://meet.example.test/neta',active:1})).status===200,'Online service stores its protected meeting link');
 const booked=await api('bookings',{tenant_id:workspace.business.id,service_id:serviceId,staff_id:staffId,date,minute:720,name:'Panel Müşterisi',phone:'05550001122',email:'',consent:false});
 check(booked.status===201&&booked.data.meeting_url==='https://meet.example.test/neta','Panel booking uses the shared calendar and returns the online meeting link');
 await db.prepare("UPDATE businesses SET status='approved' WHERE id=?").bind(workspace.business.id).run();
 const waiting=await api('waitlist',{slug:business.slug,service_id:serviceId,staff_id:'any',date,minute_from:0,minute_to:15,name:'Bekleyen Müşteri',phone:'05553334455',consent:true});
 check(waiting.status===201&&(await api('waitlist?tenant='+workspace.business.id)).data.requests.length===1,'Full-slot customer can join the tenant-scoped waiting list');
 const duplicate=await mf.dispatchFetch('https://neta.test/api/integrations/iyzico/onboarding-callback',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:'token=checkout_token_123',redirect:'manual'});
 check(duplicate.status===303&&(await db.prepare('SELECT COUNT(*) n FROM businesses WHERE slug=?').bind(business.slug).first()).n===1,'Repeated callback does not create a second business');
 const event={iyziEventType:'subscription.order.success',subscriptionReferenceCode:subscription,orderReferenceCode:'order_ref_renewal',customerReferenceCode:customer};
 const raw=JSON.stringify(event),signature=createHmac('sha256',secret).update(merchant+secret+event.iyziEventType+subscription+event.orderReferenceCode+customer).digest('hex');
 const forged=await mf.dispatchFetch('https://neta.test/api/payments/webhook',{method:'POST',headers:{'content-type':'application/json','x-iyz-signature-v3':'forged'},body:raw});
 check(forged.status===403,'Forged webhook signature is rejected');
 const sendWebhook=()=>mf.dispatchFetch('https://neta.test/api/payments/webhook',{method:'POST',headers:{'content-type':'application/json','x-iyz-signature-v3':signature},body:raw});
 const first=await sendWebhook(),second=await sendWebhook();
 check(first.status===200&&await first.text()==='SUCCESS'&&second.status===200&&await second.text()==='SUCCESS','Valid duplicate webhooks are acknowledged idempotently');
 check((await db.prepare('SELECT COUNT(*) n FROM payment_events WHERE event_key=?').bind(event.iyziEventType+':'+subscription+':'+event.orderReferenceCode).first()).n===1,'Duplicate webhook is recorded exactly once');
 console.log(JSON.stringify({passed:checks,failed:0}));
}finally{await mf.dispose()}
