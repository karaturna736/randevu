import {runRecalls} from '@/lib/whatsapp';import {ok,fail} from '@/lib/server';
export async function POST(req:Request){try{return ok(await runRecalls(req))}catch(e){return fail(e)}}
