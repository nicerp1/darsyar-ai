/* Study rooms: shared server clock, with a per-member timer and a private plan. */
const StudyRooms = (() => {
    const themes = { library: 'کتابخانه شب', rain: 'پنجره بارانی', cafe: 'کافه دنج', forest: 'کلبه جنگلی' };
    const labels = { idle: 'آماده برای شروع', focus: 'در حال مطالعه', break: 'در حال استراحت', paused: 'متوقف' };
    const reactions = { ready: 'آماده‌ام', nice: 'آفرین', wave: 'سلام' };
    const defaults = { theme: 'room', tick: false, volume: 35, chime: true, contrast: false, minimal: false, directory: true, focus: 25, rest: 5 };
    function readPrefs() {
        const saved = Storage.get('study_room_preferences', {}) || {};
        const bounded = (key,min,max) => Number.isInteger(saved[key]) && saved[key]>=min && saved[key]<=max ? saved[key] : defaults[key];
        return { ...defaults, theme:Object.hasOwn(themes,saved.theme) ? saved.theme : 'room', tick:saved.tick===true, volume:bounded('volume',0,100), chime:saved.chime!==false,
            contrast:saved.contrast===true, minimal:saved.minimal===true, directory:saved.directory!==false, focus:bounded('focus',5,120), rest:bounded('rest',1,30) };
    }
    const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
    const digits = v => String(v).replace(/[0-9]/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
    const extra = {
        settings: '<circle cx="12" cy="12" r="3"/><path d="M20 12a8 8 0 0 0-.3-2l1.3-1.3-2-3.4-1.8.5a8 8 0 0 0-3.4-2L13.3 2h-2.6l-.5 1.8a8 8 0 0 0-3.4 2L5 5.3 3 8.7 4.3 10a8 8 0 0 0 0 4L3 15.3l2 3.4 1.8-.5a8 8 0 0 0 3.4 2l.5 1.8h2.6l.5-1.8a8 8 0 0 0 3.4-2l1.8.5 2-3.4-1.3-1.3a8 8 0 0 0 .3-2Z"/>',
        lock:'<rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V6a4 4 0 0 1 8 0v4"/>',
        globe:'<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>',
        panel:'<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M9 4v16m7-11-3 3 3 3"/>',
        link:'<path d="M9 15l6-6M8 16l-1 1a3 3 0 0 1-4-4l5-5a3 3 0 0 1 4 0m0 8a3 3 0 0 0 4 0l5-5a3 3 0 0 0-4-4l-1 1"/>'
    };
    const ico = n => extra[n] ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${extra[n]}</svg>` : WebStudio.icon(n);
    const button = (action, label, glyph, cls='') => `<button type="button" class="sr-btn ${cls}" data-sr="${action}">${glyph ? ico(glyph) : ''}<span>${label}</span></button>`;
    const $ = (selector, parent = root) => parent.querySelector(selector);
    const user = () => Storage.getCurrentUser()?.username;
    const day = () => (new Date().getDay() + 1) % 7;
    const hours = seconds => seconds === null ? 'زمان خصوصی' : seconds < 60 ? (seconds ? 'کمتر از ۱ دقیقه' : '۰ دقیقه') : seconds < 3600 ? `${digits(Math.floor(seconds/60))} دقیقه` : `${digits(Math.floor(seconds/3600))} ساعت و ${digits(Math.floor(seconds%3600/60))} دقیقه`;
    let root, owner, prefs, active = false, token = 0, snapshot, rooms, offset = 0, filter = 'public', busy = false, polling = false, ticker, interval, sound, lastSecond = -1, lastPhase, lastList = 0, goalDay = day(), suspend = Promise.resolve();
    const fragments = {};

    function setHtml(selector, html) {
        if (fragments[selector] !== html) { $(selector).innerHTML = html; fragments[selector] = html; }
    }
    function hasInvite() { return location.hash.startsWith('#room='); }
    function inviteFromHash() {
        if (!hasInvite()) return null;
        const match = location.hash.match(/^#room=([0-9a-f-]{36})(?:\.([0-9a-f]{48}))?$/i);
        history.replaceState(history.state, '', location.pathname + location.search);
        return match ? { id: match[1], invite: match[2] } : null;
    }
    async function request(action, data = {}, keepalive = false) {
        const account = user();
        const response = await fetch('/api/community?rooms=1', { method:'POST', credentials:'same-origin', cache:'no-store', keepalive, headers:{'Content-Type':'application/json'}, body:JSON.stringify({ action, expectedUser:account, ...data }) });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw Object.assign(Error(result.error || 'ارتباط با اتاق برقرار نشد.'), { status:response.status });
        if (account && account === user() && Array.isArray(result.history)) Storage.applyServerData({room_study_history:result.history});
        return result;
    }
    function accept(response) {
        snapshot = response;
        offset = response.now - Date.now();
        status('');
        paint();
    }
    function status(message) { if (root) $('.sr-notice').textContent = message; }
    function toast(message) { Utils.showToast(message, 'info'); }
    function mount() {
        root = document.getElementById('view-study-rooms');
        root.innerHTML = `<div class="sr-layout" id="sr-layout">
            <section class="sr-stage" aria-labelledby="sr-title">
                <header class="sr-header"><div class="sr-title"><small>روند / تمرکز گروهی</small><h1 id="sr-title">اتاق مطالعه</h1><div class="sr-room-label"></div></div>
                    <div class="sr-tools">
                        <button type="button" class="sr-btn sr-icon" data-sr="directory" aria-label="فهرست اتاق‌ها" aria-controls="sr-directory" aria-expanded="true" title="فهرست اتاق‌ها">${ico('panel')}</button>
                        <button type="button" class="sr-btn sr-icon" data-sr="fullscreen" aria-label="تمام‌صفحه" aria-pressed="false" title="تمام‌صفحه">${ico('expand')}</button>
                        <button type="button" class="sr-btn sr-icon" data-sr="settings" aria-label="تنظیمات" title="تنظیمات">${ico('settings')}</button>
                        <button type="button" class="sr-btn sr-icon" data-sr="share" aria-label="دعوت دوستان" title="دعوت دوستان" hidden>${ico('link')}</button>
                    </div>
                </header>
                <p class="sr-notice" role="status"></p>
                <div class="sr-lobby"><div class="sr-lobby-mark">${ico('book')}</div><h2>کنار هم، با تمرکز</h2><p>به یک اتاق عمومی بپیوند یا برای دوست‌هایت اتاق بساز.</p><div>${button('show-public','اتاق‌های عمومی','globe','primary')}${button('create','ساخت اتاق','plus')}</div></div>
                <div class="sr-session" hidden>
                    <div class="sr-switch" aria-label="نوع تایمر">
                        <button type="button" data-sr="group" aria-pressed="true">${ico('people')} هم‌زمان با بقیه</button>
                        <button type="button" data-sr="solo" aria-pressed="false">${ico('timer')} تایمر خودم</button>
                    </div>
                    <div class="sr-ring"><svg viewBox="0 0 240 240" aria-hidden="true"><circle cx="120" cy="120" r="110"/><circle class="sr-progress" cx="120" cy="120" r="110" pathLength="100"/></svg><div><p class="sr-phase" aria-live="polite">زمان تمرکز</p><strong class="sr-time" dir="ltr" role="timer">۵۰:۰۰</strong><small class="sr-rhythm"></small></div></div>
                    <div class="sr-timer-actions"></div>
                    <section class="sr-members" aria-label="اعضای حاضر"><h2>اعضای اتاق</h2><div class="sr-member-list"></div><div class="sr-reactions"></div></section>
                    <section class="sr-goals"><header><div><h2>${ico('target')} هدف‌های من</h2><small>همگام با برنامهٔ مطالعهٔ تو</small></div><div>${button('plan','انتخاب از برنامه','calendar')}${button('goal','افزودن تسک','plus')}</div></header><div class="sr-goal-list"></div></section>
                </div>
            </section>
            <aside id="sr-directory" class="sr-directory" aria-label="فهرست اتاق‌ها"><header><div><small>باهم درس بخونیم</small><h2>اتاق‌ها</h2></div><button class="sr-btn sr-icon" type="button" data-sr="directory" aria-label="بستن فهرست اتاق‌ها" title="بستن فهرست">${ico('panel')}</button></header>
                <div class="sr-switch"><button type="button" data-sr="public" aria-pressed="true">${ico('globe')} عمومی</button><button type="button" data-sr="private" aria-pressed="false">${ico('lock')} خصوصی</button></div>
                <div class="sr-room-list"></div>
                ${button('create','ساخت اتاق','plus','primary')}
                ${button('join-link','ورود با لینک دعوت','link')}
            </aside>
            <dialog class="sr-dialog" aria-labelledby="sr-dialog-title"></dialog>
        </div>`;
        root.addEventListener('click', clicked);
        root.addEventListener('submit', submitted);
        root.addEventListener('change', changed);
        document.addEventListener('fullscreenchange', () => {
            if (root && !document.fullscreenElement && !root.classList.contains('sr-expanded')) syncFullscreen();
        });
        document.addEventListener('keydown', e => {
            if (active && e.key === 'Escape' && !$('.sr-dialog').open && root.classList.contains('sr-expanded')) setExpanded(false);
        });
        document.addEventListener('visibilitychange', () => {
            if (!active) return;
            if (document.hidden && snapshot?.room) suspend = request('suspend', {id:snapshot.room.id}, true).catch(()=>{});
            else if (!document.hidden) void refresh(true);
        });
        addEventListener('pagehide', () => { if (active && snapshot?.room) void request('suspend', {id:snapshot.room.id}, true).catch(()=>{}); });
    }
    function setPressed(action, value) { const el = $(`[data-sr="${action}"]`); if (el) el.setAttribute('aria-pressed', String(value)); }
    function paintPrefs() {
        const theme = prefs.theme === 'room' ? snapshot?.room.theme || 'library' : prefs.theme;
        root.dataset.themeRoom = Object.hasOwn(themes, theme) ? theme : 'library';
        root.classList.toggle('sr-contrast', Boolean(prefs.contrast));
        root.classList.toggle('sr-minimal', Boolean(prefs.minimal));
        root.classList.toggle('sr-collapsed', !prefs.directory);
        const panel = $('#sr-directory');
        panel.inert = !prefs.directory;
        $('[data-sr="directory"]').setAttribute('aria-expanded', String(Boolean(prefs.directory)));
    }
    function paintDirectory() {
        setPressed('public', filter === 'public');
        setPressed('private', filter === 'private');
        const list = rooms?.[filter] || [];
        setHtml('.sr-room-list', list.length ? list.map(room => `<button class="sr-room ${room.id === snapshot?.room.id ? 'selected' : ''}" type="button" data-sr="join" data-id="${esc(room.id)}"><span class="sr-room-icon">${ico(room.visibility === 'private' ? 'lock' : 'book')}</span><span><strong dir="auto">${esc(room.name)}</strong><small>${labels[room.phase]} · ${digits(room.members)} نفر</small></span><span class="sr-room-arrow">${ico('arrow')}</span></button>`).join('') : `<p class="sr-empty">${rooms ? (filter === 'public' ? 'هنوز اتاق عمومی باز نیست.' : 'اتاق خصوصی‌ای در فهرستت نیست.') : 'در حال دریافت اتاق‌ها…'}</p>`);
    }
    function paintGoals() {
        const tasks = Schedule.getOwnDays()[goalDay]?.tasks || [];
        setHtml('.sr-goal-list', tasks.length ? tasks.map(task => `<label class="sr-goal" dir="rtl"><input type="checkbox" data-goal="${esc(task.id)}" ${task.status === 'completed' ? 'checked' : ''}><span dir="auto">${esc(task.subject)}</span><small>${digits(task.durationMinutes)} دقیقه</small></label>`).join('') : '<p class="sr-empty">برای این روز تسکی در برنامه نداری. از همین‌جا اضافه کن.</p>');
    }
    function phase(run, now) {
        if (run?.paused) return 'paused';
        return !run || now >= run.restEnd ? 'idle' : now < run.focusEnd ? 'focus' : 'break';
    }
    function displayClock() {
        if (!snapshot) return;
        const solo = snapshot.mode === 'solo', room = snapshot.room, run = solo ? snapshot.solo : room.run;
        const now = Date.now() + offset;
        const state = phase(run, now), stop = run?.paused || now;
        const isBreak = state === 'break' || (state === 'paused' && stop >= run.focusEnd);
        const base = (solo ? prefs.focus : room.focus) * 60000;
        const total = (state === 'idle' ? base : isBreak ? run.restEnd - run.focusEnd : run.focusEnd - run.start) || 1;
        const time = state === 'idle' ? base : Math.max(0, (isBreak ? run.restEnd : run.focusEnd) - stop);
        const secs = Math.ceil(time / 1000);
        const text = digits(`${String(Math.floor(secs/60)).padStart(2,'0')}:${String(secs%60).padStart(2,'0')}`);
        if ($('.sr-time').textContent !== text) $('.sr-time').textContent = text;
        const phaseLabel = state === 'paused' ? labels.paused : (isBreak ? 'زمان استراحت' : 'زمان تمرکز');
        if ($('.sr-phase').textContent !== phaseLabel) $('.sr-phase').textContent = phaseLabel;
        $('.sr-progress').style.strokeDashoffset = String(100 - (Math.min(1, time / total) * 100));
        root.classList.toggle('sr-break', isBreak);
        $('.sr-rhythm').textContent = digits(`${solo ? prefs.focus : room.focus} دقیقه مطالعه · ${solo ? prefs.rest : room.rest} استراحت`);
        let controls = '';
        if (solo) controls = state === 'idle' ? button('soloStart','شروع تایمر من','play','primary') :
            (state === 'paused' ? button('soloResume','ادامه','play','primary') : button('soloPause','مکث','pause')) + button('soloReset','پایان تایمر','stop');
        else if (snapshot.host) controls = state === 'idle' ? button('start','شروع جلسه گروهی','play','primary') : button('end','پایان جلسه','stop');
        else controls = `<span class="sr-caption">${state === 'idle' ? 'منتظر شروع جلسه توسط میزبان' : 'هم‌زمان با اتاق'}</span>`;
        setHtml('.sr-timer-actions', controls);
        setHtml('.sr-reactions', room.visibility === 'public' && phase(room.run, now) !== 'focus' ? Object.entries(reactions).map(([k, l]) => `<button type="button" class="sr-btn" data-sr="react" data-id="${k}">${l}</button>`).join('') : '');
        if (lastPhase !== state && lastPhase && (lastPhase === 'focus' || lastPhase === 'break') && prefs.chime && document.visibilityState === 'visible') beep('end');
        if (lastSecond !== secs && state === 'focus' && prefs.tick && document.visibilityState === 'visible') beep('tick', secs % 2);
        lastPhase = state; lastSecond = secs;
    }
    function paint() {
        if (!root) return;
        paintPrefs(); paintDirectory();
        const room = snapshot?.room;
        $('.sr-lobby').hidden = Boolean(room);
        $('.sr-session').hidden = !room;
        $('[data-sr="share"]').hidden = !room || (room.visibility === 'private' && !snapshot.host);
        setHtml('.sr-room-label', room ? `<h2 dir="auto">${esc(room.name)}</h2><span class="sr-badge ${room.phase}"><i></i>${labels[room.phase]}</span><button class="sr-btn sr-leave" type="button" data-sr="leave">خروج</button>` : '<p>کتابخانهٔ آنلاین روند</p>');
        if (!room) return;
        setPressed('group', snapshot.mode === 'group'); setPressed('solo', snapshot.mode === 'solo');
        setHtml('.sr-member-list', snapshot.people.map(person => {
            const name = esc(person.name);
            return `<article class="sr-person"><span class="sr-avatar ${esc(person.phase)}" aria-hidden="true">${person.avatar && window.ProfileStudio ? ProfileStudio.avatarHTML(person.avatar) : esc(person.name.trim().slice(0,1))}<i></i></span><strong dir="auto">${name}${person.self ? ' (تو)' : ''}</strong><small title="زمان مطالعه در این اتاق">${hours(person.seconds)}</small><small>${labels[person.phase] || labels.idle}</small>${person.reaction ? `<span class="sr-reaction">${reactions[person.reaction]}</span>` : ''}${person.self ? '' : `<button type="button" data-sr="person" data-id="${esc(person.id)}" class="sr-person-more" aria-label="گزینه‌های ${name}">⋯</button>`}</article>`;
        }).join(''));
        paintGoals(); displayClock();
    }
    async function refresh(force = false) {
        if (!active || polling || busy || (!force && document.hidden)) return;
        const epoch = token;
        polling = true;
        try {
            await suspend;
            if (!active || epoch !== token) return;
            if (force || Date.now() - lastList > 18000) {
                const result = await request('list');
                if (!active || epoch !== token) return;
                rooms = result; lastList = Date.now(); paintDirectory();
                if (!snapshot && result.current) {
                    const resumed = await request('pulse', {id:result.current});
                    if (active && epoch === token) accept(resumed);
                    return;
                }
            }
            if (snapshot && active && epoch === token) {
                const current = await request('pulse', { id:snapshot.room.id });
                if (active && epoch === token) accept(current);
            }
        } catch (e) {
            if (!active || epoch !== token) return;
            if (e.status === 404) { snapshot = null; paint(); }
            status(e.message);
        } finally { polling = false; }
    }
    async function act(action, data = {}) {
        if (busy || polling && action === 'pulse') return;
        const epoch = ++token;
        busy = true;
        try {
            const result = await request(action, { id:snapshot?.room.id, ...data });
            if (epoch !== token || !active) return;
            if (result.room) accept(result);
            else if (action === 'leave' || action === 'close') { snapshot = null; paint(); }
            status('');
            if (['join','create','settings','leave','close'].includes(action)) lastList = 0;
            return result;
        } catch (e) { if (epoch === token && active) { status(e.message); toast(e.message); } }
        finally { busy = false; }
    }
    async function enter() {
        if (!root) mount();
        if (owner !== user()) { owner = user(); snapshot = rooms = null; filter = 'public'; prefs = readPrefs(); goalDay = day(); }
        if (active) return;
        window.Pomodoro?.pauseTimer();
        active = true; token++; lastList = 0; paint();
        const invite = inviteFromHash();
        if (invite) await act('join', invite);
        if (!active) return;
        await refresh(true);
        if (!active) return;
        interval = setInterval(refresh, 7000);
        ticker = setInterval(() => { if (!document.hidden) displayClock(); }, 250);
    }
    function exit() {
        if (!active) return;
        active = false; token++; clearInterval(interval); clearInterval(ticker);
        if (snapshot && user()) suspend = request('suspend', {id:snapshot.room.id}, true).catch(()=>{});
        if ($('.sr-dialog').open) $('.sr-dialog').close();
        if (document.fullscreenElement === root) void document.exitFullscreen?.().catch(()=>{});
        setExpanded(false);
        lastPhase = undefined; lastSecond = -1;
    }
    function reset() { exit(); owner = null; snapshot = rooms = null; }
    function beep(type, alternate = 0) {
        if (!sound || sound.state !== 'running') return;
        if (Number(prefs.volume) <= 0) return;
        const at=sound.currentTime, node=sound.createOscillator(), gain=sound.createGain();
        node.type = type === 'tick' ? 'triangle' : 'sine';
        node.frequency.value = type === 'tick' ? (alternate ? 720 : 520) : 660;
        gain.gain.setValueAtTime(Math.max(.001, Math.min(100, Number(prefs.volume)||0)/100 * (type === 'tick' ? .085 : .17)), at);
        gain.gain.exponentialRampToValueAtTime(.001, at + (type === 'tick' ? .038 : .35));
        node.connect(gain); gain.connect(sound.destination); node.start(at); node.stop(at + (type === 'tick' ? .04 : .36));
    }
    function unlockAudio() {
        const Context = window.AudioContext || window.webkitAudioContext;
        if (Context) { try { sound ||= new Context(); void sound.resume().catch(()=>{}); } catch {} }
    }
    function syncFullscreen() {
        const on = document.fullscreenElement === root || root.classList.contains('sr-expanded');
        const button = $('[data-sr="fullscreen"]');
        button.setAttribute('aria-pressed', String(on));
        button.setAttribute('aria-label', on ? 'خروج از تمام‌صفحه' : 'تمام‌صفحه');
        button.title = on ? 'خروج از تمام‌صفحه' : 'تمام‌صفحه';
    }
    function setExpanded(on) {
        root.classList.toggle('sr-expanded', on);
        document.body.classList.toggle('sr-lock', on);
        const shell = document.getElementById('app-main-layout');
        for (const sibling of shell?.querySelectorAll('#sidebar,.top-header,.studio-mobile-nav') || []) {
            if (on && !sibling.inert) { sibling.inert = true; sibling.dataset.roomInert = 'true'; }
            else if (!on && sibling.dataset.roomInert) { sibling.inert = false; delete sibling.dataset.roomInert; }
        }
        const bottomNav = document.querySelector('body > .studio-mobile-nav');
        if (on && bottomNav && !bottomNav.inert) { bottomNav.inert = true; bottomNav.dataset.roomInert = 'true'; }
        if (!on && bottomNav?.dataset.roomInert) { bottomNav.inert = false; delete bottomNav.dataset.roomInert; }
        syncFullscreen();
    }
    async function fullscreen() {
        if (document.fullscreenElement === root) { await document.exitFullscreen(); syncFullscreen(); return; }
        if (root.classList.contains('sr-expanded')) { setExpanded(false); return; }
        if (root.requestFullscreen) { try { await root.requestFullscreen(); syncFullscreen(); return; } catch {} }
        setExpanded(true);
    }
    const dialog = () => $('.sr-dialog');
    function show(title, content) {
        const box = dialog();
        box.innerHTML = `<header><h2 id="sr-dialog-title">${title}</h2><button type="button" data-sr="dismiss" class="sr-btn sr-icon" aria-label="بستن">${ico('close')}</button></header>${content}`;
        if (!box.open) box.showModal();
    }
    const number = (name, label, min, max, value) => `<label>${label}<input name="${name}" type="number" min="${min}" max="${max}" value="${value}" required></label>`;
    const check = (name, label, value) => `<label class="sr-toggle"><span>${label}</span><input name="${name}" type="checkbox" ${value ? 'checked' : ''}></label>`;
    function settings() {
        const room = snapshot?.room;
        show('تنظیمات اتاق مطالعه', `<form data-form="prefs">
            <fieldset><legend>ظاهر اتاق</legend><div class="sr-themes">${Object.entries(themes).map(([id, name]) => `<label><input type="radio" name="theme" value="${id}" ${prefs.theme===id?'checked':''}><img src="images/study-rooms/${id}-thumb.webp" alt="" width="320" height="180"><span>${name}</span></label>`).join('')}</div>
            <label class="sr-toggle"><span>پس‌زمینهٔ پیش‌فرض اتاق</span><input type="radio" name="theme" value="room" ${prefs.theme==='room'?'checked':''}></label>
            ${check('contrast','تیره‌تر کردن پس‌زمینه برای خوانایی',prefs.contrast)}${check('minimal','نمای خلوت (پنهان کردن اعضا و هدف‌ها)',prefs.minimal)}</fieldset>
            <fieldset><legend>صدا و تایمر شخصی</legend>${check('tick','صدای تیک‌تاک',prefs.tick)}${check('chime','صدای پایان بازه',prefs.chime)}<label>بلندی صدا<input type="range" name="volume" min="0" max="100" value="${Number(prefs.volume)||0}"></label>
            <div class="sr-fields">${number('focus','مطالعه (دقیقه)',5,120,prefs.focus)}${number('rest','استراحت (دقیقه)',1,30,prefs.rest)}</div></fieldset>
            ${room ? `<fieldset><legend>حریم خصوصی</legend>${check('privateTime','زمان مطالعه‌ام را به اعضا نشان نده',snapshot.hidden)}</fieldset>` : ''}
            <button type="submit" class="sr-btn primary">ذخیره تنظیمات من</button>
            ${snapshot?.host ? button('host','تنظیمات میزبان','settings') : ''}
        </form>`);
    }
    function roomForm(edit = false) {
        const r = edit ? snapshot.room : null;
        show(edit ? 'مدیریت اتاق' : 'ساخت اتاق مطالعه', `<form data-form="${edit?'host':'create'}"><label>نام اتاق<input name="name" minlength="2" maxlength="60" value="${esc(r?.name)}" required></label>
        ${edit ? '' : '<label>نوع اتاق<select name="visibility"><option value="private">خصوصی، با دعوت</option><option value="public">عمومی، قابل مشاهده برای همه</option></select></label>'}
        <label>پس‌زمینهٔ پیش‌فرض<select name="theme">${Object.entries(themes).map(([id,label])=>`<option value="${id}" ${r?.theme===id?'selected':''}>${label}</option>`).join('')}</select></label>
        <div class="sr-fields">${number('focus','مطالعه (دقیقه)',5,120,r?.focus || 50)}${number('rest','استراحت (دقیقه)',1,30,r?.rest || 10)}${number('capacity','ظرفیت اتاق',2,32,r?.capacity || 12)}</div>
        <button type="submit" class="sr-btn primary">${edit?'ذخیره تنظیمات اتاق':'ساخت اتاق'}</button>
        ${edit ? `<div class="sr-secondary-actions">${r.visibility === 'private' ? button('invite','تعویض لینک دعوت','link') : ''}${button('close-room','بستن اتاق','stop','danger')}</div>` : ''}
        </form>`);
    }
    const dayOptions = () => Schedule.getOwnDays().map((d,i) => `<option value="${i}" ${i===goalDay?'selected':''}>${esc(d.day)}</option>`).join('');
    function share() {
        const id = snapshot.room.id, key = snapshot.room.visibility === 'private' ? snapshot.invite : '';
        const url = new URL(location.pathname, location.origin);
        url.hash = 'room=' + id + (key ? '.' + key : '');
        show('دعوت دوستان', `<p>لینک را برای دوستانت بفرست. برای ورود باید وارد حساب روند باشند.</p><input type="url" id="sr-link" aria-label="لینک دعوت" dir="ltr" readonly value="${esc(url.href)}">${button('copy','کپی لینک','link','primary')}`);
    }
    async function clicked(event) {
        const b = event.target.closest('button[data-sr]');
        if (!b) return;
        unlockAudio();
        const action = b.dataset.sr, id = b.dataset.id;
        switch (action) {
            case 'directory': {
                prefs.directory = !prefs.directory; paintPrefs();
                if (!prefs.directory) $('[data-sr="directory"]').focus();
                void Storage.saveConfirmed('study_room_preferences', prefs).catch(e=>status(e.message));
                return;
            }
            case 'show-public': prefs.directory = true; filter='public'; paint(); $('#sr-directory').scrollIntoView({block:'nearest'}); return;
            case 'public': case 'private': filter=action; paintDirectory(); return;
            case 'settings': settings(); return;
            case 'host': roomForm(true); return;
            case 'create': roomForm(); return;
            case 'dismiss': dialog().close(); return;
            case 'fullscreen': try { await fullscreen(); } catch(e) { status(e.message); } return;
            case 'share': share(); return;
            case 'copy': try { await navigator.clipboard.writeText($('#sr-link').value); toast('لینک کپی شد.'); } catch { $('#sr-link').select(); toast('لینک را دستی کپی کن.'); } return;
            case 'join-link': show('ورود با دعوت', '<form data-form="invite"><label>لینک دعوت<input name="link" type="url" required dir="ltr" placeholder="https://…"></label><button class="sr-btn primary" type="submit">ورود به اتاق</button></form>'); return;
            case 'join': await act('join',{id}); return;
            case 'group': case 'solo':
                if (snapshot.mode !== action) { lastPhase=undefined; await act('mode',{mode:action}); } return;
            case 'soloStart': await act(action,{focus:Number(prefs.focus),rest:Number(prefs.rest)}); return;
            case 'soloPause': case 'soloResume': case 'soloReset': case 'start': case 'end': case 'leave': await act(action); return;
            case 'invite': if (confirm('لینک‌های قبلی برای اعضای جدید دیگر معتبر نیستند. ادامه می‌دهی؟') && await act('invite')) share(); return;
            case 'close-room': if (confirm('اتاق برای همه بسته شود؟') && await act('close')) dialog().close(); return;
            case 'react': await act('react',{kind:id}); return;
            case 'plan': show('هدف‌ها از برنامه', `<form data-form="day"><label>کدام روز؟<select name="day">${dayOptions()}</select></label><button class="sr-btn primary" type="submit">نمایش هدف‌های این روز</button></form>`); return;
            case 'goal': show('تسک جدید در برنامه', `<form data-form="goal"><label>عنوان تسک<input name="subject" maxlength="100" required autofocus></label><label>روز<select name="day">${dayOptions()}</select></label>${number('minutes','مدت پیشنهادی (دقیقه)',5,600,25)}<button class="sr-btn primary" type="submit">افزودن به برنامه</button></form>`); return;
            case 'person': {
                const person=snapshot.people.find(p=>p.id===id);
                if (!person || person.self) return;
                show(esc(person.name), `<form data-form="report"><input type="hidden" name="target" value="${esc(id)}"><label>دلیل گزارش<select name="reason"><option>رفتار نامناسب</option><option>مزاحمت</option><option>نام یا محتوای نامناسب</option></select></label><button class="sr-btn" type="submit">ارسال گزارش</button><button type="button" class="sr-btn danger" data-sr="block" data-id="${esc(id)}">پنهان کردن عضو</button>${snapshot.host ? `<button type="button" class="sr-btn danger" data-sr="kick" data-id="${esc(id)}">اخراج از اتاق</button>` : ''}</form>`);
                return;
            }
            case 'block': case 'kick': if (await act(action,{target:id})) dialog().close(); return;
        }
    }
    async function changed(e) {
        const field = e.target;
        if (!field.matches('[data-goal]')) return;
        const account = user(), checked = field.checked, selectedDay = goalDay;
        if (field.disabled || busy) { field.checked = !checked; return; }
        field.disabled = true;
        busy = true;
        try { await Schedule.setOwnTaskDone(selectedDay,field.dataset.goal,checked); if (account === user() && active) paintGoals(); }
        catch (err) { field.checked = !checked; status(err.message); toast(err.message); }
        finally { field.disabled = false; busy = false; }
    }
    async function submitted(e) {
        const form=e.target;
        if (!form.matches('[data-form]')) return;
        e.preventDefault(); unlockAudio();
        const submit=form.querySelector('[type="submit"]'), account=user();
        if (submit.disabled || busy) return;
        submit.disabled=true;
        const t = new FormData(form), get = key => t.get(key), num = key => Number(get(key));
        try {
            switch (form.dataset.form) {
                case 'prefs': {
                    const next={...prefs,theme:get('theme')||'room',tick:t.has('tick'),chime:t.has('chime'),contrast:t.has('contrast'),minimal:t.has('minimal'),focus:num('focus'),rest:num('rest'),volume:num('volume')};
                    await Storage.saveConfirmed('study_room_preferences',next);
                    if (account!==user() || !active) return;
                    prefs=next;
                    if (snapshot && !await act('privacy',{hidden:t.has('privateTime')})) return;
                    paint(); if (prefs.tick) beep('tick'); break;
                }
                case 'host': case 'create': {
                    const result=await act(form.dataset.form==='host'?'settings':'create',{name:get('name'),theme:get('theme'),visibility:get('visibility'),focus:num('focus'),rest:num('rest'),capacity:num('capacity')});
                    if (!result) return;
                    filter=result.room.visibility; paintDirectory(); void refresh(true);
                    break;
                }
                case 'invite': {
                    const url=new URL(get('link')), match=url.hash.match(/^#room=([0-9a-f-]{36})(?:\.([0-9a-f]{48}))?$/i);
                    if (!match) throw Error('لینک معتبر اتاق روند را وارد کن.');
                    if (!await act('join',{id:match[1],invite:match[2]})) return;
                    break;
                }
                case 'day': goalDay=num('day'); paintGoals(); break;
                case 'goal': await Schedule.addOwnTask(num('day'),String(get('subject')||'').trim(),num('minutes')); if(account!==user()||!active)return; goalDay=num('day'); paintGoals(); break;
                case 'report': if (!await act('report',{target:get('target'),reason:get('reason')})) return; toast('گزارش ثبت شد.'); break;
            }
            if (dialog().open) dialog().close();
        } catch (err) { toast(err.message); status(err.message); }
        finally { submit.disabled=false; }
    }
    return { enter, exit, reset, hasInvite };
})();
window.StudyRooms = StudyRooms;
