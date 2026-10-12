const {db,getSession,getDataValue,crypto}=require('./_supabase');
module.exports=async(req,res)=>{
    try{
        const actor=await getSession(req);if(!actor)return res.status(401).json({error:'ابتدا وارد حساب شوید.'});
        if(req.method!=='POST')return res.status(405).json({error:'درخواست معتبر نیست.'});
        const body=req.body||{},schedule=await getDataValue(actor.username,'schedule',[]);
        const task=body.taskId ? schedule[Number(body.dayIndex)]?.tasks?.find((t,index)=>(t.id||`task-${Number(body.dayIndex)}-${index}`)===body.taskId) : null;
        if(task&&!task.id)task.id=body.taskId;
        if(body.taskId&&!task)return res.status(409).json({error:'تسک تغییر کرده است؛ برنامه را دوباره باز کنید.'});
        if(task?.status==='completed')return res.status(409).json({error:'این تسک قبلاً تکمیل شده است.'});
        const reports=await getDataValue(actor.username,'manual_reports',[]);
        const completions=await getDataValue(actor.username,'task_completions',[]);
        const writes=[];let proof;
        if(body.source==='timer'){
            if(!task)return res.status(400).json({error:'ابتدا تسک را انتخاب کنید.'});
            const records=await getDataValue(actor.username,'focus_records',[]);
            const used=new Set(completions.flatMap(c=>c.recordIds||[]));
            const ids=Array.isArray(body.recordIds)?[...new Set(body.recordIds)].slice(0,100):[];
            const selected=records.filter(r=>ids.includes(r.id)&&!used.has(r.id)&&r.seconds>0&&(r.taskId===task.id||(!r.taskId&&r.subject===task.subject)));
            if(!ids.length||selected.length!==ids.length)return res.status(400).json({error:'زمان ثبت‌شدهٔ قابل استفاده برای این تسک وجود ندارد.'});
            proof={source:'timer',recordIds:ids,seconds:selected.reduce((s,r)=>s+r.seconds,0)};
        }else{
            const {date,start,end}=body,subject=String(task?.subject||body.subject||'').trim().slice(0,100);
            const validDate=typeof date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(date)&&!Number.isNaN(Date.parse(date))&&new Date(date).toISOString().slice(0,10)===date;
            if(!validDate || date>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tehran',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()) || !subject || !/^([01]\d|2[0-3]):[0-5]\d$/.test(start||'') || !/^([01]\d|2[0-3]):[0-5]\d$/.test(end||''))return res.status(400).json({error:'تاریخ و ساعت گزارش معتبر نیست.'});
            const mins=t=>Number(t.slice(0,2))*60+Number(t.slice(3));const minutes=mins(end)-mins(start);
            if(minutes<=0)return res.status(400).json({error:'ساعت پایان باید بعد از شروع، در همان روز باشد.'});
            const report={id:crypto.randomUUID(),date,subject,start,end,minutes,status:task?'completed':(['completed','partial','missed'].includes(body.status)?body.status:'completed'),notes:String(body.notes||'').slice(0,500),createdAt:new Date().toISOString(),...(task?{taskId:task.id}:{})};
            reports.push(report);writes.push({key:'manual_reports',value:reports});proof={source:'manual',reportId:report.id};
        }
        if(task){task.status='completed';completions.push({id:crypto.randomUUID(),taskId:task.id,dayIndex:Number(body.dayIndex),...proof,createdAt:new Date().toISOString()});writes.push({key:'schedule',value:schedule},{key:'task_completions',value:completions});}
        await db('app_data?on_conflict=username,key',{method:'POST',prefer:'resolution=merge-duplicates,return=minimal',body:JSON.stringify(writes.map(row=>({...row,username:actor.username,updated_at:new Date().toISOString()})))});
        return res.status(200).json({ok:true,data:Object.fromEntries(writes.map(r=>[r.key,r.value]))});
    }catch(error){console.error('study progress failed',error);res.status(500).json({error:'گزارش ذخیره نشد؛ دوباره تلاش کنید.'});}
};
