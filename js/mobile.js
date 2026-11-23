/** Android uses the same presentation as the mobile website; this is native chrome only. */
(function () {
    const capacitor = window.Capacitor;
    if (!capacitor?.isNativePlatform?.()) return;
    const plugins = capacitor.Plugins || {};
    const root = document.documentElement;
    root.classList.add('native-shell');

    plugins.StatusBar?.setOverlaysWebView?.({ overlay: true }).catch(() => {});
    plugins.StatusBar?.setBackgroundColor?.({ color: '#00000000' }).catch(() => {});
    plugins.SplashScreen?.hide?.().catch(() => {});
    plugins.App?.addListener?.('backButton', () => {
        if (document.getElementById('focus-fullscreen-overlay')?.classList.contains('active')) return Pomodoro.exitFullscreenFocus();
        if (document.querySelector('.im-extra-dialog[open]')) return window.MessengerExtras?.close?.();
        const dialog = document.querySelector('dialog[open]');
        if (dialog) return dialog.close();
        if (document.getElementById('sidebar')?.classList.contains('open')) return App.closeMobileSidebar();
        if (window.MessengerDesk?.dismissLayer?.()) return;
        if (document.getElementById('communications-drawer')?.classList.contains('open')) return Communications.close();
        const modal = document.querySelector('.modal-overlay.active, .modal-overlay.show');
        if (modal) return Utils.closeModal(modal.id);
        App.back();
    });
})();
