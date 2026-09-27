import { createRequire } from 'node:module';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const wr = createRequire(require.resolve('wrangler/package.json'));
const { Miniflare } = await import(wr.resolve('miniflare'));
const root = resolve('dist/server');
const files = ['index.js', ...readdirSync(root,{recursive:true}).filter(x=>x.endsWith('.js')&&x!=='index.js')];
const mf = new Miniflare({modules:files.map(path=>({type:'ESModule',path:resolve(root,path)})),modulesRoot:root,
  compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],cf:false,
  bindings:{CHATGPT_AUTH_ENABLED:'true',PLATFORM_ADMIN_USER_IDS:'qa-admin',PUBLIC_APP_URL:'https://neta.test'},
  outboundService:async()=>{throw new Error('Unexpected external request');}});
const request = async(url,user,body) => {
  const response=await mf.dispatchFetch('https://neta.test'+url,{method:body?'POST':'GET',
    headers:{'oai-authenticated-user-id':user,'oai-authenticated-user-email':user+'@example.test',
      ...(body?{'content-type':'application/json',origin:'https://neta.test','sec-fetch-site':'same-origin'}:{})},
    ...(body?{body:JSON.stringify(body)}:{})});
  return {status:response.status,data:await response.json()};
};
const call = (path,user,body) => request('/api/v1/'+path,user,body);
try {
  const db=await mf.getD1Database('DB');
  for(const file of readdirSync('drizzle').filter(x=>x.endsWith('.sql')).sort())
    for(const sql of readFileSync('drizzle/'+file,'utf8').split('--> statement-breakpoint').map(x=>x.trim()).filter(Boolean))
      await db.prepare(sql).run();
  const demo=await call('demo-workspace','owner',{});
  assert.equal(demo.status,201);
  const id=demo.data.business.id, branches=demo.data.branches, job=demo.data.appointments[0];
  const branch=branches.find(x=>x.id===job.branch_id) || branches[0];
  assert.equal(branches.length,2);

  await db.prepare("INSERT INTO profiles(user_id,name,email,phone,city,account_type,created_at,updated_at) VALUES('employee','Çalışan','employee@example.test','','','business',?,?)")
    .bind(new Date().toISOString(),new Date().toISOString()).run();
  assert.equal((await call('team-access','owner',{tenant_id:id,staff_id:job.staff_id,email:'employee@example.test'})).status,409);
  assert.equal((await request('/api/manager/branch-password','owner',{tenant_id:id,branch_id:branch.id,password:'12345678'})).status,400);
  const branchPassword='Sube12345';
  assert.equal((await request('/api/manager/branch-password','owner',{tenant_id:id,branch_id:branch.id,password:branchPassword})).status,200);
  assert.equal((await call('team-access','owner',{tenant_id:id,staff_id:job.staff_id,email:'employee@example.test'})).status,200);
  const legacyEmployee=await call('team-jobs?tenant='+id+'&date='+job.date,'employee');
  assert.equal(legacyEmployee.status,200);
  assert.equal(legacyEmployee.data.password_required,true);
  assert.equal(legacyEmployee.data.appointments.length,0);
  assert.equal((await request('/api/team/workspace','employee',{tenant_id:id,date:job.date,branch_password:'Yanlis123'})).status,403);
  const employee=await request('/api/team/workspace','employee',{tenant_id:id,date:job.date,branch_password:branchPassword});
  assert.equal(employee.status,200);
  assert.equal(employee.data.business.branch_id,branch.id);
  assert.equal(employee.data.permissions.settings,false);
  assert.ok(employee.data.appointments.every(x=>x.branch_id===branch.id&&!('price' in x)&&!('deposit_amount' in x)&&!('payment_status' in x)));
  assert.ok(Array.isArray(employee.data.customers)&&Array.isArray(employee.data.services)&&Array.isArray(employee.data.staff));
  assert.ok(Array.isArray(employee.data.journeys)&&employee.data.whatsapp&&typeof employee.data.whatsapp==='object');
  assert.equal((await call('workspace?tenant='+id,'employee')).status,403);
  assert.equal((await call('settings','employee',{tenant_id:id,name:'X'})).status,403);
  assert.equal((await call('team-jobs','employee',{tenant_id:id,id:job.id,status:'completed',branch_password:'Yanlis123'})).status,403);

  await db.prepare("INSERT INTO profiles(user_id,name,email,phone,city,account_type,created_at,updated_at) VALUES('manager','Müdür','manager@example.test','','','business',?,?)")
    .bind(new Date().toISOString(),new Date().toISOString()).run();
  assert.equal((await call('managers?tenant='+id,'owner')).data.enabled,false);
  assert.equal((await call('managers','owner',{tenant_id:id,action:'assign',email:'manager@example.test',branch_id:branch.id})).status,402);
  assert.equal((await call('admin-manager-addon','owner',{tenant_id:id,enabled:true})).status,403);
  assert.equal((await call('admin-addons','owner')).status,403);
  assert.equal((await call('admin-addon-price','qa-admin',{price:34900})).status,200);
  assert.equal((await call('business-addons?tenant='+id,'owner')).data.addons[0].price,34900);
  assert.equal((await call('business-addons?tenant='+id,'owner')).data.employee.included,true);
  assert.equal((await call('admin-manager-addon','qa-admin',{tenant_id:id,enabled:true})).status,200);
  assert.equal((await call('managers','owner',{tenant_id:id,action:'assign',email:'manager@example.test',branch_id:branch.id})).status,200);
  assert.equal((await call('workspace?tenant='+id,'manager')).status,403);
  assert.equal((await call('branches?tenant='+id,'manager')).status,403);
  const day=job.date;
  assert.equal((await request('/api/manager/dashboard','manager',{tenant_id:id,date:day,branch_password:'Yanlis123'})).status,403);
  const result=await request('/api/manager/dashboard','manager',{tenant_id:id,date:day,branch_password:branchPassword});
  assert.equal(result.status,200);
  assert.equal(result.data.access.branch_id,branch.id);
  assert.ok(result.data.appointments.every(x=>x.branch_id===branch.id));
  assert.equal((await request('/api/manager/dashboard','manager',{tenant_id:'other',date:day,branch_password:branchPassword})).status,403);
  const foreign=demo.data.appointments.find(a=>a.branch_id!==branch.id);
  if(foreign)assert.equal((await call('manager-appointment','manager',{tenant_id:id,id:foreign.id,status:'cancelled',branch_password:branchPassword})).status,404);
  assert.equal((await call('manager-appointment','manager',{tenant_id:id,id:job.id,status:'cancelled',branch_password:branchPassword+'x'})).status,403);
  assert.equal((await call('manager-appointment','employee',{tenant_id:id,id:job.id,status:'cancelled',branch_password:branchPassword})).status,403);
  assert.equal((await call('admin-manager-addon','qa-admin',{tenant_id:id,enabled:false})).status,200);
  assert.equal((await request('/api/manager/dashboard','manager',{tenant_id:id,date:day,branch_password:branchPassword})).status,402);
  console.log('PASS staff password gate, read-only branch workspace, owner-panel denial, manager branch scope and revocation');
} finally {await mf.dispose();}
