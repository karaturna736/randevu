import {startGoogle} from '@/lib/identity';
import {limit,fail} from '@/lib/server';
export const dynamic='force-dynamic';
export async function GET(req:Request){try{await limit(req,'google-start',20);return await startGoogle(req)}catch(e){return fail(e)}}
