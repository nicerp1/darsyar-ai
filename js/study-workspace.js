/** Web-only study surfaces; shared timer and flashcard engines remain the source of truth. */
const StudyWorkspace=(()=>{
    const icon=name=>WebStudio.icon(name);
    const pd=value=>Utils.toPersianDigits(value);
    const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const rows=key=>{const data=Storage.get(key,[]);return Array.isArray(data)?data:[];};
    const key=(date=new Date())=>new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,10);
    const positive=value=>Number.isFinite(Number(value))?Math.max(0,Number(value)):0;
    function duration(value){const seconds=Math.round(positive(value)),hours=Math.floor(seconds/3600),minutes=Math.floor(seconds%3600/60),rest=seconds%60;return `${pd(hours)} ساعت و ${pd(minutes)} دقیقه${rest?` و ${pd(rest)} ثانیه`:''}`;}
    function data(){
        const days=new Map(),subjects=new Map();
        const add=(date,seconds)=>{if(/^\d{4}-\d{2}-\d{2}$/.test(date))days.set(date,(days.get(date)||0)+seconds);};
        rows('study_history').forEach(row=>add(row.date,Math.round(positive(row.hours)*3600)));
        rows('manual_reports').filter(row=>row.status!=='missed').forEach(row=>{const seconds=Math.round(positive(row.minutes)*60);add(row.date,seconds);if(row.subject)subjects.set(row.subject,(subjects.get(row.subject)||0)+seconds);});
        return {days,subjects};
    }
    function heading(kicker,title,subtitle,action){return `<header class="sw-heading" data-reveal><div><span class="sw-kicker">${kicker}</span><h1>${title}</h1><p>${subtitle}</p></div>${action||''}</header>`;}
    const btn=(label,action,glyph='plus')=>`<button type="button" class="sw-button" onclick="${action}">${icon(glyph)}${label}</button>`;
    function short(value){const seconds=Math.round(positive(value)),hours=Math.floor(seconds/3600),minutes=Math.floor(seconds%3600/60);if(!hours)return `${pd(minutes)} دقیقه`;return minutes?`${pd(hours)}س ${pd(minutes)}د`:`${pd(hours)} ساعت`;}
    function stats(period=7){
        if(!WebStudio.enabled())return;
        const view=document.getElementById('view-stats');view.classList.add('sw-page','sw-stats');
        period=[7,30].includes(Number(period))?Number(period):7;
        try{renderStats(view,period);}
        catch(error){
            console.error('Stats render failed',error);
            view.innerHTML=heading('آمار','آمار و پیشرفت','',btn('چاپ گزارش',"Stats.exportPDFReport()",'book'))+`<div class="sw-error" role="alert">${icon('shield')}<h3>آمار بارگذاری نشد.</h3><p>داده‌های شما سالم است؛ فقط نمایش آن با مشکل روبه‌رو شد.</p><button type="button" class="sw-button" onclick="StudyWorkspace.stats(${period})">${icon('reset')}تلاش دوباره</button></div>`;
        }
    }
    function renderStats(view,period){
        const {days}=data(),today=key(),dates=Array.from({length:period},(_,index)=>{const date=new Date();date.setDate(date.getDate()-period+1+index);return{key:key(date),label:date.toLocaleDateString('fa-IR',{weekday:'long',day:'numeric',month:'long'}),short:period===7?date.toLocaleDateString('fa-IR',{weekday:'narrow'}):date.toLocaleDateString('fa-IR',{day:'numeric'}),seconds:days.get(key(date))||0};});
        const total=[...days.values()].reduce((sum,value)=>sum+value,0),range=dates.reduce((sum,day)=>sum+day.seconds,0),max=Math.max(1,...dates.map(day=>day.seconds));
        let cursor=new Date(),streak=0;if(!(days.get(today)>0))cursor.setDate(cursor.getDate()-1);while(days.get(key(cursor))>0){streak++;cursor.setDate(cursor.getDate()-1);}
        const subjects=new Map();rows('manual_reports').filter(row=>row.status!=='missed'&&row.date>=dates[0].key&&row.date<=today&&row.subject).forEach(row=>subjects.set(row.subject,(subjects.get(row.subject)||0)+Math.round(positive(row.minutes)*60)));
        const ordered=[...subjects.entries()].sort((a,b)=>b[1]-a[1]),subjectMax=Math.max(1,...ordered.map(row=>row[1])),subjectTotal=ordered.reduce((sum,row)=>sum+row[1],0)||1;
        const activeDays=dates.filter(day=>day.seconds>0).length,todaySeconds=days.get(today)||0;
        const goalHours=positive(Storage.getSettings().dailyGoalHours),goalPct=goalHours?Math.min(100,Math.round(todaySeconds/(goalHours*3600)*100)):0;
        const weekStart=new Date();weekStart.setDate(weekStart.getDate()-6);
        const weekSeconds=[...days.entries()].filter(([date])=>date>=key(weekStart)&&date<=today).reduce((sum,[,seconds])=>sum+seconds,0);
        const goal=goalHours?`<div class="sw-goal" role="progressbar" aria-label="پیشرفت هدف روزانه" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${goalPct}"><div class="sw-track"><i style="width:${goalPct}%"></i></div><small>${pd(goalPct)}٪ از هدف ${pd(goalHours)} ساعته</small></div>`:'';
        const bars=range>0?dates.map((day,index)=>`<button type="button" class="sw-trend-day${day.key===today?' is-today':''}${day.seconds?'':' is-zero'}" data-label="${esc(day.label)}" data-time="${esc(duration(day.seconds))}" aria-label="${esc(day.label)}: ${esc(duration(day.seconds))}" ${index%5===0||index===dates.length-1?'data-tick':''}><div><i style="--level:${day.seconds/max*100}%"></i></div><small>${esc(day.short)}</small></button>`).join(''):'';
        const chart=range>0?`<div class="sw-chart"><div class="sw-axis" aria-hidden="true"><span>${short(max)}</span><span>${short(max/2)}</span><span>۰</span></div><div class="sw-trend ${period===30?'is-month':''}" role="group" aria-label="زمان مطالعه روزانه؛ برای دیدن مقدار دقیق هر روز روی ستون آن بزنید">${bars}</div></div>`:`<div class="sw-empty sw-empty-chart">${icon('chart')}<h3>در این بازه زمانی ثبت نشده است.</h3><p>با تایمر تمرکز یا گزارش دستی، نمودار شکل می‌گیرد.</p>${btn('ثبت گزارش',"WebStudio.report()",'plus')}</div>`;
        view.innerHTML=heading('آمار / ردِ قدم‌های تو','آمار و پیشرفت','هر دقیقه‌ای که برای یادگیری گذاشته‌ای، اینجا دیده می‌شود.',btn('چاپ',"Stats.exportPDFReport()",'book'))+`<div id="stats-report-printable-area"><section class="sw-stats-hero" data-reveal><div class="sw-hero-main"><span class="sw-kicker">مطالعه امروز</span><strong>${duration(todaySeconds)}</strong>${goal}</div><div class="sw-streak">${icon('flame')}<b>${pd(streak)}</b><span>روز پیوسته</span></div></section><div class="sw-metrics" data-reveal>${[['calendar','۷ روز اخیر',short(weekSeconds)],['chart','مجموع کل',short(total)],['target','روز فعال',`${pd(activeDays)} از ${pd(period)}`]].map(([glyph,label,value])=>`<article>${icon(glyph)}<span>${label}</span><strong>${value}</strong></article>`).join('')}</div><div class="sw-analysis-grid"><section class="sw-panel" data-reveal><header><div><span class="sw-kicker">ریتم یادگیری</span><h2>مطالعه در گذر روزها</h2></div><div class="sw-segments" aria-label="بازه گزارش">${[7,30].map(days=>`<button type="button" aria-pressed="${period===days}" onclick="StudyWorkspace.stats(${days})">${pd(days)} روز</button>`).join('')}</div></header><div class="sw-readout" id="sw-readout" aria-live="polite" data-default-time="${esc(duration(range))}" data-default-label="مجموع ${pd(period)} روز اخیر · میانگین ${esc(short(range/period))} در روز"><strong>${duration(range)}</strong><span>مجموع ${pd(period)} روز اخیر · میانگین ${short(range/period)} در روز</span></div>${chart}<details class="sw-time-details"><summary>زمان دقیق هر روز</summary><div class="sw-time-table">${dates.slice().reverse().map(day=>`<div><span>${esc(day.label)}</span><strong>${duration(day.seconds)}</strong></div>`).join('')}</div></details></section><section class="sw-panel" data-reveal><header><div><span class="sw-kicker">تمرکزت کجا بوده؟</span><h2>سهم درس‌ها</h2></div>${icon('book')}</header><p class="sw-helper">بر پایه گزارش‌های دستی همین بازه؛ زمان تایمر تفکیک درس ندارد.</p><div class="sw-subjects">${ordered.map(([subject,seconds],index)=>`<article style="--rank:${Math.max(.35,1-index*.14)}"><div><strong>${esc(subject)}</strong><span>${short(seconds)} · ${pd(Math.round(seconds/subjectTotal*100))}٪</span></div><div class="sw-track"><i style="width:${seconds/subjectMax*100}%"></i></div></article>`).join('')||`<div class="sw-empty">${icon('note')}<h3>اولین گزارش را بنویس.</h3><p>با ثبت درس و مدت مطالعه، این بخش شکل می‌گیرد.</p>${btn('ثبت گزارش',"WebStudio.report()",'plus')}</div>`}</div></section></div><section class="sw-stats-note" data-reveal>${icon('shield')}<p>زمان‌ها بر اساس داده‌های ثبت‌شده‌اند؛ بدون داده آزمایشی. اگر یک مطالعه را هم با تایمر و هم دستی ثبت کنی، هر دو در مجموع حساب می‌شوند.</p></section></div>`;
    }
    function flashcards(){
        if(!WebStudio.enabled())return;
        const view=document.getElementById('view-flashcards');if(view.classList.contains('sw-cards'))return;
        view.classList.add('sw-page','sw-cards');
        view.innerHTML=heading('فلش‌کارت / میز مرور','کم بخوان، عمیق به خاطر بسپار.','یک سؤال، یک مکث، یک یادگیری ماندگار.',`<div class="sw-actions">${btn('کارت جدید',"Flashcards.openAddModal()",'plus')}${btn('استخراج با هوش مصنوعی',"Flashcards.openAIModal()",'spark')}</div>`)+`<div class="sw-review-layout"><aside class="sw-review-library" data-reveal><span class="sw-kicker">مسیر یادآوری</span><h2>پنج قدم تا تسلط</h2><p>با هر پاسخ درست، یک قدم جلوتر برو.</p><div class="sw-boxes"><button type="button" aria-pressed="true" onclick="StudyWorkspace.box(this,'all')">${icon('cards')}همه کارت‌ها${icon('arrow')}</button>${[1,2,3,4,5].map((box,i)=>`<button type="button" aria-pressed="false" onclick="StudyWorkspace.box(this,${box})"><span class="sw-box-number">${pd(box)}</span><span><strong>${['شروع یادگیری','آشنایی','در حال تثبیت','یادآوری قوی','تسلط'][i]}</strong><small>جعبه ${pd(box)}</small></span><b id="leitner-count-box-${box}">۰</b></button>`).join('')}</div><div class="sw-review-tip">${icon('leaf')}<p>قبل از دیدن پاسخ، چند ثانیه تلاش کن آن را از حافظه‌ات بازیابی کنی.</p></div></aside><section class="sw-review-desk" data-reveal><header><span class="sw-kicker">موضوع مرور</span><div id="flashcard-category-pills"></div></header><div class="sw-review-counter" id="flashcard-index-info" role="status"></div><div id="flashcard-stage" class="sw-review-card" role="button" tabindex="0" aria-label="نمایش پاسخ کارت" onclick="Flashcards.flipCard()"><div class="flip-card-inner"><div class="flip-card-front"><div class="sw-card-meta"><span id="flashcard-category-front"></span><span id="flashcard-box-front"></span></div><span class="sw-kicker">اول فکر کن</span><div id="flashcard-question-text" class="sw-card-text"></div><span class="sw-flip-hint">${icon('arrow')}برای دیدن پاسخ کلیک کن یا Enter بزن</span></div><div class="flip-card-back" aria-hidden="true"><div class="sw-card-meta"><span>پاسخ و توضیح</span><span id="flashcard-box-back"></span></div><span class="sw-kicker">حالا مقایسه کن</span><div id="flashcard-answer-text" class="sw-card-text"></div><span class="sw-flip-hint">${icon('arrow')}بازگشت به سؤال</span></div></div></div><div id="flashcard-empty-state" class="sw-empty">${icon('cards')}<h3>این بخش هنوز کارتی ندارد.</h3><p>یک کارت بساز یا موضوع و جعبه دیگری انتخاب کن.</p>${btn('ساخت اولین کارت',"Flashcards.openAddModal()")}</div><div id="flashcard-action-buttons" class="sw-rating">${[['wrong','دوباره تمرین می‌کنم','بازگشت به جعبه اول'],['medium','هنوز جای تمرین دارد','ماندن در همین جعبه'],['easy','خوب یاد گرفته‌ام','رفتن به جعبه بعد']].map(([rating,label,hint])=>`<button type="button" disabled onclick="Flashcards.rateCard('${rating}')"><strong>${label}</strong><small>${hint}</small></button>`).join('')}</div><p class="sw-review-footnote">پس از دیدن پاسخ، میزان تسلطت را صادقانه انتخاب کن.</p></section></div>`;
        document.getElementById('flashcard-stage').addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();Flashcards.flipCard();}});
    }
    function box(button,value){document.querySelectorAll('.sw-boxes button').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));Flashcards.filterBox(value);}
    function cardState(flipped){
        const view=document.querySelector('.sw-cards');if(!view)return;
        view.querySelectorAll('.sw-rating button').forEach(button=>button.disabled=!flipped);
        view.querySelector('.flip-card-front').setAttribute('aria-hidden',String(flipped));view.querySelector('.flip-card-back').setAttribute('aria-hidden',String(!flipped));
        view.querySelector('#flashcard-stage').setAttribute('aria-label',flipped?'بازگشت به سؤال کارت':'نمایش پاسخ کارت');
    }
    function focus(){
        const view=document.getElementById('view-pomodoro');if(!WebStudio.enabled()||view.classList.contains('sw-focus'))return;
        view.classList.add('sw-page','sw-focus');
        const container=view.querySelector('.pomodoro-container'),stage=view.querySelector('.studio-focus-stage'),selection=view.querySelector('.studio-focus-selection'),stats=view.querySelector('.studio-focus-stats'),checklist=view.querySelector('.studio-focus-checklist');
        const shell=document.createElement('div');shell.className='sw-focus-layout';
        shell.innerHTML='<section class="sw-focus-canvas" data-reveal></section><aside class="sw-focus-mission" data-reveal><span class="sw-kicker">قبل از شروع</span><h2>فقط یک کار انتخاب کن.</h2><p>یک هدف کوچک، تمرکزت را روشن می‌کند.</p></aside>';
        shell.firstElementChild.append(stage);
        shell.lastElementChild.append(selection,checklist);
        const summary=document.createElement('section');summary.className='sw-focus-summary';summary.setAttribute('data-reveal','');summary.append(stats);
        const header=document.createElement('div');header.innerHTML=heading('پومودورو / زمانِ بی‌حواس‌پرتی','وقتِ عمیق‌شدن است.','یک هدف روشن. یک بازه آرام. یک قدم واقعی.',btn('تنظیم زمان و اعلان',"Pomodoro.openSettings()",'timer'));
        container.replaceChildren(header.firstElementChild,shell,summary);
        stage.querySelector('.studio-focus-kicker').innerHTML=`${icon('target')} این لحظه، متعلق به توست`;
        stage.querySelector('.studio-focus-tip').textContent='تا پایان این بازه، فقط روی همین کار بمان.';
    }
    function printStats(){
        const details=document.querySelector('.sw-time-details'),wasOpen=details?.open;
        if(details)details.open=true;
        try{Utils.printElement('stats-report-printable-area','گزارش زمان مطالعه درسیار');}finally{if(details)details.open=wasOpen;}
    }
    return {duration,short,data,stats:(period)=>{stats(period);window.StudyFlow?.mountReport();},flashcards,box,cardState,focus,printStats};
})();
window.StudyWorkspace=StudyWorkspace;
