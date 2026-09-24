// Isolated Worker + D1 tests. Dummy identities and provider credentials never leave
// this process: all provider traffic is mocked and external network is disabled.
import {createRequire} from 'node:module';
import {readdirSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHmac,createHash,randomUUID} from 'node:crypto';
import {generateKeyPair,exportJWK,SignJWT} from 'jose';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),wranglerRequire=createRequire(require.resolve('wrangler/package.json'));
const {Miniflare,Response:TestResponse}=await import(wranglerRequire.resolve('miniflare'));
const root=resolve('dist/server'),files=['index.js',...readdirSync(root,{recursive:true}).filter(p=>p.endsWith('.js')&&p!=='index.js')];

const {publicKey,privateKey}=await generateKeyPair('RS256');const jwk={...await exportJWK(publicKey),kid:'neta-test',alg:'RS256',use:'sig'};
let identityToken='',providerBody=null;
const outboundService=async(request)=>{
 const url=new URL(request.url);
 if(url.origin==='https://www.googleapis.com'&&url.pathname==='/oauth2/v3/certs')return new TestResponse(JSON.stringify({keys:[jwk]}),{headers:{'Content-Type':'application/json'}});
 if(url.origin==='https://oauth2.googleapis.com'&&url.pathname==='/token')return new TestResponse(JSON.stringify({id_token:identityToken}),{headers:{'Content-Type':'application/json'}});
 if(url.origin==='https://www.paytr.com'&&url.pathname==='/odeme/api/get-token'){providerBody=new URLSearchParams(await request.text());return new TestResponse(JSON.stringify({status:'success',token:'isolated_test_token_12345'}),{headers:{'Content-Type':'application/json'}})}
 throw new Error('Unexpected external call in isolated test: '+url.origin+url.pathname);
};
const base={modules:files.map(p=>({type:'ESModule',path:resolve(root,p)})),modulesRoot:root,compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],cf:false,outboundService};
const bindings={PLATFORM_ADMIN_USER_IDS:'qa-admin',PUBLIC_APP_URL:'https://neta.test',PUBLIC_SITE_READY:'true',GOOGLE_AUTH_ENABLED:'true',GOOGLE_CLIENT_ID:'test-client',GOOGLE_CLIENT_SECRET:'dummy-google-secret',PAYTR_MERCHANT_ID:'test-merchant',PAYTR_MERCHANT_KEY:'dummy-test-key',PAYTR_MERCHANT_SALT:'dummy-test-salt',PAYTR_TEST_MODE:'0'};
const mf=new Miniflare({...base,bindings});let checks=0;
function check(v,label){assert.ok(v,label);checks++;console.log('PASS',label)}
const digest=s=>createHash('sha256').update(s).digest('hex');
const stamp=()=>new Date().toISOString();
async function req(path,{user,body,headers={},method}={}){return mf.dispatchFetch('https://neta.test'+path,{method:method||(body?'POST':'GET'),redirect:'manual',headers:{...(user?{'oai-authenticated-user-id':user,'oai-authenticated-user-email':user+'@example.test'}:{}),...(body?{'content-type':'application/json',origin:'https://neta.test'}:{}),...headers},...(body?{body:JSON.stringify(body)}:{})})}
async function call(path,opts){const r=await req('/api/v1/'+path,opts);return {status:r.status,data:await r.json()}}
async function callback(id,{status='success',amount='99000',bad=false,duplicate=false}={}){const hash=createHmac('sha256',bindings.PAYTR_MERCHANT_KEY).update(id+bindings.PAYTR_MERCHANT_SALT+status+amount).digest('base64');const f=new URLSearchParams({merchant_oid:id,status,total_amount:amount,hash:bad?'bad':hash});if(duplicate)f.append('status','failed');const r=await mf.dispatchFetch('https://neta.test/api/payments/paytr/callback',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:f.toString()});return {status:r.status,text:await r.text()}}
let db;
async function beginGoogle(destination='/panel'){const r=await req('/api/auth/google?sonra='+encodeURIComponent(destination));const u=new URL(r.headers.get('location'));const cookie=r.headers.get('set-cookie').split(';')[0],state=u.searchParams.get('state');const flow=await db.prepare('SELECT * FROM auth_flows WHERE state_hash=?').bind(digest(state)).first();return {r,u,cookie,state,flow}}
async function sign(flow,overrides={}){identityToken=await new SignJWT({sub:'google-person',email:'owner-a@example.test',email_verified:true,name:'Google Kullanıcısı',nonce:flow.nonce,...overrides}).setProtectedHeader({alg:'RS256',kid:'neta-test'}).setIssuer('https://accounts.google.com').setAudience('test-client').setIssuedAt().setExpirationTime('5m').sign(privateKey)}
async function finish(flow,cookie=flow.cookie){return req('/api/auth/google/callback?code=test-code&state='+flow.state,{headers:{cookie}})}
try{
 db=await mf.getD1Database('DB');
 for(const file of readdirSync('drizzle').filter(p=>p.endsWith('.sql')).sort())for(const sql of readFileSync('drizzle/'+file,'utf8').split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean))await db.prepare(sql).run();
 check((await call('auth-status')).data.google,'Provider availability comes from server configuration');
 check((await call('plans')).data.active===false,'Paid plan starts inactive');
 check((await call('billing')).status===401,'Anonymous visitors cannot access billing');
 check((await call('platform-billing',{user:'owner-a'})).status===403,'Business owners cannot access platform receipts');
 const A=(await call('businesses',{user:'owner-a',body:{name:'Test Neta A',slug:'neta-a',category:'Kuaför & Berber'}})).data.id;
 const B=(await call('businesses',{user:'owner-b',body:{name:'Test Neta B',slug:'neta-b',category:'Kuaför & Berber'}})).data.id;
 check(!!A&&!!B,'Independent business workspaces created');
 const secondBusiness=await call('businesses',{user:'owner-a',body:{name:'İkinci İşletme',slug:'neta-a-ikinci',category:'Kuaför & Berber'}});
 check(secondBusiness.status===201&&secondBusiness.data.id!==A,'One owner can create a separately isolated second business');
 check((await call('billing?tenant='+secondBusiness.data.id,{user:'owner-a'})).status===402,'Unpaid second business is blocked from billing workspace');
 const lockedWorkspace=(await call('workspace?tenant='+A,{user:'owner-a'})).data;
 check(lockedWorkspace.subscription_required===true&&!lockedWorkspace.customers,'Unpaid real panel returns only the subscription gate, not business records');
 const demoWorkspaceResult=await call('demo-workspace',{user:'owner-a',body:{}});
 check(demoWorkspaceResult.status===201&&demoWorkspaceResult.data.business.demo===1&&demoWorkspaceResult.data.branches.length===2&&demoWorkspaceResult.data.customers.length>=18,'Demo workspace is isolated, fully seeded and available without payment');
 const subscriptionId=randomUUID(),subscriptionStamp=new Date().toISOString(),subscriptionUntil=new Date(Date.now()+86400000).toISOString();
 await db.prepare("INSERT INTO recurring_subscriptions(tenant_id,reference,customer_reference,plan_reference,plan,amount,state,request_id,test_mode,paid_until,created_at,updated_at) VALUES(?,NULL,NULL,'test-business','plus',250000,'ACTIVE',?,0,?,?,?)").bind(A,subscriptionId,subscriptionUntil,subscriptionStamp,subscriptionStamp).run();
 check((await call('workspace?tenant='+A,{user:'owner-a'})).data.business.id===A,'Active subscription unlocks the real business panel');
 const branch=(await db.prepare('SELECT id FROM branches WHERE tenant_id=? AND is_primary=1').bind(A).first()).id;
 const catalog=await call('expense-catalog',{user:'owner-a',body:{tenant_id:A,name:'Saç kremi',category:'malzeme',unit:'kutu',default_unit_amount:45000,note:'Aylık stok'}});
 check(catalog.status===200,'Owner can save a reusable expense catalog item');
 check((await call('branch-expenses',{user:'owner-a',body:{tenant_id:A,branch_id:branch,month:'2026-09',category:'malzeme',amount:90000,catalog_item_id:catalog.data.id,quantity:2,unit:'kutu',note:'Eylül stoku'}})).status===200,'Saved catalog item can be used in a monthly branch expense');
 const branchReport=(await call('branches?tenant='+A+'&month=2026-09',{user:'owner-a'})).data;
 check(branchReport.catalog.length===1&&branchReport.expenses[0].quantity===2&&branchReport.summary.expenses===90000,'Reusable expense remains available and contributes to profit calculation');
 check((await call('billing?tenant='+B,{user:'owner-a'})).status===403,'Cross-tenant billing reads are rejected');
 const buyer={name:'Test Alıcı',email:'buyer@example.test',phone:'05551112233',address:'Yalnızca test adresi, İstanbul'};
 check((await call('billing-profile',{user:'owner-a',body:{tenant_id:B,...buyer}})).status===403,'Cross-tenant billing profile writes are rejected');
 check((await call('billing-profile',{user:'owner-a',body:{tenant_id:A,...buyer,address:'x'}})).status===400,'Incomplete buyer profile is rejected');
 check((await call('billing-profile',{user:'owner-a',body:{tenant_id:A,...buyer}})).status===200,'Owner can save only their billing profile');
 await db.prepare('DELETE FROM recurring_subscriptions WHERE tenant_id=?').bind(A).run();
 const payload={tenant_id:A,idempotency_key:randomUUID(),terms_accepted:true};
 check((await call('checkout',{user:'owner-a',body:payload})).status===503,'Inactive plan cannot charge');
 const plan={amount:99000,active:true,seller_name:'Test Satıcı',seller_address:'Yalnızca test satıcı adresi',support_email:'support@example.test',terms_url:'https://neta.test/kosullar'};
 check((await call('platform-billing',{user:'owner-a',body:plan})).status===403,'Business owner cannot change platform price');
 check((await call('platform-billing',{user:'qa-admin',body:{...plan,amount:1.5}})).status===400,'Invalid fractional minor-unit price rejected');
 check((await call('platform-billing',{user:'qa-admin',body:plan})).status===200,'Admin can configure authorized isolated test seller');
 check((await call('checkout',{user:'owner-a',body:{...payload,terms_accepted:false}})).status===400,'Checkout needs explicit purchase consent');
 check((await call('checkout',{user:'owner-a',body:{...payload,tenant_id:B}})).status===403,'Cross-tenant checkout is rejected');
 check((await call('checkout',{user:'owner-a',body:payload,headers:{origin:'https://attacker.test'}})).status===403,'Cross-origin checkout is rejected');
 const purchase=await call('checkout',{user:'owner-a',body:{...payload,amount:1,price:1,currency:'USD'},headers:{'cf-connecting-ip':'192.0.2.1'}});
 
 check(purchase.status===200&&purchase.data.checkout_url==='https://www.paytr.com/odeme/guvenli/isolated_test_token_12345','Checkout opens only fixed provider origin');
 const oid=purchase.data.order_id;const order=await db.prepare('SELECT * FROM subscription_orders WHERE id=?').bind(oid).first();
 check(order.amount===99000&&providerBody.get('payment_amount')==='99000'&&providerBody.get('currency')==='TL','Client cannot alter signed price or currency');
 const expected=createHmac('sha256',bindings.PAYTR_MERCHANT_KEY).update(bindings.PAYTR_MERCHANT_ID+'192.0.2.1'+oid+buyer.email+'99000'+providerBody.get('user_basket')+'1'+'0'+'TL'+'0'+bindings.PAYTR_MERCHANT_SALT).digest('base64');
 check(providerBody.get('paytr_token')===expected,'Provider request has correct authenticated signature');
 check((await call('checkout',{user:'owner-a',body:payload,headers:{'cf-connecting-ip':'192.0.2.1'}})).data.existing===true,'Repeated idempotency key does not create another order');
 check(!await db.prepare('SELECT * FROM subscriptions WHERE tenant_id=?').bind(A).first(),'Starting checkout grants no subscription');
 check((await callback(oid,{bad:true})).status===403,'Forged provider callback is rejected');
 check((await callback(oid,{duplicate:true})).status===400,'Ambiguous repeated callback fields rejected');
 check((await callback(oid,{amount:'1'})).status===409,'Signed callback with wrong amount cannot activate access');
 check(!await db.prepare('SELECT * FROM subscriptions WHERE tenant_id=?').bind(A).first(),'Rejected callbacks leave subscription unchanged');
 const results=await Promise.all([callback(oid),callback(oid),callback(oid)]);
 check(results.every(r=>r.status===200&&r.text==='OK'),'Concurrent valid callbacks acknowledged');
 let sub=await db.prepare('SELECT * FROM subscriptions WHERE tenant_id=?').bind(A).first();const until=sub.paid_until;
 check(Math.abs(new Date(until)-Date.now()-30*86400000)<10000,'One order grants exactly 30 days');
 check((await db.prepare('SELECT COUNT(*) n FROM billing_grants WHERE tenant_id=?').bind(A).first()).n===1,'Concurrent replay grants access once');
 await callback(oid,{status:'failed'});check((await db.prepare('SELECT status FROM subscription_orders WHERE id=?').bind(oid).first()).status==='paid','Late failure cannot downgrade confirmed payment');
 check(!(await call('billing?tenant='+B,{user:'owner-b'})).data.orders.length,'Other tenant sees none of this order history');
 const makeOrder=async(testMode=0,tenant=A)=>{const id='NETA'+randomUUID().replaceAll('-','');await db.prepare("INSERT INTO subscription_orders(id,tenant_id,user_id,amount,test_mode,idempotency_key,buyer_name,buyer_email,buyer_address,terms_url,terms_accepted_at,created_at,expires_at) VALUES(?,?,'owner-a',99000,?,?,?,?,?,?,?,?,?)").bind(id,tenant,testMode,randomUUID(),buyer.name,buyer.email,buyer.address,plan.terms_url,stamp(),stamp(),stamp()).run();return id};
 const second=await makeOrder();await callback(second);sub=await db.prepare('SELECT * FROM subscriptions WHERE tenant_id=?').bind(A).first();check(new Date(sub.paid_until)-new Date(until)===30*86400000,'Second distinct payment extends the existing paid period');
 const testOrder=await makeOrder(1);await callback(testOrder);check((await db.prepare('SELECT status FROM subscription_orders WHERE id=?').bind(testOrder).first()).status==='test_paid','Test order has an explicit test result');
 check((await db.prepare('SELECT COUNT(*) n FROM billing_grants WHERE order_id=?').bind(testOrder).first()).n===0,'Test payments never extend subscriptions');
 const forged=await makeOrder(0,B);await db.prepare("UPDATE subscription_orders SET status='paid' WHERE id=?").bind(forged).run();let rejected=false;try{await db.prepare('INSERT INTO billing_grants VALUES(?,?,30,?)').bind(forged,A,stamp()).run()}catch{rejected=true}check(rejected,'Database prevents granting one tenant another tenant’s order');
 const ledger=await call('platform-billing',{user:'qa-admin'});check(ledger.data.totals.paid_amount===297000,'Platform totals include real paid orders only');
 check(!JSON.stringify(ledger.data).includes(bindings.PAYTR_MERCHANT_KEY)&&!JSON.stringify(ledger.data).includes(bindings.GOOGLE_CLIENT_SECRET),'Administrative API never exposes provider secrets');

 let flow=await beginGoogle('//attacker.test');
 check(flow.u.origin==='https://accounts.google.com'&&flow.u.searchParams.get('code_challenge_method')==='S256','Google flow uses fixed provider and PKCE');
 check(flow.flow.return_to.startsWith('/kayit?'),'External continuation is replaced with safe local route');
 check(/HttpOnly/.test(flow.r.headers.get('set-cookie'))&&/Secure/.test(flow.r.headers.get('set-cookie'))&&/SameSite=Lax/.test(flow.r.headers.get('set-cookie')),'Flow cookie has secure browser-binding attributes');
 await sign(flow.flow);let result=await finish(flow,'__Host-neta-flow='+'0'.repeat(64));
 check(result.headers.get('location').includes('google_dogrulanamadi'),'Wrong browser binding cannot finish Google sign-in');
 check((await db.prepare('SELECT COUNT(*) n FROM auth_sessions').first()).n===0,'Invalid flow creates no session');
 result=await finish(flow);let cookies=result.headers.getSetCookie();let sessionCookie=cookies.find(c=>c.startsWith('__Host-neta-session=')).split(';')[0];
 check(result.status===303&&sessionCookie.length>60,'Verified Google token creates a secure session');
 let me=await call('account',{headers:{cookie:sessionCookie}});
 check(me.data.user.userId==='google:google-person'&&me.data.authenticated===true,'Session binds to stable verified Google subject');
 check(me.data.businesses.length===0,'Matching email does not automatically claim an existing business');
 check((await db.prepare('SELECT token_hash FROM auth_sessions').first()).token_hash!==sessionCookie.split('=')[1],'Only a token hash is stored');
 result=await finish(flow);check(result.headers.get('location').includes('google_dogrulanamadi'),'Consumed Google code flow cannot be replayed');
 for(const [label,claims] of [['Unverified email',{email_verified:false}],['Wrong nonce',{nonce:'invalid'}]]){flow=await beginGoogle();await sign(flow.flow,claims);result=await finish(flow);check(result.headers.get('location').includes('google_dogrulanamadi'),label+' cannot create a session')}
 flow=await beginGoogle();identityToken=await new SignJWT({sub:'google-person',email:buyer.email,email_verified:true,nonce:flow.flow.nonce}).setProtectedHeader({alg:'RS256',kid:'neta-test'}).setIssuer('https://accounts.google.com').setAudience('wrong-client').setIssuedAt().setExpirationTime('5m').sign(privateKey);result=await finish(flow);check(result.headers.get('location').includes('google_dogrulanamadi'),'Token issued for another client rejected');
 check((await req('/api/auth/signout',{body:{},headers:{cookie:sessionCookie,origin:'https://attacker.test'}})).status===403,'Cross-origin signout rejected');
 result=await req('/api/auth/signout',{body:{},headers:{cookie:sessionCookie}});check(result.status===200&&result.headers.get('set-cookie').includes('Max-Age=0'),'Signout clears secure cookies');
 check(!(await call('account',{headers:{cookie:sessionCookie}})).data.authenticated,'Signed-out session cannot be reused');
 check((await db.prepare('PRAGMA foreign_key_check').all()).results.length===0,'All billing and identity records preserve data constraints');
 console.log(JSON.stringify({passed:checks,failed:0}));
}finally{await mf.dispose()}
