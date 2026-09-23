import {CATEGORIES} from './types';

export type BusinessCategory=(typeof CATEGORIES)[number];
type FieldType='text'|'tel'|'email'|'textarea'|'select';
export type BusinessTypeConfig={
 businessType:string;
 businessProfile:{label:string;serviceLabel:string;staffLabel:string;staffPlural:string;customerLabel:string;appointmentLabel:string;workspaceHint:string};
 featureFlags:{resources:boolean;rooms:boolean;capacity:boolean;serviceJourney:boolean;sensitiveRecords:boolean};
 serviceSchema:{required:string[];optional:string[]};
 bookingRules:{mode:'staff'|'resource'|'hybrid';defaultDuration:number;slotStep:number;defaultCapacity:number;bufferBefore:number;bufferAfter:number};
 staffRoles:string[];resourceTypes:string[];
 customerFormSchema:Array<{key:string;label:string;type:FieldType;required:boolean}>;
 dashboardWidgets:string[];
 notificationTemplates:{confirmation:string;reminder:string;cancellation:string};
 themeSettings:{accent:string;tone:'warm'|'clinical'|'energetic'|'professional'};
 starter:{servicePlaceholder:string;staffTitle:string};
};

const base:BusinessTypeConfig={
 businessType:'general',
 businessProfile:{label:'İşletme',serviceLabel:'Hizmet',staffLabel:'Personel',staffPlural:'Ekip',customerLabel:'Müşteri',appointmentLabel:'Randevu',workspaceHint:'Hizmet, ekip ve randevularınızı tek yerden yönetin.'},
 featureFlags:{resources:false,rooms:false,capacity:false,serviceJourney:true,sensitiveRecords:false},
 serviceSchema:{required:['name','duration','price'],optional:['description','color']},
 bookingRules:{mode:'staff',defaultDuration:30,slotStep:15,defaultCapacity:1,bufferBefore:0,bufferAfter:0},
 staffRoles:['İşletme sahibi','Uzman','Personel'],resourceTypes:[],
 customerFormSchema:[{key:'name',label:'Ad soyad',type:'text',required:true},{key:'phone',label:'Telefon',type:'tel',required:true},{key:'email',label:'E-posta',type:'email',required:false},{key:'note',label:'Randevu notu',type:'textarea',required:false}],
 dashboardWidgets:['today','revenue','occupancy','retention','demand'],
 notificationTemplates:{confirmation:'Randevunuz onaylandı.',reminder:'Yaklaşan randevunuzu hatırlatırız.',cancellation:'Randevunuz iptal edildi.'},
 themeSettings:{accent:'#789c74',tone:'professional'},starter:{servicePlaceholder:'Örn. İlk hizmet',staffTitle:'Uzman'}
};

type Profile=Omit<Partial<BusinessTypeConfig>,'businessProfile'|'starter'>&{businessProfile:Partial<BusinessTypeConfig['businessProfile']>;starter:BusinessTypeConfig['starter']};
const profiles:Record<BusinessCategory,Profile>={
 'Kuaför & Berber':{businessType:'hair_salon',businessProfile:{label:'Salon',serviceLabel:'İşlem',staffLabel:'Uzman',staffPlural:'Ekip',workspaceHint:'Koltuk, uzman ve işlem takviminizi birlikte yönetin.'},staffRoles:['Salon sahibi','Berber','Kuaför','Saç tasarım uzmanı'],resourceTypes:['Koltuk'],themeSettings:{accent:'#789c74',tone:'warm'},starter:{servicePlaceholder:'Örn. Saç kesimi',staffTitle:'Kuaför'}},
 'Güzellik Salonu':{businessType:'beauty_salon',businessProfile:{label:'Güzellik merkezi',serviceLabel:'Uygulama',staffLabel:'Uzman',staffPlural:'Uzmanlar',workspaceHint:'Uygulama, oda ve uzman planınızı tek takvimde görün.'},featureFlags:{...base.featureFlags,resources:true,rooms:true},bookingRules:{...base.bookingRules,mode:'hybrid',bufferAfter:15},staffRoles:['Salon sahibi','Güzellik uzmanı','Cilt bakım uzmanı'],resourceTypes:['Bakım odası','Cihaz'],themeSettings:{accent:'#a8879f',tone:'warm'},starter:{servicePlaceholder:'Örn. Cilt bakımı',staffTitle:'Güzellik uzmanı'}},
 'Klinik':{businessType:'clinic',businessProfile:{label:'Klinik',serviceLabel:'Hizmet',staffLabel:'Uzman',staffPlural:'Klinik ekibi',customerLabel:'Danışan',workspaceHint:'Uzman, oda ve danışan planını güvenli biçimde yönetin.'},featureFlags:{...base.featureFlags,resources:true,rooms:true,sensitiveRecords:true},bookingRules:{...base.bookingRules,mode:'hybrid',bufferAfter:15},staffRoles:['Klinik yöneticisi','Uzman','Asistan'],resourceTypes:['Muayene odası'],themeSettings:{accent:'#668fa0',tone:'clinical'},starter:{servicePlaceholder:'Örn. İlk görüşme',staffTitle:'Uzman'}},
 'Danışmanlık':{businessType:'consulting',businessProfile:{label:'Danışmanlık ofisi',serviceLabel:'Görüşme',staffLabel:'Danışman',staffPlural:'Danışmanlar',customerLabel:'Danışan',workspaceHint:'Görüşme türü, danışman ve uygunlukları yönetin.'},staffRoles:['Yönetici','Danışman'],themeSettings:{accent:'#6f7f9d',tone:'professional'},starter:{servicePlaceholder:'Örn. Birebir danışmanlık',staffTitle:'Danışman'}},
 'Özel Ders':{businessType:'private_lesson',businessProfile:{label:'Eğitim işletmesi',serviceLabel:'Ders',staffLabel:'Eğitmen',staffPlural:'Eğitmenler',customerLabel:'Öğrenci',workspaceHint:'Ders, eğitmen ve öğrenci programlarını yönetin.'},featureFlags:{...base.featureFlags,capacity:true},bookingRules:{...base.bookingRules,defaultDuration:60,defaultCapacity:1},staffRoles:['Yönetici','Öğretmen','Eğitmen'],resourceTypes:['Derslik'],themeSettings:{accent:'#7286b7',tone:'professional'},starter:{servicePlaceholder:'Örn. Matematik dersi',staffTitle:'Eğitmen'}},
 'Spor & Fitness':{businessType:'fitness',businessProfile:{label:'Spor işletmesi',serviceLabel:'Seans',staffLabel:'Antrenör',staffPlural:'Antrenörler',customerLabel:'Üye',workspaceHint:'Birebir seansları ve kapasiteye bağlı dersleri planlayın.'},featureFlags:{...base.featureFlags,resources:true,capacity:true},bookingRules:{...base.bookingRules,mode:'hybrid',defaultDuration:60,defaultCapacity:12},staffRoles:['Salon sahibi','Antrenör','Eğitmen'],resourceTypes:['Stüdyo','Saha'],themeSettings:{accent:'#cf7c4f',tone:'energetic'},starter:{servicePlaceholder:'Örn. Birebir antrenman',staffTitle:'Antrenör'}},
 'Diyetisyen':{businessType:'dietitian',businessProfile:{label:'Danışmanlık merkezi',serviceLabel:'Görüşme',staffLabel:'Diyetisyen',staffPlural:'Diyetisyenler',customerLabel:'Danışan',workspaceHint:'Görüşme ve danışan takip akışınızı planlayın.'},featureFlags:{...base.featureFlags,sensitiveRecords:true},staffRoles:['Yönetici','Diyetisyen','Asistan'],themeSettings:{accent:'#77a26d',tone:'clinical'},starter:{servicePlaceholder:'Örn. İlk değerlendirme',staffTitle:'Diyetisyen'}},
 'Psikolog':{businessType:'psychologist',businessProfile:{label:'Danışmanlık merkezi',serviceLabel:'Seans',staffLabel:'Psikolog',staffPlural:'Psikologlar',customerLabel:'Danışan',workspaceHint:'Seansları ve danışan takvimini mahremiyet odaklı yönetin.'},featureFlags:{...base.featureFlags,rooms:true,sensitiveRecords:true},bookingRules:{...base.bookingRules,mode:'hybrid',defaultDuration:50,bufferAfter:10},staffRoles:['Yönetici','Psikolog','Asistan'],resourceTypes:['Görüşme odası'],themeSettings:{accent:'#7c789b',tone:'clinical'},starter:{servicePlaceholder:'Örn. Bireysel seans',staffTitle:'Psikolog'}},
 'Oto Servis':{businessType:'auto_service',businessProfile:{label:'Servis',serviceLabel:'İş emri',staffLabel:'Teknisyen',staffPlural:'Servis ekibi',customerLabel:'Araç sahibi',workspaceHint:'İş emri, teknisyen ve servis alanlarını birlikte planlayın.'},featureFlags:{...base.featureFlags,resources:true},bookingRules:{...base.bookingRules,mode:'hybrid',defaultDuration:60},staffRoles:['Servis sahibi','Servis danışmanı','Teknisyen'],resourceTypes:['Lift','Servis alanı'],themeSettings:{accent:'#65707a',tone:'professional'},starter:{servicePlaceholder:'Örn. Periyodik bakım',staffTitle:'Teknisyen'}},
 'Diğer':{businessType:'general',businessProfile:{},starter:{servicePlaceholder:'Örn. İlk hizmet',staffTitle:'Uzman'}}
};

export function getBusinessConfig(category?:string):BusinessTypeConfig{
 const key=(CATEGORIES.includes(category as BusinessCategory)?category:'Diğer') as BusinessCategory;
 const selected=profiles[key];
 return {...base,...selected,businessProfile:{...base.businessProfile,...selected.businessProfile},featureFlags:{...base.featureFlags,...selected.featureFlags},serviceSchema:{...base.serviceSchema,...selected.serviceSchema},bookingRules:{...base.bookingRules,...selected.bookingRules},notificationTemplates:{...base.notificationTemplates,...selected.notificationTemplates},themeSettings:{...base.themeSettings,...selected.themeSettings},starter:{...base.starter,...selected.starter}};
}

export function getBusinessConfigCatalog(){
 return CATEGORIES.map(category=>({category,config:getBusinessConfig(category)}));
}
