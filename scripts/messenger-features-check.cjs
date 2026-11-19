const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const root=path.join(__dirname,'..'),rows=new Map(),files=new Map();
const profiles=['alice','bob','eve'].map(username=>({username,name:username,avatar:'avatar:1'}));
const seed=(username,key,value)=>rows.set(`${username}:${key}`,{username,key,value,updated_at:new Date().toISOString()});
seed('bob','linked_students',['alice']);seed('alice','schedule',[{tasks:[{id:'task-1',subject:'زیست',status:'pending'}]}]);
seed('alice','focus_records',[{id:'focus-1',subject:'زیست',seconds:125,endedAt:'2026-01-01T12:00:00Z'}]);
async function db(query,options={}){
    if(options.method==='POST'){for(const row of JSON.parse(options.body))rows.set(`${row.username}:${row.key}`,structuredClone(row));return [];}
    const [table,search]=query.split('?'),params=new URLSearchParams(search);let result=table==='profiles'?profiles:[...rows.values()];
    for(const field of ['username','key','updated_at']){const f=params.get(field);if(!f)continue;const dot=f.indexOf('.'),op=f.slice(0,dot),v=f.slice(dot+1);result=result.filter(r=>op==='eq'?r[field]===v:op==='in'?v.slice(1,-1).split(',').includes(r[field]):op==='gt'?r[field]>v:op==='like'?new RegExp('^'+v.replaceAll('*','.*')+'$').test(r[field]):true);}
    const or=params.get('or');if(or?.startsWith('(updated_at.gt.')){const m=/^\(updated_at.gt.(.+),and\(updated_at.eq.(.+),key.gt.(.+)\)\)$/.exec(or);assert(m);result=result.filter(r=>r.updated_at>m[1]||(r.updated_at===m[2]&&r.key>m[3]));}
    if(or?.startsWith('(value->>createdAt.lt.')){
        const m=/^\(value->>createdAt.lt.(.+),and\(value->>createdAt.eq.(.+),key.lt.(.+)\)\)$/.exec(or);
        assert(m);
        result=result.filter(r=>r.value?.createdAt<m[1]||(r.value?.createdAt===m[2]&&r.key<m[3]));
    }
    if(or?.startsWith('(key.like.')){
        const prefixes=or.slice(1,-1).split(',').map(value=>value.slice('key.like.'.length,-1));
        result=result.filter(r=>prefixes.some(prefix=>r.key.startsWith(prefix)));
    }
    const searchFilter=params.get('value->>text');
    if(searchFilter)result=result.filter(r=>r.value?.text?.toLowerCase().includes(searchFilter.slice('ilike.*'.length,-1).toLowerCase()));
    const order=params.get('order')||'',asc=order.includes('asc');
    const date=r=>(order.startsWith('value->>createdAt')?r.value?.createdAt:r.updated_at)||'';
    result.sort((a,b)=>(date(a).localeCompare(date(b))||(a.key||'').localeCompare(b.key||''))*(asc?1:-1));
    const offset=Number(params.get('offset')||0);result=result.slice(offset,offset+Number(params.get('limit')||10000));return structuredClone(result);
}
const api={db,crypto,getSession:async req=>profiles.find(p=>p.username===req.actor),getDataValue:async(u,k,f)=>structuredClone(rows.get(`${u}:${k}`)?.value??f),getLinkedStudents:async u=>rows.get(`${u}:linked_students`)?.value||[],findStudentAdvisor:async u=>u==='alice'?profiles[1]:null};
const loaded={};function load(name){if(loaded[name])return loaded[name];const scope={module:{exports:{}},console,Buffer,Date,Intl,setTimeout,require:dep=>dep.includes('_supabase')?api:dep.includes('_notifications')?{notify:async()=>{}}:dep==='./chat-files'?{save:async(owner,thread,id,f)=>{const storagePath=`${owner}/${thread}/${id}`;files.set(storagePath,Buffer.from(f.data,'base64'));const {data,...meta}=f;return{...meta,storagePath};},read:async f=>files.get(f.storagePath)}:dep.startsWith('./')?load(dep.slice(2)):require(dep)};vm.runInNewContext(fs.readFileSync(path.join(root,'lib',name+'.js'),'utf8'),scope);return loaded[name]=scope.module.exports;}
const handler=load('messenger');
async function call(actor,method,input,headers={}){let status=200,result;const responseHeaders={};await handler({actor,method,query:method==='GET'?input:{},body:method==='POST'?input:{},headers},{setHeader(k,v){responseHeaders[k]=v;},status(n){status=n;return this;},json(v){result=v;},send(v){result=v;}});return {status,result,headers:responseHeaders};}
async function main(){
    const manual={source:'manual',taskId:'task-1',subject:'ignored',date:'2026-01-01',start:'14:00',end:'15:15',status:'completed',testCount:20,notes:'خوب بود'};
    assert.equal((await call('eve','GET',{peer:'alice',action:'reportOptions'})).status,403);
    const id=crypto.randomUUID(),report=await call('alice','POST',{action:'studyReport',peer:'bob',id,report:manual});
    assert.equal(report.status,200);assert.equal(report.result.message.studyReport.minutes,75);assert.equal(report.result.message.studyReport.subject,'زیست');
    assert.equal(rows.get('alice:manual_reports').value.length,1);
    await call('alice','POST',{action:'studyReport',peer:'bob',id,report:manual});assert.equal(rows.get('alice:manual_reports').value.length,1);
    const replay=await call('alice','POST',{action:'studyReport',peer:'bob',id:crypto.randomUUID(),report:{source:'existing',reportId:id}});assert.equal(replay.status,200);assert.equal(rows.get('alice:manual_reports').value.length,1);
    const timer=await call('alice','POST',{action:'studyReport',peer:'bob',id:crypto.randomUUID(),report:{source:'timer',recordIds:['focus-1']}});assert.equal(timer.status,200);assert.equal(timer.result.message.studyReport.seconds,125);assert.equal(rows.get('alice:manual_reports').value.length,1);
    assert.equal((await call('alice','POST',{action:'studyReport',peer:'eve',id:crypto.randomUUID(),report:manual})).status,403);
    assert.equal((await call('alice','POST',{action:'studyReport',peer:'bob',id:crypto.randomUUID(),report:{...manual,end:'13:00'}})).status,400);
    assert.equal((await call('alice','POST',{action:'studyReport',peer:'bob',id:crypto.randomUUID(),report:{source:'timer',recordIds:['stolen']}})).status,400);
    const review=await call('bob','POST',{action:'reviewStudyReport',peer:'alice',id,feedback:'آفرین'});assert.equal(review.status,200);assert.equal(review.result.message.studyReport.review.by,'bob');
    assert.equal((await call('eve','POST',{action:'reviewStudyReport',peer:'alice',id})).status,403);
    const voice={voice:true,name:'voice.webm',duration:12,data:Buffer.from('1a45dfa3007765626d','hex').toString('base64')};
    const vid=crypto.randomUUID(),sent=await call('alice','POST',{peer:'bob',id:vid,file:voice});assert.equal(sent.status,200);assert(sent.result.message.file.voice);
    const stored=[...rows.values()].find(r=>r.key.endsWith(vid)&&r.key.startsWith('im_file_')).value;assert(stored.storagePath);assert(!stored.data);
    assert.equal((await call('eve','GET',{peer:'alice',file:vid})).status,404);
    const range=await call('bob','GET',{peer:'alice',file:vid},{range:'bytes=0-3'});assert.equal(range.status,206);assert.equal(range.result.toString('hex'),'1a45dfa3');
    assert.equal((await call('bob','GET',{peer:'alice',file:vid},{range:'bytes=900-999'})).status,416);
    assert.equal((await call('alice','POST',{peer:'bob',id:crypto.randomUUID(),file:{...voice,duration:200}})).status,400);
    assert.equal((await call('alice','POST',{peer:'bob',id:crypto.randomUUID(),file:{...voice,data:Buffer.from('bad').toString('base64')}})).status,400);
    const before=await call('bob','GET',{peer:'alice'});const cursor=before.result.cursor;
    const delta=await call('bob','GET',{peer:'alice',light:'1',afterAt:cursor.at,afterKey:cursor.key});assert.equal(delta.result.messages.length,0);
    const delivery=await call('bob','POST',{action:'delivered',peer:'alice',at:sent.result.message.createdAt});
    assert.equal(delivery.status,200);
    assert.equal((await call('alice','GET',{peer:'bob'})).result.deliveredAt,sent.result.message.createdAt);
    const textId=crypto.randomUUID(),body={peer:'bob',id:textId,text:'A searchable message'};
    assert.equal((await call('alice','POST',body)).status,200);
    assert.equal((await call('alice','POST',body)).result.message.id,textId);
    assert.equal((await call('bob','POST',{action:'edit',peer:'alice',id:textId,text:'x'})).status,404);
    assert.equal((await call('eve','POST',{action:'react',peer:'alice',id:textId,emoji:'👍'})).status,404);
    assert.equal((await call('bob','POST',{action:'react',peer:'alice',id:textId,emoji:'👍'})).status,200);
    assert.equal((await call('alice','GET',{peer:'bob'})).result.reactions.theirs[textId],'👍');
    assert.equal((await call('alice','POST',{action:'preferences',peer:'bob',archived:true,messagePin:textId})).status,200);
    assert.equal((await call('alice','GET',{action:'list'})).result.threads.find(thread=>thread.peer==='bob').settings.archived,true);
    assert.equal((await call('bob','GET',{action:'globalSearch',q:'searchable'})).result.messages[0].id,textId);
    assert.equal((await call('eve','GET',{action:'globalSearch',q:'searchable'})).result.messages.length,0);
    const beforeEdit=(await call('bob','GET',{peer:'alice'})).result;
    const edit=await call('alice','POST',{action:'edit',peer:'bob',id:textId,text:'Updated message'});
    assert.equal(edit.result.message.createdAt,beforeEdit.messages.find(m=>m.id===textId).createdAt);
    const older=await call('bob','GET',{peer:'alice',beforeAt:beforeEdit.olderCursor.at,beforeKey:beforeEdit.olderCursor.key});
    assert.equal(older.result.messages.length,0);
    assert.equal((await call('alice','POST',{action:'delete',peer:'bob',id:vid})).result.message.deleted,true);
    assert.equal((await call('bob','GET',{peer:'alice',file:vid})).status,404);
    assert.equal((await call('alice','POST',{peer:'bob',id:crypto.randomUUID(),text:'reply',replyTo:vid})).status,400);
    assert([...rows.values()].some(r=>r.username==='alice'&&r.key.startsWith('im_signal_')));
    assert.equal((await call('alice','POST',{action:'createGroup',name:'گروه ریاضی',members:['fake-user']})).status,400);
    const created=await call('alice','POST',{action:'createGroup',name:'گروه ریاضی',members:['bob']});
    assert.equal(created.status,201);
    const group=created.result.peer;
    assert.equal((await call('bob','GET',{action:'list'})).result.threads.some(t=>t.peer===group&&t.person.group),true);
    assert.equal((await call('eve','GET',{peer:group})).status,404);
    const groupMessage=crypto.randomUUID();
    assert.equal((await call('bob','POST',{peer:group,id:groupMessage,text:'سلام گروه'})).status,200);
    assert.equal((await call('bob','POST',{peer:group,id:groupMessage,text:'ارسال مجدد'})).result.message.text,'سلام گروه');
    assert.equal((await call('eve','POST',{peer:group,id:crypto.randomUUID(),text:'hello'})).status,404);
    assert.equal((await call('alice','GET',{peer:group})).result.messages[0].senderName,'bob');
    const groupVoice=crypto.randomUUID();
    assert.equal((await call('bob','POST',{peer:group,id:groupVoice,file:{...voice,waveform:[20,60,100]}})).result.message.file.waveform.length,3);
    const served=await call('alice','GET',{peer:group,file:groupVoice},{range:'bytes=0-3'});
    assert.equal(served.status,206);assert.match(served.headers['Content-Disposition'],/^inline/);assert.equal(served.result.toString('hex'),'1a45dfa3');
    assert.equal((await call('eve','GET',{peer:group,file:groupVoice})).status,404);
    const groupImage=crypto.randomUUID(),file={name:'preview.png',data:Buffer.from('89504e470d0a1a0a','hex').toString('base64')};
    assert.equal((await call('alice','POST',{peer:group,id:groupImage,file})).status,200);
    assert.equal((await call('bob','GET',{peer:group,file:groupImage})).headers['Content-Type'],'image/png');
    assert.equal((await call('bob','POST',{peer:group,id:groupImage,action:'delete'})).status,404);
    assert.equal((await call('alice','POST',{peer:group,id:groupImage,action:'delete'})).status,200);
    assert.equal((await call('bob','GET',{peer:group,file:groupImage})).status,404);
    seed('alice','chat_blocked',{by:'bob'});assert.equal((await call('alice','POST',{peer:'bob',id:crypto.randomUUID(),file:voice})).status,403,'legacy block must also apply to attachments');
    console.log('PASS: group creation, member-only history, message deduplication, private photos and in-line voice range responses');
    console.log('PASS: private voice + range playback, invalid media rejection, report ACL, single-count reports, timer references, retries, advisor review, incremental sync and read signals');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
