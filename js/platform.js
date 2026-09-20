/** Runtime boundary between the bundled Android UI and the production API. */
(function () {
    const capacitor = window.Capacitor;
    const native = Boolean(capacitor?.isNativePlatform?.());
    window.DarsyarPlatform = Object.freeze({
        native,
        apiOrigin: native ? 'https://darsyar-ai.vercel.app' : ''
    });
    function setOffline(offline) {
        document.documentElement.classList.toggle('is-offline', offline);
        const banner = document.getElementById('network-status-banner');
        if (banner) { banner.classList.toggle('hidden', !offline); banner.setAttribute('aria-hidden', String(!offline)); }
    }
    window.addEventListener('offline', () => setOffline(true));
    window.addEventListener('online', () => setOffline(false));
    document.addEventListener('DOMContentLoaded', () => {
        if (!document.getElementById('network-status-banner')) {
            const banner = document.createElement('div'); banner.id = 'network-status-banner'; banner.className = 'network-status-banner hidden'; banner.setAttribute('role', 'status'); banner.innerHTML = '<span class="material-symbols-outlined" aria-hidden="true">wifi_off</span><span>اینترنت قطع است؛ اطلاعات تازه پس از اتصال دوباره دریافت می‌شود.</span>'; document.body.appendChild(banner);
        }
        setOffline(!navigator.onLine);
    });
    if (!native) return;

    const nativeFetch = window.fetch.bind(window);
    window.fetch = function (input, init) {
        if (typeof input === 'string' && input.startsWith('/api/')) {
            input = `${window.DarsyarPlatform.apiOrigin}${input}`;
        }
        return nativeFetch(input, init);
    };
    capacitor.Plugins?.Network?.addListener?.('networkStatusChange', status => setOffline(!status.connected));
})();
