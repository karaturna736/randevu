import {finishGoogle} from '@/lib/identity';
export const dynamic='force-dynamic';
export async function GET(req:Request){return finishGoogle(req)}
