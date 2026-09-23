import {recurringCallback} from '@/lib/recurring';import {fail} from '@/lib/server';
export async function POST(req:Request){try{return await recurringCallback(req)}catch(e){return fail(e)}}
