// Neta Plus'a özel işletme web sitesi, Yönetim API'si ve şubeler arası otomasyonu izole ortamda doğrular.
import { createRequire } from "node:module";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const wr = createRequire(require.resolve("wrangler/package.json"));
const { Miniflare } = await import(wr.resolve("miniflare"));
const root = resolve("dist/server");
const files = ["index.js", ...readdirSync(root,{recursive:true}).filter(p=>p.endsWith(".js")&&p!=="index.js")];
const mf = new Miniflare({
  modules: files.map(p=>({type:"ESModule",path:resolve(root,p)})), modulesRoot:root,
  compatibilityDate:"2026-05-15", compatibilityFlags:["nodejs_compat"], d1Databases:["DB"], cf:false,
  bindings:{CHATGPT_AUTH_ENABLED:"true",PUBLIC_APP_URL:"https://neta.test",PUBLIC_SITE_READY:"true",APP_ENCRYPTION_KEY:"b".repeat(64)},
});
let checks=0;
function check(v,label){assert.ok(v,label);checks++;console.log("PASS",label)}
const future=()=>new Date(Date.now()+86400000*30).toISOString();
const tomorrow=()=>new Date(Date.now()+86400000).toISOString().slice(0,10);
const hours=JSON.stringify({0:[540,1080],1:[540,1080],2:[540,1080],3:[540,1080],4:[540,1080],5:[540,1080],6:[540,1080]});
async function v1(path,{user,body}={}){
 const r=await mf.dispatchFetch(`https://neta.test/api/v1/${path}`,{method:body?"POST":"GET",headers:{...(user?{"oai-authenticated-user-id":user,"oai-authenticated-user-email":`${user}@example.test`}:{}),...(body?{"content-type":"application/json",origin:"https://neta.test"}:{})},...(body?{body:JSON.stringify(body)}:{})});
 return {status:r.status,data:await r.json()};
}
async function management(path,key){const r=await mf.dispatchFetch(`https://neta.test/api/management/v1/${path}`,{headers:{authorization:`Bearer ${key}`}});return {status:r.status,data:await r.json()}}
try{
 const db=await mf.getD1Database("DB");
 for(const file of readdirSync("drizzle").filter(p=>p.endsWith(".sql")).sort()) for(const sql of readFileSync(`drizzle/${file}`,"utf8").split("--> statement-breakpoint").map(s=>s.trim()).filter(Boolean)) await db.prepare(sql).run();
 const created=new Date().toISOString();
 for(const [id,user,slug,plan,amount] of [["plus-platform","plus-platform-owner","plus-platform-test","plus",250000],["pro-platform","pro-platform-owner","pro-platform-test","pro",99900]]){
  await db.prepare("INSERT INTO businesses(id,name,slug,category,status,demo,hours,created_at,city,address,phone,description) VALUES(?,?,?,?, 'approved',0,?,?,?,?,?,?)").bind(id,`Test ${plan}`,slug,"Kuaför & Berber",hours,created,"İstanbul","Test adres","+905551112233","Test işletme açıklaması").run();
  await db.prepare("INSERT INTO members(tenant_id,user_id,email,name) VALUES(?,?,?,?)").bind(id,user,`${user}@example.test`,user).run();
  await db.prepare("INSERT INTO recurring_subscriptions(tenant_id,plan_reference,plan,amount,state,request_id,test_mode,paid_until,created_at,updated_at) VALUES(?,?,?,?, 'ACTIVE',?,0,?,?,?)").bind(id,`plus-platform-${plan}`,plan,amount,randomUUID(),future(),created,created).run();
 }
 await db.prepare("INSERT INTO branches(id,tenant_id,name,city,address,phone,active,is_primary,created_at) VALUES(?,?,?,?,?,?,1,1,?)").bind("branch-a","plus-platform","Merkez","İstanbul","Merkez adres","+905551112233",created).run();
 await db.prepare("INSERT INTO branches(id,tenant_id,name,city,address,phone,active,is_primary,created_at) VALUES(?,?,?,?,?,?,1,0,?)").bind("branch-b","plus-platform","Cadde","İstanbul","Cadde adres","+905551112244",created).run();
 await db.prepare("INSERT INTO services(id,tenant_id,name,description,duration,price,color,active) VALUES(?,?,?,?,?,?,?,1)").bind("service-1","plus-platform","Saç Kesimi","Test",30,100000,"#000000").run();
 await db.prepare("INSERT INTO staff(id,tenant_id,name,title,hours,color,active,branch_id) VALUES(?,?,?,?,?,?,1,?)").bind("staff-b","plus-platform","Uzman B","Uzman",hours,"#000000","branch-b").run();

 let r=await v1("plus-tools?tenant=pro-platform",{user:"pro-platform-owner"});
 check(r.status===402,"Pro cannot open Plus platform tools");
 r=await v1("plus-tools?tenant=plus-platform",{user:"plus-platform-owner"});
 check(r.status===200&&r.data.website&&r.data.management_api&&r.data.branch_automation,"Plus platform tools load together");

 r=await v1("plus-tools",{user:"plus-platform-owner",body:{tenant_id:"plus-platform",action:"website",eyebrow:"RANDEVUNUZ HAZIR",hero_title:"Cadde Stüdyo",hero_text:"Size uygun saati hemen seçin.",about_text:"İstanbul'da profesyonel bakım.",instagram_url:"https://instagram.com/neta",contact_phone:"+905551112233",seo_title:"Cadde Stüdyo | Randevu",seo_description:"Cadde Stüdyo için online randevu alın.",show_reviews:false}});
 check(r.status===200,"Plus website settings can be saved");
 r=await v1("public/plus-platform-test");
 check(r.status===200&&r.data.website?.hero_title==="Cadde Stüdyo"&&r.data.website?.show_reviews===false,"Saved website content is exposed to the public business page");

 r=await v1("plus-tools",{user:"plus-platform-owner",body:{tenant_id:"plus-platform",action:"create-api-key",name:"Test ERP"}});
 const apiKey=r.data.key;
 check(r.status===201&&/^neta_live_[a-f0-9]{64}$/i.test(apiKey||""),"Plus can create a one-time management API key");
 const stored=await db.prepare("SELECT key_hash,key_prefix FROM management_api_keys WHERE tenant_id=?").bind("plus-platform").first();
 check(stored&&stored.key_hash!==apiKey&&!String(stored.key_hash).includes(apiKey),"Management API key is stored hashed, not as plaintext");
 r=await management("business",apiKey);
 check(r.status===200&&r.data.id==="plus-platform","Valid Plus API key authenticates against management API");
 r=await management("business","neta_live_"+"0".repeat(64));
 check(r.status===401,"Invalid management API key is rejected");

 r=await v1("plus-tools",{user:"plus-platform-owner",body:{tenant_id:"plus-platform",action:"branch-automation",fallback_enabled:true,max_alternatives:3}});
 check(r.status===200,"Plus can enable cross-branch automation");
 r=await v1(`availability?slug=plus-platform-test&service=service-1&date=${tomorrow()}&staff=any&branch=branch-a`);
 check(r.status===200&&r.data.slots.length===0&&r.data.alternatives?.[0]?.branch?.id==="branch-b"&&r.data.alternatives[0].slots.length>0,"Full/empty preferred branch automatically returns real slots from another branch");

 const keys=(await v1("plus-tools?tenant=plus-platform",{user:"plus-platform-owner"})).data.management_api.keys;
 check(keys.length===1&&!keys[0].key,"API key list never reveals plaintext secret again");
 r=await v1("plus-tools",{user:"plus-platform-owner",body:{tenant_id:"plus-platform",action:"revoke-api-key",id:keys[0].id}});
 check(r.status===200,"Management API key can be revoked");
 r=await management("business",apiKey);
 check(r.status===401,"Revoked management API key stops working immediately");
 console.log(`Plus platform integrity complete: ${checks} checks`);
}finally{await mf.dispose()}
