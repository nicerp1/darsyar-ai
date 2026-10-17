const {db}=require('../api/_supabase');
const positive=v=>Number.isFinite(Number(v))?Math.max(0,Number(v)):0;
const duration=s=>({hours:Math.floor(s/3600),minutes:Math.floor(s%3600/60),seconds:s%60});
module.exports=async function studyContext(username){
    const rows=await db(`app_data?username=eq.${encodeURIComponent(username)}&key=in.(study_history,manual_reports,schedule)&select=key,value`);
    const data=Object.fromEntries((rows||[]).map(r=>[r.key,r.value]));
    const days=new Map(),subjects=new Map();
    const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tehran',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
    const add=(day,seconds)=>{if(/^\d{4}-\d{2}-\d{2}$/.test(day)&&day<=date)days.set(day,(days.get(day)||0)+seconds);};
    for(const row of Array.isArray(data.study_history)?data.study_history:[])add(row.date,Math.round(positive(row.hours)*3600));
    for(const row of Array.isArray(data.manual_reports)?data.manual_reports:[]){if(row.status==='missed')continue;const seconds=Math.round(positive(row.minutes)*60);add(row.date,seconds);if(row.date<=date)subjects.set(String(row.subject||'نامشخص').slice(0,100),(subjects.get(row.subject)||0)+seconds);}
    const recent=[...days].sort(([a],[b])=>b.localeCompare(a)).slice(0,30).map(([date,seconds])=>({date,...duration(seconds)}));
    const tasks=(Array.isArray(data.schedule)?data.schedule:[]).slice(0,7).map((day,index)=>({dayIndex:index,tasks:(Array.isArray(day.tasks)?day.tasks:[]).slice(0,20).map(t=>({subject:String(t.subject||'').slice(0,100),status:t.status||'pending',estimatedMinutes:positive(t.estimatedMinutes)}))}));
    return {today:date,todayStudy:duration(days.get(date)||0),totalStudy:duration([...days.values()].reduce((a,b)=>a+b,0)),recentDays:recent,manualSubjectTotals:[...subjects].slice(0,30).map(([subject,s])=>({subject,...duration(s)})),tasks,hasStudyData:days.size>0,limitations:'زمان تایمر و گزارش دستی جدا ثبت می‌شوند؛ ثبت دوباره یک مطالعه ممکن است مجموع را زیاد کند. تفکیک درس فقط از گزارش دستی است. برنامه هفتگی فعلاً تاریخ مستقل ندارد.'};
};
