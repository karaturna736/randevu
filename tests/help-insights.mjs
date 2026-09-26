// Runs the built Worker against an isolated database. No real customer traffic.
import {createRequire} from 'node:module';
import {readdirSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';

const require=createRequire(import.meta.url),wr=createRequire(require.resolve('wrangler/package.json'));
const {Miniflare}=await import(wr.resolve('miniflare'));
const root=resolve('dist/server');
const files=['index.js',...readdirSync(root,{recursive:true}).filter(p=>p.endsWith('.js')&&p!=='index.js')];
const mf=new Miniflare({modules:files.map(p=>({type:'ESModule',path:resolve(root,p)})),modulesRoot:root,compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],cf:false,bindings:{PLATFORM_ADMIN_USER_IDS:'admin-test',CHATGPT_AUTH_ENABLED:'true'},outboundService:()=>{throw new Error('External network not allowed')}});
let checks=0;
function check(v,label){assert.ok(v,label);checks++;console.log('PASS',label)}
async function call(path,user='a',body){const r=await mf.dispatchFetch('https://neta.test/api/v1/'+path,{method:body?'POST':'GET',headers:{...(user?{'oai-authenticated-user-id':user,'oai-authenticated-user-email':user+'@example.test'}:{}),...(body?{'content-type':'application/json',origin:'https://neta.test'}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json()}}

try{
  const db=await mf.getD1Database('DB');
  for(const file of readdirSync('drizzle').filter(p=>p.endsWith('.sql')).sort())for(const sql of readFileSync('drizzle/'+file,'utf8').split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean))await db.prepare(sql).run();
  const tenant=(await call('businesses','a',{name:'Yardım Test İşletmesi',slug:'help-insights-test',category:'Danışmanlık'})).data.id;
  const stamp=new Date().toISOString(),paidUntil=new Date(Date.now()+86400000).toISOString();
  await db.prepare("INSERT INTO recurring_subscriptions(tenant_id,reference,customer_reference,plan_reference,plan,amount,state,request_id,test_mode,paid_until,created_at,updated_at) VALUES(?,NULL,NULL,'help-insights-pro','pro',99900,'ACTIVE',?,0,?,?,?)").bind(tenant,randomUUID(),paidUntil,stamp,stamp).run();

  const first=await call('help','a',{tenant_id:tenant,message:'E fatura nereden kesilir?'});
  const second=await call('help','a',{tenant_id:tenant,message:'E-fatura nasıl kesilir?'});
  check(first.status===200&&first.data.matched===false,'Unknown help question is not fabricated');
  check(second.status===200&&second.data.matched===false,'Repeated unknown help question stays unmatched');
  check((await call('platform-help-insights','a')).status===403,'Business owner cannot read platform help insights');

  const insights=await call('platform-help-insights','admin-test');
  check(insights.status===200,'Platform admin can read help insights');
  check(insights.data.rows.length===1&&Number(insights.data.rows[0].ask_count)===2,'Equivalent unknown questions are grouped and counted');
  check(Number(insights.data.totals.open_topics)===1&&Number(insights.data.totals.open_asks)===2,'Admin totals reflect grouped unanswered questions');

  const id=insights.data.rows[0].id;
  check((await call('platform-help-insights','a',{id,status:'planned'})).status===403,'Business owner cannot change insight status');
  const updated=await call('platform-help-insights','admin-test',{id,status:'planned'});
  check(updated.status===200&&updated.data.ok===true,'Platform admin can mark an insight as planned');
  const after=await call('platform-help-insights','admin-test');
  check(after.data.rows[0].status==='planned','Updated insight status persists');

  const pii=await call('help','a',{tenant_id:tenant,message:'E-arşiv özelliği var mı? 0555 123 45 67 ahmet@example.com'});
  check(pii.status===200&&pii.data.matched===false,'Another unknown question is collected safely');
  const piiRows=(await call('platform-help-insights','admin-test')).data.rows;
  const piiRow=piiRows.find(r=>String(r.sample_question).includes('E-arşiv'));
  check(piiRow&&!String(piiRow.sample_question).includes('0555')&&!String(piiRow.sample_question).includes('ahmet@example.com'),'Phone and email are redacted before analytics storage');

  check((await db.prepare('PRAGMA foreign_key_check').all()).results.length===0,'Help insight migration preserves database integrity');
  console.log(JSON.stringify({passed:checks,failed:0}));
}finally{await mf.dispose()}
