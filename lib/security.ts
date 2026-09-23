export const randomToken=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('');
export const hex=(bytes:ArrayBuffer)=>Array.from(new Uint8Array(bytes),x=>x.toString(16).padStart(2,'0')).join('');
export const digest=async(value:string)=>hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)));
export const base64=(bytes:Uint8Array)=>btoa(String.fromCharCode(...bytes));
export const utf8Base64=(value:string)=>base64(new TextEncoder().encode(value));
export async function hmac(value:string,key:string){const k=await crypto.subtle.importKey('raw',new TextEncoder().encode(key),{name:'HMAC',hash:'SHA-256'},false,['sign']);return base64(new Uint8Array(await crypto.subtle.sign('HMAC',k,new TextEncoder().encode(value))))}
export function equalSecret(a:string,b:string){const x=new TextEncoder().encode(a),y=new TextEncoder().encode(b);let diff=x.length^y.length;for(let i=0;i<Math.max(x.length,y.length);i++)diff|=(x[i]||0)^(y[i]||0);return diff===0}
export function cookieValue(header:string|null,key:string){for(const entry of (header||'').split(';')){const p=entry.trim().indexOf('=');if(p>0&&entry.trim().slice(0,p)===key)return entry.trim().slice(p+1)}return null}
export const privateHeaders={'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'};
export async function hmacHex(value:string,key:string){return Array.from(atob(await hmac(value,key)),c=>c.charCodeAt(0).toString(16).padStart(2,'0')).join('')}
export async function seal(text:string,keyHex:string){if(!/^[a-f0-9]{64}$/i.test(keyHex))throw new Error('ENCRYPTION_NOT_CONFIGURED');const key=await crypto.subtle.importKey('raw',Uint8Array.from(keyHex.match(/../g)!,h=>parseInt(h,16)),{name:'AES-GCM'},false,['encrypt']);const iv=crypto.getRandomValues(new Uint8Array(12));const bytes=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode(text));return base64(iv)+'.'+base64(new Uint8Array(bytes))}
export async function unseal(value:string,keyHex:string){const [a,b]=value.split('.');const key=await crypto.subtle.importKey('raw',Uint8Array.from(keyHex.match(/../g)!,h=>parseInt(h,16)),{name:'AES-GCM'},false,['decrypt']);return new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:Uint8Array.from(atob(a),c=>c.charCodeAt(0))},key,Uint8Array.from(atob(b),c=>c.charCodeAt(0))))}
