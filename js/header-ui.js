/** Header polish: date subtitle (phone), scroll elevation, keyboard/screen-reader semantics. Web only. */
(function () {
    if (document.documentElement.classList.contains('capacitor-app')) return;
    const fa = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { weekday: 'long', day: 'numeric', month: 'long' });

    function init() {
        const header = document.querySelector('.top-header');
        if (!header) return false;

        const ensureSub = () => {                               // the breadcrumb is injected later by WebStudio
            const crumb = header.querySelector('.studio-breadcrumb');
            if (crumb && !crumb.querySelector('.hdr-sub')) {
                const sub = document.createElement('small'); sub.className = 'hdr-sub'; sub.textContent = fa.format(new Date());
                crumb.append(sub);
            }
        };
        ensureSub();
        new MutationObserver(ensureSub).observe(header, { childList: true });
        const profile = header.querySelector('.user-profile-menu');
        if (profile && !profile.hasAttribute('role')) {
            profile.setAttribute('role', 'button'); profile.tabIndex = 0;
            const name = header.querySelector('#header-user-name')?.textContent.trim();
            profile.setAttribute('aria-label', name ? `پروفایل ${name}` : 'پروفایل');
            profile.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); profile.click(); } });
        }
        header.querySelectorAll('button.icon-btn:not([aria-label])').forEach(b => { if (b.title) b.setAttribute('aria-label', b.title); });

        const main = document.querySelector('.content-body');
        if (main && !document.querySelector('.hdr-skip')) {
            main.id = main.id || 'main-content'; main.tabIndex = -1;
            const skip = document.createElement('a'); skip.className = 'hdr-skip'; skip.href = '#' + main.id; skip.textContent = 'پرش به محتوا';
            skip.addEventListener('click', e => { e.preventDefault(); main.focus({ preventScroll: false }); main.scrollIntoView({ block: 'start' }); });
            document.body.prepend(skip);
        }

        const onScroll = e => {
            const t = e.target, y = t === document || t === document.documentElement ? window.scrollY : (t.classList?.contains('content-body') ? t.scrollTop : 0);
            if (t === document || t === document.documentElement || t.classList?.contains('content-body')) header.classList.toggle('is-scrolled', y > 6);
        };
        addEventListener('scroll', onScroll, { passive: true, capture: true });
        return true;
    }
    if (!init()) { const w = new MutationObserver(() => { if (init()) w.disconnect(); }); w.observe(document.body, { childList: true, subtree: true }); }
})();
