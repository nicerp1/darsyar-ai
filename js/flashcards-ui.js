/**
 * Flashcards UI (phone + desktop). Presentation only: state comes from Flashcards.getState(), every action is
 * forwarded to the original module (filterBox, filterCategory, flipCard, rateCard, openAddModal, openAIModal).
 * Event-driven (flashcards:changed) — no DOM observers.
 */
(function () {
    'use strict';
    const pd = v => (window.Utils?.toPersianDigits ? Utils.toPersianDigits(v) : String(v));
    const ico = n => `<span class="material-symbols-outlined" aria-hidden="true">${n}</span>`;
    const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'off';
    const CATS = [['all', 'همه دروس', '🗂️'], ['زیست', 'زیست‌شناسی', '🧬'], ['شیمی', 'شیمی', '🧪'], ['فیزیک', 'فیزیک', '⚡'], ['ریاضی', 'ریاضیات', '📐'], ['فارسی', 'ادبیات', '📖'], ['عربی', 'عربی', '📜'], ['انگلیسی', 'انگلیسی', '🌍'], ['سایر', 'عمومی', '💡']];
    const BOXES = [['شروع یادگیری', '۱ روز'], ['آشنایی', '۲ روز'], ['در حال تثبیت', '۴ روز'], ['یادآوری قوی', '۷ روز'], ['تسلط', '۱۵ روز']];
    const RATES = [['wrong', 'دوباره', 'برگشت به جعبه ۱', 'replay', '1'], ['medium', 'هنوز نه کامل', 'همین جعبه', 'hourglass_top', '2'], ['easy', 'بلدم', 'جعبه بعدی', 'check_circle', '3']];
    let root, st, shownId = null;
    const $ = (s, r = root) => r.querySelector(s);
    const render = html => (window.Utils?.renderKaTeXAndMarkdown ? Utils.renderKaTeXAndMarkdown(html || '') : String(html || ''));

    function mount() {
        if (root?.isConnected) return true;
        const view = document.getElementById('view-flashcards'); if (!view) return false;
        root = document.createElement('div'); root.id = 'fcx'; root.className = 'fcx';
        root.innerHTML = `
        <header class="fcx-head">
            <div class="fcx-title"><h2>فلش‌کارت</h2><p>کم بخوان، عمیق به خاطر بسپار.</p></div>
            <div class="fcx-tools">
                <button type="button" class="fcx-icon" data-act="ai" aria-label="استخراج کارت با هوش مصنوعی">${ico('auto_awesome')}</button>
                <button type="button" class="fcx-add" data-act="add">${ico('add')}<span>کارت جدید</span></button>
            </div>
        </header>
        <div class="fcx-layout">
            <section class="fcx-main">
                <div class="fcx-seg" id="fcx-seg" role="group" aria-label="نوع مرور" data-i="0"><i aria-hidden="true"></i>
                    <button type="button" data-due="due" aria-pressed="true">${ico('today')}<span>مرور امروز</span><b id="fcx-due-n"></b></button>
                    <button type="button" data-due="all" aria-pressed="false">${ico('style')}<span>همه کارت‌ها</span></button>
                </div>
                <div class="fcx-chips" id="fcx-chips" role="group" aria-label="دروس"></div>
                <div class="fcx-progress"><div class="fcx-track"><i id="fcx-bar"></i></div><span id="fcx-count"></span></div>
                <div class="fcx-stage" id="fcx-stage">
                    <div class="fcx-card" id="fcx-card" role="button" tabindex="0" aria-label="نمایش پاسخ" data-act="flip">
                        <div class="fcx-face fcx-front"><div class="fcx-meta"><span id="fcx-cat"></span><span id="fcx-box"></span></div><small class="fcx-kicker">اول فکر کن</small><div class="fcx-text" id="fcx-q"></div><span class="fcx-hint">${ico('touch_app')}برای دیدن پاسخ بزن</span></div>
                        <div class="fcx-face fcx-back" aria-hidden="true"><div class="fcx-meta"><span>پاسخ</span><span id="fcx-box2"></span></div><small class="fcx-kicker">حالا مقایسه کن</small><div class="fcx-text" id="fcx-a"></div><span class="fcx-hint">${ico('undo')}بازگشت به سؤال</span></div>
                    </div>
                    <div class="fcx-empty" id="fcx-empty" hidden>${ico('style')}<h3>اینجا هنوز کارتی نیست</h3><p>یک کارت بساز یا با هوش مصنوعی از متن درسی کارت بگیر؛ یا فیلتر دیگری را امتحان کن.</p><button type="button" class="fcx-add" data-act="add">${ico('add')}<span>ساخت اولین کارت</span></button></div>
                </div>
                <div class="fcx-rate" id="fcx-rate">${RATES.map(([k, l, h, i, key]) => `<button type="button" data-rate="${k}" disabled>${ico(i)}<strong>${l}</strong><small>${h}</small><kbd>${key}</kbd></button>`).join('')}</div>
                <p class="fcx-keys" id="fcx-keys">Space: چرخاندن کارت · ۱ ۲ ۳: امتیاز دادن</p>
            </section>
            <aside class="fcx-side">
                <section class="fcx-panel fcx-mastery"><div class="fcx-ring" id="fcx-ring"><svg viewBox="0 0 64 64" aria-hidden="true"><circle class="t" cx="32" cy="32" r="27"/><circle class="v" cx="32" cy="32" r="27" pathLength="100"/></svg><b id="fcx-mp">۰٪</b></div>
                    <div><h3>میزان تسلط</h3><p id="fcx-mt"></p></div><div class="fcx-dist" id="fcx-dist" aria-hidden="true"></div></section>
                <section class="fcx-panel"><header><h3>جعبه‌های لایتنر</h3><span>روی هر جعبه بزن تا فقط همان‌ها را مرور کنی</span></header><div class="fcx-ladder" id="fcx-ladder" role="group" aria-label="جعبه‌های لایتنر"></div></section>
                <section class="fcx-tip">${ico('psychology')}<p>قبل از دیدن پاسخ، چند ثانیه سعی کن از حافظه‌ات بازیابی‌اش کنی؛ همین تلاش حافظه را محکم می‌کند.</p></section>
            </aside>
        </div>`;
        view.prepend(root);
        root.addEventListener('click', onClick);
        root.querySelector('#fcx-card').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); window.Flashcards?.flipCard(); } });
        document.addEventListener('keydown', onKey);
        document.documentElement.classList.add('fcx-on');
        return true;
    }

    function paint() {
        if (!mount() || !window.Flashcards?.getState) return;
        st = Flashcards.getState();
        const { cards, queue, index, flipped } = st;
        const counts = [0, 0, 0, 0, 0, 0]; cards.forEach(c => { counts[Math.min(5, Math.max(1, c.box || 1))]++; });
        const total = cards.length, mastery = total ? Math.round(cards.reduce((a, c) => a + ((c.box || 1) - 1), 0) / (4 * total) * 100) : 0;

        $('#fcx-seg').dataset.i = st.dueOnly ? '0' : '1'; $('#fcx-due-n').textContent = st.due ? pd(st.due) : ''; $('#fcx-due-n').hidden = !st.due;
        root.querySelectorAll('#fcx-seg [data-due]').forEach(button => button.setAttribute('aria-pressed', String((button.dataset.due === 'due') === st.dueOnly)));

        // mastery
        $('#fcx-ring .v').style.strokeDashoffset = String(100 - mastery); $('#fcx-mp').textContent = `${pd(mastery)}٪`;
        $('#fcx-mt').textContent = total ? `${pd(total)} کارت · ${pd(counts[5])} در جعبه تسلط` : 'هنوز کارتی نساخته‌ای';
        $('#fcx-dist').innerHTML = total ? counts.slice(1).map((n, i) => `<i style="flex:${n || .001};--b:${i + 1}" title="جعبه ${pd(i + 1)}: ${pd(n)}"></i>`).join('') : '';

        // ladder (all + 5 boxes)
        const max = Math.max(1, ...counts.slice(1));
        const tile = (val, name, sub, n, active) => `<button type="button" class="fcx-box${active ? ' is-on' : ''}" data-box="${val}" aria-pressed="${active}" style="--f:${val === 'all' ? 100 : Math.round(n / max * 100)}%;--b:${val === 'all' ? 0 : val}"><em></em><b>${pd(n)}</b><strong>${name}</strong><small>${sub}</small></button>`;
        $('#fcx-ladder').innerHTML = tile('all', 'همه کارت‌ها', 'مرور کامل', total, String(st.box) === 'all') + BOXES.map(([n, d], i) => tile(i + 1, `جعبه ${pd(i + 1)}`, `${n} · ${d}`, counts[i + 1], String(st.box) === String(i + 1))).join('');

        // category chips with counts
        const cnt = id => id === 'all' ? total : cards.filter(c => c.category === id).length;
        $('#fcx-chips').innerHTML = CATS.map(([id, l, e]) => `<button type="button" data-cat="${id}" aria-pressed="${st.category === id}"><span aria-hidden="true">${e}</span>${l}<b>${pd(cnt(id))}</b></button>`).join('');

        // stage
        const has = queue.length > 0, card = queue[index];
        $('#fcx-card').hidden = !has; $('#fcx-empty').hidden = has; $('#fcx-rate').hidden = !has; $('#fcx-keys').hidden = !has;
        $('.fcx-progress').hidden = !has;
        if (!has) {
            if (!total) $('#fcx-empty').innerHTML = `${ico('style')}<h3>اینجا هنوز کارتی نیست</h3><p>یک کارت بساز یا با هوش مصنوعی از متن درسی کارت بگیر.</p><button type="button" class="fcx-add" data-act="add">${ico('add')}<span>ساخت اولین کارت</span></button>`;
            else if (st.dueOnly) {
                const next = st.nextDue;
                const nextText = next ? ` نوبت بعدی ${new Intl.DateTimeFormat('fa-IR-u-ca-persian', { day: 'numeric', month: 'long' }).format(new Date(`${next.date}T12:00:00`))} است و ${pd(next.count)} کارت برای مرور دارد.` : '';
                $('#fcx-empty').innerHTML = `${ico('task_alt')}<h3>مرور امروز تمام شد</h3><p>آفرین؛ کارت‌های موعد امروز را مرور کردی.${nextText}</p><button type="button" class="fcx-add" data-act="all">${ico('style')}<span>مرور همه‌ی کارت‌ها</span></button>`;
            } else $('#fcx-empty').innerHTML = `${ico('filter_alt_off')}<h3>کارتی با این فیلتر نیست</h3><p>فیلتر درس یا جعبه را تغییر بده تا کارت‌های بیشتری ببینی.</p>`;
        }
        if (has) {
            const el = $('#fcx-card');
            $('#fcx-bar').style.width = `${(index + 1) / queue.length * 100}%`;
            $('#fcx-count').textContent = `کارت ${pd(index + 1)} از ${pd(queue.length)}`;
            if (shownId !== card.id) {
                const isNew = shownId !== null;
                el.classList.add('no-anim'); el.classList.remove('is-flipped'); void el.offsetWidth; el.classList.remove('no-anim');
                $('#fcx-q').innerHTML = `<div class="fcx-rich">${render(card.question)}</div>`; $('#fcx-a').innerHTML = `<div class="fcx-rich">${render(card.answer)}</div>`;
                const cat = CATS.find(c => c[0] === card.category);
                $('#fcx-cat').textContent = card.categoryName || (cat ? cat[1] : card.category || 'عمومی');
                const b = pd(card.box || 1); $('#fcx-box').textContent = `جعبه ${b}`; $('#fcx-box2').textContent = `جعبه ${b}`;
                el.dataset.level = card.box || 1; shownId = card.id;
                if (isNew && !reduced()) { el.classList.remove('is-in'); void el.offsetWidth; el.classList.add('is-in'); }
            }
            el.classList.toggle('is-flipped', flipped);
            el.setAttribute('aria-label', flipped ? 'بازگشت به سؤال' : 'نمایش پاسخ');
            $('.fcx-front').setAttribute('aria-hidden', String(flipped)); $('.fcx-back').setAttribute('aria-hidden', String(!flipped));
            root.querySelectorAll('.fcx-rate button').forEach(b => { b.disabled = !flipped; });
            $('#fcx-rate').classList.toggle('is-ready', flipped);
        } else shownId = null;
    }

    function onClick(e) {
        const t = e.target.closest('[data-act],[data-rate],[data-box],[data-cat],[data-due]'); if (!t || !root.contains(t)) return;
        const F = window.Flashcards;
        if (t.dataset.due) return F?.setDueOnly(t.dataset.due === 'due');
        if (t.dataset.rate) return F?.rateCard(t.dataset.rate);
        if (t.dataset.box) return F?.filterBox(t.dataset.box === 'all' ? 'all' : Number(t.dataset.box));
        if (t.dataset.cat) return F?.filterCategory(t.dataset.cat);
        if (t.dataset.act === 'flip') return F?.flipCard();
        if (t.dataset.act === 'add') return F?.openAddModal();
        if (t.dataset.act === 'ai') return F?.openAIModal();
        if (t.dataset.act === 'all') return F?.setDueOnly(false);
    }
    function onKey(e) {
        if (!root?.isConnected || !root.offsetParent || e.ctrlKey || e.metaKey || e.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable || document.querySelector('.modal-overlay.active, .modal.active')) return;
        if (!st?.queue.length) return;
        if (e.code === 'Space' && e.target.tagName !== 'BUTTON') { e.preventDefault(); Flashcards.flipCard(); }
        const k = { Digit1: 'wrong', Digit2: 'medium', Digit3: 'easy', Numpad1: 'wrong', Numpad2: 'medium', Numpad3: 'easy' }[e.code];
        if (k && st.flipped) Flashcards.rateCard(k);
    }
    document.addEventListener('flashcards:changed', paint);
})();
