/** Manual report card enhancer: status chips + quick subject suggestions. The original form fields stay the source of truth. */
(function () {
    'use strict';
    const STATUS = [['completed', 'check_circle', 'کامل'], ['partial', 'timelapse', 'بخشی'], ['missed', 'cancel', 'نشد']];
    const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const fire = el => { el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };

    function build(card) {
        const select = card.querySelector('#report-status');
        if (select && !card.querySelector('.rp-status')) {
            const group = document.createElement('div'); group.className = 'rp-status'; group.setAttribute('role', 'radiogroup'); group.setAttribute('aria-label', 'وضعیت انجام');
            group.innerHTML = STATUS.map(([v, i, l]) => `<button type="button" role="radio" data-v="${v}"><span class="material-symbols-outlined" aria-hidden="true">${i}</span>${l}</button>`).join('');
            select.classList.add('rp-hide'); select.after(group);
            const sync = () => group.querySelectorAll('button').forEach(b => b.setAttribute('aria-checked', String(b.dataset.v === select.value)));
            group.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; select.value = b.dataset.v; fire(select); sync(); });
            select.addEventListener('change', sync);
            card.querySelector('form')?.addEventListener('reset', () => setTimeout(sync, 0));
            sync();
        }
        const out = card.querySelector('#report-duration-preview');
        if (out && !out.dataset.rp) {
            out.dataset.rp = '1';
            const live = () => out.classList.toggle('is-live', !/^[۰0٠]+$/.test(out.querySelector('strong')?.textContent.trim() || '0'));
            new MutationObserver(live).observe(out, { childList: true, subtree: true, characterData: true }); live();
        }
    }

    function suggest(card) {
        const input = card.querySelector('#report-subject'); if (!input) return;
        let box = card.querySelector('.rp-suggest');
        if (!box) { box = document.createElement('div'); box.className = 'rp-suggest'; input.after(box); box.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; input.value = b.dataset.s; fire(input); input.focus(); }); }
        const today = (new Date().getDay() + 1) % 7, names = [];
        (window.Schedule?.getState?.().days?.[today]?.tasks || []).forEach(t => t.subject && names.push(t.subject));
        (Storage.get('manual_reports', []) || []).slice().reverse().forEach(r => r.subject && names.push(r.subject));
        const uniq = [...new Set(names.map(n => n.trim()))].slice(0, 6);
        const html = uniq.length ? `<small>پیشنهاد از تسک‌های تو</small>${uniq.map(n => `<button type="button" data-s="${esc(n)}">${esc(n)}</button>`).join('')}` : '';
        if (box.dataset.h !== html) { box.dataset.h = html; box.innerHTML = html; }   // only touch the DOM when it changed (the observer watches the body)
    }

    function more(card) {                                      // desktop only (phones already have their own "show all"): cap the list, expand on demand
        const list = card.querySelector('#manual-report-list'); if (!list) return;
        let btn = card.querySelector('.rp-more');
        if (!btn) { btn = document.createElement('button'); btn.type = 'button'; btn.className = 'rp-more'; list.after(btn); btn.addEventListener('click', () => { list.classList.toggle('rp-expanded'); count(); }); }
        function count() {
            const n = list.querySelectorAll('.sf-report').length, open = list.classList.contains('rp-expanded'), txt = n > 6 ? (open ? 'نمایش کمتر' : `نمایش همه (${window.Utils?.toPersianDigits ? Utils.toPersianDigits(n) : n})`) : '';
            if (btn.textContent !== txt) btn.textContent = txt; if (btn.hidden !== !txt) btn.hidden = !txt;   // writing an unchanged attribute would re-trigger the body observer
        }
        count();
    }
    function run() { const card = document.querySelector('.manual-report-card'); if (!card) return; build(card); suggest(card); more(card); }
    new MutationObserver(run).observe(document.body, { childList: true, subtree: true });
    document.addEventListener('stats:rendered', run);
    document.addEventListener('schedule:rendered', run);
    run();
})();
