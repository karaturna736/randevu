import {recurringWebhook} from '@/lib/recurring';import {fail} from '@/lib/server';
export async function POST(req:Request){try{return await recurringWebhook(req)}catch(e){return fail(e)}}
