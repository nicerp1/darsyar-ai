// Auto-rotating banner for the landing hero.
// Image slides carry no text; the text slide holds the headline and CTAs.
(function () {
    var slides = Array.from(document.querySelectorAll('.hero-slide'));
    var dots = Array.from(document.querySelectorAll('.hero-dot'));
    if (slides.length < 2) return;

    var current = 0;
    var timer = null;
    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function show(index) {
        current = (index + slides.length) % slides.length;
        slides.forEach((slide, i) => slide.classList.toggle('is-active', i === current));
        dots.forEach((dot, i) => {
            var active = i === current;
            dot.classList.toggle('is-active', active);
            dot.setAttribute('aria-selected', active ? 'true' : 'false');
        });
    }

    function next() { show(current + 1); }

    function start() {
        if (reduceMotion || slides.length < 2) return;
        stop();
        timer = setInterval(next, 5000);
    }

    function stop() {
        if (timer) { clearInterval(timer); timer = null; }
    }

    dots.forEach((dot, i) => dot.addEventListener('click', function () {
        show(i);
        start();
    }));

    var hero = document.querySelector('.hero');
    if (hero) {
        hero.addEventListener('mouseenter', stop);
        hero.addEventListener('mouseleave', start);
        hero.addEventListener('focusin', stop);
        hero.addEventListener('focusout', start);
    }

    show(0);
    start();
})();
