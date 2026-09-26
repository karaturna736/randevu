import type {Metadata} from 'next';
import {BusinessBooking} from '@/components/product/public';
import {publicBusiness} from '@/lib/booking';
import {publicWebsite} from '@/lib/plus-platform';
export const dynamic='force-dynamic';
export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata>{
 try{const {slug}=await params,b=await publicBusiness(slug),site=await publicWebsite(b.id);return {title:site?.seo_title||`${b.name} | Online Randevu`,description:site?.seo_description||b.description||`${b.name} için online randevu alın.`}}
 catch{return {title:'Online Randevu | Neta'}}
}
export default async function Page({params}:{params:Promise<{slug:string}>}){const {slug}=await params;return <BusinessBooking slug={slug}/>}
