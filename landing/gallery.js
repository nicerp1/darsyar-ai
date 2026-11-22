const gallery = document.querySelector('.gallery');
const slides = Array.from(gallery.querySelectorAll('.slide'));
const indexBar = gallery.querySelector('.gallery-index');
const choices = Array.from(indexBar.querySelectorAll('a'));
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
    if (indexBar.scrollWidth > indexBar.clientWidth) {
        const item = choices[active].getBoundingClientRect();
        const bar = indexBar.getBoundingClientRect();
        const offset = item.left + item.width / 2 - bar.left - bar.width / 2;
        indexBar.scrollBy({left: offset, behavior: 'instant'});
    }
}

function slideInHash() {
    return slides.findIndex(slide => '#' + slide.id === location.hash);
}

function selectSlide(index) {
    showSlide(index);
    history.replaceState(history.state, '', '#' + slides[active].id);
}

gallery.querySelector('.gallery-controls').hidden = false;
gallery.classList.add('gallery-ready');
showSlide(Math.max(0, slideInHash()));
addEventListener('hashchange', () => {
    const index = slideInHash();
    if (index !== -1) {
        showSlide(index);
        if (!indexBar.contains(document.activeElement)) gallery.scrollIntoView({block: 'start'});
    }
});

gallery.querySelector('[data-previous]').addEventListener('click', () => selectSlide(active - 1));
gallery.querySelector('[data-next]').addEventListener('click', () => selectSlide(active + 1));
indexBar.addEventListener('keydown', event => {
    const index = choices.indexOf(event.target);
    const offset = {ArrowLeft: 1, ArrowRight: -1}[event.key];
    if (!offset || index === -1) return;
    event.preventDefault();
    selectSlide(index + offset);
    choices[active].focus({preventScroll: true});
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
    const preview = link.matches('.image-link') && link.querySelector('img');
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
