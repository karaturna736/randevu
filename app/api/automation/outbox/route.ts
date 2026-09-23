import {runAppointmentNotifications} from '@/lib/whatsapp-outbox';
import {ok,fail} from '@/lib/server';

/** Called by a private cron/worker with Authorization: Bearer AUTOMATION_SECRET. */
export async function POST(req:Request){try{return ok(await runAppointmentNotifications(req))}catch(e){return fail(e)}}

