/** Independent web workspaces; native AI screens and persisted data keys stay intact. */
const AIWorkspace = (() => {
    const config = {
        chat: {route:'ai-assistant', label:'دستیار یادگیری', icon:'spark'},
        writing: {route:'ai-writing', label:'کارگاه نوشتن', icon:'note', key:'essays', limit:15},
        research: {route:'ai-research', label:'میز پژوهش', icon:'compass', key:'researches', limit:10}
    };
    const state = {};
    let owner = null;
    const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const icon = name => WebStudio.icon(name);
    const pd = value => Utils.toPersianDigits(value);
    const el = id => document.getElementById(id);
    const words = text => String(text || '').trim().split(/\s+/).filter(Boolean).length;
    const username = () => Storage.getCurrentUser()?.username;
    const rows = key => { const value = Storage.get(key, []); return Array.isArray(value) ? value : []; };
    const messageHistory = () => rows('ai_chat_history').filter(row => ['user','assistant'].includes(row?.role) && typeof row.content === 'string');
    const dayKey = () => { const now = new Date(); return new Date(now - now.getTimezoneOffset()*60000).toISOString().slice(0,10); };
    const usage = () => { const data = Storage.get('ai_usage', {}); return data?.date === dayKey() ? Math.max(0, Number(data.count)||0) : 0; };
    const unlimited = () => { const user=Storage.getCurrentUser(); return user?.role==='admin' || ['gold','silver'].includes(user?.plan); };
    const button = (action, label, glyph='arrow', cls='') => `<button type="button" class="aw-button ${cls}" data-action="${action}">${icon(glyph)}<span>${label}</span></button>`;
    const select = (kind,name,label,options,selected) => `<label class="aw-field">${label}<select name="${name}" id="aw-${kind}-${name}">${options.map(([value,text])=>`<option value="${esc(value)}" ${String(value)===String(selected)?'selected':''}>${text}</option>`).join('')}</select></label>`;

    function enter(kind) {
        if (!WebStudio.enabled() || !config[kind] || !username()) return;
        if (owner !== username()) {
            Object.values(state).forEach(item=>item.controller?.abort());
            Object.keys(state).forEach(key=>delete state[key]);
            Object.values(config).forEach(item=>{ const view=el(`view-${item.route}`); view?.classList.remove('aw-mounted'); });
            owner=username();
        }
        const view=el(`view-${config[kind].route}`);
        if (!state[kind]) state[kind]={busy:false,content:'',title:'',id:null,truncated:false,editing:false};
        if (!view.classList.contains('aw-mounted')) {
            view.classList.add('aw-mounted','aw-workspace'); view.dataset.workspace=kind;
            view.innerHTML = shell(kind) + (kind==='chat' ? chatLayout() : documentLayout(kind));
            if (kind==='chat') {
                state.chat.prompts=[...view.querySelectorAll('.aw-prompt')].map(button=>button.outerHTML).join('');
                view.querySelector('.aw-chat-guide').remove();
                view.querySelector('.aw-tool-nav').hidden=true;
                view.querySelector('.aw-conversation-header').insertAdjacentHTML('afterbegin',`<button type="button" class="aw-button aw-back" data-route="dashboard">${icon('arrow')}<span>بازگشت به سایت</span></button>`);
                view.querySelector('.aw-back').setAttribute('aria-label','بازگشت به سایت');
            }
            if (!view.dataset.awBound) {
                view.dataset.awBound='true';
                view.addEventListener('click',onClick);
                view.addEventListener('submit',event=>{event.preventDefault();kind==='chat'?sendChat():generate(kind);});
                view.addEventListener('input',event=>{
                if(event.target.matches('[data-history-search]')) renderHistory(kind);
                if(event.target.id==='aw-chat-input') { event.target.style.height='auto';event.target.style.height=`${Math.min(180,event.target.scrollHeight)}px`; }
                });
            }
            if(kind==='chat') el('aw-chat-input').addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();sendChat();}});
        }
        if(kind==='chat') renderChat(); else renderHistory(kind);
        sync(kind);
    }

    function shell(kind) {
        return `<nav class="aw-tool-nav" aria-label="ابزارهای هوش مصنوعی">${Object.entries(config).map(([key,item])=>`<button type="button" data-route="${item.route}" ${kind===key?'aria-current="page"':''}>${icon(item.icon)}${item.label}</button>`).join('')}<span class="aw-tool-signature">فضایی برای فکرهای بزرگ‌تر</span></nav>`;
    }

    function chatLayout() {
        return `<div class="aw-chat-layout"><aside class="aw-chat-guide" data-reveal><span class="aw-kicker">یادگیری، با گفت‌وگو</span><div class="aw-emblem">${icon('spark')}</div><h1>از «نمی‌فهمم»<br>تا «یاد گرفتم».</h1><p>سؤالت را بپرس؛ مسئله را با هم قدم‌به‌قدم باز می‌کنیم.</p><div class="aw-guide-separator"></div><span class="aw-kicker">از کجا شروع کنیم؟</span>${[['یک مسئله را قدم‌به‌قدم حل کنیم','مسئله‌ام این است: '],['یک مفهوم را ساده توضیح بده','این مفهوم را با یک مثال ساده توضیح بده: '],['از من سؤال تمرینی بپرس','درباره این مبحث از من سؤال تمرینی بپرس: '],['نکته‌های یک متن را خلاصه کن','نکته‌های مهم این متن را خلاصه کن: ']].map(([label,prompt],i)=>`<button class="aw-prompt" type="button" data-prompt="${esc(prompt)}"><span>${pd(String(i+1).padStart(2,'0'))}</span>${label}${icon('arrow')}</button>`).join('')}<p class="aw-footnote">پاسخ‌های هوش مصنوعی ممکن است خطا داشته باشند؛ نکات مهم را با کتاب یا معلمت بررسی کن.</p></aside><section class="aw-conversation" data-reveal><header class="aw-conversation-header"><div><span class="aw-presence"></span><strong>دستیار درسیار</strong><small id="aw-chat-quota"></small></div>${button('clear-chat','پاک‌کردن گفت‌وگو','plus','quiet')}</header><div id="aw-chat-feed" class="aw-chat-feed" role="log" aria-label="گفت‌وگو با دستیار"></div><div id="aw-chat-status" class="aw-status" role="status" aria-live="polite" hidden></div><form class="aw-composer"><label for="aw-chat-input" class="aw-sr-only">پیام به دستیار</label><textarea id="aw-chat-input" maxlength="10000" rows="2" placeholder="هر سؤال، شروع یک کشف تازه است…"></textarea><div class="aw-composer-footer"><small>Enter ارسال · Shift + Enter خط جدید</small><button class="aw-send" type="submit" id="aw-chat-submit" aria-label="ارسال پیام">${icon('arrow')}</button>${button('cancel','توقف','plus','aw-cancel')}</div></form><p class="aw-chat-disclaimer">اطلاعات شخصی و رمز عبورت را در پیام‌ها ننویس.</p></section></div>`;
    }

    function documentLayout(kind) {
        const research=kind==='research';
        const title=research?'از یک سؤال، به یک دید تازه.':'فکرت را به کلمه تبدیل کن.';
        const controls=research
            ? select(kind,'level','سطح مخاطب',[['دانش‌آموزی (متوسطه)','دانش‌آموزی'],['دانشگاهی (کارشناسی)','کارشناسی'],['تحصیلات تکمیلی','تحصیلات تکمیلی']],'دانشگاهی (کارشناسی)')+select(kind,'count','گستردگی پژوهش',[[3,'۳ بخش · کوتاه'],[5,'۵ بخش · استاندارد'],[7,'۷ بخش · جامع'],[9,'۹ بخش · مفصل']],5)+select(kind,'style','شیوه ارجاع‌دهی',[['APA 7th','APA 7'],['Harvard','Harvard'],['Vancouver','Vancouver'],['IEEE','IEEE']],'APA 7th')
            : select(kind,'grade','برای چه مقطعی؟',[['ابتدایی','ابتدایی'],['متوسطه اول','متوسطه اول'],['متوسطه دوم','متوسطه دوم'],['دانشجویی و عمومی','دانشجویی و عمومی']],'متوسطه دوم')+select(kind,'length','حجم نوشته',[[200,'کوتاه · حدود ۲۰۰ کلمه'],[400,'متوسط · حدود ۴۰۰ کلمه'],[700,'بلند · حدود ۷۰۰ کلمه'],[1200,'مفصل · حدود ۱۲۰۰ کلمه']],400)+select(kind,'tone','حال‌وهوای متن',[['ادبی و توصیفی','ادبی و توصیفی'],['احساسی و عاطفی','احساسی و عاطفی'],['علمی و تحلیلی','علمی و تحلیلی'],['طنزآمیز و شیرین','طنزآمیز و شیرین']],'ادبی و توصیفی');
        return `<header class="aw-document-heading" data-reveal><div><span class="aw-kicker">${research?'میز پژوهش / از پرسش تا پیش‌نویس':'کارگاه نوشتن / از ایده تا روایت'}</span><h1>${title}</h1><p>${research?'موضوع را مشخص کن، ساختار بده و پیش‌نویس پژوهشت را شکل بده.':'موضوع از تو؛ یک شروع، یک روایت و یک پایان منسجم با همراهی درسیار.'}</p></div><div class="aw-heading-art" aria-hidden="true">${icon(config[kind].icon)}<span>✦</span></div></header><div class="aw-document-layout"><aside class="aw-brief" data-reveal><form id="aw-${kind}-form"><fieldset><legend><span>۰۱</span> ${research?'نقشه پژوهش':'ایده و حال‌وهوا'}</legend><label class="aw-field" for="aw-${kind}-topic">${research?'چه پرسشی را بررسی می‌کنی؟':'درباره چه چیزی بنویسیم؟'}</label><textarea id="aw-${kind}-topic" name="topic" rows="3" required maxlength="1500" placeholder="${research?'مثلاً: نقش خواب کافی در یادگیری نوجوانان':'مثلاً: نامه‌ای به خودم در ده سال آینده'}"></textarea><div class="aw-fields">${controls}</div><label class="aw-field" for="aw-${kind}-brief">نکته‌های تو <small>اختیاری</small></label><textarea id="aw-${kind}-brief" name="brief" rows="2" maxlength="2500" placeholder="${research?'محدوده موضوع، پرسش اصلی یا نکته‌هایی که باید بررسی شوند…':'ایده‌ها، تجربه‌ها یا نکته‌هایی که دوست داری در متن باشند…'}"></textarea><button type="submit" class="aw-button aw-primary">${icon('spark')}<span>${research?'ساخت پیش‌نویس پژوهش':'شروع نوشتن'}</span></button></fieldset></form>${button('cancel','توقف درخواست','plus','aw-cancel')}<p class="aw-brief-note">${research?'منابع تولیدشده تأییدشده نیستند. پیش از استفاده، وجود و صحت هر ارجاع را بررسی کن.':'این متن یک پیش‌نویس است؛ با تجربه‌ها و زبان خودت بازنویسی‌اش کن.'}</p><details class="aw-library" open><summary>${icon('book')} ${research?'پژوهش‌های من':'نوشته‌های من'}<span id="aw-${kind}-history-count">۰</span></summary><label class="aw-sr-only" for="aw-${kind}-search">جست‌وجو در تاریخچه</label><input id="aw-${kind}-search" data-history-search type="search" placeholder="جست‌وجوی عنوان…"><div id="aw-${kind}-history" class="aw-history"></div></details></aside><section class="aw-document-desk" data-reveal><header class="aw-document-toolbar"><div><span class="aw-kicker">۰۲ / ${research?'پیش‌نویس پژوهش':'بوم نوشتن'}</span><strong id="aw-${kind}-title">${research?'یک پرسش خوب، آغاز یک پژوهش خوب':'هنوز همه‌چیز ممکن است'}</strong><small id="aw-${kind}-meta">متن اینجا شکل می‌گیرد</small></div><div class="aw-document-actions">${button('edit','ویرایش','note')}${button('copy','کپی','cards')}${button('print','چاپ','book')}</div></header><div id="aw-${kind}-status" class="aw-status" role="status" aria-live="polite" hidden></div>${research?'<nav id="aw-research-outline" class="aw-outline" aria-label="بخش‌های پژوهش" hidden></nav>':''}<article id="aw-${kind}-output" class="aw-paper"><div class="aw-blank"><div class="aw-paper-art" aria-hidden="true"><i></i><i></i><i></i>${icon(config[kind].icon)}</div><span class="aw-kicker">${research?'پرسش / بررسی / نتیجه':'ایده / روایت / بازنویسی'}</span><h2>${research?'به موضوعت عمق بده.':'هر نوشته، با یک جرقه شروع می‌شود.'}</h2><p>${research?'موضوع و محدوده را در فرم مشخص کن. پیش‌نویس به همراه ساختار بخش‌ها همین‌جا نمایش داده می‌شود.':'یک موضوع انتخاب کن و لحن دلخواهت را مشخص کن؛ این صفحه، جای شکل‌گرفتن روایت توست.'}</p><div class="aw-blank-steps"><span>۱. موضوع</span><span>۲. ساخت پیش‌نویس</span><span>۳. بازبینی تو</span></div></div></article><div id="aw-${kind}-editor" class="aw-editor" hidden><label for="aw-${kind}-edit-text">ویرایش متن (Markdown)</label><textarea id="aw-${kind}-edit-text" rows="20"></textarea><div>${button('save-edit','ذخیره ویرایش','check','aw-primary')}${button('discard-edit','انصراف','arrow')}</div></div><footer class="aw-paper-footer"><span>${research?'ارجاع معتبر، نتیجه قابل‌اعتماد.':'بهترین نسخه، نسخه‌ای است که صدای تو را دارد.'}</span>${button('continue','ادامه متن','arrow','aw-continue')}</footer></section></div>`;
    }

    function onClick(event) {
        const target=event.target.closest('button'); if(!target) return;
        const kind=event.currentTarget.dataset.workspace;
        if(target.dataset.route) return App.navigate(target.dataset.route);
        if(target.dataset.prompt) {el('aw-chat-input').value=target.dataset.prompt;el('aw-chat-input').focus();return;}
        if(target.dataset.historyId) return load(kind,target.dataset.historyId);
        if(target.dataset.section) {el(target.dataset.section)?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'center'});return;}
        switch(target.dataset.action) {
            case 'cancel': state[kind].controller?.abort();break;
            case 'clear-chat': if(!state.chat.busy && confirm('تاریخچه این گفت‌وگو پاک شود؟')){Storage.set('ai_chat_history',[]);renderChat();}break;
            case 'copy': if(state[kind].content) Utils.copyToClipboard(state[kind].content,'متن کپی شد.');break;
            case 'print': if(state[kind].content) Utils.printElement(`aw-${kind}-output`,esc(state[kind].title));break;
            case 'edit': state[kind].editing=true;el(`aw-${kind}-edit-text`).value=state[kind].content;sync(kind);el(`aw-${kind}-edit-text`).focus();break;
            case 'discard-edit':state[kind].editing=false;sync(kind);break;
            case 'save-edit': {
                const text=el(`aw-${kind}-edit-text`).value.trim();if(!text)return;
                state[kind].content=text;state[kind].editing=false;persist(kind);showDocument(kind);sync(kind);break;
            }
            case 'continue':generate(kind,true);break;
        }
    }

    function sync(kind) {
        const item=state[kind],view=el(`view-${config[kind].route}`);if(!view||!item)return;
        view.setAttribute('aria-busy',String(item.busy));
        view.querySelectorAll('.aw-cancel').forEach(button=>button.hidden=!item.busy);
        view.querySelectorAll('fieldset').forEach(field=>field.disabled=item.busy||item.editing);
        view.querySelectorAll('[data-history-id]').forEach(button=>button.disabled=item.busy||item.editing);
        view.querySelectorAll('[data-action="copy"],[data-action="print"],[data-action="edit"]').forEach(button=>button.disabled=!item.content||item.busy||item.editing);
        if(kind==='chat') {
            view.querySelectorAll('[data-prompt]').forEach(button=>button.disabled=item.busy);
            el('aw-chat-submit').disabled=item.busy;el('aw-chat-input').disabled=item.busy;
            view.querySelector('[data-action="clear-chat"]').disabled=item.busy;
            el('aw-chat-quota').textContent=unlimited()?'حساب ویژه':`${pd(Math.max(0,10-usage()))} پیام باقی‌مانده امروز`;
        } else {
            el(`aw-${kind}-editor`).hidden=!item.editing;el(`aw-${kind}-output`).hidden=item.editing;
            if(kind==='research') el('aw-research-outline').hidden=item.editing||!el('aw-research-outline').children.length;
            view.querySelector('.aw-continue').hidden=!item.truncated||item.busy||item.editing;
        }
    }

    function status(kind,text='',error=false) {
        const box=el(`aw-${kind}-status`);if(!box)return;
        box.hidden=!text;box.textContent=text;box.classList.toggle('is-error',error);
    }

    async function request(messages,maxTokens,signal) {
        const response=await fetch('/api/ai',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},signal,body:JSON.stringify({model:Storage.getSettings().aiModel||'gapgpt-qwen-3.5',messages,temperature:.65,max_tokens:maxTokens})});
        if(!response.ok) throw new Error(response.status===429?'درخواست‌ها زیاد شده‌اند؛ کمی بعد دوباره تلاش کن.':response.status===401?'نشستت پایان یافته؛ دوباره وارد حساب شو.':'ارتباط با سرویس هوشمند برقرار نشد؛ دوباره تلاش کن.');
        const data=await response.json(),choice=data.choices?.[0];
        if(typeof choice?.message?.content!=='string'||!choice.message.content.trim())throw new Error('پاسخ قابل‌نمایشی دریافت نشد؛ دوباره تلاش کن.');
        return {text:choice.message.content.trim(),truncated:choice.finish_reason==='length'};
    }

    function renderChat() {
        const messages=messageHistory(),item=state.chat;
        const display=item.busy?[...messages,{role:'user',content:item.pending}]:messages;
        el('aw-chat-feed').innerHTML=display.length?display.map(message=>`<article class="aw-message ${message.role}"><span class="aw-message-mark">${icon(message.role==='user'?'user':'spark')}</span><div><span class="aw-message-label">${message.role==='user'?'تو':'درسیار'}</span><div class="aw-prose">${Utils.renderKaTeXAndMarkdown(message.content)}</div></div></article>`).join(''):`<div class="aw-chat-welcome"><div class="aw-welcome-orbit" aria-hidden="true">${icon('spark')}</div><span class="aw-kicker">کنجکاوی‌ات را دنبال کن</span><h2>امروز چه چیزی را<br><em>با هم یاد بگیریم؟</em></h2><p>مسئله، متن یا مفهومی که ذهنت را درگیر کرده بنویس.</p></div>`;
        const feed=el('aw-chat-feed');
        if (!display.length) {
            const suggestions=document.createElement('div');suggestions.className='aw-empty-prompts';
            suggestions.innerHTML=item.prompts||'';
            feed.querySelector('.aw-chat-welcome').append(suggestions);
        }
        feed.scrollTop=feed.scrollHeight;
        if (!display.length) feed.scrollTop=0;
    }

    async function sendChat() {
        const item=state.chat,input=el('aw-chat-input'),text=input.value.trim();
        if(item.busy||!text)return;
        if(!unlimited()&&usage()>=10){status('chat','اعتبار امروز تمام شده است؛ فردا دوباره می‌توانی گفت‌وگو کنی.',true);return;}
        const user=owner,history=messageHistory();
        item.busy=true;item.pending=text;item.controller=new AbortController();
        status('chat','در حال فکرکردن به سؤال تو…');sync('chat');renderChat();
        try {
            const result=await request([{role:'user',content:'به فارسی، دقیق و آموزشی پاسخ بده. مسئله را گام‌به‌گام توضیح بده و عدم اطمینان را روشن کن. فرمول‌ها را با LaTeX بنویس.'},...history.slice(-8),{role:'user',content:text}],2400,item.controller.signal);
            if(username()!==user||owner!==user)return;
            Storage.set('ai_chat_history',[...history,{role:'user',content:text},{role:'assistant',content:result.text}]);
            Storage.set('ai_usage',{date:dayKey(),count:usage()+1});Storage.addXP(5);input.value='';input.style.height='auto';
            status('chat',result.truncated?'پاسخ به محدودیت طول رسید؛ برای جزئیات بیشتر یک سؤال تکمیلی بپرس.':'');
        } catch(error) { if(username()===user&&owner===user)status('chat',error.name==='AbortError'?'درخواست متوقف شد؛ پیام تو برای ارسال دوباره حفظ شده است.':error.message,true); }
        finally { item.busy=false;item.controller=null;if(owner===user&&username()===user){renderChat();sync('chat');} }
    }

    async function generate(kind,continuation=false) {
        const item=state[kind],form=el(`aw-${kind}-form`);
        if(item.busy||item.editing||(!continuation&&!form.reportValidity()))return;
        const fields=Object.fromEntries(new FormData(form)),user=owner;
        if(!continuation&&!fields.topic.trim()){el(`aw-${kind}-topic`).focus();return;}
        const research=kind==='research',target=research?({3:750,5:1200,7:1800,9:2400}[fields.count]||1200):Number(fields.length);
        const prompt=research?`پیش‌نویس پژوهشی فارسی با عنوان «${fields.topic}» برای سطح ${fields.level} بنویس. چکیده، مقدمه، ${fields.count} بخش بدنه با تیتر Markdown، نتیجه‌گیری و منابع پیشنهادی داشته باشد. حدود ${target} کلمه. سبک ارجاع ${fields.style}. منبع، نقل‌قول، نویسنده، آمار یا DOI ساختگی نساز. منابع تأییدنشده را صریحاً مشخص کن. ادعای جست‌وجو یا راستی‌آزمایی انجام‌نشده نکن.`:`انشای فارسی درباره «${fields.topic}» برای مقطع ${fields.grade} با لحن ${fields.tone} بنویس. حدود ${target} کلمه، دارای مقدمه، بدنه منسجم و پایان مشخص. متن متناسب با موضوع و غیرتکراری باشد. فقط متن نهایی با تیترهای Markdown را بنویس.`;
        const messages=continuation?[{role:'user',content:`متن زیر درباره «${item.title}» نیمه‌کاره مانده است. بدون تکرار و بدون مقدمه اضافی، از محل قطع‌شدن ادامه بده و آن را کامل کن:\n${item.content.slice(-9000)}`}]:[{role:'user',content:prompt+`\nنکات نویسنده: ${fields.brief||'ندارد'}`}];
        item.busy=true;item.controller=new AbortController();sync(kind);
        status(kind,continuation?'در حال ادامه‌دادن متن…':'در حال ساخت پیش‌نویس؛ می‌توانی به صفحه‌های دیگر سر بزنی.');
        try {
            const result=await request(messages,Math.min(6000,Math.max(1600,target*5)),item.controller.signal);
            if(username()!==user||owner!==user)return;
            item.content=continuation?item.content+'\n\n'+result.text:result.text;item.truncated=result.truncated;
            if(!continuation){item.id=`${research?'res':'ess'}-${Date.now()}`;item.title=fields.topic.trim();item.fields=fields;}
            persist(kind);showDocument(kind);if(!continuation)Storage.addXP(research?30:20);
            status(kind,result.truncated?'متن به محدودیت طول پاسخ رسید. با «ادامه متن» آن را کامل کن.':'پیش‌نویس آماده شد. قبل از استفاده، متن را بازبینی کن.');
        } catch(error) {if(username()===user&&owner===user)status(kind,error.name==='AbortError'?'درخواست متوقف شد. تنظیمات و متن قبلی حفظ شده‌اند.':error.message,true);}
        finally {item.busy=false;item.controller=null;if(owner===user&&username()===user)sync(kind);}
    }

    function persist(kind) {
        const item=state[kind],settings=config[kind],existing=rows(settings.key),previous=existing.find(row=>row.id===item.id)||{};
        const record={...previous,...item.fields,id:item.id,title:item.title,content:item.content,truncated:item.truncated,date:previous.date||Utils.getJalaliDateNumeric()};
        Storage.set(settings.key,[record,...existing.filter(row=>row.id!==item.id)].slice(0,settings.limit));renderHistory(kind);
    }

    function renderHistory(kind) {
        const query=el(`aw-${kind}-search`).value.trim(),items=rows(config[kind].key);
        el(`aw-${kind}-history-count`).textContent=pd(items.length);
        const list=el(`aw-${kind}-history`);list.replaceChildren();
        items.filter(item=>String(item.title).includes(query)).forEach(item=>{
            const button=document.createElement('button');button.type='button';button.dataset.historyId=String(item.id);button.className='aw-history-item';
            button.innerHTML=`${icon(config[kind].icon)}<span><strong>${esc(item.title)}</strong><small>${esc(item.date||'')} · ${pd(words(item.content))} کلمه</small></span>${icon('arrow')}`;
            button.disabled=state[kind].busy||state[kind].editing;list.append(button);
        });
        if(!list.children.length){const empty=document.createElement('p');empty.textContent=query?'نوشته‌ای با این عنوان پیدا نشد.':'هنوز چیزی ذخیره نکرده‌ای؛ اولین پیش‌نویس از همین‌جا شروع می‌شود.';list.append(empty);}
    }

    function load(kind,id) {
        const item=state[kind];if(item.busy||item.editing)return;
        const record=rows(config[kind].key).find(row=>String(row.id)===id);if(!record)return;
        Object.assign(item,{id:record.id,title:record.title,content:String(record.content||''),fields:record,truncated:Boolean(record.truncated)});
        el(`aw-${kind}-topic`).value=record.title||'';
        ['grade','length','tone','level','count','style','brief'].forEach(key=>{const field=el(`aw-${kind}-${key}`);if(field&&record[key]!=null){if(field.tagName!=='SELECT'||[...field.options].some(option=>option.value===String(record[key])))field.value=record[key];}});
        showDocument(kind);status(kind,'از تاریخچه باز شد.');sync(kind);
    }

    function showDocument(kind) {
        const item=state[kind],output=el(`aw-${kind}-output`);
        el(`aw-${kind}-title`).textContent=item.title;el(`aw-${kind}-meta`).textContent=`${pd(words(item.content))} کلمه · حدود ${pd(Math.max(1,Math.ceil(words(item.content)/180)))} دقیقه مطالعه`;
        output.innerHTML=Utils.renderKaTeXAndMarkdown(item.content);output.classList.add('aw-prose');
        if(kind==='research') {
            const outline=el('aw-research-outline');outline.replaceChildren();
            output.querySelectorAll('h2,h3,h4').forEach((heading,i)=>{heading.id=`aw-research-section-${i}`;const button=document.createElement('button');button.type='button';button.dataset.section=heading.id;button.textContent=heading.textContent;outline.append(button);});
            outline.hidden=!outline.children.length;
        }
    }
    return {enter};
})();
window.AIWorkspace=AIWorkspace;
