// Isolated integration test for temporary manual panel provisioning.
import {createRequire} from 'node:module';
import {readdirSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';

const require=createRequire(import.meta.url);
const wranglerRequire=createRequire(require.resolve('wrangler/package.json'));
const {Miniflare}=await import(wranglerRequire.resolve('miniflare'));
const root=resolve('dist/server');
const files=['index.js',...readdirSync(root,{recursive:true}).filter(p=>p.endsWith('.js')&&p!=='index.js')];
const mf=new Miniflare({
  modules:files.map(p=>({type:'ESModule',path:resolve(root,p)})),
  modulesRoot:root,
  compatibilityDate:'2026-05-15',
  compatibilityFlags:['nodejs_compat'],
  d1Databases:['DB'],
  bindings:{PLATFORM_ADMIN_USER_IDS:'manual-admin',CHATGPT_AUTH_ENABLED:'true',MANUAL_PANEL_PROVISIONING:'true'},
  cf:false,
});

let checks=0;
function check(condition,message){assert.ok(condition,message);checks++;console.log('PASS',message)}
async function call(path,{user,body}={}){
  const headers={
    ...(user?{'oai-authenticated-user-id':user,'oai-authenticated-user-email':user+'@example.test'}:{}),
    ...(body?{'content-type':'application/json',origin:'https://randevu.test'}:{}),
  };
  const response=await mf.dispatchFetch('https://randevu.test/api/v1/'+path,{method:body?'POST':'GET',headers,...(body?{body:JSON.stringify(body)}:{})});
  const text=await response.text();
  let data;
  try{data=JSON.parse(text)}catch{throw new Error('Non-JSON '+response.status+' '+text.slice(0,300))}
  return {status:response.status,data};
}

try{
  const db=await mf.getD1Database('DB');
  for(const file of readdirSync('drizzle').filter(p=>p.endsWith('.sql')).sort())
    for(const sql of readFileSync('drizzle/'+file,'utf8').split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean))
      await db.prepare(sql).run();

  const owner='manual-owner';
  const profile=await call('account',{user:owner,body:{name:'Manuel İşletme Sahibi',phone:'05550000000',city:'İstanbul',account_type:'business',marketing_consent:false}});
  check(profile.status===200,'Business user can complete registration without a payment');

  const adminBefore=await call('admin-access',{user:'manual-admin'});
  check(adminBefore.status===200&&adminBefore.data.users.some(u=>u.user_id===owner&&Number(u.businesses)===0),'Registered business user appears in admin before creating a business');

  const hours=Object.fromEntries([0,1,2,3,4,5,6].map(day=>[day,[540,1080]]));
  const created=await call('manual-onboarding',{user:owner,body:{
    name:'Manuel Test Studio',slug:'manuel-test-studio',category:'Kuaför & Berber',city:'İstanbul',address:'Test adresi',phone:'05550000000',
    starter:{service_name:'Saç Kesimi',duration:30,price:50000,staff_name:'Test Uzman',staff_title:'Uzman',hours},
  }});
  check(created.status===201&&created.data.status==='pending'&&!!created.data.id,'Business setup creates a pending business without checkout');
  const tenant=created.data.id;

  const paymentCountBefore=(await db.prepare('SELECT COUNT(*) n FROM payments').first()).n;
  const locked=await call('workspace?tenant='+tenant,{user:owner});
  check(locked.status===200&&locked.data.subscription_required===true,'Panel stays locked until the administrator grants access');
  check((await call('admin-access',{user:owner})).status===403,'Business owner cannot use the manual grant API');

  const grant=await call('admin-access',{user:'manual-admin',body:{action:'grant',id:tenant,plan:'plus'}});
  check(grant.status===200&&grant.data.plan==='plus','Administrator can grant Plus panel access');

  const subscription=await db.prepare('SELECT plan,paid_until FROM subscriptions WHERE tenant_id=?').bind(tenant).first();
  check(subscription?.plan==='plus'&&subscription.paid_until.startsWith('2099-12-31'),'Manual grant stores a long-lived internal entitlement');
  const business=await db.prepare('SELECT status,selected_plan FROM businesses WHERE id=?').bind(tenant).first();
  check(business?.status==='approved'&&business.selected_plan==='plus','Manual grant approves the business and records the selected package');

  const open=await call('workspace?tenant='+tenant,{user:owner});
  check(open.status===200&&!open.data.subscription_required&&open.data.entitlements.plan==='plus','Granted user receives the real Plus feature entitlements');
  const paymentCountAfter=(await db.prepare('SELECT COUNT(*) n FROM payments').first()).n;
  check(paymentCountAfter===paymentCountBefore,'Manual panel grant does not create a fake payment record');

  const change=await call('admin-access',{user:'manual-admin',body:{action:'grant',id:tenant,plan:'pro'}});
  check(change.status===200&&change.data.plan==='pro','Administrator can change the granted package');
  const pro=await call('workspace?tenant='+tenant,{user:owner});
  check(pro.data.entitlements.plan==='pro','Package change immediately updates feature entitlements');

  const revoke=await call('admin-access',{user:'manual-admin',body:{action:'revoke',id:tenant}});
  check(revoke.status===200&&revoke.data.action==='revoke','Administrator can revoke manual panel access');
  const lockedAgain=await call('workspace?tenant='+tenant,{user:owner});
  check(lockedAgain.data.subscription_required===true,'Revoked business is locked again');

  console.log(`Manual provisioning complete: ${checks} checks`);
}finally{
  await mf.dispose();
}
