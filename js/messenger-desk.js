/* Messenger presentation and input. Transport and account state live in Messenger. */
window.MessengerDesk = (() => {
    const $ = id => document.getElementById(id);
    const paths={
        arrow_forward:'M4 12h15m-6-6 6 6-6 6', account_circle:'M20 20a8 8 0 1 0-16 0m8-8a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
        person:'M5 21v-2a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v2m-7-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
        group_add:'M13 20H3v-2a5 5 0 0 1 5-5h2a5 5 0 0 1 5 5v2m-6-9a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM19 8v8m-4-4h8',
        edit_square:'M13 4H5v16h15v-8m-11 3 1-4 8-8 3 3-8 8Z', edit:'m5 19 1-5 11-11 4 4-11 11Z',
        search:'M15.5 15.5 21 21m-3.5-11A7.5 7.5 0 1 1 2.5 10a7.5 7.5 0 0 1 15 0Z',
        manage_search:'M3 5h15M3 10h8M3 15h6m10 3 3 3m-2-6a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
        side_navigation:'M3 5h18v14H3Zm12 0v14', more_horiz:'M4 12h1m6 0h2m6 0h1', close:'m6 6 12 12M18 6 6 18',
        keyboard_arrow_down:'m6 9 6 6 6-6', chevron_right:'m9 6 6 6-6 6',chevron_left:'m15 6-6 6 6 6',
        attach_file:'m9 15 7-7a2 2 0 0 0-3-3l-8 8a4 4 0 0 0 6 6l9-9', mood:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-13 2q4 5 8 0m-7-4h.1m5.9 0h.1',
        send:'m3 4 18 8-18 8 3-8Zm3 8h15', dark_mode:'M20 15A9 9 0 0 1 9 4a9 9 0 1 0 11 11Z',
        forum:'M4 4h14v10H9l-5 4Zm6 14h6l4 3V9',chat_bubble:'M4 4h16v12H9l-5 4Z',bookmark:'M6 4h12v16l-6-4-6 4Z',
        push_pin:'m9 4 11 11-3 1-3-2-3 3-4-4 3-3-2-3Zm1 12-6 6',
        notifications:'M5 17h14l-2-4V9a5 5 0 0 0-10 0v4Zm5 3h4', notifications_off:'M4 4l16 16M9 5a5 5 0 0 1 8 4v4m-10-3v3l-2 4h12m-7 3h4',
        archive:'M4 8h16v12H4ZM3 4h18v4H3Zm9 7v6m-3-3 3 3 3-3',
        folder:'M3 6h7l2 3h9v10H3Z',block:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM6 6l12 12',
        error:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-5v6m0 4h.1',schedule:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-5v5l4 2',
        done_all:'m2 12 4 4 8-8m-4 8 2 2L22 8',check:'m4 12 5 5L20 6',
        play_circle:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-11-4 6 4-6 4Z',description:'M6 3h8l4 4v14H6Zm7 0v6h5m-9 4h6m-6 4h6',
        forward:'m13 5 8 7-8 7v-4H9q-4 0-6 3 0-8 10-9Z',reply:'m11 5-8 7 8 7v-4h4q4 0 6 3 0-8-10-9Z',
        content_copy:'M8 8h12v13H8ZM4 16V3h12',checklist:'m3 6 2 2 3-4m-5 9 2 2 3-4m-5 9 2 2 3-4m4-12h9m-9 7h9m-9 7h9',
        delete:'M4 6h16m-14 0 1 15h10l1-15M9 6V3h6v3m-5 4v7m4-7v7',
        flag:'M5 21V4q4-3 8 0t7 0v11q-3 3-7 0t-8 0',zoom_in:'m16 16 5 5m-4-11a7 7 0 1 1-14 0 7 7 0 0 1 14 0Zm-7-3v6m-3-3h6'
    };
    const glyph=name=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="'+(paths[name]||paths.more_horiz)+'"/></svg>';
    const button = (id, name, title) => '<button type="button" class="im-icon" id="' + id +
        '" aria-label="' + title + '" title="' + title + '">' + glyph(name) + '</button>';
    const emojis = ['👍','❤️','😂','🔥','👏','😮'];
    const stickers = ['🌟','🚀','🎉','🫶','📚','💡','🌱','🏆'];
    const filters = [['all','همهٔ گفتگوها'],['unread','خوانده‌نشده'],['groups','گروه‌ها'],['pinned','سنجاق‌شده'],['archived','بایگانی']];
    let api, filter = 'all', detailOpen = false, selecting = false, chosen = new Set(), gallery = [];
    let overlay, chatKey, searchSerial = 0, presenceTimer, searchTimer;
    let jumpTarget = null;

    function layout() {
        return `
          <div id="im-shell" dir="rtl">
            <aside class="im-sidebar" aria-label="فهرست گفتگوها">
              <header class="desk-brand">
                ${button('im-exit','arrow_forward','بازگشت به درسیار')}
                <h1>پیام‌ها</h1>
                ${button('im-account','account_circle','پروفایل و تنظیمات')}
                ${button('im-new','edit_square','گفتگوی جدید')}
              </header>
              <div class="desk-search-bar"><label class="im-search">${glyph('search')}<input id="im-search" type="search" dir="auto" placeholder="جستجوی گفتگو" aria-label="جستجوی گفتگو"></label>${button('im-global-find','manage_search','جستجو در همه پیام‌ها')}</div>
              <div class="desk-thread-filters"><select id="im-folders" aria-label="فیلتر گفتگوها"></select></div>
              <div id="im-threads" class="im-threads" aria-label="گفتگوها"></div>
            </aside>
            <section class="im-conversation" aria-label="گفتگو">
              <header id="im-header">
                ${button('im-back','arrow_forward','بازگشت به فهرست')}
                <button type="button" id="im-person" aria-controls="im-detail-panel" aria-expanded="false" title="جزئیات گفتگو"><span id="im-avatar" class="im-avatar" aria-hidden="true"></span><span><strong id="im-name" dir="auto"></strong><small id="im-subtitle" dir="auto"></small></span></button>
                ${button('im-options','more_horiz','گزینه‌های گفتگو')}
                <button type="button" id="im-mute" hidden></button><button type="button" id="im-block" hidden></button>
              </header>
              <button type="button" id="im-pinned" hidden></button>
              <div class="desk-stream">
                <div id="im-log" class="im-log" tabindex="0" aria-label="پیام‌های گفتگو"><div class="im-welcome">${glyph('chat_bubble')}<h2>یک گفتگو انتخاب کنید</h2></div></div>
                <span id="im-floating-date" aria-hidden="true" hidden></span>
                ${button('im-jump','keyboard_arrow_down','رفتن به آخرین پیام')}
              </div>
              <div id="im-selection" hidden></div>
              <div id="im-feedback" class="im-feedback" role="status" aria-live="polite"></div>
              <div id="im-compose-area">
                <div id="im-context" hidden></div>
                <div id="im-emojis" hidden>
                  <div class="desk-filters" aria-label="دسته‌بندی انتخابگر"><button type="button" data-palette="emoji" aria-pressed="true">ایموجی</button><button type="button" data-palette="sticker" aria-pressed="false">استیکر</button></div>
                  <div id="im-palette"></div>
                </div>
                <form id="im-compose">
                  ${button('im-attach','attach_file','پیوست فایل')}
                  <input type="file" id="im-file" hidden multiple accept=".jpg,.jpeg,.png,.webp,.gif,.mp4,.webm,.pdf,.txt,.docx,.xlsx,.pptx,.zip">
                  <textarea id="im-input" rows="1" maxlength="4000" dir="auto" placeholder="پیام بنویس…" aria-label="متن پیام"></textarea>
                  ${button('im-emoji-toggle','mood','ایموجی و نماد')}
                  <button id="im-send" type="submit" class="im-send" aria-label="ارسال پیام">${glyph('send')}</button>
                </form>
              </div>
            </section>
            <aside id="im-detail-panel" aria-label="جزئیات گفتگو" hidden></aside>
          </div>`;
    }

    function dialog(title, html) {
        closeDialog();
        const node = document.createElement('dialog');
        node.className = 'desk-dialog';
        node.setAttribute('aria-label', title);
        node.dir = 'rtl';
        node.innerHTML = '<header><h2>' + api.esc(title) + '</h2><button type="button" class="im-icon" data-close aria-label="بستن">' + glyph('close') + '</button></header><div class="desk-dialog-body">' + html + '</div>';
        $('im-shell').append(node);
        node.addEventListener('close', () => { if(overlay===node)overlay=null;node.remove(); });
        node.querySelector('[data-close]').onclick = () => node.close();
        node.addEventListener('click', event => { if(event.target===node)node.close(); });
        overlay = node;
        node.showModal();
        return node;
    }

    function closeDialog() { if(overlay?.open)overlay.close(); }
    function close() { closeDialog(); clearTimeout(presenceTimer); clearTimeout(searchTimer); searchSerial++; }
    function actionButtons(actions) {
        return actions.map(([key,label,icon])=>'<button class="desk-action" type="button" data-desk-action="'+key+'">'+glyph(icon)+api.esc(label)+'</button>').join('');
    }

    function mount(bridge) {
        close();
        api = bridge;
        filter = 'all'; detailOpen = false; chatKey = null;
        const shell = $('im-shell'), log = $('im-log'), input = $('im-input');
        $('im-folders').onchange=event=>{filter=event.target.value;api.renderThreads();};
        $('im-account').onclick = () => {
            const node = dialog('پروفایل و تنظیمات', actionButtons([['profile','پروفایل من','person'],['theme','تغییر تم پیام‌رسان','dark_mode']]));
            node.querySelector('[data-desk-action="profile"]').onclick = () => { node.close(); App.navigate('profile'); };
            node.querySelector('[data-desk-action="theme"]').onclick = () => { shell.classList.toggle('desk-alt-theme'); };
        };
        $('im-options').onclick = options;
        $('im-new').onclick = newConversation;
        $('im-person').onclick = () => setDetails(!detailOpen);
        $('im-global-find').onclick = () => search(true);
        api.renderThreads();
        $('im-pinned').onclick = () => {
            const pin = api.state().settings.messagePin;
            if(pin)void reveal(pin.id);
        };
        $('im-jump').onclick = () => log.scrollTo({top:log.scrollHeight,behavior:motion()?'smooth':'instant'});
        log.addEventListener('scroll', () => { updateScroll();api.read(); }, {passive:true});
        log.addEventListener('contextmenu', event => {
            const entry=event.target.closest('[data-message]');
            if(!entry||event.target.closest('a,video,audio,input'))return;
            event.preventDefault(); menu(entry.dataset.message);
        });
        log.addEventListener('click', onMessageClick);
        let gesture;
        log.addEventListener('pointerdown', event => {
            const entry=event.target.closest('[data-message]');
            if(event.pointerType==='touch'&&entry&&!event.target.closest('a,button,audio,video,input')){
                gesture={id:entry.dataset.message,x:event.clientX,y:event.clientY,pointer:event.pointerId,entry};
            }
        });
        log.addEventListener('pointermove', event => {
            if(!gesture||gesture.pointer!==event.pointerId)return;
            const x=event.clientX-gesture.x,y=event.clientY-gesture.y;
            if(Math.abs(y)>15&&Math.abs(y)>Math.abs(x)){gesture.entry.style.translate='';gesture=null;return;}
            if(x>10&&motion())gesture.entry.style.translate=Math.min(x*.55,45)+'px';
        },{passive:true});
        const clearGesture = () => { if(gesture)gesture.entry.style.translate='';gesture=null; };
        log.addEventListener('pointercancel',clearGesture);
        log.addEventListener('pointerup',event=>{
            if(gesture?.pointer!==event.pointerId)return;
            const {id,x,y}=gesture;clearGesture();
            if(event.clientX-x>52&&Math.abs(event.clientY-y)<32)api.messageAction('reply',api.message(id));
        });
        input.addEventListener('input',()=>api.presence(Boolean(input.value.trim())));
        input.addEventListener('paste',event=>{
            const files=[...(event.clipboardData?.files||[])].filter(file=>file.type.startsWith('image/'));
            if(files.length&&!$('im-input').disabled&&!$('im-attach').disabled){event.preventDefault();api.attach(files);}
        });
        shell.addEventListener('dragover',event=>{
            if(event.dataTransfer?.types.includes('Files')&&!$('im-attach').disabled){
                event.preventDefault();event.dataTransfer.dropEffect='copy';
            }
        });
        shell.addEventListener('drop',event=>{
            const files=[...(event.dataTransfer?.files||[])];
            if(!files.length)return;
            event.preventDefault();if(!$('im-attach').disabled)api.attach(files);
        });
        const picker=$('im-emojis');
        $('im-emoji-toggle').setAttribute('aria-controls',picker.id);
        $('im-emoji-toggle').setAttribute('aria-expanded','false');
        const paintPalette=kind=>{
            picker.querySelectorAll('[data-palette]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.palette===kind)));
            $('im-palette').innerHTML=(kind==='sticker'?stickers:[...emojis,'🥰','😊','🎯','💙','😢','👀','✅','🙏','🤔','🙂'])
                .map(value=>'<button type="button" data-'+kind+'="'+value+'">'+value+'</button>').join('');
        };
        paintPalette('emoji');
        picker.onclick=event=>{
            const item=event.target.closest('button');
            if(item?.dataset.palette)paintPalette(item.dataset.palette);
            if(item?.dataset.sticker&&!input.disabled&&!$('im-attach').disabled){
                picker.hidden=true;$('im-emoji-toggle').setAttribute('aria-expanded','false');
                const canvas=document.createElement('canvas');canvas.width=canvas.height=192;
                const ctx=canvas.getContext('2d');if(!ctx)return;
                ctx.font='138px "Segoe UI Emoji","Apple Color Emoji",sans-serif';
                ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(item.dataset.sticker,96,103);
                const peer=api.state().peer;
                canvas.toBlob(blob=>{if(blob&&peer===api.state().peer)api.attach([new File([blob],'sticker.png',{type:'image/png'})],true);},'image/png');
            }
            if(!item?.dataset.emoji||input.disabled)return;
            if(input.value.length+item.dataset.emoji.length>input.maxLength)return;
            input.setRangeText(item.dataset.emoji,input.selectionStart,input.selectionEnd,'end');
            input.dispatchEvent(new Event('input'));input.focus();
        };
        $('im-emoji-toggle').onclick=()=>{
            picker.hidden=!picker.hidden;$('im-emoji-toggle').setAttribute('aria-expanded',String(!picker.hidden));
            if(!picker.hidden)picker.querySelector('[data-emoji]')?.focus();
        };
        $('im-jump').hidden=true;
    }

    const motion=()=>!matchMedia('(prefers-reduced-motion: reduce)').matches&&document.documentElement.dataset.motion!=='off';
    function threads(items) {
        const query=$('im-search').value.trim().toLocaleLowerCase();
        const folders=[...new Set(items.map(item=>item.settings?.folder).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'fa'));
        const folderSelect=$('im-folders');
        const options=filters.map(([value,label])=>'<option value="'+value+'">'+label+'</option>').join('')+
            (folders.length?'<optgroup label="پوشه‌ها">'+folders.map(name=>'<option value="custom:'+api.esc(name)+'">'+api.esc(name)+'</option>').join('')+'</optgroup>':'');
        if(folderSelect.innerHTML!==options)folderSelect.innerHTML=options;
        if(filter.startsWith('custom:')&&!folders.includes(filter.slice(7)))filter='all';
        folderSelect.value=filter;
        const list=items.filter(t=>{
            if(!t.person||!(filter==='archived'?t.settings?.archived:!t.settings?.archived||query))return false;
            if(filter==='unread'&&!t.unread||filter==='pinned'&&!t.pinned)return false;
            if(filter==='groups'&&!t.person.group)return false;
            if(filter.startsWith('custom:')&&t.settings?.folder!==filter.slice(7))return false;
            return [t.person.name,t.peer,t.preview].some(v=>String(v||'').toLocaleLowerCase().includes(query));
        }).sort((a,b)=>Number(b.pinned)-Number(a.pinned)||(b.at||'').localeCompare(a.at||''));
        const box=$('im-threads');
        const html=list.map(t=>{
            const active=api.state().peer===t.peer;
            return `<div class="desk-thread-row${active?' selected':''}"><button type="button" class="im-thread" data-peer="${api.esc(t.peer)}"${active?' aria-current="true"':''}>
              <span class="im-avatar">${api.avatar(t.person)}</span><span class="im-thread-copy"><strong dir="auto">${api.esc(t.person.name)}</strong>
              <small dir="auto">${api.esc(t.preview||'شروع گفتگو')}</small></span><span class="im-thread-meta"><time>${t.at?formatTime(t.at):''}</time>
              <span>${t.pinned?glyph('push_pin'):''}${t.muted?glyph('notifications_off'):''}${t.unread?'<b aria-label="پیام خوانده‌نشده"></b>':''}</span></span></button>
              <button type="button" class="desk-thread-menu im-icon" data-thread-menu="${api.esc(t.peer)}" aria-label="تنظیمات گفتگو با ${api.esc(t.person.name)}">${glyph('more_horiz')}</button></div>`;
        }).join('')||'<p class="desk-empty-list">گفتگویی در این بخش نیست.</p>';
        if(box.dataset.markup!==html){box.dataset.markup=html;box.innerHTML=html;}
        box.onclick=event=>{
            const choose=event.target.closest('[data-peer]'),more=event.target.closest('[data-thread-menu]');
            if(choose)void api.select(choose.dataset.peer);
            if(more)options(more.dataset.threadMenu);
        };
        box.oncontextmenu=event=>{const choose=event.target.closest('[data-peer]');if(choose){event.preventDefault();options(choose.dataset.peer);}};
    }

    function newConversation(){
        const node=dialog('گفتگوی جدید','<form class="desk-form"><label>نام کاربری درسیار<input name="username" dir="ltr" placeholder="@username" maxlength="33" required autocomplete="off"></label><p role="alert"></p><button type="submit" class="desk-primary">شروع گفتگو</button></form><button id="im-new-group" type="button" class="desk-action">'+glyph('group_add')+'ساخت گروه</button>');
        const form=node.querySelector('form'),status=node.querySelector('[role="alert"]');
        node.querySelector('#im-new-group').onclick=newGroup;
        form.onsubmit=async event=>{
            event.preventDefault();
            const target=form.elements.username.value.trim().replace(/^@/,'').toLowerCase();
            if(!target){status.textContent='نام کاربری را وارد کنید.';return;}
            const submit=form.querySelector('[type="submit"]');
            submit.disabled=true;
            status.textContent='';
            if(await api.select(target,{preserveDialog:true})){if(node.open)node.close();}
            else if(node.open){status.textContent=$('im-feedback').textContent;submit.disabled=false;}
        };
        form.elements.username.focus();
    }

    function newGroup(){
        const node=dialog('ساخت گروه','<form class="desk-form"><label>نام گروه<input name="groupName" maxlength="64" required dir="auto" autocomplete="off"></label><label>نام کاربری اعضا<textarea name="members" rows="3" maxlength="660" required dir="ltr" placeholder="@username"></textarea></label><small>نام کاربری‌ها را با فاصله، ویرگول یا خط جدید جدا کنید.</small><p role="alert"></p><button class="desk-primary" type="submit">ساخت گروه</button></form>');
        const form=node.querySelector('form'),status=node.querySelector('[role="alert"]'),submit=form.querySelector('button[type="submit"]');
        form.onsubmit=async event=>{
            event.preventDefault();submit.disabled=true;status.textContent='';
            const members=form.elements.members.value.toLowerCase().split(/[\s,،]+/u).filter(Boolean).map(name=>name.replace(/^@/,''));
            try{
                const result=await api.createGroup(form.elements.groupName.value,members);
                if(!node.open||!result?.peer)return;
                node.close();
                filter='all';
                await api.select(result.peer);
            }catch(error){if(node.open)status.textContent=error.message;}
            finally{submit.disabled=false;}
        };
    }

    function options(target) {
        const state=api.state();
        const id=typeof target==='string'?target:state.peer;
        const thread=state.threads.find(t=>t.peer===id);
        if(!thread)return;
        const actions=id===state.peer?[['find','جستجو در گفتگو','search'],...(state.canReport&&!state.blocked?[['report','گزارش مطالعه','description']]:[])]:[];
        actions.push(['pin',thread.pinned?'برداشتن سنجاق':'سنجاق کردن گفتگو','push_pin'],['archive',thread.settings?.archived?'بازگرداندن از بایگانی':'بایگانی گفتگو','archive'],['folder','انتقال به پوشه','folder']);
        if(id===state.peer&&!id.startsWith('~')){
            actions.push(['mute',thread.muted?'فعال کردن اعلان‌ها':'بی‌صدا کردن گفتگو','notifications']);
            if(!thread.person.group)actions.push(['block',state.ownBlock?'رفع مسدودسازی':'مسدود کردن کاربر','block']);
        }
        const node=dialog(thread.person.name,actionButtons(actions));
        node.querySelectorAll('[data-desk-action]').forEach(item=>item.onclick=()=>{
            node.close();
            const action=item.dataset.deskAction;
            if(action==='find')return search();
            if(action==='report')return window.MessengerExtras?.openReport();
            if(action==='pin')return api.preferences(id,{pinned:!thread.pinned});
            if(action==='archive')return api.preferences(id,{archived:!thread.settings?.archived});
            if(action==='folder'){
                const prompt=dialog('انتقال به پوشه','<form class="desk-form"><label>نام پوشه<input maxlength="32" dir="auto" list="im-folder-names"></label><datalist id="im-folder-names"></datalist><p>برای خارج‌کردن گفتگو از پوشه، نام را خالی بگذارید.</p><button class="desk-primary">ذخیره</button></form>');
                const input=prompt.querySelector('input');input.value=thread.settings?.folder||'';
                const names=new Set(state.threads.map(t=>t.settings?.folder).filter(Boolean));
                for(const name of names){const option=document.createElement('option');option.value=name;prompt.querySelector('datalist').append(option);}
                prompt.querySelector('form').onsubmit=async event=>{event.preventDefault();if(await api.preferences(id,{folder:input.value}))prompt.close();};
                return;
            }
            $(action==='mute'?'im-mute':'im-block').click();
        });
    }

    const formatTime=at=>new Date(at).toLocaleTimeString('fa-IR',{hour:'2-digit',minute:'2-digit'});
    function header() {
        const state=api.state(), shell=$('im-shell');
        if(chatKey!==state.peer){
            chatKey=state.peer;selected(false);setDetails(false);close();
            if(motion())$('im-log').animate?.([{opacity:.2,transform:'translateX(-9px)'},{opacity:1,transform:'none'}],{duration:240,easing:'cubic-bezier(.2,.8,.25,1)'});
        }
        shell.dataset.wall=state.settings.wallpaper||'plain';
        const pin=state.settings.messagePin;
        $('im-pinned').hidden=!pin;
        if(pin)$('im-pinned').textContent='سنجاق‌شده · '+pin.text;
        clearTimeout(presenceTimer);
        const {at,typing}=state.presence;
        const age=Date.now()-(at||0);
        if(state.person?.group){
            $('im-subtitle').textContent=Number(state.person.memberCount||0).toLocaleString('fa-IR')+' عضو';
        }else if(!state.peer.startsWith('~')&&at&&age<45000){
            if(typing&&age<6500)$('im-subtitle').innerHTML='<span class="desk-typing"><i></i><i></i><i></i></span> در حال نوشتن';
            else $('im-subtitle').textContent='اکنون در این گفتگو';
            presenceTimer=setTimeout(()=>header(),(typing&&age<6500?6500:45000)-age+20);
        }else if(!state.peer.startsWith('~'))$('im-subtitle').textContent=state.peer?'@'+state.peer:'';
    }

    function updateScroll() {
        const log=$('im-log');if(!log)return;
        const top=log.getBoundingClientRect().top;
        const first=document.elementFromPoint(log.getBoundingClientRect().left+24,top+24)?.closest('[data-message]');
        const date=first?.dataset.date||'';
        const float=$('im-floating-date');
        float.hidden=!date||log.scrollTop<100;
        if(date)float.textContent=date;
        $('im-jump').hidden=log.scrollHeight-log.scrollTop-log.clientHeight<130;
    }

    function messageMarkup(all, state, hasMore) {
        const byId=new Map(all.map(m=>[m.id,m]));
        let day, previous, unread=false;
        const result=hasMore?['<button type="button" id="im-older">پیام‌های قدیمی‌تر</button>']:[];
        for(const m of all){
            const label=new Date(m.createdAt).toLocaleDateString('fa-IR',{year:'numeric',month:'long',day:'numeric'});
            if(day!==label){result.push('<div class="im-date">'+api.esc(label)+'</div>');day=label;previous=null;}
            if(!unread&&state.unreadSince&&m.sender!==state.user&&m.createdAt>state.unreadSince){
                result.push('<div class="desk-unread">پیام‌های خوانده‌نشده</div>');unread=true;
            }
            const mine=m.sender===state.user;
            const grouped=previous?.sender===m.sender&&!previous?.deleted&&Date.parse(m.createdAt)-Date.parse(previous.createdAt)<180000;
            const album=m.album&&previous?.album===m.album&&previous.sender===m.sender;
            previous=m;
            const quote=byId.get(m.replyTo);
            const media=m.file&&!m.deleted?fileMarkup(m):'';
            const legacyText=String(m.text||m.message||'');
            const status=m.failed?'ارسال ناموفق':m.pending?'در حال ارسال':state.peer==='~saved'?'ذخیره شد':state.readAt>=m.createdAt?'خوانده شد':state.deliveredAt>=m.createdAt?'تحویل شد':'ارسال شد';
            const body=m.deleted?'<p class="desk-deleted">پیام حذف شد</p>':
                `${m.forwarded?'<small class="desk-forwarded">پیام بازفرستاده‌شده</small>':''}
                ${m.replyTo?'<button type="button" class="desk-quote" data-quote="'+api.esc(m.replyTo)+'"><strong>پاسخ به پیام</strong><span dir="auto">'+api.esc(quote?.deleted?'پیام حذف شد':quote?.text?.slice(0,120)||quote?.file?.name||'مشاهده پیام')+'</span></button>':''}
                ${window.MessengerExtras?.reportHTML(m)||''}${media}${legacyText?'<p dir="auto">'+api.esc(legacyText)+'</p>':''}`;
            result.push(`<article class="im-message${mine?' mine':''}${grouped?' grouped':''}${album?' desk-album':''}" data-message="${api.esc(m.id)}" data-date="${api.esc(label)}">
              ${state.person?.group&&!mine&&!grouped&&!m.deleted?'<strong class="desk-message-author" dir="auto">'+api.esc(m.senderName||m.sender)+'</strong>':''}
              ${body}<footer><span class="desk-reactions">${reactionMarkup(m,state)}</span><time>${formatTime(m.createdAt)}</time>
              ${m.editedAt?'<small>ویرایش شد</small>':''}${mine&&!m.deleted?'<span class="'+(state.readAt>=m.createdAt?'desk-read':'')+'" title="'+status+'" aria-label="'+status+'">'+glyph(m.failed?'error':m.pending?'schedule':state.deliveredAt>=m.createdAt||state.readAt>=m.createdAt?'done_all':'check')+'</span>':''}
              ${m.failed?'<button type="button" data-action="retry">تلاش دوباره</button>':!m.deleted&&!m.pending?'<button type="button" class="desk-message-more" data-action="menu" aria-label="گزینه‌های پیام">'+glyph('more_horiz')+'</button>':''}</footer></article>`);
        }
        if(!all.length)result.push('<div class="im-welcome">'+glyph(state.peer==='~saved'?'bookmark':'chat_bubble')+'<h2>'+(state.peer?'هنوز پیامی وجود ندارد':'یک گفتگو انتخاب کنید')+'</h2></div>');
        return result.join('');
    }

    function reactionMarkup(message, state) {
        const byActor=message.groupReactions||{};
        const mine=state.person?.group?byActor[state.user]:state.reactions.mine?.[message.id];
        const values=state.person?.group?Object.values(byActor):[mine,state.reactions.theirs?.[message.id]];
        return [...new Set(values.filter(Boolean))].map(emoji=>'<button type="button" data-react="'+api.esc(emoji)+'" aria-pressed="'+(mine===emoji)+'" aria-label="واکنش '+api.esc(emoji)+'">'+api.esc(emoji)+' '+values.filter(e=>e===emoji).length+'</button>').join('');
    }

    function fileMarkup(m) {
        const file=m.file,url=api.fileURL(api.state().peer,file.id),name=api.esc(file.name);
        if(file.voice)return window.MessengerExtras?.voiceHTML(file,url)||'';
        if(file.type.startsWith('image/'))return '<button type="button" class="desk-media-thumb'+(file.sticker?' desk-sticker':'')+'" data-media aria-label="باز کردن '+name+'"><img src="'+url+'" alt="'+(file.sticker?'استیکر':name)+'" loading="lazy" decoding="async"></button>';
        if(file.type.startsWith('video/'))return '<button type="button" class="desk-media-thumb desk-video" data-media>'+glyph('play_circle')+name+'</button>';
        return file.type==='text/plain'||file.type==='application/pdf'
            ? '<button type="button" class="im-document" data-document>'+glyph('description')+'<span><strong>'+name+'</strong><small>'+Math.ceil(file.size/1024)+' KB</small></span></button>'
            : '<a class="im-document" href="'+url+'" download="'+name+'">'+glyph('description')+'<span><strong>'+name+'</strong><small>'+Math.ceil(file.size/1024)+' KB</small></span></a>';
    }

    function onMessageClick(event) {
        const entry=event.target.closest('[data-message]');
        if(!entry)return;
        const target=event.target.closest('button'), id=entry.dataset.message;
        if(target?.hasAttribute('data-media'))return mediaViewer(id);
        if(target?.hasAttribute('data-document'))return void previewDocument(id);
        if(target?.dataset.quote)return void reveal(target.dataset.quote);
        if(target?.dataset.react)return void react(id,target.dataset.react);
        if(target?.dataset.action==='menu')return menu(id);
        if(target?.dataset.action==='retry')return api.messageAction('retry',api.message(id));
        if(selecting&&!event.target.closest('a,audio,video,input,select')){
            if(chosen.has(id))chosen.delete(id);else chosen.add(id);
            updateSelection();
        }
    }

    function selected(active, id) {
        selecting=active;chosen=new Set(id?[id]:[]);updateSelection();
    }
    function updateSelection() {
        const node=$('im-selection');if(!node)return;
        node.hidden=!selecting;
        $('im-log').querySelectorAll('[data-message]').forEach(e=>e.classList.toggle('desk-selected',chosen.has(e.dataset.message)));
        if(!selecting)return;
        node.innerHTML='<strong>'+chosen.size.toLocaleString('fa-IR')+' انتخاب</strong>'+actionButtons([['forward','بازفرستادن','forward'],['copy','کپی متن','content_copy'],['cancel','خروج','close']]);
        node.querySelector('[data-desk-action="cancel"]').onclick=()=>selected(false);
        node.querySelector('[data-desk-action="forward"]').onclick=()=>forward([...chosen].map(api.message).filter(m=>m&&!m.pending&&!m.failed&&!m.deleted));
        node.querySelector('[data-desk-action="copy"]').onclick=()=>copy([...chosen].map(id=>api.message(id)?.text||'').filter(Boolean).join('\n'));
    }

    function menu(id) {
        const m=api.message(id);
        if(!m||m.deleted||m.pending)return;
        const state=api.state(), modern=!m.legacy&&!id.startsWith('bot-');
        const actions=[['select','انتخاب چند پیام','checklist']];
        if(m.text)actions.push(['copy','کپی متن','content_copy']);
        if(!m.failed)actions.push(['forward','بازفرستادن','forward']);
        if(modern&&!m.failed){
            actions.push(['reply','پاسخ','reply'],['pin',state.settings.messagePin?.id===id?'برداشتن سنجاق پیام':'سنجاق کردن پیام','push_pin']);
            if(m.sender===state.user&&!m.studyReport)actions.push(['edit','ویرایش','edit'],['delete','حذف پیام','delete']);
            if(m.sender!==state.user&&state.peer!=='~ai')actions.push(['report','گزارش پیام','flag']);
        }
        const node=dialog('گزینه‌های پیام',(modern&&!m.failed?'<div class="desk-emoji-row">'+emojis.map(e=>'<button type="button" data-reaction="'+e+'" aria-label="واکنش '+e+'">'+e+'</button>').join('')+'</div>':'')+actionButtons(actions));
        node.onclick=e=>{
            const btn=e.target.closest('[data-desk-action],[data-reaction]');if(!btn)return;
            node.close();
            if(btn.dataset.reaction)return void react(id,btn.dataset.reaction);
            switch(btn.dataset.deskAction){
            case 'select':return selected(true,id);
            case 'copy':return copy(m.text);
            case 'forward':return forward([m]);
            case 'pin':return api.preferences(state.peer,{messagePin:state.settings.messagePin?.id===id?null:id});
            case 'edit': {
                const edit=dialog('ویرایش پیام','<form class="desk-form"><textarea aria-label="متن پیام" rows="4" maxlength="4000" dir="auto"></textarea><button class="desk-primary">ذخیره تغییر</button></form>');
                edit.querySelector('textarea').value=m.text;
                edit.querySelector('form').onsubmit=async event=>{
                    event.preventDefault();
                    const save=edit.querySelector('.desk-primary');
                    save.disabled=true;
                    if(await api.modify('edit',id,{text:edit.querySelector('textarea').value}))edit.close();
                    else save.disabled=false;
                };return;
            }
            case 'delete': {
                const confirm=dialog('حذف پیام','<p>این پیام از گفتگو حذف می‌شود.</p><button type="button" class="desk-primary">حذف پیام</button>');
                confirm.querySelector('.desk-primary').onclick=async event=>{
                    event.target.disabled=true;
                    if(await api.modify('delete',id))confirm.close();else event.target.disabled=false;
                };return;
            }
            default: return api.messageAction(btn.dataset.deskAction,m);
            }
        };
    }

    async function react(id,emoji) {
        const state=api.state();
        const own=(state.person?.group?api.message(id)?.groupReactions?.[state.user]:state.reactions.mine?.[id])===emoji;
        if(await api.modify('react',id,{emoji:own?null:emoji})&&motion()){
            const chip=$('im-log').querySelector('[data-message="'+CSS.escape(id)+'"] [data-react="'+emoji+'"]');
            chip?.animate?.([{transform:'scale(.82)'},{transform:'scale(1.22)',offset:.6},{transform:'none'}],{duration:250});
        }
    }
    async function copy(value) {
        if(!value)return;
        try{await navigator.clipboard.writeText(value);api.feedback('متن کپی شد.');}
        catch{api.feedback('دسترسی به کلیپ‌بورد فراهم نیست.');}
    }
    function forward(messages) {
        if(!messages.length)return;
        const targets=api.state().threads.filter(t=>t.peer!=='~ai');
        const node=dialog('بازفرستادن پیام',actionButtons(targets.map(t=>[t.peer,t.person.name,'forward']))+'<p role="status"></p>');
        node.querySelectorAll('[data-desk-action]').forEach(item=>item.onclick=async()=>{
            node.querySelectorAll('button[data-desk-action]').forEach(b=>b.disabled=true);
            node.querySelector('[role="status"]').textContent='در حال ارسال…';
            const ok=await api.forward(messages,item.dataset.deskAction);
            if(ok){node.close();selected(false);}else node.querySelector('[role="status"]').textContent='ارسال کامل نشد. نتیجه را در گفتگو بررسی کنید.';
        });
    }

    async function reveal(id) {
        jumpTarget=id;
        const node=await api.findLoaded(id);
        if(jumpTarget!==id)return;
        if(!node){api.feedback('پیام در دسترس نیست.');return;}
        node.scrollIntoView({block:'center',behavior:motion()?'smooth':'instant'});
        if(motion())node.animate?.([{outline:'2px solid var(--im-blue)'},{outline:'2px solid transparent'}],{duration:1000});
    }

    function search(global=false) {
        global=global===true;
        if(!global&&!api.state().peer)return;
        const node=dialog(global?'جستجو در همه پیام‌ها':'جستجو در گفتگو','<input type="search" dir="auto" aria-label="متن جستجو" placeholder="حداقل دو نویسه"><div class="desk-find-results" aria-live="polite"></div>');
        const input=node.querySelector('input'), results=node.querySelector('.desk-find-results');
        input.oninput=()=>{
            clearTimeout(searchTimer);const serial=++searchSerial, term=input.value.trim();
            if(term.length<2){results.textContent='';return;}
            searchTimer=setTimeout(async()=>{
                results.textContent='در حال جستجو…';
                try{
                    const items=await (global?api.globalSearch(term):api.search(term));
                    if(serial!==searchSerial||!node.open)return;
                    results.innerHTML=items.map((message,index)=>'<button type="button" data-hit="'+index+'" dir="auto">'+(global?'<small>'+api.esc(message.peer)+'</small> ':'')+api.esc(message.text.slice(0,180))+'</button>').join('')||'پیامی پیدا نشد.';
                    results.onclick=async event=>{
                        const hit=event.target.closest('[data-hit]');if(!hit)return;
                        const message=items[hit.dataset.hit];node.close();
                        if(global&&message.peer!==api.state().peer&&!(await api.select(message.peer)))return;
                        void reveal(message.id);
                    };
                }catch(error){if(node.open&&serial===searchSerial)results.textContent=error.message;}
            },260);
        };
        input.focus();
    }

    function setDetails(open) {
        detailOpen=open&&Boolean(api?.state().peer);
        const panel=$('im-detail-panel');if(!panel)return;
        panel.hidden=!detailOpen;$('im-shell').classList.toggle('desk-with-details',detailOpen);
        $('im-person').setAttribute('aria-expanded',String(detailOpen));
        if(detailOpen)renderDetails();
    }
    function renderDetails() {
        const state=api.state(), media=state.messages.filter(m=>m.file&&!m.deleted);
        const urls=state.messages.flatMap(m=>[...(m.text||'').matchAll(/https?:\/\/[^\s<>]+/gi)].map(match=>match[0])).slice(-50);
        const panel=$('im-detail-panel');
        panel.innerHTML=`<header><h2>جزئیات گفتگو</h2>${button('im-detail-close','close','بستن جزئیات')}</header>
            <div class="desk-detail-person"><span class="im-avatar">${api.avatar(state.person)}</span><strong dir="auto">${api.esc(state.person?.name)}</strong>${state.person?.group?'<small>'+Number(state.person.memberCount||0).toLocaleString('fa-IR')+' عضو</small>':state.peer.startsWith('~')?'':'<small dir="ltr">'+api.esc('@'+state.peer)+'</small>'}</div>
            <label class="desk-setting">پس‌زمینه گفتگو <select id="im-wall-select"><option value="plain">ساده</option><option value="mist">مه‌آلود</option><option value="dusk">گرگ‌ومیش</option></select></label>
            ${state.peer.startsWith('~')?'':actionButtons([...(state.person?.group?[]:[['profile','مشاهده پروفایل','person']]),['mute',state.threads.find(t=>t.peer===state.peer)?.muted?'فعال کردن اعلان‌ها':'بی‌صدا کردن اعلان‌ها','notifications']])}
            ${[['تصاویر و ویدیو',m=>m.file.type.startsWith('image/')||m.file.type.startsWith('video/')],['اسناد',m=>!m.file.voice&&!/^(audio|image|video)\//.test(m.file.type)],['پیام‌های صوتی',m=>m.file.voice]].map(([label,test])=>'<details><summary>'+label+'</summary>'+media.filter(test).map(m=>'<button type="button" class="desk-action" data-detail-media="'+api.esc(m.id)+'">'+api.esc(m.file.name)+'</button>').join('')+'</details>').join('')}
            <details><summary>پیوندها</summary>${urls.map(url=>'<a href="'+api.esc(url)+'" dir="ltr" target="_blank" rel="noopener noreferrer">'+api.esc(url)+'</a>').join('')}</details>
            ${state.hasMore?'<button type="button" class="desk-action" id="im-detail-more">بارگیری موارد قدیمی‌تر</button>':''}`;
        $('im-detail-close').onclick=()=>setDetails(false);
        $('im-wall-select').value=state.settings.wallpaper||'plain';
        $('im-wall-select').onchange=event=>api.preferences(state.peer,{wallpaper:event.target.value});
        panel.querySelector('[data-desk-action="profile"]')?.addEventListener('click',()=>Community.profile(state.peer));
        panel.querySelector('[data-desk-action="mute"]')?.addEventListener('click',()=>$('im-mute').click());
        $('im-detail-more')?.addEventListener('click',async()=>{await api.older();if(detailOpen)renderDetails();});
        panel.querySelectorAll('[data-detail-media]').forEach(b=>b.onclick=()=>{
            const m=api.message(b.dataset.detailMedia);
            if(m&&/^(image|video)\//.test(m.file.type))mediaViewer(m.id);
            else void reveal(b.dataset.detailMedia);
        });
    }

    function mediaViewer(id) {
        gallery=api.state().messages.filter(m=>m.file&&!m.deleted&&/^(image|video)\//.test(m.file.type));
        let index=gallery.findIndex(m=>m.id===id);if(index<0)return;
        const node=dialog('نمایش رسانه','<div class="desk-gallery-stage"></div><div class="desk-gallery-bar">'+actionButtons([['prev','قبلی','chevron_right'],['zoom','بزرگ‌نمایی','zoom_in'],['next','بعدی','chevron_left']])+'<a download>دانلود</a></div>');
        node.classList.add('desk-gallery');
        const stage=node.querySelector('.desk-gallery-stage');
        const paint=()=>{
            const m=gallery[index],file=m.file, url=api.fileURL(api.state().peer,file.id);
            const image=file.type.startsWith('image/');
            stage.classList.remove('zoom');
            stage.innerHTML=image?'<img src="'+url+'" alt="'+api.esc(file.name)+'">':'<video controls playsinline preload="metadata" src="'+url+'"></video>';
            const download=node.querySelector('a');download.href=url;download.download=file.name;
            node.querySelector('[data-desk-action="prev"]').disabled=index===0;
            node.querySelector('[data-desk-action="next"]').disabled=index===gallery.length-1;
            node.querySelector('[data-desk-action="zoom"]').hidden=!image;
        };
        const move=step=>{index=Math.max(0,Math.min(index+step,gallery.length-1));paint();};
        node.querySelector('[data-desk-action="prev"]').onclick=()=>move(-1);
        node.querySelector('[data-desk-action="next"]').onclick=()=>move(1);
        node.querySelector('[data-desk-action="zoom"]').onclick=()=>stage.classList.toggle('zoom');
        let drag;
        stage.addEventListener('pointerdown',event=>{
            if(!stage.classList.contains('zoom')||event.pointerType==='touch')return;
            event.preventDefault();stage.setPointerCapture(event.pointerId);
            drag={x:event.clientX,y:event.clientY,left:stage.scrollLeft,top:stage.scrollTop};
        });
        stage.addEventListener('pointermove',event=>{
            if(!drag)return;
            stage.scrollLeft=drag.left+drag.x-event.clientX;
            stage.scrollTop=drag.top+drag.y-event.clientY;
        });
        for(const type of ['pointerup','pointercancel','lostpointercapture'])stage.addEventListener(type,()=>{drag=null;});
        node.addEventListener('keydown',event=>{
            if(event.target.closest('video'))return;
            if(event.key==='ArrowLeft')move(1);if(event.key==='ArrowRight')move(-1);
        });
        paint();
    }
    async function previewDocument(id){
        const file=api.message(id)?.file, peer=api.state().peer;
        if(!file)return;
        const url=api.fileURL(peer,file.id), controller=new AbortController();
        const node=dialog(file.name,'<div role="status">در حال دریافت…</div><a class="desk-action" href="'+url+'" download="'+api.esc(file.name)+'">دانلود فایل</a>');
        const body=node.querySelector('[role="status"]');
        let source='';
        node.addEventListener('close',()=>{controller.abort();if(source)URL.revokeObjectURL(source);},{once:true});
        try{
            const response=await fetch(url,{credentials:'same-origin',signal:controller.signal});
            if(!response.ok)throw Error();
            if(file.type==='text/plain'){
                const pre=document.createElement('pre');pre.dir='auto';pre.textContent=(await response.text()).slice(0,32000);body.replaceChildren(pre);
            }else{
                const blob=await response.blob();if(!node.open)return;
                source=URL.createObjectURL(blob);
                const frame=document.createElement('iframe');frame.title=file.name;frame.setAttribute('sandbox','');frame.src=source;body.replaceChildren(frame);
            }
        }catch{if(!controller.signal.aborted)body.textContent='پیش‌نمایش در دسترس نیست.';}
    }

    function afterMessages() { updateSelection();updateScroll(); }
    function loading() {
        $('im-log').innerHTML='<div class="desk-loading" role="status" aria-label="در حال بارگیری گفتگو"><i></i><i></i><i></i></div>';
    }
    return {layout,mount,threads,header,messageMarkup,afterMessages,loading,close};
})();
