/** Web presentation layer. Native screens keep their existing renderers and IDs. */
const WebStudio = (() => {
    const enabled = () => !document.documentElement.classList.contains('capacitor-app');
    const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const pd = value => Utils.toPersianDigits(value);
    const localDate = (date = new Date()) => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches || Storage.getSettings().motion === 'off';
    const paths = {
        home:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z"/>',
        timer:'<circle cx="12" cy="13" r="8"/><path d="M9 2h6m-3 7v5l3 2M18 5l2-2"/>',
        calendar:'<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18m-13 4h2m4 0h2m-8 3h2"/>',
        chart:'<path d="M4 3v17h17M8 16v-4m5 4V8m5 8V5"/>',
        chat:'<path d="M21 11a8 8 0 0 1-8 8H7l-4 3V11a9 9 0 0 1 18 0Z"/><path d="M8 10h8m-8 4h5"/>',
        spark:'<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5ZM20 2v4m-2-2h4"/>',
        book:'<path d="M12 5v16m0-16C8 2 4 3 2 4v15c4-1 7 0 10 2 3-2 6-3 10-2V4c-2-1-6-2-10 1Z"/>',
        note:'<path d="M13 4H5a2 2 0 0 0-2 2v14h14a2 2 0 0 0 2-2v-8M9 15l1-5L18 2l4 4-8 8ZM16 4l4 4"/>',
        cards:'<rect x="6" y="3" width="15" height="17" rx="3"/><path d="m3 7-2 12a2 2 0 0 0 2 2l10 1m-2-14h5m-5 4h5"/>',
        trophy:'<path d="M7 3h10v6a5 5 0 0 1-10 0Zm10 1h4v3a4 4 0 0 1-4 4M7 4H3v3a4 4 0 0 0 4 4m5 3v6m-5 1h10"/>',
        user:'<circle cx="12" cy="7" r="4"/><path d="M4 21v-3a8 8 0 0 1 16 0v3Z"/>',
        people:'<circle cx="9" cy="7" r="4"/><path d="M2 21v-3a7 7 0 0 1 14 0v3ZM17 3a4 4 0 0 1 0 8m2 3a6 6 0 0 1 3 5v2"/>',
        arrow:'<path d="M20 12H4m6-6-6 6 6 6"/>',
        plus:'<path d="M12 5v14M5 12h14"/>',
        close:'<path d="m6 6 12 12M18 6 6 18"/>',
        play:'<path d="m8 4 13 8-13 8Z"/>',
        pause:'<rect x="5" y="4" width="5" height="16" rx="1"/><rect x="14" y="4" width="5" height="16" rx="1"/>',
        reset:'<path d="M4 11a8 8 0 1 1 2 6M4 4v7h7"/>',
        expand:'<path d="M9 3H3v6m12-6h6v6M3 15v6h6m12-6v6h-6"/>',
        check:'<path d="m5 12 4 4L19 6"/>',
        flame:'<path d="M13 2c1 6 7 8 7 13a8 8 0 0 1-16 0c0-4 2-7 5-9 0 3 1 4 2 4 2-2 2-5 2-8Z"/>',
        leaf:'<path d="M20 3C7 2 3 7 4 14s10 8 14 1c2-3 2-8 2-12ZM4 22l10-12"/>',
        shield:'<path d="m12 2 9 4v6c0 6-9 10-9 10S3 18 3 12V6Zm-4 10 3 3 5-6"/>',
        compass:'<circle cx="12" cy="12" r="10"/><path d="m16 8-2 6-6 2 2-6Z"/>',
        moon:'<path d="M21 13A9 9 0 0 1 11 3a9 9 0 1 0 10 10Z"/>',
        target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>'
    };
    const icon = (name, cls = '') => `<svg class="studio-icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.spark}</svg>`;
    let ready = false;
    let outgoing = null;
    let routeAnimations = [];
    const mobileTabForRoute = route => {
        if (['dashboard','stats','pomodoro','schedule','profile'].includes(route)) return route;
        if (['chat','admin','legal','subscription'].includes(route)) return 'profile';
        return 'stats';
    };
    function moveMobileNavIndicator(route, instant = false) {
        const nav = document.querySelector('.studio-mobile-nav');
        const button = nav?.querySelector(`[data-mobile-route="${route}"]`);
        const indicator = nav?.querySelector('.studio-nav-indicator');
        if (!nav || !button || !indicator) return;
        const x = button.offsetLeft + button.offsetWidth / 2 - indicator.offsetWidth / 2;
        if (instant) indicator.style.transition = 'none';
        indicator.style.transform = `translate3d(${x}px,0,0)`;
        if (instant) {
            indicator.getBoundingClientRect();
            indicator.style.removeProperty('transition');
        }
    }
    const dashboardBanners = [
        { tone:'lilac', quote:'توانا بُوَد هر که دانا بُوَد', second:'ز دانش، دل پیر، بُرنا بود', author:'فردوسی', source:'https://ganjoor.net/ferdousi/shahname/aghaz/sh1' },
        { tone:'sage', quote:'به راه بادیه رفتن به از نشستن باطل', second:'وگر مراد نیابم به قدر وسع بکوشم', author:'سعدی', source:'https://ganjoor.net/saadi/divan/ghazals/sh405' },
        { tone:'peach', quote:'نابرده رنج گنج میسر نمی‌شود', second:'مزد آن گرفت جان برادر که کار کرد', author:'سعدی', source:'https://ganjoor.net/saadi/mavaez/ghasides/sh12' }
    ];
    let dashboardBannerIndex = Math.floor(Math.random() * dashboardBanners.length);
    const viewLabels = { dashboard:'امروزِ تو', pomodoro:'اتاق تمرکز', chat:'گفت‌وگو', schedule:'برنامه من', stats:'آمار و پیشرفت', 'ai-assistant':'دستیار هوشمند', flashcards:'فلش‌کارت', 'ai-writing':'کارگاه نوشتن', 'ai-research':'پژوهش', gamification:'لیگ و دوستان', admin:'پنل مشاوره', profile:'پروفایل', legal:'قوانین و حریم خصوصی' };

    function init() {
        if (!enabled() || ready) return;
        ready = true;
        document.documentElement.classList.add('studio-web');
        const mapping = { dashboard:'home', pomodoro:'timer', schedule:'calendar', stats:'chart', chat:'chat', 'ai-assistant':'spark', flashcards:'cards', 'ai-writing':'note', 'ai-research':'compass', gamification:'trophy', admin:'people', profile:'user', subscription:'trophy', exams:'book' };
        Object.entries(mapping).forEach(([name, glyph]) => {
            const nav = document.getElementById(`nav-${name}`);
            const oldIcon = nav?.querySelector('.material-symbols-outlined');
            if (oldIcon) oldIcon.outerHTML = icon(glyph);
            if (nav && nav.tagName !== 'BUTTON') {
                nav.setAttribute('role', 'button'); nav.tabIndex = 0;
                nav.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); nav.click(); } });
            }
        });
        const dashboardLabel = document.querySelector('#nav-dashboard > span');
        if (dashboardLabel) dashboardLabel.textContent = 'امروزِ تو';
        const timerLabel = document.querySelector('#nav-pomodoro > span');
        if (timerLabel) timerLabel.textContent = 'اتاق تمرکز';
        document.querySelector('.menu-toggle-btn')?.setAttribute('aria-label', 'باز کردن منو');
        const sidebar = document.getElementById('sidebar');
        if (sidebar && !sidebar.querySelector('.studio-drawer-top')) {
            const top = document.createElement('div'); top.className = 'studio-drawer-top';
            top.innerHTML = `<span class="studio-drawer-avatar">${icon('user')}</span><button type="button" class="studio-drawer-close" aria-label="بستن منو" onclick="App.closeMobileSidebar()">${icon('close')}</button>`;
            sidebar.querySelector('.sidebar-header')?.append(top);
            const mobileWeb = matchMedia('(max-width: 720px)').matches;
            sidebar.setAttribute('aria-hidden', String(mobileWeb)); sidebar.inert = mobileWeb;
            matchMedia('(max-width: 720px)').addEventListener('change', event => {
                if (!event.matches && sidebar.classList.contains('open')) window.App?.closeMobileSidebar();
                sidebar.inert = event.matches && !sidebar.classList.contains('open');
                sidebar.setAttribute('aria-hidden', String(event.matches && !sidebar.classList.contains('open')));
            });
        }
        document.querySelector('[onclick="App.toggleTheme()"]')?.setAttribute('aria-label', 'تغییر تم روشن و تاریک');
        const header = document.querySelector('.top-header');
        const mobileBrand = document.createElement('div'); mobileBrand.className = 'studio-mobile-brand';
        mobileBrand.innerHTML = '<img src="icons/icon-64.png" width="31" height="31" alt=""><span>درسیار</span>';
        header?.insertBefore(mobileBrand, header.querySelector('.header-left'));
        const mobileNav = document.createElement('nav'); mobileNav.className = 'studio-mobile-nav'; mobileNav.setAttribute('aria-label','پیمایش اصلی');
        mobileNav.innerHTML = `<span class="studio-nav-indicator" aria-hidden="true"></span>${[['dashboard','home','خانه'],['stats','chart','آمار'],['pomodoro','plus','تمرکز'],['schedule','calendar','برنامه'],['profile','user','پروفایل']].map(([route,glyph,label])=>`<button type="button" data-mobile-route="${route}" aria-label="${label}" onclick="App.navigate('${route}')">${icon(glyph)}<span>${label}</span></button>`).join('')}`;
        document.body.append(mobileNav);
        const initialMobileRoute = mobileTabForRoute(document.querySelector('.sidebar .nav-item.active')?.id?.replace(/^nav-/, '') || 'dashboard');
        mobileNav.querySelectorAll('button').forEach(button => {
            const active = button.dataset.mobileRoute === initialMobileRoute;
            button.classList.toggle('active', active);
            if (active) button.setAttribute('aria-current','page');
        });
        requestAnimationFrame(() => moveMobileNavIndicator(initialMobileRoute, true));
        window.addEventListener('resize', () => moveMobileNavIndicator(document.querySelector('.studio-mobile-nav button.active')?.dataset.mobileRoute || initialMobileRoute, true), { passive:true });
        const crumb = document.createElement('div'); crumb.className = 'studio-breadcrumb';
        crumb.innerHTML = '<span>فضای یادگیری من</span><b aria-hidden="true">/</b><strong id="studio-page-name">امروزِ تو</strong>';
        header?.insertBefore(crumb, header.querySelector('.header-left'));
        const page = document.createElement('section'); page.id = 'view-chat'; page.className = 'view-section';
        page.innerHTML = `<header class="studio-page-heading"><div><span class="studio-eyebrow">همراه مسیرت</span><h1>یک گفت‌وگوی خوب، یک قدم جلوتر.</h1><p>پیام‌ها، بازخوردها و یادداشت‌هایت؛ همه در یک فضای آرام.</p></div>${icon('chat','studio-heading-icon')}</header><div class="studio-chat-layout"><aside class="studio-chat-aside"><span class="studio-eyebrow">فضای ارتباط</span><div class="studio-contact-symbol">${icon('people')}</div><h2 id="studio-chat-peer"></h2><p id="studio-chat-hint"></p><div class="studio-chat-shortcuts"><button type="button" onclick="Communications.switchTab('chat')">${icon('chat')}گفت‌وگو${icon('arrow')}</button><button type="button" onclick="Communications.switchTab('notes')">${icon('note')}یادداشت‌های شخصی${icon('arrow')}</button><button type="button" onclick="App.navigate('ai-assistant')">${icon('spark')}دستیار هوشمند${icon('arrow')}</button></div><div class="studio-privacy">${icon('shield')}<p>اطلاعات خصوصی و رمز عبورت را در گفت‌وگو ارسال نکن.</p></div></aside><div id="studio-chat-host"></div></div>`;
        document.querySelector('.content-body')?.append(page);
        const drawer = document.getElementById('communications-drawer');
        if (drawer) {
            document.getElementById('studio-chat-host').append(drawer);
            drawer.querySelector('.communications-header > button')?.remove();
            const refresh = document.createElement('button'); refresh.className = 'studio-button secondary'; refresh.type = 'button'; refresh.textContent = 'تازه‌سازی پیام‌ها';
            refresh.addEventListener('click', () => Communications.switchTab('chat'));
            drawer.querySelector('.communications-header')?.append(refresh);
            const input = document.getElementById('advisor-chat-input');
            input?.addEventListener('keydown', event => { if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); Communications.sendMessage(); } });
        }
        const aiAvatar = document.querySelector('.ai-chat-header .ai-avatar');
        if (aiAvatar) aiAvatar.innerHTML = icon('spark');
        document.querySelector('#ai-chat-input')?.setAttribute('aria-label', 'پیام به دستیار هوشمند');
        document.querySelector('.btn-send-ai')?.setAttribute('aria-label', 'ارسال پیام');
    }

    function chatContext() {
        const user = Storage.getCurrentUser();
        document.getElementById('studio-chat-peer').textContent = Storage.isManager() ? 'همراه دانش‌آموزانت باش' : user?.advisor?.name || user?.advisor?.username || 'جای همراهت خالی است';
        document.getElementById('studio-chat-hint').textContent = Storage.isManager() ? 'دانش‌آموز را انتخاب کن و بازخوردت را برایش بنویس.' : user?.advisor ? 'سؤال بپرس، گزارش بده و قدم بعدی را با مشاورت هماهنگ کن.' : 'بعد از اتصال به مشاور، پیام‌های شما این‌جا نمایش داده می‌شوند.';
    }

    function clearTransition() {
        routeAnimations.forEach(animation => animation.cancel());
        routeAnimations = [];
        if (outgoing) {
            outgoing.classList.remove('studio-leaving');
            outgoing.inert = false;
            outgoing.removeAttribute('aria-hidden');
            ['top','left','width','height'].forEach(key => outgoing.style.removeProperty(`--leave-${key}`));
            outgoing = null;
        }
        document.querySelectorAll('.studio-web-enter').forEach(view => view.classList.remove('studio-web-enter'));
    }

    function beforeLeave(name, previous) {
        clearTransition();
        if (reduced() || name === previous) return;
        const view = document.getElementById(`view-${previous}`);
        if (!view?.classList.contains('active') || !view.animate) return;
        const rect = view.getBoundingClientRect();
        outgoing = view;
        ['top','left','width','height'].forEach(key => view.style.setProperty(`--leave-${key}`, `${rect[key]}px`));
    }

    function enter(name, previous) {
        const mobileTab = mobileTabForRoute(name);
        document.querySelectorAll('.studio-mobile-nav button').forEach(button=>{
            const active=button.dataset.mobileRoute===mobileTab;
            button.classList.toggle('active',active);
            if(active)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');
        });
        moveMobileNavIndicator(mobileTab);
        if(name==='chat'&&window.Messenger){clearTransition();return;}
        const view = document.getElementById(`view-${name}`);
        const crumb = document.getElementById('studio-page-name'); if (crumb) crumb.textContent = viewLabels[name] || 'درسیار';
        document.querySelectorAll('.sidebar .nav-item').forEach(item => item.setAttribute('aria-current', item.classList.contains('active') ? 'page' : 'false'));
        if (!view || reduced() || !view.animate || name === previous) return;
        const navs = [...document.querySelectorAll('.sidebar .nav-item')];
        const direction = navs.findIndex(item => item.id === `nav-${name}`) >= navs.findIndex(item => item.id === `nav-${previous}`) ? 1 : -1;
        if (outgoing) {
            const leaving = outgoing;
            if (leaving.contains(document.activeElement)) { view.tabIndex = -1; view.focus({preventScroll:true}); }
            leaving.classList.add('studio-leaving'); leaving.inert = true; leaving.setAttribute('aria-hidden','true');
            const exit = leaving.animate([{opacity:.65,transform:'none'},{opacity:0,transform:`translateX(${-direction * 30}px) scale(.975)`}], {duration:180,easing:'cubic-bezier(.4,0,1,1)',fill:'forwards'});
            routeAnimations.push(exit);
            exit.finished.then(() => {
                leaving.classList.remove('studio-leaving'); leaving.inert = false; leaving.removeAttribute('aria-hidden');
            }).catch(() => {});
        }
        view.classList.add('studio-web-enter');
        routeAnimations.push(view.animate([{opacity:0,transform:`translateX(${direction * 24}px) translateY(14px) scale(.985)`,filter:'blur(3px)'},{opacity:1,transform:'none',filter:'blur(0px)'}], {duration:540,easing:'cubic-bezier(.16,1,.3,1)'}));
        const marked = view.querySelectorAll('[data-reveal]');
        const items = marked.length ? marked : view.querySelectorAll('.page-header,.content-card,.studio-chat-aside,#studio-chat-host,.ai-chat-container');
        [...items].slice(0,12).forEach((item, i) => routeAnimations.push(item.animate([{opacity:0,transform:'translateY(22px)'},{opacity:1,transform:'none'}], {duration:580,delay:60+Math.min(i,7)*42,easing:'cubic-bezier(.16,1,.3,1)',fill:'backwards'})));
        const activeIcon = document.querySelector('.sidebar .nav-item.active .studio-icon');
        activeIcon?.animate([{transform:'scale(.75) rotate(-12deg)'},{transform:'scale(1.12) rotate(3deg)'},{transform:'none'}], {duration:440,easing:'ease-out'});
    }

    function studyData() {
        const byDate = new Map();
        const add = (date, hours) => { if (date && Number.isFinite(Number(hours))) byDate.set(date, (byDate.get(date) || 0) + Math.max(0, Number(hours))); };
        (Storage.get('study_history', []) || []).forEach(row => add(row.date, row.hours || 0));
        (Storage.get('manual_reports', []) || []).filter(row => row.status !== 'missed').forEach(row => add(row.date, Number(row.minutes || 0) / 60));
        return byDate;
    }

    function todayTasks() {
        const day = (new Date().getDay() + 1) % 7, schedule = Storage.get('schedule', []) || [];
        return { day, tasks: (schedule[day]?.tasks || schedule[day]?.slots || []).filter(task => task?.subject) };
    }

    function dashboard() {
        const view = document.getElementById('view-dashboard'), user = Storage.getCurrentUser();
        if (!view || !user) return;
        let shell = view.querySelector('.studio-dashboard');
        if (!shell) { shell = document.createElement('div'); shell.className = 'studio-dashboard'; view.prepend(shell); }
        view.classList.add('studio-dashboard-ready');
        const {tasks} = todayTasks(), done = tasks.filter(task => task.status === 'completed').length;
        const next = tasks.find(task => task.status !== 'completed'), data = studyData(), today = localDate();
        const days = Array.from({length:7}, (_, i) => { const date = new Date(); date.setDate(date.getDate()-6+i); return {date:localDate(date),label:new Intl.DateTimeFormat('fa-IR',{weekday:'short'}).format(date),hours:data.get(localDate(date)) || 0}; });
        const week = days.reduce((sum, day) => sum + day.hours, 0), max = Math.max(1, ...days.map(day => day.hours));
        let cursor = new Date(), streak = 0;
        if (!(data.get(today) > 0)) cursor.setDate(cursor.getDate()-1);
        while (data.get(localDate(cursor)) > 0) { streak++; cursor.setDate(cursor.getDate()-1); }
        const reports = (Storage.get('manual_reports', []) || []).slice().sort((a,b) => String(b.createdAt || b.date).localeCompare(String(a.createdAt || a.date))).slice(0,3);
        const dateLabel = new Intl.DateTimeFormat('fa-IR',{weekday:'long',day:'numeric',month:'long'}).format(new Date());
        const banner = dashboardBanners[dashboardBannerIndex];
        const completion = tasks.length ? Math.round(done/tasks.length*100) : 0;
        shell.innerHTML = `
            <header class="studio-page-heading studio-dashboard-heading" data-reveal><div class="studio-dashboard-heading-copy"><span class="studio-dashboard-heading-kicker">داشبورد مطالعه</span><h1>${esc(user.name || user.username)}</h1><p>برنامه و پیشرفت تو در یک نگاه</p></div><div class="studio-dashboard-heading-aside"><div class="studio-dashboard-date">${icon('calendar')}<span><small>امروز</small><strong>${esc(dateLabel)}</strong></span></div><button class="studio-button secondary" type="button" onclick="WebStudio.report()">${icon('plus')}ثبت گزارش مطالعه</button></div></header>
            <div class="studio-dashboard-top">
                <section class="studio-hero studio-hero-${banner.tone}" data-reveal><div class="studio-hero-copy"><span class="studio-eyebrow">نقل‌قولی برای امروز</span><blockquote><h2>«${esc(banner.quote)}<br>${esc(banner.second)}»</h2><cite>— <a href="${banner.source}" target="_blank" rel="noopener noreferrer" aria-label="منبع شعر ${banner.author} در گنجور">${banner.author}</a></cite></blockquote><p>${next ? `تسک بعدی: <strong>${esc(next.subject)}</strong> · ${pd(next.durationMinutes || 60)} دقیقه` : tasks.length ? 'همهٔ تسک‌های امروز انجام شده‌اند.' : 'هنوز تسکی برای امروز ثبت نشده است.'}</p><div class="studio-hero-actions"><button class="studio-button primary" type="button" onclick="WebStudio.focusNext()">${icon('play')}شروع تمرکز${icon('arrow')}</button><button class="studio-banner-next" type="button" onclick="WebStudio.nextBanner()" aria-label="نمایش بنر بعدی">${icon('arrow')}بنر بعدی</button></div></div><div class="studio-hero-art" aria-label="${pd(done)} از ${pd(tasks.length)} تسک انجام شده"><div class="studio-orbit orbit-one"></div><div class="studio-orbit orbit-two"></div><span class="studio-orbit-chip chip-one">${icon('book')}</span><span class="studio-orbit-chip chip-two">${icon('check')}</span><div class="studio-progress-orb" style="--progress:${completion}%"><div>${icon('target')}<strong>${pd(done)}<small> / ${pd(tasks.length)}</small></strong><span>قدم‌های امروز</span></div></div><span class="studio-art-caption">${pd(dashboardBannerIndex+1)} / ${pd(dashboardBanners.length)}</span></div></section>
                <section class="studio-day-metrics" aria-label="خلاصه مطالعه" data-reveal>${metric('timer','مطالعه امروز',studyDuration(data.get(today)||0),'','violet')}${metric('chart','۷ روز گذشته',studyDuration(week),'','mint')}${metric('flame','روزهای پیوسته',pd(streak),'روز','coral')}</section>
            </div>
            <div class="studio-dashboard-grid">
                <section class="studio-panel studio-plan" data-reveal><header><div><span class="studio-eyebrow">قدم به قدم</span><h2>برنامه امروز</h2></div><button class="studio-text-button" type="button" onclick="App.navigate('schedule')">برنامه کامل${icon('arrow')}</button></header><div class="studio-task-list">${tasks.slice(0,4).map((task,i) => `<button type="button" class="studio-task ${task.status === 'completed' ? 'is-done':''}" onclick="WebStudio.editTask(${i})"><span class="studio-task-marker">${task.status === 'completed' ? icon('check') : pd(String(i+1).padStart(2,'0'))}</span><span class="studio-task-copy"><strong>${esc(task.subject)}</strong><small>${esc(task.note || 'برای مشاهده و ویرایش کلیک کن')}</small></span><span class="studio-task-time">${pd(task.durationMinutes || 60)}<small>دقیقه</small></span>${icon('arrow')}</button>`).join('') || `<div class="studio-empty">${icon('calendar')}<strong>امروزت هنوز یک صفحه سفید است.</strong><p>اولین تسک را بنویس؛ لازم نیست برنامه‌ات از همان اول کامل باشد.</p><button class="studio-button secondary" type="button" onclick="WebStudio.editTask(-1)">${icon('plus')}اولین تسک من</button></div>`}</div>${tasks.length ? `<footer><span>${pd(done)} از ${pd(tasks.length)} تسک انجام شده</span><div class="studio-mini-track"><i style="width:${completion}%"></i></div></footer>` : ''}</section>
                <section class="studio-panel studio-week" data-reveal><header><div><span class="studio-eyebrow">ریتم یادگیری تو</span><h2>قدم‌های این هفته</h2></div><span class="studio-tag mint">${studyDuration(week)}</span></header><div class="studio-week-chart" role="img" aria-label="مطالعه هفت روز گذشته: ${days.map(day=>`${day.label} ${studyDuration(day.hours)}`).join('، ')}">${days.map(day=>`<div class="studio-bar-column ${day.date===today?'is-today':''}"><span>${pd(day.hours.toFixed(1))}</span><div><i style="--bar-height:${day.hours/max*100}%"></i></div><small>${esc(day.label)}</small></div>`).join('')}</div><footer><span>${week > 0 ? 'مطالعه با تایمر و گزارش‌های دستی' : 'با اولین مطالعه، نمودار تو جان می‌گیرد.'}</span><button class="studio-text-button" type="button" onclick="App.navigate('stats')">جزئیات${icon('arrow')}</button></footer></section>
                <section class="studio-panel studio-tools" data-reveal><header><div><span class="studio-eyebrow">یک میان‌بر به یادگیری</span><h2>ابزارهای همراهت</h2></div>${icon('spark')}</header><div class="studio-tool-grid">${[['ai-assistant','spark','دستیار هوشمند','با هم حلش کنیم','violet'],['flashcards','cards','فلش‌کارت','یاد بگیر و مرور کن','coral']].map(([route,glyph,title,sub,tone])=>`<button class="studio-tool ${tone}" type="button" onclick="App.navigate('${route}')"><span>${icon(glyph)}</span><strong>${title}</strong><small>${sub}</small>${icon('arrow','tool-arrow')}</button>`).join('')}</div></section>
                <section class="studio-panel studio-reports" data-reveal><header><div><span class="studio-eyebrow">رد قدم‌هایت</span><h2>آخرین گزارش‌ها</h2></div><button class="studio-text-button" type="button" onclick="WebStudio.report()">${icon('plus')}ثبت</button></header>${reports.map(report=>`<article>${icon('note')}<div><strong>${esc(report.subject || 'مطالعه')}</strong><small>${esc(report.date)} · ${pd(report.minutes || 0)} دقیقه</small></div><span class="studio-report-status">${report.status==='missed'?'انجام نشده':report.status==='partial'?'بخشی انجام شده':'ثبت شده'}</span></article>`).join('') || `<div class="studio-empty compact">${icon('note')}<p>بعد از مطالعه، چند خط از پیشرفتت بنویس.</p><button class="studio-text-button" type="button" onclick="WebStudio.report()">ثبت اولین گزارش${icon('arrow')}</button></div>`}</section>
            </div><button type="button" class="studio-connection" data-reveal onclick="App.navigate('${Storage.isManager()?'admin':user.advisor?'chat':'schedule'}')"><span class="studio-connection-icon">${icon(Storage.isManager()?'people':user.advisor?'chat':'leaf')}</span><span><small>${Storage.isManager()?'فضای مشاوره':user.advisor?'همراه مسیرت':'با ریتم خودت پیش برو'}</small><strong>${Storage.isManager()?'امروز کنار دانش‌آموزانت باش':user.advisor?`گفت‌وگو با ${esc(user.advisor.name || user.advisor.username)}`:'برنامه‌ریزی مستقل؛ مسیر یادگیری خودت را بساز'}</strong></span>${icon('arrow')}</button>`;
        if(user.advisor){const badge=document.querySelector('.studio-connection-icon');if(badge)badge.innerHTML=ProfileStudio.avatarHTML(user.advisor.avatar);const button=document.createElement('button');button.type='button';button.className='studio-text-button';button.textContent='مشاهده پروفایل مشاور';button.onclick=()=>Community.profile(user.advisor.username);document.querySelector('.studio-connection')?.after(button);}
    }

    function studyDuration(hours) { const seconds=Math.round(Math.max(0,Number(hours)||0)*3600); return `${pd(Math.floor(seconds/3600))} ساعت و ${pd(Math.floor(seconds%3600/60))} دقیقه`; }
    function nextBanner() { dashboardBannerIndex=(dashboardBannerIndex+1)%dashboardBanners.length; dashboard(); }
    function metric(glyph,label,value,unit,tone) { return `<article class="studio-metric ${tone}"><span class="studio-metric-icon">${icon(glyph)}</span><div><small>${label}</small><strong>${value}<em>${unit}</em></strong></div>${icon('arrow','studio-metric-arrow')}</article>`; }
    function editTask(index) { const {day} = todayTasks(); App.navigate('schedule'); Schedule.openEditTaskModal(day,index); }
    function report() { App.navigate('stats'); requestAnimationFrame(()=>{ document.querySelector('.manual-report-card')?.scrollIntoView({behavior:reduced()?'instant':'smooth',block:'center'}); document.getElementById('report-subject')?.focus({preventScroll:true}); }); }
    function focusNext() { const task = todayTasks().tasks.find(row=>row.status!=='completed'); App.navigate('pomodoro'); if (task) Pomodoro.setTaskFromExternal(task.subject,task.durationMinutes,task.id); }

    function preparePomodoro() {
        if (!enabled()) return;
        const view = document.getElementById('view-pomodoro');
        if (!view || view.classList.contains('studio-focus-ready')) return;
        view.classList.add('studio-focus-ready');
        const container = view.querySelector('.pomodoro-container');
        const modes = container.querySelector('.pomodoro-modes-nav'), dial = container.querySelector('.pomo-dial-wrap'), controls = container.querySelector('.pomo-controls-row');
        const taskPill = document.getElementById('pomo-active-task-label').parentElement;
        const listCard = document.getElementById('pomo-tasks-list').closest('.content-card');
        const selectCard = document.getElementById('pomo-task-selector').closest('.content-card');
        const statsCard = document.getElementById('pomo-stat-today-sessions').closest('.content-card');
        const stage = document.createElement('section'); stage.className = 'studio-focus-stage studio-focus-unified'; stage.setAttribute('data-reveal','');
        const heading = document.createElement('header'); heading.className = 'studio-focus-unified-header';
        heading.innerHTML = `<span><i aria-hidden="true"></i>تمرکز</span><button type="button" onclick="Pomodoro.openSettings()" aria-label="تنظیم زمان و اعلان">${icon('timer')}<span>تنظیمات</span></button>`;
        const kicker = document.createElement('span'); kicker.className = 'studio-focus-kicker'; kicker.innerHTML = 'یک کار، یک بازهٔ آرام';
        stage.append(heading,kicker,modes,dial,taskPill);
        taskPill.className = 'studio-active-task'; taskPill.removeAttribute('style');
        const changeTask = document.createElement('button'); changeTask.type='button'; changeTask.className='studio-focus-change-task'; changeTask.textContent='تغییر تسک'; changeTask.addEventListener('click',()=>document.getElementById('pomo-task-selector')?.focus()); taskPill.append(changeTask);
        selectCard.classList.add('studio-focus-selection'); listCard.classList.add('studio-focus-checklist'); statsCard.classList.add('studio-focus-stats');
        const taskDetails=document.createElement('details');taskDetails.className='studio-focus-task-details';taskDetails.innerHTML='<summary>تسک‌های من و افزودن تسک</summary>';taskDetails.append(listCard);
        const tip = document.createElement('p'); tip.className = 'studio-focus-tip'; tip.textContent = 'گوشی را کنار بگذار؛ پایان جلسه خبرت می‌کنیم.';
        stage.append(selectCard,controls,tip,taskDetails,statsCard);
        container.replaceChildren(stage);
        controls.firstElementChild.innerHTML=icon('reset');
        controls.lastElementChild.innerHTML=icon('expand');
        document.querySelector('#pomo-tasks-list')?.parentElement.querySelector('input')?.setAttribute('aria-label','عنوان کار جدید');
        document.getElementById('pomo-task-selector')?.setAttribute('aria-label','انتخاب تسک از برنامه امروز');
        controls.querySelectorAll('button[title]').forEach(button => button.setAttribute('aria-label',button.title));
        const input = document.getElementById('input-pomo-new-task'); input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.isComposing){e.preventDefault();Pomodoro.addTaskSubmit();}});
    }

    function timerState(state,mode) {
        if (!enabled()) return;
        const view = document.getElementById('view-pomodoro'); if (!view) return;
        view.dataset.timerState = state; view.dataset.timerMode = mode;
        const label = view.querySelector('.pomo-status-label');
        if (label) label.textContent = state==='running' ? (mode==='work'?'در حال تمرکز':'نوبت استراحت توست') : state==='paused'?'هر وقت آماده‌ای، ادامه بده':'آماده یک شروع تازه';
    }
    return { enabled, init, icon, dashboard, nextBanner, beforeLeave, enter, chatContext, editTask, report, focusNext, preparePomodoro, timerState };
})();
window.WebStudio = WebStudio;
