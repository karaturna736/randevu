export function capacityScenario(window:any,days:number,conversion:number){
 const start=Math.floor(window.minute_from/60)*60;
 const end=Math.min(1440,start+Math.max(120,Math.ceil(window.duration/60)*60));
 const capacity=Math.floor((end-start)/window.duration);
 const requestsPerWeek=window.count/Math.max(days/7,window.distinct_dates,1);
 const expectedBookings=Math.min(capacity,requestsPerWeek*Math.max(0,Math.min(100,conversion))/100);
 return {start,end,capacity,requests_per_week:requestsPerWeek,expected_bookings:expectedBookings,weekly_revenue:Math.round(expectedBookings*(window.value/window.count||0)),eligible:window.count>=5&&window.distinct_dates>=2&&window.specific_staff===0&&capacity>0};
}
