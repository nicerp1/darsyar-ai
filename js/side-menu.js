/** Mobile web side menu: spring-driven open/close + swipe gestures. Sets --mp (0..1) on <html>. */
(function () {
    const root = document.documentElement;
    const mq = matchMedia('(max-width: 720px)');
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;
    const SHIFT = .64;                 // must match --menu-shift in css/side-menu.css
    const K = 150, C = 25;             // spring stiffness / damping (smooth, no bounce)
    let p = 0, v = 0, target = 0, raf = 0, last = 0, dragging = false;

    const active = () => mq.matches && !root.classList.contains('capacitor-app');
    const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
    const scrollY = () => Math.max(window.scrollY || 0, root.scrollTop || 0, document.body.scrollTop || 0);

    function render() {
        root.style.setProperty('--mp', p.toFixed(4));
        root.classList.toggle('menu-moving', p > .001 || dragging);
    }
    function tick(now) {
        const dt = Math.min(.032, (now - last) / 1000 || .016); last = now;
        v += (K * (target - p) - C * v) * dt;
        p += v * dt;
        if (Math.abs(v) < .02 && Math.abs(target - p) < .004) { p = target; v = 0; raf = 0; render(); return; }
        render();
        raf = requestAnimationFrame(tick);
    }
    function go(to, vel = 0) {
        target = to; v = vel;
        if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); }
    }
    function prepare() {
        root.style.setProperty('--ms', scrollY());
        let i = 0;
        sidebar.querySelectorAll('.sidebar-nav > *, .sidebar-footer > *').forEach(el => {
            if (el.getClientRects().length) el.style.setProperty('--i', i++);
        });
    }

    // Follow the app's own open/close state (button, X, nav item, Escape, overlay)
    new MutationObserver(() => {
        if (!active() || dragging) return;
        const open = sidebar.classList.contains('open');
        if (open) prepare();
        const to = open ? 1 : 0;
        if (to !== target || (!raf && p !== to)) go(to);
    }).observe(sidebar, { attributes: true, attributeFilter: ['class'] });

    mq.addEventListener('change', () => { cancelAnimationFrame(raf); raf = 0; p = target = v = 0; dragging = false; render(); });

    // Swipe: from the right edge to open, anywhere to close
    let sx = 0, sy = 0, sp = 0, axis = null, mode = null, lastX = 0, lastT = 0, vx = 0;
    document.addEventListener('touchstart', e => {
        if (!active() || e.touches.length !== 1) { mode = null; return; }
        const t = e.touches[0];
        sx = lastX = t.clientX; sy = t.clientY; lastT = performance.now(); axis = null; vx = 0; sp = p;
        mode = sidebar.classList.contains('open') ? 'close' : (sx > innerWidth * .78 ? 'open' : null);
    }, { passive: true });
    document.addEventListener('touchmove', e => {
        if (!mode) return;
        const t = e.touches[0], dx = t.clientX - sx, dy = t.clientY - sy;
        if (!axis) {
            if (Math.hypot(dx, dy) < 8) return;
            axis = Math.abs(dx) > Math.abs(dy) * 1.2 ? 'x' : 'y';
            if (axis === 'x' && ((mode === 'open' && dx > 0) || (mode === 'close' && dx < 0))) axis = 'y';
            if (axis === 'x') {
                dragging = true; cancelAnimationFrame(raf); raf = 0; v = 0;
                if (mode === 'open') { prepare(); window.App?.toggleMobileSidebar(); }
            }
        }
        if (axis !== 'x') return;
        e.preventDefault();
        const now = performance.now();
        vx = (t.clientX - lastX) / Math.max(1, now - lastT); lastX = t.clientX; lastT = now;
        p = clamp(sp - dx / (innerWidth * SHIFT), 0, 1.04);
        render();
    }, { passive: false });
    const end = () => {
        if (!dragging) { mode = null; return; }
        dragging = false; mode = null;
        const open = vx < -.4 ? true : vx > .4 ? false : p > .5;
        const isOpen = sidebar.classList.contains('open');
        go(open ? 1 : 0, -vx * 1000 / (innerWidth * SHIFT));
        if (open && !isOpen) window.App?.toggleMobileSidebar();
        if (!open && isOpen) window.App?.closeMobileSidebar();
    };
    document.addEventListener('touchend', end);
    document.addEventListener('touchcancel', end);
})();
