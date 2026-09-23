import {recurringWebhook} from '@/lib/recurring';
import {fail} from '@/lib/server';

export const dynamic='force-dynamic';

export async function POST(request:Request){
 try{return await recurringWebhook(request)}catch(error){return fail(error)}
}
