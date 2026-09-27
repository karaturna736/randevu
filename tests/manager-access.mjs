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
const call = async(path,user,body) => {
  const response=await mf.dispatchFetch('https://neta.test/api/v1/'+path,{method:body?'POST':'GET',
    headers:{'oai-authenticated-user-id':user,'oai-authenticated-user-email':user+'@example.test',
      ...(body?{'content-type':'application/json',origin:'https://neta.test'}:{})},
    ...(body?{body:JSON.stringify(body)}:{})});
  return {status:response.status,data:await response.json()};
};
try {
  const db=await mf.getD1Database('DB');
  for(const file of readdirSync('drizzle').filter(x=>x.endsWith('.sql')).sort())
    for(const sql of readFileSync('drizzle/'+file,'utf8').split('--> statement-breakpoint').map(x=>x.trim()).filter(Boolean))
      await db.prepare(sql).run();
  const demo=await call('demo-workspace','owner',{});
  assert.equal(demo.status,201);
  const id=demo.data.business.id;
  const branches=demo.data.branches;
  assert.equal(branches.length,2);
  const job=demo.data.appointments[0];
  await db.prepare("INSERT INTO profiles(user_id,name,email,phone,city,account_type,created_at,updated_at) VALUES('employee','Çalışan','employee@example.test','','','business',?,?)")
    .bind(new Date().toISOString(),new Date().toISOString()).run();
  assert.equal((await call('team-access','owner',{tenant_id:id,staff_id:job.staff_id,email:'employee@example.test'})).status,200);
  const employee=await call('team-jobs?tenant='+id+'&date='+job.date,'employee');
  assert.equal(employee.status,200);
  assert.ok(employee.data.appointments.length>0);
  assert.ok(employee.data.appointments.every(x=>!('price' in x)&&!('deposit_amount' in x)));
  await db.prepare("INSERT INTO profiles(user_id,name,email,phone,city,account_type,created_at,updated_at) VALUES('manager','Müdür','manager@example.test','','','business',?,?)")
    .bind(new Date().toISOString(),new Date().toISOString()).run();
  assert.equal((await call('managers?tenant='+id,'owner')).data.enabled,false);
  assert.equal((await call('managers','owner',{tenant_id:id,action:'assign',email:'manager@example.test',branch_id:branches[0].id})).status,402);
  assert.equal((await call('admin-manager-addon','owner',{tenant_id:id,enabled:true})).status,403);
  assert.equal((await call('admin-manager-addon','qa-admin',{tenant_id:id,enabled:true})).status,200);
  assert.equal((await call('managers','owner',{tenant_id:id,action:'assign',email:'manager@example.test',branch_id:branches[0].id})).status,200);
  assert.equal((await call('workspace?tenant='+id,'manager')).status,403);
  assert.equal((await call('branches?tenant='+id,'manager')).status,403);
  const day=job.date;
  const result=await call('manager-dashboard?tenant='+id+'&date='+day,'manager');
  assert.equal(result.status,200);
  assert.equal(result.data.access.branch_id,branches[0].id);
  assert.ok(result.data.appointments.every(x=>x.branch_id===branches[0].id));
  assert.equal((await call('manager-dashboard?tenant=other&date='+day,'manager')).status,403);
  assert.equal((await call('admin-manager-addon','qa-admin',{tenant_id:id,enabled:false})).status,200);
  assert.equal((await call('manager-dashboard?tenant='+id+'&date='+day,'manager')).status,402);
  console.log('PASS employee access without addon; manager branch scope, owner API denial, and revocation');
} finally {await mf.dispose();}
