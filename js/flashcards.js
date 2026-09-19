/**
 * StudyMate Pro - Flashcards & Leitner 5-Box Memory Engine
 */

const Flashcards = (function () {
    let currentCategory = 'all';
    let currentBoxFilter = 'all';
    let reviewQueue = [];
    let currentCardIndex = 0;
    let isFlipped = false;

    function init() {
        renderLeitnerBoxCounts();
        renderCategoryPills();
        loadReviewQueue();
        renderCurrentCard();
    }

    function renderLeitnerBoxCounts() {
        const cards = Storage.get('flashcards', []);
        const boxCounts = [0, 0, 0, 0, 0, 0]; // 1 to 5

        cards.forEach(c => {
            const b = c.box || 1;
            boxCounts[b] = (boxCounts[b] || 0) + 1;
        });

        for (let i = 1; i <= 5; i++) {
            const countEl = document.getElementById(`leitner-count-box-${i}`);
            if (countEl && typeof Utils !== 'undefined') {
                countEl.textContent = Utils.toPersianDigits(boxCounts[i]);
            }
        }
    }

    function renderCategoryPills() {
        const categories = [
            { id: 'all', label: 'همه دروس' },
            { id: 'زیست', label: '🧬 زیست‌شناسی' },
            { id: 'شیمی', label: '🧪 شیمی' },
            { id: 'فیزیک', label: '⚡ فیزیک' },
            { id: 'ریاضی', label: '📐 ریاضیات' },
            { id: 'فارسی', label: '📖 ادبیات فارسی' },
            { id: 'عربی', label: '📜 عربی' },
            { id: 'انگلیسی', label: '🌍 انگلیسی' },
            { id: 'سایر', label: '💡 عمومی و سایر' }
        ];

        const container = document.getElementById('flashcard-category-pills');
        if (!container) return;

        container.innerHTML = categories.map(cat => `
            <button class="category-pill ${currentCategory === cat.id ? 'active' : ''}" onclick="Flashcards.filterCategory('${cat.id}')">
                ${cat.label}
            </button>
        `).join('');
    }

    function filterCategory(catId) {
        currentCategory = catId;
        renderCategoryPills();
        loadReviewQueue();
        renderCurrentCard();
        if (typeof Utils !== 'undefined') {
            Utils.playSound('click');
        }
    }

    function filterBox(boxNum) {
        currentBoxFilter = boxNum;
        loadReviewQueue();
        renderCurrentCard();
        if (typeof Utils !== 'undefined') {
            Utils.playSound('click');
        }
    }

    function loadReviewQueue() {
        let cards = Storage.get('flashcards', []);

        if (currentCategory !== 'all') {
            cards = cards.filter(c => c.category === currentCategory);
        }

        if (currentBoxFilter !== 'all') {
            cards = cards.filter(c => c.box === parseInt(currentBoxFilter));
        }

        reviewQueue = cards;
        currentCardIndex = 0;
        isFlipped = false;
    }

    function renderCurrentCard() {
        const stage = document.getElementById('flashcard-stage');
        const countInfoEl = document.getElementById('flashcard-index-info');
        const emptyState = document.getElementById('flashcard-empty-state');
        const actionButtons = document.getElementById('flashcard-action-buttons');

        if (!stage) return;

        stage.classList.remove('flipped');
        isFlipped = false;

        if (reviewQueue.length === 0) {
            stage.style.display = 'none';
            if (actionButtons) actionButtons.style.display = 'none';
            if (emptyState) emptyState.style.display = 'block';
            if (countInfoEl) countInfoEl.textContent = 'کارت فعالی برای مرور وجود ندارد.';
            return;
        }

        stage.style.display = 'block';
        if (actionButtons) actionButtons.style.display = 'flex';
        if (emptyState) emptyState.style.display = 'none';

        const card = reviewQueue[currentCardIndex];
        const questionEl = document.getElementById('flashcard-question-text');
        const answerEl = document.getElementById('flashcard-answer-text');
        const categoryBadgeFront = document.getElementById('flashcard-category-front');
        const boxBadgeFront = document.getElementById('flashcard-box-front');
        const boxBadgeBack = document.getElementById('flashcard-box-back');

        if (questionEl && typeof Utils !== 'undefined') {
            questionEl.innerHTML = Utils.renderKaTeXAndMarkdown(card.question);
        }
        if (answerEl && typeof Utils !== 'undefined') {
            answerEl.innerHTML = Utils.renderKaTeXAndMarkdown(card.answer);
        }
        if (categoryBadgeFront) {
            categoryBadgeFront.textContent = card.categoryName || card.category;
        }
        if (boxBadgeFront && typeof Utils !== 'undefined') {
            boxBadgeFront.textContent = `جعبه ${Utils.toPersianDigits(card.box || 1)}`;
        }
        if (boxBadgeBack && typeof Utils !== 'undefined') {
            boxBadgeBack.textContent = `جعبه ${Utils.toPersianDigits(card.box || 1)}`;
        }

        if (countInfoEl && typeof Utils !== 'undefined') {
            countInfoEl.textContent = `کارت ${Utils.toPersianDigits(currentCardIndex + 1)} از ${Utils.toPersianDigits(reviewQueue.length)}`;
        }
    }

    function flipCard() {
        const stage = document.getElementById('flashcard-stage');
        if (!stage) return;
        isFlipped = !isFlipped;
        if (isFlipped) {
            stage.classList.add('flipped');
        } else {
            stage.classList.remove('flipped');
        }
        if (typeof Utils !== 'undefined') {
            Utils.playSound('click');
        }
    }

    function rateCard(rating) {
        if (reviewQueue.length === 0) return;
        const currentCard = reviewQueue[currentCardIndex];
        let allCards = Storage.get('flashcards', []);
        const cardInStorage = allCards.find(c => c.id === currentCard.id);

        if (cardInStorage) {
            let currentBox = cardInStorage.box || 1;

            if (rating === 'wrong') {
                // Return to Box 1
                cardInStorage.box = 1;
                if (typeof Utils !== 'undefined') {
                    Utils.showToast('کارت به جعبه ۱ بازگشت تا مجدداً تمرین شود.', 'warning');
                }
            } else if (rating === 'medium') {
                // Keep in same box
                if (typeof Utils !== 'undefined') {
                    Utils.showToast('کارت در جعبه فعلی باقی ماند.', 'info');
                }
            } else if (rating === 'easy') {
                // Advance to next box
                if (currentBox < 5) {
                    cardInStorage.box = currentBox + 1;
                }
                Storage.addXP(15);
                if (typeof Utils !== 'undefined') {
                    Utils.showToast(`عالی بود! کارت به جعبه ${Utils.toPersianDigits(cardInStorage.box)} منتقل شد (+۱۵ XP).`, 'success');
                }
            }

            Storage.set('flashcards', allCards);
        }

        renderLeitnerBoxCounts();

        // Next card in queue
        currentCardIndex++;
        if (currentCardIndex >= reviewQueue.length) {
            currentCardIndex = 0;
            loadReviewQueue();
            if (typeof Utils !== 'undefined') {
                Utils.showToast('🎉 تمام کارت‌های این دسته با موفقیت مرور شدند!', 'success');
                Utils.launchConfetti();
            }
        }
        renderCurrentCard();
    }

    function openAddModal() {
        if (typeof Utils !== 'undefined') {
            Utils.openModal('modal-add-flashcard');
        }
    }

    function addFlashcardSubmit() {
        const catSelect = document.getElementById('input-fc-category');
        const qInput = document.getElementById('input-fc-question');
        const aInput = document.getElementById('input-fc-answer');

        if (!qInput || !aInput || !qInput.value.trim() || !aInput.value.trim()) {
            if (typeof Utils !== 'undefined') {
                Utils.showToast('لطفاً هم صورت سوال و هم پاسخ را وارد نمایید.', 'warning');
            }
            return;
        }

        const category = catSelect ? catSelect.value : 'زیست';
        const catNames = {
            'زیست': 'زیست‌شناسی',
            'شیمی': 'شیمی',
            'فیزیک': 'فیزیک',
            'ریاضی': 'ریاضیات',
            'فارسی': 'ادبیات فارسی',
            'عربی': 'عربی',
            'انگلیسی': 'زبان انگلیسی',
            'سایر': 'عمومی و سایر'
        };

        const newCard = {
            id: 'fc-' + Date.now(),
            category: category,
            categoryName: catNames[category] || category,
            question: qInput.value.trim(),
            answer: aInput.value.trim(),
            box: 1,
            createdDate: new Date().toISOString().split('T')[0]
        };

        const cards = Storage.get('flashcards', []);
        cards.unshift(newCard);
        Storage.set('flashcards', cards);
        Storage.addXP(10);

        qInput.value = '';
        aInput.value = '';

        renderLeitnerBoxCounts();
        loadReviewQueue();
        renderCurrentCard();

        if (typeof Utils !== 'undefined') {
            Utils.closeModal('modal-add-flashcard');
            Utils.showToast('فلش‌کارت جدید با موفقیت اضافه شد!', 'success');
        }
    }

    function openAIModal() {
        if (typeof Utils !== 'undefined') {
            Utils.openModal('modal-ai-flashcards');
        }
    }

    async function generateAIFlashcardsSubmit() {
        const textInput = document.getElementById('input-ai-fc-text');
        const catSelect = document.getElementById('input-ai-fc-category');
        if (!textInput || !textInput.value.trim()) {
            if (typeof Utils !== 'undefined') {
                Utils.showToast('لطفاً متن جزوه یا درس را وارد نمایید.', 'warning');
            }
            return;
        }

        const rawText = textInput.value.trim();
        const category = catSelect ? catSelect.value : 'زیست';
        if (rawText.length < 80) return Utils.showToast('برای استخراج حرفه‌ای، حداقل یک پاراگراف کامل وارد کنید.', 'warning');
        const requestedCount = Math.min(15, Math.max(4, Number(document.getElementById('input-ai-fc-count')?.value) || 8));
        const button = document.getElementById('btn-ai-flashcards'); if (button) { button.disabled = true; button.innerHTML = '<span class="material-symbols-outlined">hourglass_top</span> تحلیل نکات متن…'; }
        let generated = [];
        try {
            const settings = Storage.getSettings();
            const response = await fetch('/api/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
                model: settings.aiModel || 'gapgpt-qwen-3.5', temperature: 0.25, max_tokens: 3200,
                messages: [
                    { role: 'system', content: 'تو طراح حرفه‌ای فلش‌کارت آموزشی هستی. فقط JSON معتبر و بدون markdown برگردان.' },
                    { role: 'user', content: `از متن زیر دقیقاً ${requestedCount} فلش‌کارت باکیفیت استخراج کن. کارت‌ها ترکیبی از این سه نوع باشند: ۱) سوال مفهومی و پاسخ کوتاه، ۲) جای‌خالی با نماد _____ و پاسخ واژه حذف‌شده، ۳) سوال تحلیلی که رابطه علت و معلولی یا مقایسه‌ای بسنجد. نکات کم‌اهمیت و سوال‌های مبهم را حذف کن. پاسخ‌ها مستقل، دقیق و حداکثر سه جمله باشند. خروجی فقط آرایه JSON با ساختار [{"type":"concept|cloze|analysis","question":"...","answer":"..."}] باشد.\n\nمتن درس:\n${rawText.slice(0, 24000)}` }
                ]
            }) });
            const payload = await response.json(); if (!response.ok) throw new Error(payload.error || 'سرویس هوش مصنوعی پاسخ نداد.');
            const raw = String(payload.choices?.[0]?.message?.content || '').replace(/^```(?:json)?/i, '').replace(/```$/,'').trim();
            const parsed = JSON.parse(raw); generated = (Array.isArray(parsed) ? parsed : parsed.cards || []).filter(item => item?.question && item?.answer).slice(0, requestedCount);
        } catch (error) {
            console.warn('AI flashcard extraction fallback:', error);
            const sentences = rawText.split(/[.\n!؟?]/).map(item => item.trim()).filter(item => item.length > 35);
            generated = sentences.slice(0, requestedCount).map((sentence, index) => {
                const words = sentence.split(/\s+/).filter(word => word.length > 4);
                const keyword = words.sort((a, b) => b.length - a.length)[0] || 'مفهوم کلیدی';
                return index % 2 ? { type: 'cloze', question: sentence.replace(keyword, '_____'), answer: keyword } : { type: 'concept', question: `بر اساس متن، نکته اصلی درباره «${keyword}» چیست؟`, answer: sentence };
            });
        }
        if (!generated.length) { if (button) button.disabled = false; return Utils.showToast('از این متن نکته قابل‌استخراجی پیدا نشد.', 'warning'); }
        const now = Date.now();
        const newGeneratedCards = generated.map((item, idx) => ({ id: `fc-ai-${now}-${idx}`, category, categoryName: category, question: String(item.question).trim().slice(0, 600), answer: String(item.answer).trim().slice(0, 1200), cardType: ['concept','cloze','analysis'].includes(item.type) ? item.type : 'concept', box: 1, createdDate: new Date().toISOString().split('T')[0] }));

        const cards = Storage.get('flashcards', []);
        cards.unshift(...newGeneratedCards);
        Storage.set('flashcards', cards);
        Storage.addXP(25);

        textInput.value = '';
        renderLeitnerBoxCounts();
        loadReviewQueue();
        renderCurrentCard();

        if (typeof Utils !== 'undefined') {
            Utils.closeModal('modal-ai-flashcards');
            Utils.showToast(`هوش مصنوعی ${Utils.toPersianDigits(newGeneratedCards.length)} فلش‌کارت از متن شما استخراج کرد!`, 'success');
            Utils.launchConfetti();
        }
        if (button) { button.disabled = false; button.innerHTML = '<span class="material-symbols-outlined">auto_awesome</span> استخراج حرفه‌ای کارت‌ها'; }
    }

    return {
        init,
        filterCategory,
        filterBox,
        flipCard,
        rateCard,
        openAddModal,
        addFlashcardSubmit,
        openAIModal,
        generateAIFlashcardsSubmit
    };
})();

if (typeof window !== 'undefined') {
    window.Flashcards = Flashcards;
}
