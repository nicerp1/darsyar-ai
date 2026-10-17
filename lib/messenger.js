const {db,getSession,getDataValue,findStudentAdvisor,getLinkedStudents,crypto}=require('../api/_supabase');
const {notify}=require('../api/_notifications');
const enc=encodeURIComponent;
const pair=(a,b)=>crypto.createHash('sha256').update(JSON.stringify([a,b].sort())).digest('hex').slice(0,24);
const put=rows=>db('app_data?on_conflict=username,key',{method:'POST',prefer:'resolution=merge-duplicates,return=minimal',body:JSON.stringify(rows.map(r=>({...r,updated_at:new Date().toISOString()})))});
const person=async username=>(await db(`profiles?username=eq.${enc(username)}&select=username,name,avatar`))?.[0];
const fail=(res,status,error)=>res.status(status).json({error});
const messageKey=(thread,id)=>`im_m_${thread}_${id}`;
const uuid=v=>/^[a-f0-9-]{36}$/.test(String(v));
async function threadRows(actor,peer,hash,offset=0,cursor=null){
    const names=[...new Set([actor.username,peer].filter(n=>!n.startsWith('~')))];
    const after=cursor?`&or=(updated_at.gt.${enc(cursor.at)},and(updated_at.eq.${enc(cursor.at)},key.gt.${enc(cursor.key)}))`:'';
    return db(`app_data?username=in.(${names.map(enc).join(',')})&key=like.im_m_${hash}_*&select=key,value,updated_at&order=updated_at.${cursor?'asc':'desc'},key.${cursor?'asc':'desc'}&limit=51&offset=${cursor?0:offset}${after}`);
}
function validateFile(file){
    if(!file)return null;
    if(typeof file.data!=='string'||file.data.length>2800000||!/^([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(file.data))throw Error('فایل معتبر نیست.');
    const bytes=Buffer.from(file.data,'base64');if(!bytes.length||bytes.length>2*1024*1024)throw Error('حداکثر حجم فایل ۲ مگابایت است.');
    const name=String(file.name||'file').replace(/[\x00-\x1f\x7f/\\]/g,'_').slice(0,100);
    const ext=name.split('.').pop().toLowerCase();let type='application/octet-stream';
    if(ext==='jpg'||ext==='jpeg'){if(bytes[0]!==255||bytes[1]!==216||bytes[2]!==255)throw Error('تصویر JPG معتبر نیست.');type='image/jpeg';}
    else if(ext==='png'){if(bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw Error('تصویر PNG معتبر نیست.');type='image/png';}
    else if(ext==='webp'){if(bytes.toString('ascii',0,4)!=='RIFF'||bytes.toString('ascii',8,12)!=='WEBP')throw Error('تصویر WebP معتبر نیست.');type='image/webp';}
    else if(ext==='pdf'){if(bytes.toString('ascii',0,5)!=='%PDF-')throw Error('فایل PDF معتبر نیست.');type='application/pdf';}
    else if(['docx','xlsx','pptx','zip'].includes(ext)){if(bytes[0]!==0x50||bytes[1]!==0x4b)throw Error('ساختار فایل معتبر نیست.');}
    else if(ext==='txt')type='text/plain';
    else if(file.voice===true&&['webm','ogg','m4a','mp4'].includes(ext)){
        if(!Number.isFinite(file.duration)||file.duration<=0||file.duration>181)throw Error('ویس باید حداکثر ۳ دقیقه باشد.');
        if(ext==='webm'&&bytes.subarray(0,4).toString('hex')==='1a45dfa3')type='audio/webm';
        else if(ext==='ogg'&&bytes.toString('ascii',0,4)==='OggS')type='audio/ogg';
        else if(['m4a','mp4'].includes(ext)&&bytes.toString('ascii',4,8)==='ftyp')type='audio/mp4';
        else throw Error('ساختار فایل صوتی معتبر نیست.');
    }
    else throw Error('فقط عکس، PDF، متن، Word، Excel، PowerPoint یا ZIP مجاز است.');
    return {name,type,size:bytes.length,data:file.data,...(type.startsWith('audio/')?{voice:true,duration:Math.round(file.duration)}:{})};
}
module.exports=async(req,res)=>{
    res.setHeader('Cache-Control','private, no-store');
    try{
        const actor=await getSession(req,'username,name');if(!actor)return fail(res,401,'ابتدا وارد حساب شوید.');
        const input=req.method==='GET'?req.query||{}:req.body||{};
        if(req.method==='GET'&&input.action==='events')return require('./messenger-events')(req,res,actor,db);
        if(req.method==='GET'&&input.action==='list'){
            const [rows,advisor,linked,readRows]=await Promise.all([
                db(`app_data?username=eq.${enc(actor.username)}&key=like.im_thread_*&select=value&order=updated_at.desc&limit=100`),
                findStudentAdvisor(actor.username),getLinkedStudents(actor.username),
                db(`app_data?username=eq.${enc(actor.username)}&key=like.im_read_*&select=key,value`)
            ]);
            const reads=Object.fromEntries((readRows||[]).map(r=>[r.key,r.value]));
            const peers=new Map((rows||[]).map(r=>[r.value.peer,r.value]));
            if(advisor&&!peers.has(advisor.username))peers.set(advisor.username,{peer:advisor.username});
            for(const name of linked.slice(0,100))if(!peers.has(name))peers.set(name,{peer:name});
            peers.set('~saved',{...peers.get('~saved'),peer:'~saved'});peers.set('~ai',{...peers.get('~ai'),peer:'~ai'});
            const names=[...peers.keys()].filter(n=>/^[a-z0-9_.-]{3,32}$/.test(n));
            const profiles=names.length?await db(`profiles?username=in.(${names.map(enc).join(',')})&select=username,name,avatar`):[];
            const people=new Map((profiles||[]).map(p=>[p.username,p]));
            const threads=(await Promise.all([...peers.values()].map(async t=>{
                const p=t.peer==='~saved'?{name:'پیام‌های ذخیره‌شده',username:'~saved'}:t.peer==='~ai'?{name:'دستیار درسیار',username:'~ai'}:people.get(t.peer);
                if(!p)return null;const hash=pair(actor.username,t.peer==='~saved'?actor.username:t.peer);
                return {...t,person:p,pinned:t.peer===advisor?.username,unread:Boolean(t.sender&&t.sender!==actor.username&&t.at>(reads[`im_read_${hash}`]||''))};
            }))).filter(Boolean);
            return res.status(200).json({threads});
        }
        let peer=String(input.peer||'').trim().toLowerCase();
        if(!['~saved','~ai'].includes(peer))peer=peer.replace(/^@/,'');
        if(peer===actor.username)peer='~saved';
        if(!['~saved','~ai'].includes(peer)&&!/^[a-z0-9_.-]{3,32}$/.test(peer))return fail(res,400,'نام کاربری معتبر وارد کنید.');
        const [other,accessRows]=await Promise.all([
            peer==='~saved'?actor:peer==='~ai'?{username:'~ai',name:'دستیار درسیار'}:person(peer),
            peer.startsWith('~')?[]:db(`app_data?username=in.(${enc(actor.username)},${enc(peer)})&key=in.(linked_students,chat_blocked,im_block_${enc(peer)},im_block_${enc(actor.username)})&select=username,key,value`)
        ]);
        if(!other)return fail(res,404,'کاربری با این نام کاربری پیدا نشد.');
        const hash=pair(actor.username,peer==='~saved'?actor.username:peer);
        const access=new Map((accessRows||[]).map(row=>[`${row.username}:${row.key}`,row.value]));
        let ownBlock=access.get(`${actor.username}:im_block_${peer}`)||false;
        const peerBlock=access.get(`${peer}:im_block_${actor.username}`)||false;
        let student=null,legacyBlock=null;
        if(!peer.startsWith('~')&&!(req.method==='GET'&&input.file)){
            // Only inspect the two participants, never scan all counselors' student lists.
            const mine=access.get(`${actor.username}:linked_students`),theirs=access.get(`${peer}:linked_students`);
            student=Array.isArray(theirs)&&theirs.includes(actor.username)?actor.username:Array.isArray(mine)&&mine.includes(peer)?peer:null;
            if(student)legacyBlock=access.get(`${student}:chat_blocked`)||null;
            if(legacyBlock?.by===actor.username)ownBlock=true;
        }
        if(req.method==='GET'&&input.file){
            if(!uuid(input.file))return fail(res,400,'فایل معتبر نیست.');
            const rows=await db(`app_data?username=in.(${[...new Set([actor.username,other.username].filter(n=>!n.startsWith('~')))].map(enc).join(',')})&key=eq.im_file_${hash}_${input.file}&select=value`);
            const file=rows?.[0]?.value;if(!file)return fail(res,404,'فایل پیدا نشد یا دسترسی ندارید.');
            res.setHeader('Content-Type',file.type);res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Content-Security-Policy',"default-src 'none'; sandbox");
            res.setHeader('Content-Disposition',`${/^(image|audio)\//.test(file.type)?'inline':'attachment'}; filename="attachment"; filename*=UTF-8''${enc(file.name)}`);
            const bytes=file.storagePath?await require('./chat-files').read(file):Buffer.from(file.data,'base64');
            res.setHeader('Accept-Ranges','bytes');
            const range=req.headers?.range;
            if(range){const match=/^bytes=(\d*)-(\d*)$/.exec(range);let start,end;
                if(match){start=match[1]?Number(match[1]):Math.max(0,bytes.length-Number(match[2]));end=match[1]&&match[2]?Math.min(bytes.length-1,Number(match[2])):bytes.length-1;}
                if(!match||!Number.isFinite(start)||start>end||start>=bytes.length){res.setHeader('Content-Range',`bytes */${bytes.length}`);return res.status(416).send('');}
                res.setHeader('Content-Range',`bytes ${start}-${end}/${bytes.length}`);res.setHeader('Content-Length',end-start+1);return res.status(206).send(bytes.subarray(start,end+1));
            }
            res.setHeader('Content-Length',bytes.length);return res.status(200).send(bytes);
        }
        if(req.method==='GET'&&input.action==='reportOptions'){
            if(student!==actor.username&&peer!=='~saved')return fail(res,403,'گزارش را فقط به مشاور خودت یا پیام‌های ذخیره‌شده بفرست.');
            const [schedule,reports,records]=await Promise.all(['schedule','manual_reports','focus_records'].map(key=>getDataValue(actor.username,key,[])));
            return res.status(200).json({schedule,reports,records});
        }
        if(req.method==='GET'){
            const offset=Math.min(10000,Math.max(0,parseInt(input.offset,10)||0));
            const cursor=input.afterAt&&/^\d{4}-\d{2}-\d{2}T[\d:.+-]+Z?$/.test(input.afterAt)&&Number.isFinite(Date.parse(input.afterAt))&&new RegExp(`^im_m_${hash}_[a-z0-9-]+$`).test(input.afterKey||'')?{at:input.afterAt,key:input.afterKey}:null;
            const rows=await threadRows(actor,other.username,hash,offset,cursor);
            const page=rows.slice(0,50),edge=cursor?page.at(-1):page[0];
            const messages=page.map(r=>r.value);if(!cursor)messages.reverse();let legacy=[];
            if(!offset&&!input.light&&!peer.startsWith('~')){
                if(student){const old=await getDataValue(student,'advisor_chat',[]);const advisorName=student===actor.username?other.name:actor.name;legacy=(Array.isArray(old)?old:[]).filter(m=>m.senderUsername?[actor.username,peer].includes(m.senderUsername):(m.sender==='student'||m.senderName===advisorName)).map(m=>({...m,id:`legacy:${m.id}`,sender:m.senderUsername||(m.sender==='student'?student:(student===actor.username?peer:actor.username)),legacy:true}));}
            }
            const readAt=peer.startsWith('~')?'':await getDataValue(peer,`im_read_${hash}`,'');
            return res.status(200).json({peer:{username:other.username,name:other.name,avatar:other.avatar},messages,legacy,canReport:student===actor.username||peer==='~saved',canReview:student===peer,hasMore:rows.length>50,moreChanges:Boolean(cursor&&rows.length>50),cursor:edge?{at:edge.updated_at,key:edge.key}:cursor,blocked:Boolean(ownBlock||peerBlock||legacyBlock),ownBlock:Boolean(ownBlock),readAt});
        }
        if(req.method!=='POST')return fail(res,405,'درخواست معتبر نیست.');
        const action=input.action||'send';
        if(action==='read'){
            const at=String(input.at||'');if(!Number.isFinite(Date.parse(at))||Date.parse(at)>Date.now()+1000)return fail(res,400,'زمان معتبر نیست.');
            const old=await getDataValue(actor.username,`im_read_${hash}`,'');
            if(old<at)await put([{username:actor.username,key:`im_read_${hash}`,value:at},...(!peer.startsWith('~')?[{username:peer,key:`im_signal_${hash}`,value:{at:new Date().toISOString()}}]:[])]);return res.status(200).json({ok:true});
        }
        if(action==='reviewStudyReport'){
            if(student!==peer||ownBlock||peerBlock||legacyBlock)return fail(res,403,'فقط مشاور فعلی می‌تواند این گزارش را بررسی کند.');
            if(!uuid(input.id))return fail(res,400,'گزارش معتبر نیست.');
            const key=messageKey(hash,input.id),message=await getDataValue(peer,key,null);
            if(!message?.studyReport||message.sender!==peer)return fail(res,404,'گزارش پیدا نشد.');
            message.studyReport.review={by:actor.username,at:new Date().toISOString(),feedback:String(input.feedback||'').trim().slice(0,1000)};
            await put([{username:peer,key,value:message},{username:peer,key:`im_signal_${hash}`,value:{at:new Date().toISOString()}},{username:actor.username,key:`im_signal_${hash}`,value:{at:new Date().toISOString()}}]);
            await notify(peer,'messenger','مشاور روی گزارش مطالعه‌ات بازخورد داد.',actor.username).catch(()=>{});
            return res.status(200).json({ok:true,message});
        }
        if(action==='block'&&!peer.startsWith('~')){const writes=[{username:actor.username,key:`im_block_${peer}`,value:input.blocked===true}];if(input.blocked===false&&legacyBlock?.by===actor.username)writes.push({username:student,key:'chat_blocked',value:null});await put(writes);return res.status(200).json({ok:true});}
        if(action==='report'){
            if(!uuid(input.id))return fail(res,400,'پیام معتبر نیست.');
            const rows=await db(`app_data?username=in.(${actor.username},${other.username})&key=eq.${messageKey(hash,input.id)}&select=value`);
            if(!rows?.[0])return fail(res,404,'پیام پیدا نشد.');
            await put([{username:actor.username,key:`im_report_${crypto.randomUUID()}`,value:{peer,message:rows[0].value,reason:String(input.reason||'محتوای نامناسب').slice(0,300),at:new Date().toISOString()}}]);return res.status(200).json({ok:true});
        }
        if(!['send','retryAI','studyReport'].includes(action))return fail(res,400,'درخواست معتبر نیست.');
        if(ownBlock||peerBlock||legacyBlock)return fail(res,403,'این گفتگو مسدود شده است.');
        if(!uuid(input.id))return fail(res,400,'شناسه پیام معتبر نیست.');
        const key=messageKey(hash,input.id),existing=await getDataValue(actor.username,key,null);
        let message=existing,reportData={};
        if(!existing){
            const recent=await db(`app_data?username=eq.${enc(actor.username)}&key=like.im_m_*&updated_at=gt.${enc(new Date(Date.now()-60000).toISOString())}&select=key&limit=31`);
            if(recent.length>=30)return fail(res,429,'پیام‌ها را کمی آهسته‌تر بفرست؛ یک دقیقه بعد دوباره تلاش کن.');
            if(action==='retryAI')return fail(res,404,'پیام اولیه پیدا نشد.');
            const text=String(input.text||'').trim();if(text.length>4000)return fail(res,400,'متن پیام باید کمتر از ۴۰۰۰ نویسه باشد.');
            let file;try{file=validateFile(input.file);}catch(e){return fail(res,400,e.message);}
            if(peer==='~ai'&&file)return fail(res,400,'دستیار در این بخش فقط پیام متنی می‌پذیرد.');
            if(!text&&!file&&action!=='studyReport')return fail(res,400,'متن یا فایل را انتخاب کنید.');
            if(input.replyTo&&!uuid(input.replyTo))return fail(res,400,'پیام پاسخ معتبر نیست.');
            let study=null;
            if(action==='studyReport'){
                if(student!==actor.username&&peer!=='~saved')return fail(res,403,'گزارش را فقط برای مشاور خودت یا در پیام‌های ذخیره‌شده ثبت کن.');
                try{study=await require('./chat-study-report')(actor.username,input.id,input.report||{});}catch(e){return fail(res,400,e.message);}
                reportData=Object.fromEntries(study.writes.map(r=>[r.key,r.value]));
            }
            const createdAt=new Date().toISOString();
            message={id:input.id,sender:actor.username,text,createdAt,replyTo:input.replyTo||null,...(study?{studyReport:study.report}:{}),...(file?{file:{id:input.id,name:file.name,type:file.type,size:file.size,...(file.voice?{voice:true,duration:file.duration}:{})}}:{})};
            const summary={peer,sender:actor.username,at:createdAt,preview:study?`گزارش مطالعه: ${study.report.subject}`:text.slice(0,100)||(file?.voice?'پیام صوتی':file?'فایل پیوست':'')};
            const writes=[{username:actor.username,key,value:message},{username:actor.username,key:`im_thread_${hash}`,value:summary}];
            if(study)writes.push(...study.writes);
            if(!peer.startsWith('~'))writes.push({username:peer,key:`im_thread_${hash}`,value:{...summary,peer:actor.username}});
            if(file)writes.push({username:actor.username,key:`im_file_${hash}_${input.id}`,value:await require('./chat-files').save(actor.username,hash,input.id,file)});
            await put(writes);
            if(!peer.startsWith('~'))await notify(peer,'messenger',`پیام جدید از ${actor.name||actor.username}`,actor.username).catch(e=>console.error('message notice failed',e));
        }
        if(peer==='~ai'){
            const answerKey=`im_m_${hash}_bot-${input.id}`;
            const answer=await getDataValue(actor.username,answerKey,null);
            if(answer)return res.status(200).json({ok:true,message,answer});
            const recent=(await threadRows(actor,'~ai',hash)).slice(0,10).reverse().map(r=>({role:r.value.sender==='~ai'?'assistant':'user',content:r.value.text}));
            let status=200,result;
            await require('../api/ai')({...req,method:'POST',body:{mode:'messenger',messages:recent,max_tokens:320}},{status(n){status=n;return this;},json(p){result=p;return this;}});
            const content=result?.choices?.[0]?.message?.content;
            if(status!==200||typeof content!=='string'||!content.trim())return res.status(200).json({ok:true,message,aiError:'پیامت ذخیره شد؛ دستیار فعلاً پاسخ نداد. دوباره تلاش کن.'});
            const reply={id:`bot-${input.id}`,sender:'~ai',text:content.slice(0,3000),createdAt:new Date().toISOString()};
            await put([{username:actor.username,key:answerKey,value:reply},{username:actor.username,key:`im_thread_${hash}`,value:{peer:'~ai',sender:'~ai',at:reply.createdAt,preview:reply.text.slice(0,100)}}]);
            return res.status(200).json({ok:true,message,answer:reply});
        }
        if(existing&&action==='studyReport'){
            const [reports,schedule]=await Promise.all(['manual_reports','schedule'].map(key=>getDataValue(actor.username,key,[])));
            reportData={manual_reports:reports,schedule};
        }
        return res.status(200).json({ok:true,message,data:reportData});
    }catch(error){console.error('messenger failed',error);return fail(res,500,'ارتباط برقرار نشد؛ دوباره تلاش کنید.');}
};
