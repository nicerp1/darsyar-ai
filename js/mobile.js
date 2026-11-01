/** Android uses the same presentation as the mobile website; this is native chrome only. */
(function () {
    const capacitor = window.Capacitor;
    if (!capacitor?.isNativePlatform?.()) return;
    const plugins = capacitor.Plugins || {};
    const root = document.documentElement;
    root.classList.add('native-shell');

    let trail = [], lastView = '', returning = false;
    const currentView = () => document.querySelector('.view-section.active')?.id?.replace('view-', '') || 'dashboard';
    function rememberView() {
        const view = currentView();
        if (view === lastView) return;
        lastView = view;
        if (returning) { returning = false; return; }
        if (trail.at(-1) !== view) trail.push(view);
        if (trail.length > 30) trail.shift();
    }

    plugins.StatusBar?.setOverlaysWebView?.({ overlay: true }).catch(() => {});
    plugins.StatusBar?.setBackgroundColor?.({ color: '#00000000' }).catch(() => {});
    plugins.SplashScreen?.hide?.().catch(() => {});
    plugins.App?.addListener?.('backButton', () => {
        if (document.getElementById('focus-fullscreen-overlay')?.classList.contains('active')) return Pomodoro.exitFullscreenFocus();
        if (document.querySelector('.im-extra-dialog[open]')) return window.MessengerExtras?.close?.();
        const dialog = document.querySelector('dialog[open]');
        if (dialog) return dialog.close();
        if (document.getElementById('sidebar')?.classList.contains('open')) return App.closeMobileSidebar();
        if (document.getElementById('im-shell')?.classList.contains('im-mobile-chat')) {
            document.getElementById('im-shell').classList.remove('im-mobile-chat');
            return;
        }
        if (document.getElementById('communications-drawer')?.classList.contains('open')) return Communications.close();
        const modal = document.querySelector('.modal-overlay.active, .modal-overlay.show');
        if (modal) return Utils.closeModal(modal.id);
        if (trail.length > 1) {
            trail.pop();
            returning = true;
            App.navigate(trail.at(-1));
            return;
        }
        if (currentView() !== 'dashboard') { returning = true; App.navigate('dashboard'); }
    });

    document.addEventListener('DOMContentLoaded', () => {
        rememberView();
        const content = document.querySelector('.content-body');
        if (content) new MutationObserver(rememberView).observe(content, { subtree: true, attributes: true, attributeFilter: ['class'] });
    });
})();
