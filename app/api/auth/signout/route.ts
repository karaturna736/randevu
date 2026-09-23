import {signOutApp} from '@/lib/identity';
import {body,fail} from '@/lib/server';
export const dynamic='force-dynamic';
export async function POST(req:Request){try{await body(req);const r=await signOutApp(req);const headers=new Headers(r.headers);headers.delete('Location');headers.set('Content-Type','application/json');return new Response(JSON.stringify({redirect:'/signout-with-chatgpt?return_to=%2Fgiris'}),{headers})}catch(e){return fail(e)}}
