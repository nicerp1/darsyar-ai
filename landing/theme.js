// Theme switch for the landing + guide pages.
// Respects the system preference until the user chooses explicitly.
(function () {
    var stored = null;
    try { stored = localStorage.getItem('ravand-theme'); } catch (e) { /* ignore */ }
    if (stored === 'light' || stored === 'dark') {
        document.documentElement.setAttribute('data-theme', stored);
    }
    document.addEventListener('click', function (event) {
        var toggle = event.target.closest && event.target.closest('.theme-toggle');
        if (!toggle) return;
        var current = document.documentElement.getAttribute('data-theme');
        var next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        try { localStorage.setItem('ravand-theme', next); } catch (e) { /* ignore */ }
    });
})();
