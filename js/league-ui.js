/**
 * League & friends UI (phone + desktop). Presentation only: reads Gamification.getModel(), forwards actions to
 * Gamification.sendRequest / friendAction / saveSettings (settings are copied into the original inputs first).
 * Event-driven (league:rendered).
 */
(function () {
    'use strict';
    const pd = v => (window.Utils?.toPersianDigits ? Utils.toPersianDigits(v) : String(v ?? ''));
    const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const ico = n => `<span class="material-symbols-outlined" aria-hidden="true">${n}</span>`;
    const avatar = value => window.ProfileStudio?.avatarHTML ? ProfileStudio.avatarHTML(value) : ico('person');
    const LEVELS = ['تازه‌کار', 'پوینده', 'پرتلاش', 'نخبه', 'استاد'], T = [0, 200, 600, 1200, 2500, 5000];
    const lvl = n => LEVELS[Math.max(1, Math.min(5, Number(n) || 1)) - 1];
    let root, tab = 'league', sig = '', armed = null;
    const $ = (s, r = root) => r.querySelector(s);

    function mount() {
        if (root?.isConnected) return true;
        const view = document.getElementById('view-gamification'); if (!view) return false;
        root = document.createElement('div'); root.id = 'lgx'; root.className = 'lgx';
        root.innerHTML = `
        <section class="lgx-hero" id="lgx-hero"></section>
        <div class="lgx-tabs" role="tablist" aria-label="بخش‌های لیگ" data-i="0"><i aria-hidden="true"></i>
            <button type="button" role="tab" data-tab="league" aria-selected="true">${ico('leaderboard')}لیگ</button>
            <button type="button" role="tab" data-tab="friends" aria-selected="false">${ico('group')}دوستان<b id="lgx-rq" hidden></b></button>
            <button type="button" role="tab" data-tab="settings" aria-selected="false">${ico('tune')}تنظیمات</button>
        </div>
        <div class="lgx-grid" id="lgx-grid" data-tab="league">
            <div class="lgx-col">
                <section class="lgx-prize" id="lgx-prize"></section>
                <section class="lgx-card" data-pane="league"><header><div><h3>لیگ ماهانه مطالعه</h3><p>رتبه‌بندی بر اساس امتیاز فعالیت‌های ثبت‌شده</p></div><span class="lgx-pill">${ico('verified_user')}اختیاری</span></header><div id="lgx-board"></div></section>
            </div>
            <div class="lgx-col">
                <section class="lgx-card" data-pane="friends"><header><div><h3>دوستان من</h3><p>با نام کاربری درخواست بفرست</p></div></header>
                    <form class="lgx-add" id="lgx-add" autocomplete="off"><input id="lgx-user" inputmode="text" autocapitalize="off" placeholder="نام کاربری دوست" aria-label="نام کاربری دوست"><button type="submit">${ico('person_add')}<span>افزودن</span></button></form>
                    <div id="lgx-requests"></div><div id="lgx-friends" class="lgx-friends"></div></section>
                <section class="lgx-card" data-pane="settings"><header><div><h3>پروفایل لیگ</h3><p>کنترل نمایش اطلاعات با خودت است</p></div></header>
                    <label class="lgx-switch"><span><strong>حضور در لیگ</strong><small>نام نمایشی و امتیاز دیده می‌شود</small></span><input id="lgx-visible" type="checkbox"><i aria-hidden="true"></i></label>
                    <label class="lgx-switch"><span><strong>نمایش پایه تحصیلی</strong><small>شماره تماس و ایمیل هرگز نمایش داده نمی‌شود</small></span><input id="lgx-grade" type="checkbox"><i aria-hidden="true"></i></label>
                    <label class="lgx-field"><span>معرفی کوتاه</span><textarea id="lgx-bio" maxlength="120" rows="2" placeholder="مثلاً: دانش‌آموز تجربی و علاقه‌مند به زیست"></textarea><small id="lgx-bio-n">۰ / ۱۲۰</small></label>
                    <button type="button" class="lgx-save" data-act="save">${ico('check')}ذخیره تنظیمات</button></section>
            </div>
        </div>`;
        view.prepend(root);
        root.addEventListener('click', onClick);
        $('#lgx-add').addEventListener('submit', e => { e.preventDefault(); const v = $('#lgx-user').value.trim(); if (!v) return; const old = document.getElementById('friend-username'); if (old) old.value = v; $('#lgx-user').value = ''; window.Gamification?.sendRequest(); });
        $('#lgx-bio').addEventListener('input', e => { $('#lgx-bio-n').textContent = `${pd(e.target.value.length)} / ${pd(120)}`; });
        document.documentElement.classList.add('lgx-on');
        return true;
    }

    function hero(user, model, rank, me) {
        const level = Math.max(1, Number(user?.level) || 1), xp = Number(user?.xp) || 0, min = T[level - 1], max = T[level] || T.at(-1);
        const pct = Math.min(100, Math.max(0, Math.round((xp - min) / Math.max(1, max - min) * 100)));
        $('#lgx-hero').innerHTML = `
            <div class="lgx-hero-top">
                <span class="lgx-me">${window.ProfileStudio?.avatarHTML ? ProfileStudio.avatarHTML(user?.avatar) : ico('person')}</span>
                <div class="lgx-hero-id"><small>لیگ واقعی دانش‌آموزان</small><h2>${esc(user?.name || 'دانش‌آموز')}</h2><span class="lgx-lvl">${ico('military_tech')}سطح ${pd(level)} · ${lvl(level)}</span></div>
            </div>
            <div class="lgx-xp"><div class="lgx-xp-top"><span>پیشرفت تا سطح بعدی</span><b>${pd(xp)} از ${pd(max)} امتیاز</b></div><div class="lgx-xp-bar"><i style="--p:${pct}%"></i></div></div>
            <div class="lgx-stats">
                <div>${ico('emoji_events')}<strong>${rank ? `#${pd(rank)}` : '—'}</strong><small>رتبه‌ی تو</small></div>
                <div>${ico('bolt')}<strong>${me ? pd(me.seasonPoints || 0) : '—'}</strong><small>امتیاز فصل</small></div>
                <div>${ico('group')}<strong>${model ? pd(model.friends.length) : '—'}</strong><small>دوست</small></div>
            </div>`;
    }

    function board(model) {
        const box = $('#lgx-board');
        if (!model) {
            const error = window.Gamification?.getError?.();
            box.innerHTML = error ? `<div class="lgx-empty">${ico('wifi_off')}<p>${esc(error)}</p><button type="button" class="lgx-retry" data-act="retry">تلاش دوباره</button></div>` : '<div class="lgx-skel"><i></i><i></i><i></i><i></i></div>';
            return;
        }
        const list = model.leaderboard || [];
        if (!list.length) { box.innerHTML = `<div class="lgx-empty">${ico('groups')}<p>هنوز کسی با رضایت خودش وارد لیگ نشده است.</p><button type="button" class="lgx-retry" data-act="join">تنظیم حضور من در لیگ</button></div>`; return; }
        const top = list.slice(0, 3), best = Math.max(1, ...list.map(i => i.seasonPoints || 0));
        const pod = (it, pos) => it ? `<article class="lgx-pod p${pos}${it.isMe ? ' is-me' : ''}" style="--d:${pos === 1 ? 0 : pos === 2 ? 1 : 2}">${pos === 1 ? `<span class="lgx-crown">${ico('workspace_premium')}</span>` : ''}<span class="lgx-av" data-profile="${esc(it.username)}">${avatar(it.avatar)}</span><strong>${esc(it.name)}${it.isMe ? ' (تو)' : ''}</strong><small>${pd(it.seasonPoints || 0)} امتیاز</small><div class="lgx-step"><b>${pd(pos)}</b></div></article>` : '';
        const podium = top.length >= 3 ? `<div class="lgx-podium">${pod(top[1], 2)}${pod(top[0], 1)}${pod(top[2], 3)}</div>` : '';
        const rows = list.map((it, i) => `<article class="lgx-row${it.isMe ? ' is-me' : ''}" style="--i:${i}"><b class="lgx-rank">${pd(it.rank)}</b><span class="lgx-av" data-profile="${esc(it.username)}">${avatar(it.avatar)}</span><div class="lgx-who"><strong>${esc(it.name)}${it.isMe ? '<em>تو</em>' : ''}${it.isFriend ? '<em class="f">دوست</em>' : ''}</strong><small>${lvl(it.level)}</small><i class="lgx-meter"><u style="width:${Math.round((it.seasonPoints || 0) / best * 100)}%"></u></i></div><span class="lgx-pts"><b>${pd(it.seasonPoints || 0)}</b><small>امتیاز</small></span></article>`).join('');
        box.innerHTML = `${podium}<h4 class="lgx-board-heading">رتبه‌بندی کامل لیگ <small>${pd(list.length)} نفر</small></h4><div class="lgx-rows">${rows}</div>`;
        box.querySelectorAll('[data-profile]').forEach(node => {
            const person = list.find(item => item.username === node.dataset.profile);
            if (person) window.Community?.bind?.(node, person);
        });
    }

    const person = (p, actions) => `<article class="lgx-person"><span class="lgx-av2">${window.ProfileStudio?.avatarHTML ? ProfileStudio.avatarHTML(p.avatar) : ''}</span><div><strong>${esc(p.name)}</strong><small>@${esc(p.username)}${p.grade ? ` · ${esc(p.grade)}` : ''}</small><em>${pd(p.xp)} امتیاز · ${lvl(p.level)}</em></div>${actions}</article>`;

    function social(model) {
        const req = $('#lgx-requests'), fr = $('#lgx-friends');
        if (!model) { req.innerHTML = ''; fr.innerHTML = window.Gamification?.getError?.() ? `<div class="lgx-empty">${ico('wifi_off')}<p>دوستان بارگذاری نشدند.</p><button type="button" class="lgx-retry" data-act="retry">تلاش دوباره</button></div>` : '<div class="lgx-skel"><i></i><i></i></div>'; return; }
        const n = model.requests.length; $('#lgx-rq').hidden = !n; $('#lgx-rq').textContent = pd(n);
        req.innerHTML = n ? `<div class="lgx-reqs"><h4>${ico('mail')}درخواست‌های دوستی</h4>${model.requests.map(p => person(p, `<div class="lgx-acts"><button type="button" class="ok" data-fa="accept" data-u="${esc(p.username)}">پذیرش</button><button type="button" data-fa="reject" data-u="${esc(p.username)}">رد</button></div>`)).join('')}</div>` : '';
        fr.innerHTML = model.friends.length ? model.friends.map(p => person(p, `<button type="button" class="lgx-rm" data-rm="${esc(p.username)}" aria-label="حذف ${esc(p.name)} از دوستان">${ico('person_remove')}</button>`)).join('') : `<div class="lgx-empty">${ico('diversity_3')}<p>هنوز دوستی اضافه نکرده‌ای. نام کاربری یک هم‌کلاسی را بنویس!</p></div>`;
        document.querySelectorAll('#lgx .lgx-person .lgx-av2').forEach((node, i) => { const p = [...model.requests, ...model.friends][i]; if (p) window.Community?.bind?.(node, p); });
    }

    function paint() {
        if (!mount()) return;
        const user = window.Storage?.getCurrentUser?.(), model = window.Gamification?.getModel?.(), student = user?.accountType === 'student';
        const grid = $('#lgx-grid');
        const unavailable = $('#lgx-unavailable');
        if (!student) {
            $('#lgx-hero').innerHTML = '';
            $('.lgx-tabs').hidden = true;
            grid.hidden = true;
            if (!unavailable) root.insertAdjacentHTML('beforeend', `<div class="lgx-empty wide" id="lgx-unavailable">${ico('school')}<p>لیگ و دوستان برای حساب دانش‌آموز فعال است.</p></div>`);
            return;
        }
        grid.hidden = false;
        $('.lgx-tabs').hidden = false;
        unavailable?.remove();
        const me = model?.leaderboard?.find(i => i.isMe);
        hero(user, model, me?.rank, me);
        const prize = document.querySelector('#view-gamification .league-prize-card');
        $('#lgx-prize').innerHTML = prize ? `${ico('workspace_premium')}<div><small>${esc(prize.querySelector('small')?.textContent)}</small><h3>${esc(prize.querySelector('h3')?.textContent)}</h3><p>${esc(prize.querySelector('p')?.textContent)}</p></div>` : '';
        board(model); social(model);
        if (model) {                                      // fill the form only when the server data changed (never clobber typing)
            const s = JSON.stringify(model.settings || {});
            if (s !== sig) { sig = s; const st = model.settings || {}; $('#lgx-visible').checked = !!st.leagueVisible; $('#lgx-grade').checked = st.showGrade !== false; $('#lgx-bio').value = st.bio || ''; $('#lgx-bio-n').textContent = `${pd(($('#lgx-bio').value).length)} / ${pd(120)}`; }
        }
        setTab(tab);
    }

    function setTab(t) {
        tab = t; $('#lgx-grid').dataset.tab = t; $('.lgx-tabs').dataset.i = String(['league', 'friends', 'settings'].indexOf(t));
        root.querySelectorAll('.lgx-tabs [data-tab]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === t)));
    }

    function onClick(e) {
        const b = e.target.closest('[data-tab],[data-fa],[data-rm],[data-act]'); if (!b || !root.contains(b)) return;
        const G = window.Gamification;
        if (b.dataset.tab) return setTab(b.dataset.tab);
        if (b.dataset.act === 'retry') return G?.init();
        if (b.dataset.act === 'join') { setTab('settings'); $('#lgx-visible')?.focus(); return; }
        if (b.dataset.fa) return G?.friendAction(b.dataset.fa, b.dataset.u);
        if (b.dataset.rm) {                                // two-step remove: first tap arms the button
            if (armed === b) { armed = null; return G?.friendAction('remove', b.dataset.rm); }
            if (armed) armed.classList.remove('armed');
            armed = b; b.classList.add('armed'); setTimeout(() => { if (armed === b) { b.classList.remove('armed'); armed = null; } }, 3000); return;
        }
        if (b.dataset.act === 'save') {
            const set = (id, fn) => { const el = document.getElementById(id); if (el) fn(el); };
            set('league-visible', el => { el.checked = $('#lgx-visible').checked; }); set('league-show-grade', el => { el.checked = $('#lgx-grade').checked; }); set('league-bio', el => { el.value = $('#lgx-bio').value; });
            G?.saveSettings();
        }
    }

    document.addEventListener('league:rendered', paint);
})();
