import {runRecovery} from '@/lib/recovery';import {ok,fail} from '@/lib/server';
export const dynamic='force-dynamic';
export async function POST(req:Request){try{return ok(await runRecovery(req))}catch(e){return fail(e)}}
