/* Responsive dashboard layer. Reads the app's existing state and forwards actions to existing modules. */
(function () {
    'use strict';
    const dayNames = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];
    const fa = value => window.Utils?.toPersianDigits ? Utils.toPersianDigits(value) : String(value ?? '');
    const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
    const icon = name => `<span class="material-symbols-outlined" aria-hidden="true">${name}</span>`;
    const indexToday = () => (new Date().getDay() + 1) % 7;
    const localIso = date => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    const dateOffset = offset => { const date = new Date(); date.setHours(12, 0, 0, 0); date.setDate(date.getDate() + offset); return date; };
    const duration = hours => { const mins = Math.round(Number(hours || 0) * 60); return mins < 60 ? `${fa(mins)} دقیقه` : `${fa(Math.floor(mins / 60))} ساعت${mins % 60 ? ` و ${fa(mins % 60)} دقیقه` : ''}`; };
    const dayLabel = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { weekday: 'long', day: 'numeric', month: 'long' });
    let root;

    function getModel() {
        const history = window.Stats?.getData?.().history || [];
        const hoursByDate = new Map(history.map(item => [item.date, Number(item.hours || 0)]));
        const week = Array.from({ length: 7 }, (_, i) => ({ date: dateOffset(i - 6), hours: hoursByDate.get(localIso(dateOffset(i - 6))) || 0 }));
        const days = window.Schedule?.getState?.().days || [];
        const tasks = days[indexToday()]?.tasks || [];
        const settings = window.Storage?.getSettings?.() || {};
        const quotes = window.Storage?.get?.('quotes', []) || [];
        const quote = quotes.length ? quotes[Math.floor(Math.random() * quotes.length)] : null;
        return {
            user: window.Storage?.getCurrentUser?.() || {}, history, week, tasks,
            todayHours: hoursByDate.get(localIso(new Date())) || 0,
            goal: Number(settings.dailyGoalHours) > 0 ? Number(settings.dailyGoalHours) : 4,
            streak: window.Stats?.getData?.().streak || 0,
            due: window.Flashcards?.dueCount?.() || 0,
            quote
        };
    }

    function mount() {
        const view = document.getElementById('view-dashboard');
        if (!view) return false;
        if (root?.isConnected) return true;
        root = document.createElement('div'); root.id = 'dashboard-story-ui'; root.className = 'dashboard-story-ui';
        view.prepend(root); root.addEventListener('click', onClick);
        document.documentElement.classList.add('dashboard-story-on');
        return true;
    }

    function paint() {
        if (!mount()) return;
        const m = getModel(), completed = m.tasks.filter(task => task.status === 'completed').length;
        const nextIndex = m.tasks.findIndex(task => task.status !== 'completed');
        const pct = Math.min(100, Math.round(m.todayHours / m.goal * 100));
        const max = Math.max(.5, ...m.week.map(day => day.hours));
        const quoteText = m.quote?.text ? `«${m.quote.text}»` : 'پیشرفت از قدم‌های کوچک و پیوسته ساخته می‌شود.';
        const quoteAuthor = m.quote?.author ? `— ${m.quote.author}` : 'درسیار';
        root.innerHTML = `
            <section class="ds-hero">
                <div class="ds-hero-heading"><div><span class="ds-eyebrow">${esc(dayLabel.format(new Date()))}</span><h1>${esc(m.user.name || m.user.username || 'مسیر مطالعه‌ی تو')}</h1></div><span class="ds-streak">${icon('local_fire_department')}<b>${fa(m.streak)}</b><small>روز پیوسته</small></span></div>
                <blockquote><span>یادآور امروز</span><p>${esc(quoteText)}</p><cite>${esc(quoteAuthor)}</cite></blockquote>
                <div class="ds-actions"><button type="button" class="ds-primary" data-go="pomodoro">${icon('play_arrow')}شروع تمرکز</button><button type="button" class="ds-secondary" data-act="report">${icon('edit_note')}ثبت گزارش</button><button type="button" class="ds-secondary ds-story-button" data-act="story">${icon('ios_share')}اشتراک استوری</button></div>
            </section>
            <section class="ds-goal"><div class="ds-progress-ring" style="--progress:${pct}"><span><b>${fa(pct)}٪</b><small>هدف امروز</small></span></div><div class="ds-goal-copy"><small>مطالعه‌ی امروز</small><strong>${duration(m.todayHours)}</strong><span>از ${duration(m.goal)}</span></div><button type="button" data-act="goal" aria-label="تغییر هدف مطالعه">${icon('tune')}</button></section>
            <section class="ds-smart-grid">
                ${nextIndex >= 0 ? `<button type="button" class="ds-smart ds-next" data-focus="${nextIndex}"><span class="ds-tile-icon">${icon('play_circle')}</span><span><small>تسک بعدی</small><strong>${esc(m.tasks[nextIndex].subject)}</strong><em>${fa(m.tasks[nextIndex].durationMinutes || 60)} دقیقه · شروع با تایمر</em></span>${icon('chevron_left')}</button>` : `<button type="button" class="ds-smart" data-go="schedule"><span class="ds-tile-icon">${icon('event_available')}</span><span><small>برنامه‌ی امروز</small><strong>${m.tasks.length ? 'همه‌ی تسک‌ها انجام شد' : 'برای امروز تسکی نداری'}</strong><em>${m.tasks.length ? 'آفرین، استراحت هم بخشی از مسیر است' : 'یک برنامه‌ی ساده برای خودت بساز'}</em></span>${icon('chevron_left')}</button>`}
                <button type="button" class="ds-smart" data-go="flashcards"><span class="ds-tile-icon mint">${icon('style')}</span><span><small>مرور هوشمند</small><strong>${m.due ? `${fa(m.due)} کارت برای مرور` : 'فلش‌کارت‌ها'}</strong><em>مرور فاصله‌دار برای ماندگاری بهتر</em></span>${icon('chevron_left')}</button>
            </section>
            <section class="ds-card ds-plan"><header><div><h2>برنامه‌ی امروز</h2><p>${m.tasks.length ? `${fa(completed)} از ${fa(m.tasks.length)} تسک انجام شده` : 'برنامه‌ی امروز هنوز خالی است'}</p></div><button type="button" data-go="schedule">مشاهده برنامه ${icon('chevron_left')}</button></header>
                ${m.tasks.length ? `<div class="ds-plan-progress"><i style="width:${Math.round(completed / m.tasks.length * 100)}%"></i></div><ul>${m.tasks.slice(0, 5).map((task, index) => `<li class="${task.status === 'completed' ? 'is-done' : ''}"><span class="ds-task-mark">${task.status === 'completed' ? icon('check') : ''}</span><span class="ds-task-copy"><strong>${esc(task.subject)}</strong><small>${fa(task.durationMinutes || 60)} دقیقه${task.note ? ` · ${esc(task.note)}` : ''}</small></span><button type="button" data-focus="${index}" aria-label="شروع تمرکز برای ${esc(task.subject)}" ${task.status === 'completed' ? 'disabled' : ''}>${icon('timer')}</button></li>`).join('')}</ul>` : `<div class="ds-empty">${icon('edit_calendar')}<p>برای شروع، یک تسک کوتاه به برنامه‌ی امروزت اضافه کن.</p><button type="button" data-act="addtask">افزودن تسک</button></div>`}
            </section>
            <section class="ds-card ds-week"><header><div><h2>روند ۷ روز گذشته</h2><p>${duration(m.week.reduce((sum, day) => sum + day.hours, 0))} مطالعه</p></div><button type="button" data-go="stats">آمار کامل ${icon('chevron_left')}</button></header><div class="ds-week-bars">${m.week.map((day, index) => `<div class="${index === 6 ? 'today' : ''}" title="${duration(day.hours)}"><span><i style="height:${Math.max(day.hours ? 6 : 0, day.hours / max * 100)}%"></i></span><small>${dayNames[(day.date.getDay() + 1) % 7]}</small></div>`).join('')}</div></section>
            <nav class="ds-tools" aria-label="دسترسی سریع">${[['timer','تمرکز','pomodoro'],['calendar_month','برنامه','schedule'],['style','فلش‌کارت','flashcards'],['leaderboard','لیگ','gamification'],['forum','گفت‌وگو','chat'],['monitoring','آمار','stats']].map(([glyph,label,route]) => `<button type="button" data-go="${route}">${icon(glyph)}<span>${label}</span></button>`).join('')}</nav>`;
    }

    function shareStory() {
        const m = getModel(), canvas = document.createElement('canvas');
        canvas.width = 1080; canvas.height = 1920;
        const ctx = canvas.getContext('2d');
        const bg = ctx.createLinearGradient(0, 0, 1080, 1920); bg.addColorStop(0, '#201b3d'); bg.addColorStop(.55, '#34274e'); bg.addColorStop(1, '#56344d');
        ctx.fillStyle = bg; ctx.fillRect(0, 0, 1080, 1920);
        ctx.fillStyle = 'rgba(255,255,255,.05)'; ctx.beginPath(); ctx.arc(980, 250, 390, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(950, 300, 300, 0, Math.PI * 2); ctx.stroke();
        ctx.direction = 'rtl'; ctx.textAlign = 'right'; ctx.fillStyle = '#e6d8ff'; ctx.font = '600 32px Kalameh, sans-serif'; ctx.fillText('درسیار · گزارش مطالعه‌ی من', 940, 180);
        ctx.fillStyle = '#fff'; ctx.font = '800 72px Kalameh, sans-serif'; ctx.fillText('یک هفته‌ی رو به جلو', 940, 470);
        ctx.fillStyle = '#ffd0b5'; ctx.font = '800 118px Kalameh, sans-serif'; ctx.fillText(duration(m.week.reduce((sum, day) => sum + day.hours, 0)), 940, 690);
        ctx.fillStyle = '#ede9f5'; ctx.font = '500 38px Kalameh, sans-serif'; ctx.fillText(`استریک مطالعه: ${fa(m.streak)} روز`, 940, 790);
        ctx.fillStyle = 'rgba(255,255,255,.1)'; ctx.beginPath(); ctx.roundRect(90, 930, 900, 560, 40); ctx.fill();
        const bars = m.week, peak = Math.max(.5, ...bars.map(day => day.hours));
        bars.forEach((day, index) => { const x = 160 + index * 125, height = Math.max(8, day.hours / peak * 300); ctx.fillStyle = index === 6 ? '#ffc19e' : '#b9a4ed'; ctx.beginPath(); ctx.roundRect(x, 1350 - height, 64, height, 28); ctx.fill(); ctx.fillStyle = '#eee9f6'; ctx.font = '500 28px Kalameh, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(dayNames[(day.date.getDay() + 1) % 7], x + 32, 1410); });
        ctx.textAlign = 'right'; ctx.fillStyle = '#e8e1f2'; ctx.font = '500 34px Kalameh, sans-serif';
        const quote = m.quote?.text || 'پیشرفت از قدم‌های کوچک و پیوسته ساخته می‌شود.';
        const words = quote.split(/\s+/), lines = []; let line = '';
        words.forEach(word => { const test = line ? `${line} ${word}` : word; if (ctx.measureText(test).width > 820 && line) { lines.push(line); line = word; } else line = test; });
        if (line) lines.push(line); lines.slice(0, 2).forEach((text, index) => ctx.fillText(`«${text}»`, 940, 1630 + index * 54));
        return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    }

    async function onClick(event) {
        const button = event.target.closest('[data-go],[data-act],[data-focus]'); if (!button || !root.contains(button)) return;
        if (button.dataset.go) return window.App?.navigate(button.dataset.go);
        if (button.dataset.focus != null) return window.Schedule?.launchPomoForTask(indexToday(), Number(button.dataset.focus));
        if (button.dataset.act === 'goal') return window.Dashboard?.openEditGoalModal();
        if (button.dataset.act === 'addtask') return window.Schedule?.openEditTaskModal(indexToday(), -1);
        if (button.dataset.act === 'report') { if (window.WebStudio?.report) return WebStudio.report(); return window.App?.navigate('stats'); }
        if (button.dataset.act === 'story') {
            try {
                const blob = await shareStory(); if (!blob) throw new Error('امکان ساخت تصویر فراهم نشد.');
                const file = new File([blob], 'darsyar-study-story.png', { type: 'image/png' });
                if (navigator.share && navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: 'گزارش مطالعه درسیار' });
                else { const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = file.name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1500); window.Utils?.showToast('استوری مطالعه دانلود شد؛ می‌توانی آن را منتشر کنی.', 'success'); }
            } catch (error) { if (error.name !== 'AbortError') window.Utils?.showToast(error.message || 'ساخت استوری انجام نشد.', 'error'); }
        }
    }
    document.addEventListener('dashboard:rendered', paint);
})();
