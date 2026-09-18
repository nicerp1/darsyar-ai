/** Runtime boundary between the bundled Android UI and the production API. */
(function () {
    const capacitor = window.Capacitor;
    const native = Boolean(capacitor?.isNativePlatform?.());
    window.DarsyarPlatform = Object.freeze({
        native,
        apiOrigin: native ? 'https://darsyar-ai.vercel.app' : ''
    });
    if (!native) return;

    const nativeFetch = window.fetch.bind(window);
    window.fetch = function (input, init) {
        if (typeof input === 'string' && input.startsWith('/api/')) {
            input = `${window.DarsyarPlatform.apiOrigin}${input}`;
        }
        return nativeFetch(input, init);
    };
})();
