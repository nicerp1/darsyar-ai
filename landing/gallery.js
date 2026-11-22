const gallery = document.querySelector('.gallery');
const slides = Array.from(gallery.querySelectorAll('.slide'));
const choices = Array.from(gallery.querySelectorAll('.gallery-index a'));
const indicator = gallery.querySelector('.slide-count');
const dialog = document.querySelector('.image-viewer');
const format = new Intl.NumberFormat('fa-IR');
let active = 0;

function showSlide(index) {
    active = (index + slides.length) % slides.length;
    slides.forEach((slide, i) => { slide.hidden = i !== active; });
    choices.forEach((link, i) => {
        if (i === active) link.setAttribute('aria-current', 'true');
        else link.removeAttribute('aria-current');
    });
    indicator.textContent = `${format.format(active + 1)} از ${format.format(slides.length)} · ${choices[active].textContent}`;
}

function slideInHash() {
    return slides.findIndex(slide => '#' + slide.id === location.hash);
}

function selectSlide(index) {
    showSlide(index);
    history.replaceState(history.state, '', '#' + slides[active].id);
}

gallery.querySelector('.gallery-controls').hidden = false;
showSlide(Math.max(0, slideInHash()));
addEventListener('hashchange', () => {
    const index = slideInHash();
    if (index !== -1) showSlide(index);
});

gallery.querySelector('[data-previous]').addEventListener('click', () => selectSlide(active - 1));
gallery.querySelector('[data-next]').addEventListener('click', () => selectSlide(active + 1));
gallery.querySelector('.gallery-index').addEventListener('keydown', event => {
    const offset = {ArrowLeft: 1, ArrowRight: -1}[event.key];
    if (!offset) return;
    event.preventDefault();
    selectSlide(choices.indexOf(event.target) + offset);
    choices[active].focus();
});

document.addEventListener('click', event => {
    const link = event.target.closest('a');
    if (!link || event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const choice = choices.indexOf(link);
    if (choice !== -1) {
        event.preventDefault();
        selectSlide(choice);
        return;
    }
    const preview = link.matches('.image-link, .journey-grid article > a') && link.querySelector('img');
    if (!preview || !dialog?.showModal) return;
    event.preventDefault();
    const fullImage = dialog.querySelector('img');
    fullImage.alt = preview.alt;
    fullImage.src = link.href;
    dialog.showModal();
});

dialog?.addEventListener('click', event => {
    if (event.target === dialog) dialog.close();
});
