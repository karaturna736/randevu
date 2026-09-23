import {paymentCallback} from '@/lib/billing';
import {fail} from '@/lib/server';
export const dynamic='force-dynamic';
export async function POST(req:Request){try{return await paymentCallback(req)}catch(e){return fail(e)}}
