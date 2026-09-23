// Contracts for later provider adapters. No sending or charging happens until connected.
export interface NotificationProvider{send(input:{to:string;template:string;variables:Record<string,string>;idempotencyKey:string}):Promise<{providerId:string}>}
export interface PaymentProvider{createDeposit(input:{tenantId:string;appointmentId:string;amount:number;currency:'TRY';idempotencyKey:string}):Promise<{checkoutUrl:string}>;verifyWebhook(request:Request):Promise<{providerId:string;paid:boolean}>}
export interface LanguageProvider{extractIntent(message:string):Promise<{serviceId?:string;date?:string;partOfDay?:string}>}
