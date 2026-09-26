export const HOURS=JSON.stringify({"1":[540,1140],"2":[540,1140],"3":[540,1140],"4":[540,1140],"5":[540,1140],"6":[600,1080]});
export const CATEGORIES=['Kuaför & Berber','Güzellik Salonu','Spa & Masaj','Klinik','Danışmanlık','Özel Ders','Spor & Fitness','Diyetisyen','Psikolog','Oto Servis','Diğer'];
export const STATUS:Record<string,string>={confirmed:'Onaylandı',completed:'Tamamlandı',cancelled:'İptal edildi',no_show:'Gelmedi'};
export const money=(n:number)=>new Intl.NumberFormat('tr-TR',{style:'currency',currency:'TRY',minimumFractionDigits:0,maximumFractionDigits:2}).format(n/100);
export const time=(n:number)=>`${Math.floor(n/60).toString().padStart(2,'0')}:${(n%60).toString().padStart(2,'0')}`;
export const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Istanbul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export const addDays=(d:string,n:number)=>new Date(new Date(d+'T12:00:00Z').getTime()+n*86400000).toISOString().slice(0,10);
export const dateLabel=(d:string)=>new Date(d+'T12:00:00Z').toLocaleDateString('tr-TR',{day:'numeric',month:'short'});
export const initials=(s:string)=>s.split(' ').slice(0,2).map(x=>x[0]).join('').toLocaleUpperCase('tr-TR');