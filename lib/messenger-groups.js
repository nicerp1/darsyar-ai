/* Group membership and history live in the existing private app_data store. */
const groupPrefix = 'g:';
const usernamePattern = /^[a-z0-9_.-]{3,32}$/;
const enc = encodeURIComponent;

module.exports = function createGroups({db, put, getDataValue, crypto, uuid, validateFile, searchTerm, reactions, serveFile}) {
    const groupKey = id => 'im_group_' + id;
    const membershipKey = id => 'im_member_' + id;
    const peerName = id => groupPrefix + id;
    const hashFor = id => crypto.createHash('sha256').update(peerName(id)).digest('hex').slice(0,24);
    const fail = (res,status,error) => res.status(status).json({error});
    const profile = (id,group) => ({username:peerName(id),name:group.name,group:true,memberCount:group.members.length});
    const ping = (group,id) => group.members.map(username=>({username,key:'im_signal_'+hashFor(id),value:crypto.randomUUID()}));

    async function create(res,actor,input) {
        const name=typeof input.name==='string'?input.name.trim():'';
        if(!name||name.length>64||!Array.isArray(input.members)||input.members.length>19)return fail(res,400,'نام گروه و حداکثر ۱۹ عضو وارد کنید.');
        if(input.members.some(value=>typeof value!=='string'||!usernamePattern.test(value)))return fail(res,400,'نام کاربری عضو نامعتبر است.');
        const members=[...new Set([actor.username,...input.members])];
        if(members.length<2)return fail(res,400,'دست‌کم یک عضو دیگر اضافه کنید.');
        const [profiles, owned, blocked]=await Promise.all([
            db('profiles?username=in.('+members.map(enc).join(',')+')&select=username'),
            db('app_data?username=eq.'+enc(actor.username)+'&key=like.im_group_*&select=key&limit=25'),
            db('app_data?username=in.('+members.map(enc).join(',')+')&key=eq.im_block_'+enc(actor.username)+'&select=value')
        ]);
        if(profiles?.length!==members.length)return fail(res,400,'یک یا چند کاربر پیدا نشدند.');
        if(blocked?.some(row=>row.value===true))return fail(res,403,'امکان افزودن یکی از اعضا وجود ندارد.');
        if(owned?.length>=25)return fail(res,429,'تعداد گروه‌های این حساب به حد مجاز رسیده است.');
        const id=crypto.randomUUID(),at=new Date().toISOString(),group={name,members,owner:actor.username,at};
        await put([{username:actor.username,key:groupKey(id),value:group},...members.map(username=>({
            username,key:membershipKey(id),value:{id,name,owner:actor.username,count:members.length,at}
        })),...ping(group,id)]);
        return res.status(201).json({peer:peerName(id),person:profile(id,group)});
    }

    async function list(actor) {
        const base='app_data?username=eq.'+enc(actor.username);
        const [rows,options]=await Promise.all([
            db(base+'&key=like.im_member_*&select=value&order=updated_at.desc&limit=100'),
            db(base+'&or=(key.like.im_read_*,key.like.im_pref_*,key.like.im_mute_*)&select=key,value')
        ]);
        const values=new Map((options||[]).map(row=>[row.key,row.value]));
        return (rows||[]).map(({value:v})=>{
            const hash=hashFor(v.id),settings=values.get('im_pref_'+hash)||{};
            return {peer:peerName(v.id),person:{username:peerName(v.id),name:v.name,group:true,memberCount:v.count},
                at:v.at,preview:v.preview||'گروه تازه',sender:v.sender,unread:Boolean(v.sender&&v.sender!==actor.username&&v.at>(values.get('im_read_'+hash)||'')),
                settings,muted:values.get('im_mute_'+hash)===true,pinned:settings.pinned===true};
        });
    }

    async function handle(req,res,actor,input) {
        if(req.method==='POST'&&input.action==='createGroup')return create(res,actor,input);
        const id=String(input.peer||'').slice(groupPrefix.length);
        if(!uuid(id))return fail(res,404,'گروه پیدا نشد.');
        const membership=await getDataValue(actor.username,membershipKey(id),null);
        if(!membership?.owner||!usernamePattern.test(membership.owner))return fail(res,404,'گروه پیدا نشد.');
        const owner=membership.owner, group=await getDataValue(owner,groupKey(id),null);
        if(!group?.members?.includes(actor.username))return fail(res,404,'گروه پیدا نشد.');
        const hash=hashFor(id), keyFor=mid=>'im_gm_'+hash+'_'+mid, fileKey=mid=>'im_file_'+hash+'_'+mid;
        const find=mid=>getDataValue(owner,keyFor(mid),null);
        const location='app_data?username=eq.'+enc(owner)+'&key=like.im_gm_'+hash+'_*';
        const settingsKey='im_pref_'+hash;
        const muteKey='im_mute_'+hash;
        const readKey='im_read_'+hash;
        const save=(key,value)=>put([{username:actor.username,key,value}]);

        if(req.method==='GET'&&input.file){
            if(!uuid(input.file))return fail(res,404,'فایل پیدا نشد.');
            const message=await find(input.file);
            const file=message?.file&&!message.deleted?await getDataValue(owner,fileKey(input.file),null):null;
            if(!file)return fail(res,404,'فایل پیدا نشد.');
            return serveFile(req,res,file);
        }
        if(req.method==='GET'){
            if(input.action==='search'){
                const term=searchTerm(input.q);
                if(term.length<2)return res.status(200).json({messages:[]});
                const result=await db(location+'&value->>text=ilike.'+enc('*'+term+'*')+'&select=value&order=updated_at.desc&limit=50');
                return res.status(200).json({messages:(result||[]).map(r=>r.value).filter(m=>!m.deleted)});
            }
            const edge=(at,key)=>typeof at==='string'&&/^\d{4}-\d{2}-\d{2}T[\d:.+-]+Z?$/.test(at)&&Number.isFinite(Date.parse(at))&&typeof key==='string'&&key.startsWith(keyFor(''))&&uuid(key.slice(keyFor('').length))?{at,key}:null;
            const after=edge(input.afterAt,input.afterKey), before=edge(input.beforeAt,input.beforeKey);
            const sort=after?'asc':'desc', field=after?'updated_at':'value->>createdAt', bound=after||before, op=after?'gt':'lt';
            const filter=bound?'&or=('+field+'.'+op+'.'+enc(bound.at)+',and('+field+'.eq.'+enc(bound.at)+',key.'+op+'.'+enc(bound.key)+'))':'';
            const latest=after||before?null:(await db(location+'&select=key,updated_at&order=updated_at.desc,key.desc&limit=1'))?.[0];
            const [rows,settings,muted,ownReadAt]=await Promise.all([
                db(location+'&select=key,value,updated_at&order='+field+'.'+sort+',key.'+sort+'&limit=51'+filter),
                getDataValue(actor.username,settingsKey,{}),getDataValue(actor.username,muteKey,false),getDataValue(actor.username,readKey,'')
            ]);
            const page=(rows||[]).slice(0,50), oldest=page.at(-1), high=after?page.at(-1):latest;
            const messages=page.map(row=>row.value);
            if(!after)messages.reverse();
            return res.status(200).json({
                peer:profile(id,group),messages,legacy:[],hasMore:rows.length>50,moreChanges:Boolean(after&&rows.length>50),
                cursor:high?{at:high.updated_at,key:high.key}:after,
                olderCursor:!after&&oldest?{at:oldest.value.createdAt,key:oldest.key}:null,
                readAt:'',ownReadAt,settings,muted,reactions:{},presence:{}
            });
        }
        if(req.method!=='POST')return fail(res,405,'درخواست معتبر نیست.');
        const action=input.action||'send';
        if(['presence','delivered'].includes(action))return res.status(200).json({ok:true});
        if(action==='read'){
            if(typeof input.at==='string'&&Number.isFinite(Date.parse(input.at))&&Date.parse(input.at)<=Date.now()+1000&&(await getDataValue(actor.username,readKey,''))<input.at){
                await save(readKey,input.at);
            }
            return res.status(200).json({ok:true});
        }
        if(action==='preferences'){
            const settings={...await getDataValue(actor.username,settingsKey,{})};
            for(const flag of ['pinned','archived'])if(typeof input[flag]==='boolean')settings[flag]=input[flag];
            if(typeof input.folder==='string')settings.folder=input.folder.trim().slice(0,32);
            if(['mist','plain','dusk'].includes(input.wallpaper))settings.wallpaper=input.wallpaper;
            if(input.messagePin===null)settings.messagePin=null;
            else if(uuid(input.messagePin)){
                const target=await find(input.messagePin);
                if(!target||target.deleted)return fail(res,404,'پیام پیدا نشد.');
                settings.messagePin={id:target.id,text:target.text?.slice(0,120)||target.file?.name||'پیام'};
            }
            await save(settingsKey,settings);
            return res.status(200).json({settings});
        }
        if(action==='mute'){
            await save(muteKey,input.muted===true);
            return res.status(200).json({ok:true,muted:input.muted===true});
        }
        if(!uuid(input.id))return fail(res,400,'پیام معتبر نیست.');
        const key=keyFor(input.id), existing=await find(input.id);
        if(action==='report'){
            if(!existing||existing.deleted)return fail(res,404,'پیام پیدا نشد.');
            await save('im_report_'+crypto.randomUUID(),{peer:peerName(id),message:existing,reason:'گزارش پیام گروه',at:new Date().toISOString()});
            return res.status(200).json({ok:true});
        }
        if(action==='react'){
            if(!existing||existing.deleted||input.emoji!==null&&!reactions.has(input.emoji))return fail(res,400,'واکنش نامعتبر است.');
            const current={...(existing.groupReactions||{})};
            if(input.emoji===null)delete current[actor.username];else current[actor.username]=input.emoji;
            const message={...existing,groupReactions:current};
            await put([{username:owner,key,value:message},...ping(group,id)]);
            return res.status(200).json({message});
        }
        if(action==='edit'||action==='delete'){
            if(!existing||existing.deleted||existing.sender!==actor.username)return fail(res,404,'پیام قابل تغییر نیست.');
            const text=typeof input.text==='string'?input.text.trim():'';
            if(action==='edit'&&((!text&&!existing.file)||text.length>4000))return fail(res,400,'متن پیام معتبر نیست.');
            const message=action==='delete'?{id:existing.id,sender:existing.sender,senderName:existing.senderName,createdAt:existing.createdAt,deleted:true}:{...existing,text,editedAt:new Date().toISOString()};
            await put([{username:owner,key,value:message},...ping(group,id)]);
            return res.status(200).json({message});
        }
        if(action!=='send')return fail(res,400,'درخواست معتبر نیست.');
        if(existing)return existing.sender===actor.username&&!existing.deleted?res.status(200).json({message:existing}):fail(res,409,'این شناسه قبلاً استفاده شده.');
        const recent=await db('app_data?key=like.im_gm_*&value->>sender=eq.'+enc(actor.username)+'&updated_at=gt.'+enc(new Date(Date.now()-60000).toISOString())+'&select=key&limit=30');
        if(recent?.length>=30)return fail(res,429,'پیام‌ها را کمی آهسته‌تر بفرست.');
        const text=typeof input.text==='string'?input.text.trim():'';
        let file;
        try{file=validateFile(input.file);}catch(error){return fail(res,400,error.message);}
        if((!text&&!file)||text.length>4000)return fail(res,400,'متن یا فایل معتبر وارد کنید.');
        if(input.replyTo){const target=uuid(input.replyTo)?await find(input.replyTo):null;if(!target||target.deleted)return fail(res,400,'پیام پاسخ معتبر نیست.');}
        const createdAt=new Date().toISOString();
        const message={id:input.id,sender:actor.username,senderName:actor.name||actor.username,text,createdAt,replyTo:input.replyTo||null};
        if(input.forwarded===true)message.forwarded=true;
        if(file&&uuid(input.album))message.album=input.album;
        const writes=[{username:owner,key,value:message},...ping(group,id)];
        if(file){
            const {data,...info}=file;
            message.file={id:input.id,...info};
            writes.push({username:owner,key:fileKey(input.id),value:await require('./chat-files').save(owner,hash,input.id,file)});
        }
        const preview=text.slice(0,100)||(file?.voice?'پیام صوتی':'فایل پیوست');
        const members=await Promise.all(group.members.map(username=>getDataValue(username,membershipKey(id),null)));
        for(const [i,username] of group.members.entries()){
            const previous=members[i];if(!previous)continue;
            writes.push({username,key:membershipKey(id),value:{...previous,sender:actor.username,at:createdAt,preview}});
        }
        await put(writes);
        return res.status(200).json({message});
    }

    return {handle,list};
};
