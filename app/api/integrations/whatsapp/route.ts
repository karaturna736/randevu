import {verifyWa,whatsappWebhook} from '@/lib/whatsapp';
import {fail} from '@/lib/server';
export async function GET(req:Request){try{return await verifyWa(req)}catch(e){return fail(e)}}
export async function POST(req:Request){try{return await whatsappWebhook(req)}catch(e){return fail(e)}}
