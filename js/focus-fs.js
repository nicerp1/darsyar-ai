/** Fullscreen focus: progress ring, session dots, clock, keyboard control and idle auto-hide. Mirrors the original timer state. */
(function () {
    'use strict';
    // classList.remove() on a missing class still rewrites the attribute and re-fires our own observers; guard it
    const unidle = () => { if (overlay.classList.contains('fsx-idle')) overlay.classList.remove('fsx-idle'); };
    const pd = v => (window.Utils?.toPersianDigits ? Utils.toPersianDigits(v) : String(v));
    const SVG = 'http://www.w3.org/2000/svg';
    let overlay, clock, cycle, ring, idleTimer = 0, tick = 0, raf = 0;

    function build() {
        overlay = document.getElementById('focus-fullscreen-overlay');
        if (!overlay || overlay.dataset.fsx) return !!overlay;
        overlay.dataset.fsx = '1';
        const dial = overlay.querySelector('.focus-static-dial'), card = overlay.querySelector('.focus-static-card');
        ring = document.createElementNS(SVG, 'svg'); ring.setAttribute('viewBox', '0 0 280 280'); ring.setAttribute('class', 'fsx-ring'); ring.setAttribute('aria-hidden', 'true');
        ring.innerHTML = '<circle class="ticks" cx="140" cy="140" r="134"/><circle class="bg" cx="140" cy="140" r="120"/><circle class="fg" cx="140" cy="140" r="120"/>';
        dial.prepend(ring);
        clock = document.createElement('div'); clock.className = 'fsx-clock'; clock.setAttribute('aria-hidden', 'true'); overlay.prepend(clock);
        cycle = document.createElement('div'); cycle.className = 'fsx-cycle'; cycle.setAttribute('aria-hidden', 'true'); dial.after(cycle);
        const hint = document.createElement('div'); hint.className = 'fsx-hint'; hint.textContent = 'فاصله: شروع یا توقف · Esc: خروج'; card.append(hint);
        new MutationObserver(onActive).observe(overlay, { attributes: true, attributeFilter: ['class'] });
        new MutationObserver(() => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; sync(); }); }).observe(overlay, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['class', 'style'] });
        ['pointermove', 'pointerdown', 'keydown', 'touchstart', 'wheel'].forEach(e => overlay.addEventListener(e, wake, { passive: true }));
        document.addEventListener('keydown', onKey);
        return true;
    }

    function sync() {
        if (!overlay?.classList.contains('active')) return;
        const old = document.getElementById('pomo-circle-progress'), fg = ring.querySelector('.fg');
        if (old?.style.strokeDasharray && fg.style.strokeDasharray !== old.style.strokeDasharray) fg.style.strokeDasharray = old.style.strokeDasharray;
        if (old && old.style.strokeDashoffset !== '' && fg.style.strokeDashoffset !== old.style.strokeDashoffset) fg.style.strokeDashoffset = old.style.strokeDashoffset;   // only write on change: the observer watches this subtree
        const pmx = document.getElementById('pmx'), btn = document.getElementById('fs-btn-pomo-play');
        const mode = pmx?.dataset.mode || document.getElementById('view-pomodoro')?.dataset.timerMode || 'work';
        const running = pmx ? pmx.dataset.state === 'running' : /توقف/.test(btn?.textContent || '');
        overlay.dataset.mode = mode; overlay.dataset.state = running ? 'running' : 'idle';
        const now = new Date(), key = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
        const n = Number((Storage.get('study_history', []) || []).find(h => h.date === key)?.sessions || 0), filled = n === 0 ? 0 : ((n - 1) % 4) + 1;
        const html = [0, 1, 2, 3].map(i => `<i class="${i < filled ? 'on' : ''}"></i>`).join('');
        if (cycle.dataset.h !== html) { cycle.dataset.h = html; cycle.innerHTML = html; }
        if (!running) { clearTimeout(idleTimer); idleTimer = 0; unidle(); } else if (!idleTimer && !overlay.classList.contains('fsx-idle')) wake();   // timer ticks must not wake the calm mode
    }

    function wake() {
        unidle(); clearTimeout(idleTimer); idleTimer = 0;
        if (overlay.dataset.state === 'running') idleTimer = setTimeout(() => { idleTimer = 0; if (overlay.dataset.state === 'running') overlay.classList.add('fsx-idle'); }, 3500);
    }

    function clockTick() { clock.textContent = pd(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })); }
    let wasActive = false;
    function onActive() {
        const on = overlay.classList.contains('active');
        if (on === wasActive) return;                      // fsx-idle also changes the class attribute; only react to open/close
        wasActive = on;
        clearInterval(tick); clearTimeout(idleTimer); idleTimer = 0; unidle();
        if (on) { clockTick(); tick = setInterval(clockTick, 15000); sync(); overlay.querySelector('#fs-btn-pomo-play')?.focus({ preventScroll: true }); }
    }
    function onKey(e) {
        if (!overlay?.classList.contains('active') || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
        if (e.code === 'Space' && !e.repeat && e.target.tagName !== 'BUTTON') { e.preventDefault(); window.Pomodoro?.toggleTimer(); wake(); }
        if (e.key === 'Escape') window.Pomodoro?.exitFullscreenFocus?.();
    }

    if (!build()) new MutationObserver((_, o) => { if (build()) o.disconnect(); }).observe(document.body, { childList: true });
})();
