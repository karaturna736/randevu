import {onboardingPaymentCallback} from '@/lib/onboarding-payment';import {fail} from '@/lib/server';
export async function POST(req:Request){try{return await onboardingPaymentCallback(req)}catch(e){return fail(e)}}
