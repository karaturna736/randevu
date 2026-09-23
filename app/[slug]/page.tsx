import {BusinessBooking} from '@/components/product/public';
export const dynamic='force-dynamic';
export default async function Page({params}:{params:Promise<{slug:string}>}){const {slug}=await params;return <BusinessBooking slug={slug}/>}
