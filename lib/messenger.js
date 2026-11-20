const {db,getSession,getDataValue,findStudentAdvisor,getLinkedStudents,crypto}=require('../api/_supabase');
const {notify}=require('../api/_notifications');
const enc=encodeURIComponent;
const pair=(a,b)=>crypto.createHash('sha256').update(JSON.stringify([a,b].sort())).digest('hex').slice(0,24);
const put=rows=>db('app_data?on_conflict=username,key',{method:'POST',prefer:'resolution=merge-duplicates,return=minimal',body:JSON.stringify(rows.map(r=>({...r,updated_at:new Date().toISOString()})))});
const person=async username=>(await db(`profiles?username=eq.${enc(username)}&select=username,name,avatar`))?.[0];
const fail=(res,status,error)=>res.status(status).json({error});
const messageKey=(thread,id)=>`im_m_${thread}_${id}`;
const uuid=v=>/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(String(v));
const reactions = new Set(['👍','❤️','😂','🔥','👏','😮']);
const wallpapers = new Set(['mist','plain','dusk']);
const waveform = values => Array.isArray(values)
    ? values.slice(0,48).filter(Number.isFinite).map(v=>Math.max(0,Math.min(100,Math.round(v))))
    : [];
const searchTerm = value => String(value||'').trim().replace(/[%*_\\]/g,'').slice(0,100);
const signals = (actor, peer, hash) => [...new Set([actor, peer].filter(n => !n.startsWith('~')))]
    .map(username => ({username,key:`im_signal_${hash}`,value:{at:new Date().toISOString()}}));
async function threadRows(actor,peer,hash,offset=0,cursor=null,before=null){
    const names=[...new Set([actor.username,peer].filter(n=>!n.startsWith('~')))];
    const timestamp=cursor?'updated_at':'value->>createdAt';
    const edge=cursor||before;
    const direction=cursor?'gt':'lt';
    const boundary=edge?`&or=(${timestamp}.${direction}.${enc(edge.at)},and(${timestamp}.eq.${enc(edge.at)},key.${direction}.${enc(edge.key)}))`:'';
    const order=cursor?'asc':'desc';
    return db(`app_data?username=in.(${names.map(enc).join(',')})&key=like.im_m_${hash}_*&select=key,value,updated_at&order=${timestamp}.${order},key.${order}&limit=51&offset=${edge?0:offset}${boundary}`);
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
    else if(ext==='gif' && /^GIF8[79]a$/.test(bytes.toString('ascii',0,6)))type='image/gif';
    else if(file.voice!==true&&ext==='mp4'&&bytes.toString('ascii',4,8)==='ftyp')type='video/mp4';
    else if(file.voice!==true&&ext==='webm'&&bytes.subarray(0,4).toString('hex')==='1a45dfa3')type='video/webm';
    else if(file.voice===true&&['webm','ogg','m4a','mp4'].includes(ext)){
        if(!Number.isFinite(file.duration)||file.duration<=0||file.duration>181)throw Error('ویس باید حداکثر ۳ دقیقه باشد.');
        if(ext==='webm'&&bytes.subarray(0,4).toString('hex')==='1a45dfa3')type='audio/webm';
        else if(ext==='ogg'&&bytes.toString('ascii',0,4)==='OggS')type='audio/ogg';
        else if(['m4a','mp4'].includes(ext)&&bytes.toString('ascii',4,8)==='ftyp')type='audio/mp4';
        else throw Error('ساختار فایل صوتی معتبر نیست.');
    }
    else throw Error('فقط عکس، PDF، متن، Word، Excel، PowerPoint یا ZIP مجاز است.');
    return {name,type,size:bytes.length,data:file.data,...(type==='image/png'&&file.sticker===true?{sticker:true}:{}),...(type.startsWith('audio/')?{voice:true,duration:Math.round(file.duration),waveform:waveform(file.waveform)}:{})};
}
async function serveFile(req,res,file){
    res.setHeader('Content-Type',file.type);res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Content-Security-Policy',"default-src 'none'; sandbox");
    res.setHeader('Content-Disposition',`${/^(image|audio|video)\//.test(file.type)?'inline':'attachment'}; filename="attachment"; filename*=UTF-8''${enc(file.name)}`);
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
const groups=require('./messenger-groups')({db,put,getDataValue,crypto,uuid,validateFile,searchTerm,reactions,serveFile});
module.exports=async(req,res)=>{
    res.setHeader('Cache-Control','private, no-store');
    try{
        const actor=await getSession(req,'username,name');if(!actor)return fail(res,401,'ابتدا وارد حساب شوید.');
        const input=req.method==='GET'?req.query||{}:req.body||{};
        if(input.action==='createGroup'||String(input.peer||'').startsWith('g:'))return await groups.handle(req,res,actor,input);
        if(req.method==='GET'&&input.action==='events')return require('./messenger-events')(req,res,actor,db);
        if(req.method==='GET'&&['list','globalSearch'].includes(input.action)){
            const [rows,advisor,linked,readRows,muteRows,prefsRows]=await Promise.all([
                db(`app_data?username=eq.${enc(actor.username)}&key=like.im_thread_*&select=value&order=updated_at.desc&limit=100`),
                findStudentAdvisor(actor.username),getLinkedStudents(actor.username),
                db(`app_data?username=eq.${enc(actor.username)}&key=like.im_read_*&select=key,value`),
                db(`app_data?username=eq.${enc(actor.username)}&key=like.im_mute_*&select=key,value`),
                db(`app_data?username=eq.${enc(actor.username)}&key=like.im_pref_*&select=key,value`)
            ]);
            const reads=Object.fromEntries((readRows||[]).map(r=>[r.key,r.value]));
            const prefs=Object.fromEntries((prefsRows||[]).map(r=>[r.key,r.value]));
            const muted=new Set((muteRows||[]).filter(r=>r.value===true).map(r=>r.key.slice('im_mute_'.length)));
            const peers=new Map((rows||[]).map(r=>[r.value.peer,r.value]));
            if(advisor&&!peers.has(advisor.username))peers.set(advisor.username,{peer:advisor.username});
            for(const name of linked.slice(0,100))if(!peers.has(name))peers.set(name,{peer:name});
            peers.set('~saved',{...peers.get('~saved'),peer:'~saved'});peers.set('~ai',{...peers.get('~ai'),peer:'~ai'});
            if(input.action==='globalSearch'){
                const term=searchTerm(input.q);
                if(term.length<2)return res.status(200).json({messages:[]});
                const pairs=new Map([...peers.keys()]
                    .filter(p=>['~saved','~ai'].includes(p)||/^[a-z0-9_.-]{3,32}$/.test(p))
                    .map(p=>[pair(actor.username,p==='~saved'?actor.username:p),p]));
                const scopes=[...pairs.keys()].map(hash=>`key.like.im_m_${hash}_*`);
                const pages=await Promise.all(Array.from({length:Math.ceil(scopes.length/30)},(_,i)=>
                    db(`app_data?or=(${scopes.slice(i*30,i*30+30).join(',')})&value->>text=ilike.${enc('*'+term+'*')}&select=key,username,value&order=updated_at.desc&limit=30`)));
                const messages=pages.flat().flatMap(row=>{
                    const peer=pairs.get(row.key?.split('_')[2]);
                    if(!peer||row.value?.deleted||![actor.username,peer].includes(row.username))return [];
                    return [{...row.value,peer}];
                }).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,50);
                return res.status(200).json({messages});
            }
            const names=[...peers.keys()].filter(n=>/^[a-z0-9_.-]{3,32}$/.test(n));
            const profiles=names.length?await db(`profiles?username=in.(${names.map(enc).join(',')})&select=username,name,avatar`):[];
            const people=new Map((profiles||[]).map(p=>[p.username,p]));
            const threads=(await Promise.all([...peers.values()].map(async t=>{
                const p=t.peer==='~saved'?{name:'پیام‌های ذخیره‌شده',username:'~saved'}:t.peer==='~ai'?{name:'هوش مصنوعی روند',username:'~ai'}:people.get(t.peer);
                if(!p)return null;const hash=pair(actor.username,t.peer==='~saved'?actor.username:t.peer);
                const settings=prefs[`im_pref_${hash}`]||{};
                return {...t,person:p,settings,pinned:settings.pinned??(t.peer===advisor?.username),muted:muted.has(hash),unread:Boolean(t.sender&&t.sender!==actor.username&&t.at>(reads[`im_read_${hash}`]||''))};
            }))).filter(Boolean);
            return res.status(200).json({threads:[...threads,...await groups.list(actor)]});
        }
        let peer=String(input.peer||'').trim().toLowerCase();
        if(!['~saved','~ai'].includes(peer))peer=peer.replace(/^@/,'');
        if(peer===actor.username)peer='~saved';
        if(!['~saved','~ai'].includes(peer)&&!/^[a-z0-9_.-]{3,32}$/.test(peer))return fail(res,400,'نام کاربری معتبر وارد کنید.');
        const hash=pair(actor.username,peer==='~saved'?actor.username:peer);
        const [other,accessRows]=await Promise.all([
            peer==='~saved'?actor:peer==='~ai'?{username:'~ai',name:'هوش مصنوعی روند'}:person(peer),
            peer.startsWith('~')?[]:db(`app_data?username=in.(${enc(actor.username)},${enc(peer)})&key=in.(linked_students,chat_blocked,im_block_${enc(peer)},im_block_${enc(actor.username)},im_read_${hash},im_delivered_${hash},im_mute_${hash})&select=username,key,value`)
        ]);
        if(!other)return fail(res,404,'کاربری با این نام کاربری پیدا نشد.');
        const participants=[...new Set([actor.username,other.username].filter(n=>!n.startsWith('~')))];
        const findMessage=async id=>(await db(`app_data?username=in.(${participants.map(enc).join(',')})&key=eq.${messageKey(hash,id)}&select=username,value`))?.[0]?.value;
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
            const linkedMessage=await findMessage(input.file);
            if(!linkedMessage?.file||linkedMessage.deleted)return fail(res,404,'فایل پیدا نشد یا دسترسی ندارید.');
            const rows=await db(`app_data?username=in.(${[...new Set([actor.username,other.username].filter(n=>!n.startsWith('~')))].map(enc).join(',')})&key=eq.im_file_${hash}_${input.file}&select=value`);
            const file=rows?.[0]?.value;if(!file)return fail(res,404,'فایل پیدا نشد یا دسترسی ندارید.');
            return await serveFile(req,res,file);
        }
        if(req.method==='GET'&&input.action==='reportOptions'){
            if(student!==actor.username&&peer!=='~saved')return fail(res,403,'گزارش را فقط به مشاور خودت یا پیام‌های ذخیره‌شده بفرست.');
            const [schedule,reports,records]=await Promise.all(['schedule','manual_reports','focus_records'].map(key=>getDataValue(actor.username,key,[])));
            return res.status(200).json({schedule,reports,records});
        }
        if(req.method==='GET'){
            if(input.action==='search'){
                const term=searchTerm(input.q);
                if(term.length<2)return res.status(200).json({messages:[]});
                const matches=await db(`app_data?username=in.(${participants.map(enc).join(',')})&key=like.im_m_${hash}_*&value->>text=ilike.${enc('*'+term+'*')}&select=value&order=updated_at.desc&limit=50`);
                return res.status(200).json({messages:matches.map(r=>r.value).filter(m=>!m.deleted)});
            }
            const offset=Math.min(10000,Math.max(0,parseInt(input.offset,10)||0));
            const validEdge=(at,key)=>typeof at==='string'&&/^\d{4}-\d{2}-\d{2}T[\d:.+-]+Z?$/.test(at)&&Number.isFinite(Date.parse(at))&&new RegExp(`^im_m_${hash}_[a-z0-9-]+$`).test(key||'')?{at,key}:null;
            const cursor=validEdge(input.afterAt,input.afterKey),before=validEdge(input.beforeAt,input.beforeKey);
            const latest=cursor||before||offset?[]:await db(`app_data?username=in.(${participants.map(enc).join(',')})&key=like.im_m_${hash}_*&select=key,updated_at&order=updated_at.desc,key.desc&limit=1`);
            const rows=await threadRows(actor,other.username,hash,offset,cursor,before);
            const page=rows.slice(0,50),edge=cursor?page.at(-1):latest[0],oldest=page.at(-1);
            const messages=page.map(r=>r.value);if(!cursor)messages.reverse();let legacy=[];
            if(!offset&&!before&&!input.light&&!peer.startsWith('~')){
                if(student){const old=await getDataValue(student,'advisor_chat',[]);const advisorName=student===actor.username?other.name:actor.name;legacy=(Array.isArray(old)?old:[]).filter(m=>m.senderUsername?[actor.username,peer].includes(m.senderUsername):(m.sender==='student'||m.senderName===advisorName)).map(m=>({...m,id:`legacy:${m.id}`,sender:m.senderUsername||(m.sender==='student'?student:(student===actor.username?peer:actor.username)),legacy:true}));}
            }
            const readAt=peer.startsWith('~')?'':access.get(`${peer}:im_read_${hash}`)||'';
            const [settings, mine, theirs, presence]=await Promise.all([
                getDataValue(actor.username,`im_pref_${hash}`,{}),
                getDataValue(actor.username,`im_react_${hash}`,{}),
                peer.startsWith('~')?{}:getDataValue(peer,`im_react_${hash}`,{}),
                peer.startsWith('~')||ownBlock||peerBlock||legacyBlock?{}:getDataValue(peer,`im_presence_${hash}`,{})
            ]);
            const ownReadAt=peer.startsWith('~')?'':access.get(`${actor.username}:im_read_${hash}`)||'';
            const deliveredAt=peer.startsWith('~')?'':access.get(`${peer}:im_delivered_${hash}`)||'';
            return res.status(200).json({peer:{username:other.username,name:other.name,avatar:other.avatar},messages,legacy,canReport:student===actor.username||peer==='~saved',canReview:student===peer,hasMore:rows.length>50,moreChanges:Boolean(cursor&&rows.length>50),cursor:edge?{at:edge.updated_at,key:edge.key}:cursor,olderCursor:!cursor&&oldest?{at:oldest.value.createdAt,key:oldest.key}:null,blocked:Boolean(ownBlock||peerBlock||legacyBlock),ownBlock:Boolean(ownBlock),muted:Boolean(access.get(`${actor.username}:im_mute_${hash}`)),readAt,deliveredAt,ownReadAt,settings,reactions:{mine,theirs},presence});
        }
        if(req.method!=='POST')return fail(res,405,'درخواست معتبر نیست.');
        const action=input.action||'send';
        if(action==='preferences'){
            const key=`im_pref_${hash}`;
            const settings={...await getDataValue(actor.username,key,{})};
            for(const flag of ['pinned','archived'])if(typeof input[flag]==='boolean')settings[flag]=input[flag];
            if(typeof input.folder==='string')settings.folder=input.folder.trim().slice(0,32);
            if(wallpapers.has(input.wallpaper))settings.wallpaper=input.wallpaper;
            if(input.messagePin===null)settings.messagePin=null;
            else if(uuid(input.messagePin)){
                const m=await findMessage(input.messagePin);
                if(!m||m.deleted)return fail(res,404,'پیام پیدا نشد.');
                settings.messagePin={id:m.id,text:m.text?.slice(0,120)||m.file?.name||'پیام'};
            }
            await put([{username:actor.username,key,value:settings}]);
            return res.status(200).json({settings});
        }
        if(action==='presence'){
            if(peer.startsWith('~')||ownBlock||peerBlock||legacyBlock)return res.status(200).json({ok:true});
            const key=`im_presence_${hash}`, now=Date.now();
            const previous=await getDataValue(actor.username,key,{});
            if(now-(previous.at||0)>=2000)await put([{username:actor.username,key,value:{at:now,typing:input.typing===true}},...signals(actor.username,peer,hash).filter(r=>r.username===peer)]);
            return res.status(200).json({ok:true});
        }
        if(['edit','delete','react'].includes(action)){
            if(ownBlock||peerBlock||legacyBlock)return fail(res,403,'این گفتگو مسدود شده است.');
            if(!uuid(input.id))return fail(res,400,'شناسه پیام معتبر نیست.');
            const key=messageKey(hash,input.id);
            const message=action==='react'?await findMessage(input.id):await getDataValue(actor.username,key,null);
            if(!message||message.deleted)return fail(res,404,'پیام پیدا نشد.');
            if(action==='react'){
                if(input.emoji!==null&&!reactions.has(input.emoji))return fail(res,400,'واکنش معتبر نیست.');
                const reactionKey=`im_react_${hash}`;
                const values={...await getDataValue(actor.username,reactionKey,{})};
                if(input.emoji===null)delete values[input.id];
                else values[input.id]=input.emoji;
                const bounded=Object.fromEntries(Object.entries(values).slice(-600));
                await put([{username:actor.username,key:reactionKey,value:bounded},...signals(actor.username,peer,hash)]);
                return res.status(200).json({reactions:bounded});
            }
            if(message.sender!==actor.username||message.studyReport)return fail(res,403,'این پیام قابل تغییر نیست.');
            const text=String(input.text||'').trim();
            if(action==='edit'&&((!text&&!message.file)||text.length>4000))return fail(res,400,'متن پیام معتبر نیست.');
            const changed=action==='delete'
                ? {id:message.id,sender:message.sender,createdAt:message.createdAt,deleted:true}
                : {...message,text,editedAt:new Date().toISOString()};
            const names=peer.startsWith('~')?[actor.username]:participants;
            const summaries=await Promise.all(names.map(async username=>{
                const threadKey=`im_thread_${hash}`;
                const summary=await getDataValue(username,threadKey,null);
                if(summary?.at!==message.createdAt||summary?.sender!==actor.username)return null;
                return {username,key:threadKey,value:{...summary,preview:changed.deleted?'پیام حذف شد':text.slice(0,100)||message.file?.name||''}};
            }));
            await put([{username:actor.username,key,value:changed},...summaries.filter(Boolean),...signals(actor.username,peer,hash)]);
            return res.status(200).json({message:changed});
        }
        if(action==='read'||action==='delivered'){
            const at=String(input.at||'');if(!Number.isFinite(Date.parse(at))||Date.parse(at)>Date.now()+1000)return fail(res,400,'زمان معتبر نیست.');
            const key=`im_${action}_${hash}`,old=await getDataValue(actor.username,key,'');
            if(old<at)await put([{username:actor.username,key,value:at},...(!peer.startsWith('~')?[{username:peer,key:`im_signal_${hash}`,value:{at:new Date().toISOString()}}]:[])]);
            if(action==='read'&&!peer.startsWith('~'))await require('../api/_notifications').markMessengerRead(actor.username,peer).catch(e=>console.error('message notice read failed',e));
            return res.status(200).json({ok:true});
        }
        if(action==='mute'&&!peer.startsWith('~')){await put([{username:actor.username,key:`im_mute_${hash}`,value:input.muted===true}]);return res.status(200).json({ok:true,muted:input.muted===true});}
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
        if(existing?.deleted)return fail(res,410,'این پیام حذف شده است.');
        let message=existing,reportData={};
        if(!existing){
            const recent=await db(`app_data?username=eq.${enc(actor.username)}&key=like.im_m_*&updated_at=gt.${enc(new Date(Date.now()-60000).toISOString())}&select=key&limit=31`);
            if(recent.length>=30)return fail(res,429,'پیام‌ها را کمی آهسته‌تر بفرست؛ یک دقیقه بعد دوباره تلاش کن.');
            if(action==='retryAI')return fail(res,404,'پیام اولیه پیدا نشد.');
            const text=String(input.text||'').trim();if(text.length>4000)return fail(res,400,'متن پیام باید کمتر از ۴۰۰۰ نویسه باشد.');
            let file;try{file=validateFile(input.file);}catch(e){return fail(res,400,e.message);}
            if(peer==='~ai'&&file)return fail(res,400,'دستیار در این بخش فقط پیام متنی می‌پذیرد.');
            if(!text&&!file&&action!=='studyReport')return fail(res,400,'متن یا فایل را انتخاب کنید.');
            if(input.replyTo){
                const reference=uuid(input.replyTo)?await findMessage(input.replyTo):null;
                if(!reference||reference.deleted)return fail(res,400,'پیام پاسخ معتبر نیست.');
            }
            let study=null;
            if(action==='studyReport'){
                if(student!==actor.username&&peer!=='~saved')return fail(res,403,'گزارش را فقط برای مشاور خودت یا در پیام‌های ذخیره‌شده ثبت کن.');
                try{study=await require('./chat-study-report')(actor.username,input.id,input.report||{});}catch(e){return fail(res,400,e.message);}
                reportData=Object.fromEntries(study.writes.map(r=>[r.key,r.value]));
            }
            const createdAt=new Date().toISOString();
            message={id:input.id,sender:actor.username,text,createdAt,replyTo:input.replyTo||null,...(study?{studyReport:study.report}:{}),...(file?{file:{id:input.id,name:file.name,type:file.type,size:file.size,...(file.voice?{voice:true,duration:file.duration,waveform:file.waveform}:{})}}:{})};
            if(file&&uuid(input.album))message.album=input.album;
            if(file?.sticker)message.file.sticker=true;
            if(input.forwarded===true)message.forwarded=true;
            const summary={peer,sender:actor.username,at:createdAt,preview:study?`گزارش مطالعه: ${study.report.subject}`:text.slice(0,100)||(file?.voice?'پیام صوتی':file?'فایل پیوست':'')};
            const writes=[{username:actor.username,key,value:message},{username:actor.username,key:`im_thread_${hash}`,value:summary}];
            if(study)writes.push(...study.writes);
            if(!peer.startsWith('~'))writes.push({username:peer,key:`im_thread_${hash}`,value:{...summary,peer:actor.username}});
            if(file)writes.push({username:actor.username,key:`im_file_${hash}_${input.id}`,value:await require('./chat-files').save(actor.username,hash,input.id,file)});
            await put(writes);
            const recipientMuted=!peer.startsWith('~')&&access.get(`${peer}:im_mute_${hash}`)===true;
            const alreadyRead=!peer.startsWith('~')&&(access.get(`${peer}:im_read_${hash}`)||'')>=createdAt;
            if(!peer.startsWith('~')&&!recipientMuted&&!alreadyRead)await notify(peer,'messenger',`پیام جدید از ${actor.name||actor.username}`,actor.username).catch(e=>console.error('message notice failed',e));
        }
        if(peer==='~ai'){
            const answerKey=`im_m_${hash}_bot-${input.id}`;
            const answer=await getDataValue(actor.username,answerKey,null);
            if(answer)return res.status(200).json({ok:true,message,answer});
            const recent=(await threadRows(actor,'~ai',hash)).filter(r=>!r.value.deleted&&r.value.text).slice(0,10).reverse().map(r=>({role:r.value.sender==='~ai'?'assistant':'user',content:r.value.text}));
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
