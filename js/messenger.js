/** Database-backed web messenger. Drafts remain in memory only. */
const Messenger=(()=>{
    const $=id=>document.getElementById(id);
    const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const icons={send:'M22 2 15 22l-4-9L2 9Zm0 0L11 13',back:'m15 5-7 7 7 7',clip:'m8 13 7-7a3 3 0 0 1 4 4L9 20a5 5 0 0 1-7-7L13 2',search:'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',plus:'M12 5v14M5 12h14',saved:'M5 3h14v19l-7-5-7 5Z',pin:'m8 3 8 0-1 7 4 4H5l4-4Zm4 11v8',check:'m3 12 4 4L17 6m-5 10L22 6',smile:'M8 14q4 5 8 0M8 8v1m8-1v1M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',file:'M6 2h8l5 5v15H6Zm8 0v6h5M9 13h7m-7 4h7',close:'m6 6 12 12M6 18 18 6',reply:'m9 5-7 7 7 7M2 12h13a7 7 0 0 1 7 7',more:'M5 12h1m6 0h1m6 0h1',spark:'m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z',shield:'m12 2 9 4v6c0 5-9 10-9 10S3 17 3 12V6Z',mute:'M3 9v6h4l5 4V5L7 9Zm13-2 6 10m0-10-6 10'};
    const icon=n=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${icons[n]||icons.more}"/></svg>`;
    let user='',peer='',person=null,threads=[],messages=[],legacy=[],drafts=new Map(),sequence=0,epoch=0,poll=null,active=false,sending=false,selecting=false,refreshing=false,blocked=false,ownBlock=false,hasMore=false,readAt='',aiRetry=null,cacheDbPromise=null;
    const threadCache=new Map(),threadListCache=new Map();
    function openCache(){if(cacheDbPromise)return cacheDbPromise;cacheDbPromise=new Promise(resolve=>{if(!window.indexedDB){resolve(null);return;}const req=indexedDB.open('darsyar-messenger-cache',1);req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains('threads'))req.result.createObjectStore('threads',{keyPath:'key'});};req.onsuccess=()=>resolve(req.result);req.onerror=()=>resolve(null);}).catch(()=>null);return cacheDbPromise;}
    const cacheKey=target=>`${encodeURIComponent(user)}::${encodeURIComponent(target)}`;
    async function cacheRead(target){const k=cacheKey(target);if(threadCache.has(k))return threadCache.get(k);const db=await openCache();if(!db)return null;return new Promise(resolve=>{try{const req=db.transaction('threads').objectStore('threads').get(k);req.onsuccess=()=>{const value=req.result?.value||null;if(value)threadCache.set(k,value);resolve(value);};req.onerror=()=>resolve(null);}catch{resolve(null);}});}
    async function cacheWrite(target,value){const k=cacheKey(target),safe={...value,messages:(value.messages||[]).slice(-120).map(m=>({...m,file:m.file?{...m.file,data:undefined}:undefined}))};threadCache.set(k,safe);const db=await openCache();if(!db)return;try{db.transaction('threads','readwrite').objectStore('threads').put({key:k,value:safe,savedAt:Date.now()});}catch{}}
    async function cacheReadThreads(){const k=`${encodeURIComponent(user)}::@threads`;if(threadListCache.has(k))return threadListCache.get(k);const db=await openCache();if(!db)return null;return new Promise(resolve=>{try{const req=db.transaction('threads').objectStore('threads').get(k);req.onsuccess=()=>{const value=req.result?.value||null;if(value)threadListCache.set(k,value);resolve(value);};req.onerror=()=>resolve(null);}catch{resolve(null);}});}
    async function cacheWriteThreads(value){const k=`${encodeURIComponent(user)}::@threads`,threads=value||[];threadListCache.set(k,threads);const db=await openCache();if(!db)return;try{db.transaction('threads','readwrite').objectStore('threads').put({key:k,value:threads,savedAt:Date.now()});}catch{}}
    async function cacheDeleteAccount(account){
        const prefix=encodeURIComponent(account)+'::';
        for(const cache of [threadCache,threadListCache]){
            for(const key of cache.keys())if(key.startsWith(prefix))cache.delete(key);
        }
        const db=await openCache();if(!db)return;
        try{
            const tx=db.transaction('threads','readwrite'), req=tx.objectStore('threads').openCursor();
            req.onsuccess=()=>{const cursor=req.result;if(cursor){if(String(cursor.key).startsWith(prefix))cursor.delete();cursor.continue();}};
        }catch{}
    }
    const draftKey = target => 'darsyar-im-draft:' + encodeURIComponent(user) + ':' + encodeURIComponent(target);
    const draft = () => {
        if(!drafts.has(peer)){
            let text='';
            try{text=localStorage.getItem(draftKey(peer))||'';}catch{}
            drafts.set(peer,{text,file:null,reply:null,id:null});
        }
        return drafts.get(peer);
    };
    function rememberDraft(target,text){
        if(!target||!user)return;
        try{if(text)localStorage.setItem(draftKey(target),text);else localStorage.removeItem(draftKey(target));}catch{}
    }
    const desk=()=>window.MessengerDesk;
    let requestedPeer;
    let settings={}, reactions={}, presenceState={}, unreadSince='', deliveredAt='', presenceSent=0, olderPending=false;
    let upload=null;
    const state=()=>({user,peer,person,threads,messages:[...legacy,...messages],blocked,ownBlock,canReport,settings,reactions,presence:presenceState,unreadSince,readAt,deliveredAt,hasMore});
    function sessionMeta(p,initial=false){
        settings=p.settings||{}; reactions=p.reactions||{}; presenceState=p.presence||{};
        deliveredAt=p.deliveredAt||'';
        if(initial)unreadSince=p.ownReadAt||((threads.find(t=>t.peer===peer)?.unread)?'0000':'');
    }
    function presence(typing){
        if(!active||document.hidden||!$('im-log')?.clientHeight||!peer||peer.startsWith('~')||blocked||Date.now()-presenceSent<(typing?2400:20000))return;
        presenceSent=Date.now();void request({action:'presence',peer,typing}).catch(()=>{});
    }
    const readReceipts=new Map();
    let lastListRefresh=0;
    let messageCursor=null, olderCursor=null;
    let canReport=false,canReview=false,refreshAgain=false,lastSync=0;
    const extras=()=>window.MessengerExtras;
    let eventStream=null,streamReady=false;
    function connectEvents(){
        eventStream?.close();eventStream=null;streamReady=false;
        if(!active||document.hidden||typeof EventSource==='undefined')return;
        const version=epoch,source=new EventSource('/api/chat?messenger=1&action=events');eventStream=source;
        source.onopen=()=>{if(eventStream===source){streamReady=true;extras()?.connection('');}};
        source.addEventListener('changed',()=>{if(version!==epoch||!active||eventStream!==source)return;void refresh();void refreshList();});
        source.onerror=()=>{if(eventStream===source){streamReady=false;setTimeout(()=>{if(eventStream===source&&!streamReady)extras()?.connection('در حال اتصال دوباره…');},3000);}};
        source.addEventListener('unavailable',()=>{streamReady=false;});
    }
    document.addEventListener('visibilitychange',()=>{if(document.hidden){eventStream?.close();eventStream=null;streamReady=false;}else if(active){connectEvents();void refresh();}});
    const avatar=p=>p?.group?'<span class="im-special desk-group-avatar" aria-hidden="true">'+esc((p.name||'گ').slice(0,1))+'</span>':p?.username==='~saved'?`<span class="im-special saved">${icon('saved')}</span>`:p?.username==='~ai'?`<span class="im-special ai">${icon('spark')}</span>`:ProfileStudio.avatarHTML(p?.avatar);
    async function request(body,query=''){
        const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),body?45000:15000);
        try{
            const response=await fetch(`/api/chat?messenger=1${query}`,{signal:controller.signal,credentials:'same-origin',...(body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,messenger:true})}:{})});
            const payload=await response.json();if(!response.ok)throw Error(payload.error||'ارتباط با پیام‌رسان برقرار نشد.');return payload;
        }catch(error){if(error.name==='AbortError'||error instanceof TypeError)throw Error('اتصال کند یا قطع شده است؛ دوباره تلاش کن.');throw error;}
        finally{clearTimeout(timeout);}
    }
    function syncUser(){const current=Storage.getCurrentUser()?.username||'';if(user!==current){epoch++;sequence++;user=current;peer='';threads=[];messages=[];legacy=[];drafts.clear();outbox.clear();person=null;aiRetry=null;sending=false;}return Boolean(user);}
    function layout(){const view=$('view-chat');if(!view||$('im-shell'))return;
        // Keep the old notes drawer intact for the notes shortcut and old clients.
        const previous=view.querySelector('#communications-drawer');if(previous){document.body.append(previous);previous.classList.remove('open');previous.setAttribute('aria-hidden','true');}
        view.innerHTML=desk().layout();
        $('im-exit').onclick=()=>App.navigate('dashboard');
        $('im-search').oninput=renderThreads;
        $('im-mute').onclick=async()=>{const target=peer,seq=sequence,t=threads.find(x=>x.peer===target),next=!t?.muted;try{await request({action:'mute',peer:target,muted:next});if(seq!==sequence||target!==peer)return;t.muted=next;renderThreads();renderHeader();feedback(next?'اعلان‌های این گفتگو بی‌صدا شد.':'اعلان‌های این گفتگو فعال شد.');}catch(e){feedback(e.message);}};
        $('im-block').onclick=async()=>{if(!confirm(ownBlock?'مسدودسازی این گفتگو برداشته شود؟':'این کاربر دیگر نتواند به شما پیام بدهد؟'))return;try{await request({action:'block',peer,blocked:!ownBlock});await select(peer);}catch(e){feedback(e.message);}};
        $('im-input').oninput=()=>{draft().text=$('im-input').value;draft().id=null;rememberDraft(peer,draft().text);$('im-input').style.height='auto';$('im-input').style.height=Math.min(140,$('im-input').scrollHeight)+'px';};
        $('im-input').onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing&&window.innerWidth>720){e.preventDefault();$('im-compose').requestSubmit();}};
        $('im-compose').onsubmit=e=>{e.preventDefault();if(draft().files?.length)void sendBatch();else void send();};
        $('im-attach').onclick=()=>$('im-file').click();
        $('im-file').onchange=e=>{const files=[...e.target.files];e.target.value='';void attach(files);};
        desk().mount({state,renderThreads,esc,avatar,select,createGroup,preferences,presence,fileURL,message:id=>[...messages,...legacy].find(m=>m.id===id),feedback,search,globalSearch,findLoaded,older,messageAction,modify,forward,attach,read:()=>markRead()});
        $('im-back').onclick=()=>{stopPlayback();desk().close();$('im-shell').classList.remove('im-mobile-chat');($('im-threads').querySelector('[aria-current="true"]')||$('im-new')).focus();};
    }
    function mountExtras(){extras()?.mount({state:()=>({user,peer,blocked,canReport,canReview}),request,sendFile:async(file,target)=>{if(peer!==target||blocked)return false;file.clientId=file.clientId||crypto.randomUUID();if(outbox.has(file.clientId))return await send(false,file.clientId);draft().file=file;draft().id=file.clientId;return await send();},submitReport:async(data,target)=>{if(peer!==target)throw Error('گفتگو تغییر کرده است.');const version=epoch,p=await request({action:'studyReport',peer:target,...data});if(version!==epoch)throw Error('حساب تغییر کرده است.');if(p.data)Storage.applyServerData(p.data);if(peer===target){messages=[...new Map([...messages,p.message].map(m=>[m.id,m])).values()];renderMessages(true);}void refreshList();return p;},review:async(id,feedbackText,target)=>{const version=epoch,p=await request({action:'reviewStudyReport',peer:target,id,feedback:feedbackText});if(version!==epoch)return;if(peer===target){messages=messages.map(m=>m.id===id?p.message:m);renderMessages();}}});}
    function stopPlayback(){document.querySelectorAll('#im-log audio').forEach(audio=>{if(!audio.paused)audio.pause();});}
    function reconcileMessages(box,markup){
        const template=document.createElement('template');template.innerHTML=markup;
        const existing=new Map([...box.querySelectorAll(':scope > [data-message]')].map(n=>[n.dataset.message,n]));
        const dates=new Map([...box.querySelectorAll(':scope > .im-date,:scope > .desk-unread')].map(n=>[n.textContent,n]));
        const desired=[...template.content.children].map(node=>{
            if(node.matches('.im-date,.desk-unread')&&dates.has(node.textContent))return dates.get(node.textContent);
            if(node.id==='im-older'&&box.querySelector('#im-older'))return box.querySelector('#im-older');
            const old=existing.get(node.dataset.message);if(!old)return node;
            const a=old.cloneNode(true),b=node.cloneNode(true);a.querySelector('footer')?.remove();b.querySelector('footer')?.remove();a.querySelector('.im-study-card')?.remove();b.querySelector('.im-study-card')?.remove();
            if(a.innerHTML!==b.innerHTML)return node;
            old.className=node.className;
            if(old.querySelector('footer')?.innerHTML!==node.querySelector('footer')?.innerHTML)old.querySelector('footer').innerHTML=node.querySelector('footer').innerHTML;
            const report=old.querySelector('.im-study-card'),nextReport=node.querySelector('.im-study-card');if(report&&nextReport&&report.outerHTML!==nextReport.outerHTML)report.replaceWith(nextReport);
            return old;
        });
        desired.forEach((node,i)=>{if(box.children[i]!==node)box.insertBefore(node,box.children[i]||null);});while(box.children.length>desired.length)box.lastElementChild.remove();
    }
    async function createGroup(name,members){
        const version=epoch;
        const result=await request({action:'createGroup',name,members});
        if(active&&version===epoch){await refreshList();return result;}
        return null;
    }
    async function enter(target){
        target=target||requestedPeer;requestedPeer=null;
        if(!syncUser())return;
        const view=$('view-chat');
        if(!view)return;
        if(!desk()){view.textContent='بارگیری پیام‌رسان کامل نشد. صفحه را تازه‌سازی کنید.';return;}
        document.body.classList.add('im-open');active=true;layout();mountExtras();
        clearInterval(poll);
        const version=epoch;
        if(target||peer){void refreshList();await select(target||peer,{showConversation:Boolean(target)});}
        else{
            const cached=await cacheReadThreads();
            if(!active||version!==epoch)return;
            if(cached){threads=cached;renderThreads();void refreshList();}
            else await refreshList();
        }
        if(!active||version!==epoch)return;
        connectEvents();
        poll=setInterval(()=>{
            if(!active||document.hidden)return;
            if(peer&&(!streamReady||Date.now()-lastSync>8000))void refresh();
            else if(!peer&&Date.now()-lastListRefresh>15000)void refreshList();
        },1500);
    }
    function leave(){stopPlayback();extras()?.close();desk()?.close();$('im-shell')?.classList.remove('im-mobile-chat');active=false;sequence++;clearInterval(poll);poll=null;eventStream?.close();eventStream=null;streamReady=false;document.body.classList.remove('im-open');}
    function logout(){
        leave();
        upload?.abort();
        if(user)void cacheDeleteAccount(user);
        const prefix='darsyar-im-draft:'+encodeURIComponent(user)+':';
        try{for(let i=localStorage.length-1;i>=0;i--){const key=localStorage.key(i);if(key?.startsWith(prefix))localStorage.removeItem(key);}}catch{}
        syncUser();$('view-chat')?.querySelector('#im-shell')?.remove();
    }
    async function refreshList(){const version=epoch;lastListRefresh=Date.now();try{const p=await request(null,'&action=list');if(version!==epoch)return;threads=p.threads||[];renderThreads();void cacheWriteThreads(threads);}catch(e){if(active)feedback(e.message);}}
    function renderThreads(){if($('im-threads'))desk().threads(threads);}
    function applySnapshot(target,p,seq,fromCache=false){if(seq!==sequence)return false;peer=target===user?'~saved':target;person={...p.peer,username:peer};messages=[...new Map([...Array.from(outbox.values()).filter(e=>e.target===peer).map(e=>({id:e.id,sender:user,text:e.snapshot.text||(e.snapshot.file?.voice?'پیام صوتی':'فایل پیوست'),createdAt:e.createdAt||(e.createdAt=new Date().toISOString()),pending:!e.failed,failed:e.failed})),...(p.messages||[])].map(m=>[m.id,m])).values()].sort((a,b)=>a.createdAt.localeCompare(b.createdAt));legacy=p.legacy||[];canReport=Boolean(p.canReport);canReview=Boolean(p.canReview);hasMore=Boolean(p.hasMore);messageCursor=p.cursor||p.messageCursor||null;olderCursor=p.olderCursor||null;blocked=Boolean(p.blocked);ownBlock=Boolean(p.ownBlock);readAt=p.readAt||'';aiRetry=null;if(peer==='~saved')person.name='پیام‌های ذخیره‌شده';let thread=threads.find(t=>t.peer===peer);if(!thread){thread={peer,person,preview:''};threads.push(thread);}thread.person=person;thread.muted=Boolean(p.muted??thread.muted);sessionMeta(p,true);renderThreads();renderHeader();desk().header();$('im-shell').classList.add('desk-has-chat');renderMessages(true);restoreDraft();selecting=false;if(!fromCache)presence(false);feedback(fromCache?'نسخهٔ ذخیره‌شده · در حال همگام‌سازی…':blocked?'این گفتگو مسدود است.':peer==='~ai'?'پاسخ‌های این دستیار کوتاه‌اند؛ برای توضیح مفصل از صفحهٔ دستیار استفاده کن.':'');if(!fromCache)updateReceipts();return true;}
    async function select(target,{showConversation=true,preserveDialog=false}={}){
        if(!syncUser()||!$('im-shell'))return false;
        if(target!==peer)upload?.abort();
        stopPlayback();extras()?.close();if(!preserveDialog)desk().close();
        const version=epoch,seq=++sequence,previous=peer;
        selecting=true;
        if(target!==previous)desk().loading();
        feedback('در حال دریافت گفتگو…');
        $('im-send').disabled=$('im-input').disabled=$('im-attach').disabled=true;
        let cached;
        try{
            cached=await cacheRead(target);
            if(seq!==sequence||version!==epoch||!active)return false;
            if(cached){if(showConversation)$('im-shell').classList.add('im-mobile-chat');applySnapshot(target,cached,seq,true);selecting=true;}
            const p=await request(null,'&peer='+encodeURIComponent(target));
            if(seq!==sequence||version!==epoch||!active)return false;
            if(showConversation&&!cached)$('im-shell').classList.add('im-mobile-chat');
            applySnapshot(target,p,seq);void cacheWrite(peer,p);return true;
        }catch(error){
            if(seq===sequence&&version===epoch){
                if(!cached){peer=previous;renderMessages(true);if(!previous)$('im-shell').classList.remove('im-mobile-chat');}
                feedback(cached?'همگام‌سازی گفتگو ناموفق بود.':error.message);
            }
            return Boolean(cached);
        }finally{
            if(seq===sequence&&version===epoch){selecting=false;if(active)restoreDraft();}
        }
    }
    function renderHeader(){$('im-avatar').innerHTML=avatar(person);$('im-name').textContent=person?.name||'';$('im-subtitle').textContent=peer==='~saved'?'فقط خودت به این گفتگو دسترسی داری':peer==='~ai'?'هوش مصنوعی · پاسخ‌های کوتاه':`@${peer}`;$('im-block').hidden=peer.startsWith('~');$('im-block').setAttribute('aria-label',ownBlock?'رفع مسدودسازی':'مسدود کردن گفتگو');const muted=Boolean(threads.find(t=>t.peer===peer)?.muted),mute=$('im-mute');mute.hidden=peer.startsWith('~');mute.classList.toggle('is-muted',muted);mute.setAttribute('aria-label',muted?'فعال‌کردن اعلان‌های گفتگو':'بی‌صدا کردن گفتگو');mute.title=muted?'فعال‌کردن اعلان‌های گفتگو':'بی‌صدا کردن گفتگو';}
    function restoreDraft(){if(!peer)return;extras()?.update();const d=draft();if($('im-input').value!==d.text)$('im-input').value=d.text;restoreDraftControls();$('im-context').hidden=!d.reply&&!d.file;$('im-context').innerHTML=d.file||d.reply?`<span>${icon(d.file?'file':'reply')}<span><strong>${d.file?'پیوست آماده ارسال':'در پاسخ به'}</strong><small>${esc(d.file?.name||d.reply.text||'فایل')}</small></span></span><button type="button" class="im-icon" aria-label="حذف پیوست یا پاسخ">${icon('close')}</button>`:'';if(!$('im-context').hidden)$('im-context').querySelector('button').onclick=()=>{d.file=null;d.reply=null;d.id=null;restoreDraft();};if(d.files?.length)previewFiles(d);}
    function feedback(text){if($('im-feedback'))$('im-feedback').textContent=text||'';}
    function restoreDraftControls(){
        if(selecting||!peer)return;
        $('im-input').disabled=blocked||Boolean(upload);
        $('im-send').disabled=blocked||Boolean(upload)||(peer==='~ai'&&sending);
        $('im-attach').disabled=blocked||Boolean(upload)||peer==='~ai';
    }
    const apiOrigin=()=>window.DarsyarPlatform?.apiOrigin||'';
    const fileURL=(p,id)=>`${apiOrigin()}/api/chat?messenger=1&peer=${encodeURIComponent(p)}&file=${encodeURIComponent(id)}`;
    function renderMessages(bottom=false,prepend=false){
        const box=$('im-log');if(!box)return;
        const oldHeight=box.scrollHeight, oldTop=box.scrollTop;
        const nearBottom=oldHeight-oldTop-box.clientHeight<100;
        const all=[...legacy,...messages].sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id));
        reconcileMessages(box,desk().messageMarkup(all,state(),hasMore));
        if($('im-older'))$('im-older').onclick=older;
        if(bottom||nearBottom)box.scrollTop=box.scrollHeight;
        else box.scrollTop=oldTop+(prepend?box.scrollHeight-oldHeight:0);
        desk().afterMessages();
    }
    async function older(){
        if(olderPending||!hasMore)return false;
        olderPending=true;
        const seq=sequence,target=peer,button=$('im-older');
        if(button)button.disabled=true;
        const boundary=olderCursor
            ? '&beforeAt='+encodeURIComponent(olderCursor.at)+'&beforeKey='+encodeURIComponent(olderCursor.key)
            : '&offset='+messages.filter(m=>!m.pending&&!m.failed).length;
        try{
            const p=await request(null,'&peer='+encodeURIComponent(target)+boundary);
            if(seq!==sequence)return false;
            messages=[...new Map([...p.messages,...messages].map(m=>[m.id,m])).values()]
                .sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id));
            hasMore=Boolean(p.hasMore);
            olderCursor=p.olderCursor||null;
            renderMessages(false,true);
            return p.messages.length>0;
        }catch(error){if(seq===sequence)feedback(error.message);return false;}
        finally{olderPending=false;if(button?.isConnected)button.disabled=false;}
    }
    function updateReceipts(){void markRead('delivered');void markRead();}
    async function markRead(action='read'){
        const target=peer, log=$('im-log');
        if(!active||selecting||document.hidden||!target||target.startsWith('~'))return;
        if(action==='read'&&(!log?.clientHeight||log.scrollHeight-log.scrollTop-log.clientHeight>120))return;
        const at=messages.filter(m=>m.sender!==user&&!m.pending&&!m.deleted).at(-1)?.createdAt;
        const key=[user,target,action].join(':'), version=epoch, previous=readReceipts.get(key);
        if(!at||previous>=at)return;
        readReceipts.set(key,at);
        try{
            await request({action,peer:target,at});
            if(version!==epoch||action!=='read')return;
            const thread=threads.find(t=>t.peer===target);
            if(thread&&(!thread.at||thread.at<=at))thread.unread=false;
            renderThreads();
        }catch{if(readReceipts.get(key)===at)readReceipts.set(key,previous);}
    }
    async function refresh(){if(refreshing){refreshAgain=true;return;}if(selecting||!peer)return;refreshing=true;const seq=sequence,target=peer;try{const after=messageCursor?`&afterAt=${encodeURIComponent(messageCursor.at)}&afterKey=${encodeURIComponent(messageCursor.key)}`:'';const p=await request(null,`&peer=${encodeURIComponent(target)}&light=1${after}`);if(!active||seq!==sequence)return;lastSync=Date.now();extras()?.connection('');messageCursor=p.cursor||messageCursor;const before=JSON.stringify([messages,reactions,deliveredAt]);sessionMeta(p);desk().header();presence(false);messages=[...new Map([...messages,...p.messages].map(m=>[m.id,m])).values()].sort((a,b)=>a.createdAt.localeCompare(b.createdAt));const changed=before!==JSON.stringify([messages,reactions,deliveredAt])||readAt!==p.readAt;readAt=p.readAt;blocked=p.blocked;ownBlock=p.ownBlock;restoreDraftControls();extras()?.update();void cacheWrite(target,{peer:person,messages,legacy,canReport,canReview,hasMore,messageCursor,blocked,ownBlock,readAt,settings,reactions,deliveredAt,muted:threads.find(t=>t.peer===target)?.muted});if(changed){renderMessages();updateReceipts();}if(p.moreChanges)setTimeout(()=>{if(active&&seq===sequence)refresh();},0);if(Date.now()-lastListRefresh>15000){lastListRefresh=Date.now();void refreshList();}}catch(e){if(active&&seq===sequence)feedback(e.message);}finally{refreshing=false;if(refreshAgain){refreshAgain=false;setTimeout(()=>{if(active)refresh();},0);}}}
    const fileData=blob=>new Promise((resolve,reject)=>{
        const reader=new FileReader();
        reader.onload=()=>resolve(String(reader.result).split(',')[1]);
        reader.onerror=()=>reject(Error('خواندن فایل ناموفق بود.'));
        reader.readAsDataURL(blob);
    });
    async function attach(files,sticker=false){
        if(!peer||blocked||selecting||upload||peer==='~ai')return;
        const target=peer,version=epoch;
        const valid=files.slice(0,10).filter(file=>file.size>0&&file.size<=2*1024*1024&&/\.(jpe?g|png|webp|gif|mp4|webm|pdf|txt|docx|xlsx|pptx|zip)$/i.test(file.name));
        if(files.length!==valid.length)feedback('حداکثر ۱۰ فایل پشتیبانی‌شده، هر کدام تا ۲ مگابایت.');
        if(!valid.length)return;
        try{
            const items=await Promise.all(valid.map(async file=>({name:file.name,data:await fileData(file),clientId:crypto.randomUUID(),sticker})));
            if(version!==epoch||target!==peer)return;
            const d=draft();d.files=[...(d.files||[]),...items].slice(0,10);d.album=d.album||crypto.randomUUID();restoreDraft();
        }catch(error){if(version===epoch&&target===peer)feedback(error.message);}
    }
    function previewFiles(d){
        const el=$('im-context');
        el.hidden=false;
        el.innerHTML='<div class="desk-uploads">'+d.files.map((file,i)=>{
            const ext=file.name.split('.').pop().toLowerCase();
            const type={jpg:'jpeg',jpeg:'jpeg',png:'png',webp:'webp',gif:'gif'}[ext];
            const thumb=type?'<img loading="lazy" alt="" src="data:image/'+type+';base64,'+file.data+'">':'';
            return '<div>'+thumb+'<span dir="auto">'+esc(file.name)+'</span><button type="button" data-remove-file="'+i+'" aria-label="حذف '+esc(file.name)+'">×</button></div>';
        }).join('')+'</div>';
        el.querySelectorAll('[data-remove-file]').forEach(btn=>btn.onclick=()=>{
            d.files.splice(Number(btn.dataset.removeFile),1);if(!d.files.length)d.album=null;restoreDraft();
        });
    }
    async function sendBatch(){
        if(upload||!peer||blocked||selecting||!draft().files?.length)return;
        const target=peer,version=epoch,d=draft(),files=d.files.slice(),album=files.length>1?d.album:null;
        const controller=new AbortController();upload=controller;
        const status=$('im-feedback');
        status.innerHTML='<span></span> <progress max="1" value="0" aria-label="پیشرفت ارسال فایل"></progress> <button type="button">لغو ارسال</button>';
        status.querySelector('button').onclick=()=>controller.abort();
        const bar=status.querySelector('progress'),label=status.querySelector('span');
        restoreDraftControls();
        let sent=0;
        try{
            for(const file of files){
                if(controller.signal.aborted||version!==epoch||target!==peer)break;
                label.textContent='ارسال '+(sent+1)+' از '+files.length;
                const payload={peer:target,id:file.clientId,text:sent?'':d.text,file,album,replyTo:sent?null:d.reply?.id};
                const result=await uploadFile(payload,controller,fraction=>{bar.value=(sent+fraction)/files.length;});
                if(version!==epoch)return;
                d.files=d.files.filter(item=>item.clientId!==file.clientId);
                if(sent++===0){d.text='';d.reply=null;rememberDraft(target,'');}
                if(target===peer){messages=[...new Map([...messages,result.message].map(m=>[m.id,m])).values()];renderMessages(true);}
            }
            if(target===peer)feedback(sent===files.length?'فایل‌ها ارسال شدند.':'فایل‌های باقی‌مانده برای ارسال دوباره آماده‌اند.');
        }catch(error){if(target===peer&&version===epoch)feedback(error.message+' فایل‌های باقی‌مانده برای تلاش دوباره آماده‌اند.');}
        finally{
            if(upload===controller)upload=null;
            if(version===epoch&&target===peer)restoreDraft();
            if(sent&&version===epoch)void refreshList();
        }
    }
    function uploadFile(payload,controller,progress){
        return new Promise((resolve,reject)=>{
            const xhr=new XMLHttpRequest();
            xhr.open('POST',apiOrigin()+'/api/chat?messenger=1');
            xhr.withCredentials=true;
            xhr.setRequestHeader('Content-Type','application/json');
            xhr.timeout=45000;
            const abort=()=>xhr.abort();
            controller.signal.addEventListener('abort',abort,{once:true});
            xhr.upload.onprogress=e=>{if(e.lengthComputable)progress(e.loaded/e.total);};
            xhr.onloadend=()=>controller.signal.removeEventListener('abort',abort);
            xhr.onerror=xhr.ontimeout=()=>reject(Error('ارتباط با سرور برقرار نشد.'));
            xhr.onabort=()=>reject(Error('ارسال لغو شد.'));
            xhr.onload=()=>{
                try{const result=JSON.parse(xhr.responseText);if(xhr.status>=200&&xhr.status<300)resolve(result);else reject(Error(result.error||'ارسال ناموفق بود.'));}
                catch{reject(Error('پاسخ سرور معتبر نبود.'));}
            };
            xhr.send(JSON.stringify(payload));
        });
    }
    async function preferences(target,change){
        const version=epoch;
        try{
            const result=await request({action:'preferences',peer:target,...change});
            if(version!==epoch)return false;
            const thread=threads.find(t=>t.peer===target);
            if(thread){thread.settings=result.settings;thread.pinned=result.settings.pinned??thread.pinned;}
            if(peer===target){settings=result.settings;desk().header();}
            renderThreads();return true;
        }catch(error){if(version===epoch)feedback(error.message);return false;}
    }
    async function modify(action,id,change={}){
        const target=peer,seq=sequence;
        try{
            const result=await request({action,peer:target,id,...change});
            if(seq!==sequence)return false;
            if(result.message)messages=messages.map(m=>m.id===id?result.message:m);
            if(result.reactions)reactions={...reactions,mine:result.reactions};
            renderMessages();void refreshList();return true;
        }catch(error){if(seq===sequence)feedback(error.message);return false;}
    }
    async function search(term){
        const seq=sequence;
        const result=await request(null,'&action=search&peer='+encodeURIComponent(peer)+'&q='+encodeURIComponent(term));
        return seq===sequence?result.messages:[];
    }
    async function globalSearch(term){
        const version=epoch;
        const result=await request(null,'&action=globalSearch&q='+encodeURIComponent(term));
        return version===epoch?result.messages:[];
    }
    async function findLoaded(id){
        const seq=sequence, selector='[data-message="'+CSS.escape(id)+'"]';
        let node=$('im-log')?.querySelector(selector);
        for(let page=0;!node&&hasMore&&page<20;page++){
            if(!(await older())||seq!==sequence)return null;
            node=$('im-log')?.querySelector(selector);
        }
        return node;
    }
    async function forward(items,target){
        const version=epoch,source=peer;
        try{
            for(const item of items){
                let file;
                if(item.file){
                    const result=await fetch(fileURL(source,item.file.id),{credentials:'same-origin'});
                    if(!result.ok)throw Error('فایل پیدا نشد.');
                    file={name:item.file.name,data:await fileData(await result.blob()),voice:item.file.voice,duration:item.file.duration,waveform:item.file.waveform,sticker:item.file.sticker};
                }
                if(version!==epoch||source!==peer||!active)return false;
                await request({peer:target,id:crypto.randomUUID(),text:item.text,file,forwarded:true});
            }
            if(source===peer){feedback('پیام‌ها بازفرستاده شدند.');void refresh();void refreshList();}
            return true;
        }catch(error){if(version===epoch&&source===peer)feedback(error.message);return false;}
    }
    const outbox=new Map();
    async function send(retry=false,failedId=null){
        if(!peer||blocked||selecting||(peer==='~ai'&&sending))return false;
        const d=draft(),previous=failedId?outbox.get(failedId):null;
        if(failedId&&(!previous||previous.target!==peer||previous.sending))return false;
        if(!retry&&!previous&&!d.text.trim()&&!d.file)return false;
        if(!retry&&!previous&&outbox.size>=20){feedback('ابتدا پیام‌های ارسال‌نشده را دوباره ارسال کن.');return false;}
        const target=peer,version=epoch,seq=sequence,snapshot=previous?.snapshot||{...d},id=previous?.id||(retry?aiRetry:d.id||crypto.randomUUID());
        let entry=previous;
        if(!retry){
            entry={id,target,snapshot,sending:true,createdAt:previous?.createdAt||new Date().toISOString()};outbox.set(id,entry);
            if(!previous){drafts.set(target,{text:'',file:null,reply:null,id:null,files:d.files,album:d.album});rememberDraft(target,'');}
            messages=[...messages.filter(m=>m.id!==id),{id,sender:user,text:snapshot.text||(snapshot.file?.voice?'پیام صوتی':'فایل پیوست'),createdAt:entry.createdAt,pending:true}];
        }
        if(target==='~ai')sending=true;
        renderMessages(true);restoreDraft();feedback(target==='~ai'?'دستیار در حال پاسخ‌دادن است…':'');
        try{
            const p=await request({action:retry?'retryAI':'send',peer:target,id,text:snapshot.text,file:snapshot.file,replyTo:snapshot.reply?.id});
            if(version!==epoch)return false;outbox.delete(id);
            if(seq===sequence&&active){
                messages=[...new Map([...messages,p.message,...(p.answer?[p.answer]:[])].map(m=>[m.id,m])).values()];renderMessages(true);feedback(p.aiError||'');void cacheWrite(target,{peer:person,messages,legacy,canReport,canReview,hasMore,messageCursor,blocked,ownBlock,readAt,muted:threads.find(t=>t.peer===target)?.muted});
                if(p.aiError){aiRetry=id;const b=document.createElement('button');b.type='button';b.textContent='تلاش دوباره';b.onclick=()=>send(true);$('im-feedback').append(b);}else aiRetry=null;
            }
            void refreshList();return true;
        }catch(error){
            if(version!==epoch)return false;
            if(entry){entry.sending=false;entry.failed=true;}
            if(seq===sequence&&active){
                const confirmed=messages.find(m=>m.id===id&&!m.pending&&!m.failed);
                if(confirmed&&target!=='~ai'){outbox.delete(id);return true;}
                messages=messages.map(m=>m.id===id?{...m,pending:false,failed:true}:m);renderMessages();feedback(error.message||'ارسال نشد؛ دکمهٔ تلاش دوباره روی پیام را بزن.');
            }
            return false;
        }finally{if(version===epoch){if(target==='~ai')sending=false;if(active)restoreDraft();}}
    }
    async function messageAction(action,message){if(!message)return;if(action==='retry'){send(false,message.id);return;}if(action==='reply'){draft().reply=message;restoreDraft();$('im-input').focus();return;}const target=peer,version=epoch;try{if(action==='report'){if(!confirm('این پیام به‌عنوان محتوای نامناسب گزارش شود؟'))return;await request({action:'report',peer:target,id:message.id});feedback('گزارش ثبت شد.');return;}let file=null;if(message.file){const response=await fetch(fileURL(target,message.file.id),{credentials:'same-origin'});if(!response.ok)throw Error('فایل دریافت نشد.');const blob=await response.blob();const data=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result).split(',')[1]);r.onerror=reject;r.readAsDataURL(blob);});file={name:message.file.name,data,...(message.file.voice?{voice:true,duration:message.file.duration}:{})};}if(version!==epoch)return;await request({peer:'~saved',id:crypto.randomUUID(),text:message.text,file});feedback('در پیام‌های ذخیره‌شده قرار گرفت.');await refreshList();}catch(e){feedback(e.message);}}
    function open(target){requestedPeer=target;App.navigate('chat');}
    return {enter,leave,logout,open,select,peer:()=>peer,isOpenWith:target=>active&&peer===target};
})();
window.Messenger=Messenger;
