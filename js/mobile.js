/** Native Android integration. No-op in regular browsers. */
(function () {
    const capacitor = window.Capacitor;
    if (!capacitor?.isNativePlatform?.()) return;
    document.documentElement.classList.add('capacitor-app');
    const plugins = capacitor.Plugins || {};
    plugins.StatusBar?.setBackgroundColor?.({ color: '#0f172a' }).catch(() => {});
    plugins.StatusBar?.setStyle?.({ style: 'LIGHT' }).catch(() => {});
    plugins.SplashScreen?.hide?.().catch(() => {});
    plugins.Network?.addListener?.('networkStatusChange', status => {
        if (typeof Utils !== 'undefined') Utils.showToast(status.connected ? 'اتصال اینترنت برقرار شد.' : 'اینترنت قطع است؛ برای همگام‌سازی دوباره متصل شوید.', status.connected ? 'success' : 'warning');
    });
    plugins.App?.addListener?.('backButton', () => {
        const communications = document.getElementById('communications-drawer');
        if (communications?.classList.contains('open')) return Communications.close();
        const modal = document.querySelector('.modal-overlay.active, .modal-overlay.show');
        if (modal) return Utils.closeModal(modal.id);
        const sidebar = document.getElementById('sidebar');
        if (sidebar?.classList.contains('open')) return App.toggleMobileSidebar();
        const activeView = document.querySelector('.view-section.active')?.id;
        if (activeView && activeView !== 'view-dashboard') return App.navigate('dashboard');
        plugins.App.exitApp?.();
    });
})();
