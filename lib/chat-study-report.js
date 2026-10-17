const {getDataValue}=require('../api/_supabase');
const validDate=d=>/^\d{4}-\d{2}-\d{2}$/.test(d||'')&&Number.isFinite(Date.parse(d))&&new Date(d).toISOString().slice(0,10)===d;
module.exports=async function prepare(username,id,input){
    const writes=[],reports=await getDataValue(username,'manual_reports',[]);
    if(input.source==='existing'){
        const report=reports.find(r=>r.id===input.reportId);if(!report)throw Error('گزارش انتخاب‌شده پیدا نشد.');
        return {report:{...report,source:'manual'},writes};
    }
    if(input.source==='timer'){
        const ids=[...new Set(Array.isArray(input.recordIds)?input.recordIds:[])].slice(0,100);
        const records=await getDataValue(username,'focus_records',[]),selected=records.filter(r=>ids.includes(r.id)&&Number.isFinite(r.seconds)&&r.seconds>0);
        if(!ids.length||selected.length!==ids.length)throw Error('زمان‌های ثبت‌شده معتبر نیستند.');
        const subjects=new Set(selected.map(r=>r.subject));if(subjects.size!==1)throw Error('زمان‌های مربوط به یک درس را انتخاب کن.');
        const dates=selected.map(r=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tehran',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(r.endedAt)));
        if(new Set(dates).size!==1)throw Error('زمان‌های مربوط به یک روز را انتخاب کن.');
        const seconds=selected.reduce((n,r)=>n+r.seconds,0);
        return {report:{id,source:'timer',recordIds:ids,subject:selected[0].subject,seconds,minutes:seconds/60,date:dates[0],status:'completed',notes:String(input.notes||'').slice(0,500)},writes};
    }
    if(input.source!=='manual')throw Error('نوع گزارش معتبر نیست.');
    const existing=reports.find(r=>r.id===id);if(existing)return {report:existing,writes};
    const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tehran',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
    const schedule=await getDataValue(username,'schedule',[]);
    const task=input.taskId?schedule.flatMap(d=>d.tasks||[]).find(t=>t.id===input.taskId):null;
    if(input.taskId&&!task)throw Error('تسک تغییر کرده است؛ فرم را دوباره باز کن.');
    const subject=String(task?.subject||input.subject||'').trim().slice(0,100),status=input.status;
    if(!subject||!validDate(input.date)||input.date>today||!['completed','partial','missed'].includes(status))throw Error('درس، تاریخ و وضعیت گزارش را درست وارد کن.');
    const time=t=>/^([01]\d|2[0-3]):[0-5]\d$/.test(t||''),mins=t=>Number(t.slice(0,2))*60+Number(t.slice(3));
    if(status!=='missed'&&(!time(input.start)||!time(input.end)||mins(input.end)<=mins(input.start)))throw Error('ساعت پایان باید پس از شروع، در همان روز باشد.');
    const testCount=input.testCount===''||input.testCount==null?null:Number(input.testCount);
    if(testCount!==null&&(!Number.isInteger(testCount)||testCount<0||testCount>5000))throw Error('تعداد تست معتبر نیست.');
    const report={id,source:'manual',date:input.date,subject,start:status==='missed'?'':input.start,end:status==='missed'?'':input.end,minutes:status==='missed'?0:mins(input.end)-mins(input.start),status,testCount,notes:String(input.notes||'').slice(0,500),createdAt:new Date().toISOString(),...(task?{taskId:task.id}:{})};
    writes.push({username,key:'manual_reports',value:[...reports,report]});
    if(task){task.status=status;writes.push({username,key:'schedule',value:schedule});}
    return {report,writes};
};
