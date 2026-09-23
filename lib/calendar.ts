import {time} from './types';
const escape=(s:string)=>s.replace(/\\/g,'\\\\').replace(/\r\n|\r|\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');
const stamp=(d:Date)=>d.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
export function calendarUrl(a:{id?:string;date:string;minute:number;duration:number;service_name:string},b:{name:string;address?:string}){
 const start=new Date(a.date+'T'+time(a.minute)+':00+03:00');
 const end=new Date(+start+a.duration*60000);
 const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Randevu//Appointments//TR','CALSCALE:GREGORIAN','BEGIN:VEVENT','UID:'+escape(a.id||a.date+'-'+a.minute)+'@randevu','DTSTAMP:'+stamp(new Date()),'DTSTART:'+stamp(start),'DTEND:'+stamp(end),'SUMMARY:'+escape(a.service_name+' · '+b.name),'LOCATION:'+escape(b.address||''),'DESCRIPTION:'+escape('Randevu değişikliklerini işletme veya Randevu hesabınız üzerinden kontrol edin. Bu takvim kaydı kendiliğinden güncellenmez.'),'END:VEVENT','END:VCALENDAR'];
 return 'data:text/calendar;charset=utf-8,'+encodeURIComponent(lines.join('\r\n')+'\r\n');
}
export function safeDestination(raw:string|null,fallback='/randevularim'){
 if(!raw||!raw.startsWith('/')||raw.startsWith('//')||raw.includes('\\'))return fallback;
 try{const u=new URL(raw,'https://randevu.invalid');if(u.origin!=='https://randevu.invalid'||/^\/(signin-with-chatgpt|signout-with-chatgpt|callback|api)(\/|$)/.test(u.pathname))return fallback;return u.pathname+u.search+u.hash}catch{return fallback}
}
