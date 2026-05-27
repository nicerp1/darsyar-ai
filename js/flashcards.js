// ============ FLASHCARD SYSTEM - PROFESSIONAL ============
const Flashcards = {
    settings: {
        cardsPerGeneration: 5,
        maxCardsPerDay: 50
    },
    
    categories: [
        { id: 'biology', name: 'زیست‌شناسی', icon: '🧬' },
        { id: 'chemistry', name: 'شیمی', icon: '⚗️' },
        { id: 'physics', name: 'فیزیک', icon: '⚡' },
        { id: 'math', name: 'ریاضی', icon: '📐' },
        { id: 'persian', name: 'فارسی', icon: '📚' },
        { id: 'arabic', name: 'عربی', icon: '🕌' },
        { id: 'english', name: 'زبان انگلیسی', icon: '🌍' },
        { id: 'other', name: 'سایر', icon: '📌' }
    ],
    
    boxes: [
        { id: 1, name: 'تازه', interval: 1 },
        { id: 2, name: 'یادگیری', interval: 2 },
        { id: 3, name: 'متوسط', interval: 4 },
        { id: 4, name: 'خوب', interval: 7 },
        { id: 5, name: 'عالی', interval: 15 }
    ],
    
    cards: JSON.parse(localStorage.getItem('flashcards') || '[]'),
    reviewHistory: JSON.parse(localStorage.getItem('flashcardReviews') || '{}'),
    
    // ============ API CALL ============
    async callAI(prompt) {
        if (typeof AIAssistant !== 'undefined' && typeof AIAssistant.callGapGPT === 'function') {
            return await AIAssistant.callGapGPT(prompt);
        }
        if (typeof AIAssistant !== 'undefined' && AIAssistant.apiKey) {
            const response = await fetch(`${AIAssistant.baseURL || 'https://api.gapgpt.app/v1'}/chat/completions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${AIAssistant.apiKey}` },
                body: JSON.stringify({ model: 'gapgpt-qwen-3.5', messages: [{ role: 'user', content: prompt }], temperature: 0.7, max_tokens: 1500 })
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            return data.choices[0].message.content;
        }
        throw new Error('AI Assistant در دسترس نیست');
    },
    
    // ============ RENDER ============
    render() {
        const container = document.getElementById('flashcardsContainer');
        if (!container) return;
        const stats = this.getStats();
        
        container.innerHTML = `
            <!-- هدر -->
            <div class="card" style="margin-bottom:1.5rem;">
                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:1rem;">
                    <div>
                        <h3 style="margin:0;font-size:1.2rem;">🃏 فلش‌کارت‌های من</h3>
                        <p style="margin:0.3rem 0 0;color:var(--text-secondary);font-size:0.85rem;">
                            ${stats.totalCards} کارت در ${this.categories.filter(c => (stats.cardsByCategory[c.id] || 0) > 0).length} دسته
                        </p>
                    </div>
                    <div style="display:flex;gap:0.5rem;">
                        <button class="btn btn-primary btn-sm" onclick="Flashcards.showGenerateModal()">🤖 ساخت هوشمند</button>
                        <button class="btn btn-sm" onclick="Flashcards.showManualForm()">✏️ افزودن دستی</button>
                    </div>
                </div>
            </div>
            
            <!-- آمار سریع -->
            <div class="grid-4" style="margin-bottom:1.5rem;">
                <div class="card" style="text-align:center;padding:1rem;">
                    <div style="font-size:0.8rem;color:var(--text-secondary);margin-bottom:0.3rem;">کل کارت‌ها</div>
                    <div style="font-size:1.8rem;font-weight:700;">${stats.totalCards}</div>
                </div>
                <div class="card" style="text-align:center;padding:1rem;">
                    <div style="font-size:0.8rem;color:var(--text-secondary);margin-bottom:0.3rem;">امروز مرور</div>
                    <div style="font-size:1.8rem;font-weight:700;color:${stats.cardsToReview > 0 ? 'var(--danger)' : 'var(--text)'};">${stats.cardsToReview}</div>
                </div>
                <div class="card" style="text-align:center;padding:1rem;">
                    <div style="font-size:0.8rem;color:var(--text-secondary);margin-bottom:0.3rem;">دقت</div>
                    <div style="font-size:1.8rem;font-weight:700;">${stats.accuracy}%</div>
                </div>
                <div class="card" style="text-align:center;padding:1rem;">
                    <div style="font-size:0.8rem;color:var(--text-secondary);margin-bottom:0.3rem;">کل مرورها</div>
                    <div style="font-size:1.8rem;font-weight:700;">${stats.totalReviews}</div>
                </div>
            </div>
            
            ${stats.cardsToReview > 0 ? `
            <div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:1rem 1.5rem;margin-bottom:1.5rem;display:flex;justify-content:space-between;align-items:center;">
                <span style="font-weight:500;">📅 <strong>${stats.cardsToReview}</strong> کارت آماده مرور داری</span>
                <button class="btn btn-primary" onclick="Flashcards.startReview()">شروع مرور</button>
            </div>` : ''}
            
            <!-- دسته‌بندی‌ها -->
            <div class="card">
                <h4 style="margin:0 0 1rem;font-size:1rem;">📂 دسته‌بندی‌ها</h4>
                <div style="display:flex;flex-direction:column;gap:0.5rem;">
                    ${this.categories.map(cat => {
                        const count = stats.cardsByCategory[cat.id] || 0;
                        const toReview = this.cards.filter(c => c.category === cat.id && c.nextReview <= new Date().toISOString().split('T')[0]).length;
                        if (count === 0) return '';
                        return `
                            <div style="display:flex;align-items:center;justify-content:space-between;padding:0.8rem 1rem;background:var(--bg);border-radius:8px;cursor:pointer;transition:all 0.2s;" 
                                 onclick="Flashcards.startCategoryReview('${cat.id}')"
                                 onmouseover="this.style.background='var(--primary-light)'" 
                                 onmouseout="this.style.background='var(--bg)'">
                                <div style="display:flex;align-items:center;gap:0.8rem;">
                                    <span style="font-size:1.3rem;">${cat.icon}</span>
                                    <div>
                                        <strong>${cat.name}</strong>
                                        <span style="color:var(--text-secondary);font-size:0.85rem;margin-right:0.5rem;">${count} کارت</span>
                                    </div>
                                </div>
                                <div style="display:flex;align-items:center;gap:0.5rem;">
                                    ${toReview > 0 ? `<span style="background:var(--danger);color:#fff;padding:0.2rem 0.6rem;border-radius:50px;font-size:0.75rem;">${toReview}</span>` : ''}
                                    <span style="color:var(--text-secondary);">←</span>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    },
    
    // ============ GENERATE MODAL ============
    showGenerateModal() {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal" style="max-width:550px;">
                <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
                <h3 style="margin-top:0;">🤖 ساخت فلش‌کارت با هوش مصنوعی</h3>
                <p style="color:var(--text-secondary);font-size:0.9rem;margin-bottom:1rem;">متن درسی را وارد کنید تا فلش‌کارت‌های آموزشی ساخته شود.</p>
                
                <div class="input-group">
                    <label>📝 متن درسی</label>
                    <textarea id="genText" rows="6" placeholder="متن کتاب یا جزوه را اینجا بچسبانید..."></textarea>
                </div>
                
                <div style="display:flex;gap:1rem;align-items:end;">
                    <div class="input-group" style="flex:1;">
                        <label>تعداد فلش‌کارت</label>
                        <input type="number" id="genCount" value="${this.settings.cardsPerGeneration}" min="1" max="20">
                    </div>
                    <button class="btn btn-primary" id="genBtn" onclick="Flashcards.generateCards()" style="height:42px;">🤖 شروع ساخت</button>
                </div>
                
                <div id="genResult" style="margin-top:1rem;"></div>
            </div>
        `;
        document.body.appendChild(modal);
        modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    },
    
    async generateCards() {
        const text = document.getElementById('genText')?.value?.trim();
        const count = parseInt(document.getElementById('genCount')?.value) || 5;
        const btn = document.getElementById('genBtn');
        const resultDiv = document.getElementById('genResult');
        
        if (!text) return Utils.showToast('⚠️ متنی وارد نشده');
        if (text.length < 20) return Utils.showToast('⚠️ متن خیلی کوتاه است');
        
        btn.disabled = true;
        btn.textContent = '⏳ در حال ساخت...';
        resultDiv.innerHTML = '<p style="color:var(--text-secondary);">⏳ در حال تحلیل متن و ساخت فلش‌کارت...</p>';
        
        try {
            const prompt = `از متن زیر ${count} عدد فلش‌کارت آموزشی به زبان فارسی بساز.

متن: ${text.substring(0, 2000)}

موضوع متن را تشخیص بده. category باید یکی از: "زیست‌شناسی", "شیمی", "فیزیک", "ریاضی", "فارسی", "عربی", "انگلیسی", "سایر"

فقط JSON خالص خروجی بده:
[{"question":"سوال","answer":"جواب","hint":"نکته","category":"دسته"}]`;
            
            const rawResponse = await this.callAI(prompt);
            const cards = this.extractJSON(rawResponse);
            
            if (!cards || cards.length === 0) throw new Error('نتونستم فلش‌کارت استخراج کنم');
            
            const added = this.addCards(cards);
            resultDiv.innerHTML = `<div style="color:var(--success);font-weight:600;">✅ ${added.length} فلش‌کارت با موفقیت ساخته شد</div>`;
            this.render();
            setTimeout(() => document.querySelector('.modal-overlay')?.remove(), 1500);
        } catch(e) {
            resultDiv.innerHTML = `<div style="color:var(--danger);">❌ خطا. متن طولانی‌تر وارد کن.</div>`;
        }
        
        btn.disabled = false;
        btn.textContent = '🤖 شروع ساخت';
    },
    
    extractJSON(text) {
        try { const p = JSON.parse(text); if (Array.isArray(p)) return p; } catch(e) {}
        const m = text.match(/\[\s*\{[\s\S]*\}\s*\]/);
        if (m) try { const p = JSON.parse(m[0]); if (Array.isArray(p)) return p; } catch(e) {}
        return null;
    },
    
    // ============ MANUAL FORM ============
    showManualForm() {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal" style="max-width:500px;">
                <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
                <h3 style="margin-top:0;">✏️ افزودن فلش‌کارت دستی</h3>
                <div class="input-group"><label>سوال</label><input type="text" id="manQuestion"></div>
                <div class="input-group"><label>جواب</label><input type="text" id="manAnswer"></div>
                <div class="input-group"><label>نکته (اختیاری)</label><input type="text" id="manHint"></div>
                <div class="input-group"><label>دسته‌بندی</label><select id="manCategory">${this.categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}</select></div>
                <button class="btn btn-primary" onclick="Flashcards.addManualFromForm()">💾 ذخیره</button>
            </div>
        `;
        document.body.appendChild(modal);
        modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    },
    
    addManualFromForm() {
        const q = document.getElementById('manQuestion')?.value?.trim();
        const a = document.getElementById('manAnswer')?.value?.trim();
        const h = document.getElementById('manHint')?.value?.trim();
        const c = document.getElementById('manCategory')?.value;
        if (!q || !a) return Utils.showToast('⚠️ سوال و جواب الزامی');
        this.cards.push({ id: Date.now().toString(), question: q, answer: a, hint: h || '', category: c || 'other', box: 1, created: new Date().toISOString(), nextReview: new Date().toISOString(), correctCount: 0, wrongCount: 0 });
        this.saveCards();
        document.querySelector('.modal-overlay')?.remove();
        this.render();
        Utils.showToast('✅ اضافه شد');
    },
    
    addCards(cards) {
        const added = cards.map(c => ({ ...c, id: Date.now() + Math.random().toString(36), category: this.detectCategory(c.category), box: 1, created: new Date().toISOString(), nextReview: new Date().toISOString(), correctCount: 0, wrongCount: 0 }));
        this.cards.push(...added);
        this.saveCards();
        return added;
    },
    
    detectCategory(name) {
        if (!name) return 'other';
        for (const c of this.categories) if (name.includes(c.name) || c.name.includes(name) || name === c.id) return c.id;
        return 'other';
    },
    
    getCategoryName(id) { return (this.categories.find(c => c.id === id) || {}).name || 'سایر'; },
    
    // ============ REVIEW ============
    startCategoryReview(catId) {
        const cat = this.categories.find(c => c.id === catId);
        const cards = this.cards.filter(c => c.category === catId);
        if (!cards.length) return Utils.showToast('این دسته خالیه');
        const toReview = cards.filter(c => c.nextReview <= new Date().toISOString().split('T')[0]);
        this._reviewCards = toReview.length > 0 ? toReview : cards;
        this._reviewIndex = 0;
        this.showReviewCard(`${cat?.icon || ''} ${cat?.name || catId}`);
    },
    
    startReview() {
        const cards = this.getCardsForReview();
        if (!cards.length) return Utils.showToast('✅ هیچ کارتی برای مرور نیست');
        this._reviewCards = cards;
        this._reviewIndex = 0;
        this.showReviewCard('مرور همه');
    },
    
    showReviewCard(title = 'مرور') {
        if (this._reviewIndex >= this._reviewCards.length) { Utils.showToast('🎉 تموم شد!'); this.render(); return; }
        const card = this._reviewCards[this._reviewIndex];
        document.getElementById('reviewModal')?.remove();
        
        const modal = document.createElement('div');
        modal.id = 'reviewModal';
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal" style="max-width:500px;text-align:center;">
                <div style="display:flex;justify-content:space-between;margin-bottom:1.5rem;color:var(--text-secondary);font-size:0.85rem;">
                    <span>${this._reviewIndex+1}/${this._reviewCards.length}</span>
                    <span>${title}</span>
                    <span>جعبه ${card.box}</span>
                </div>
                
                <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:2rem;margin-bottom:1rem;min-height:120px;display:flex;align-items:center;justify-content:center;">
                    <div style="font-size:1.2rem;font-weight:600;line-height:1.8;">${card.question}</div>
                </div>
                
                <div id="reviewAnswer" style="display:none;background:var(--bg);border:1px solid var(--border);border-radius:12px;padding:2rem;margin-bottom:1rem;min-height:120px;align-items:center;justify-content:center;flex-direction:column;">
                    <div style="font-size:1.2rem;font-weight:600;color:var(--success);line-height:1.8;">${card.answer}</div>
                    ${card.hint ? `<div style="margin-top:1rem;padding:0.8rem;background:var(--surface);border-radius:8px;font-size:0.9rem;color:var(--text-secondary);">💡 ${card.hint}</div>` : ''}
                </div>
                
                <button class="btn btn-primary btn-lg" id="reviewShowBtn" onclick="Flashcards.toggleAnswer()" style="width:100%;">نمایش پاسخ</button>
                
                <div id="reviewQuality" style="display:none;margin-top:1rem;">
                    <p style="margin-bottom:0.8rem;font-weight:500;">چقدر بلد بودی؟</p>
                    <div style="display:flex;gap:0.5rem;">
                        <button class="btn" style="flex:1;background:var(--bg);" onclick="Flashcards.answerCard(0)">دوباره بخونم</button>
                        <button class="btn" style="flex:1;background:var(--bg);" onclick="Flashcards.answerCard(1)">سخت بود</button>
                        <button class="btn btn-success" style="flex:1;" onclick="Flashcards.answerCard(2)">بلد بودم</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    },
    
    toggleAnswer() {
        document.getElementById('reviewAnswer').style.display = 'flex';
        document.getElementById('reviewShowBtn').style.display = 'none';
        document.getElementById('reviewQuality').style.display = 'block';
    },
    
    answerCard(quality) {
        this.reviewCard(this._reviewCards[this._reviewIndex].id, quality);
        this._reviewIndex++;
        document.getElementById('reviewModal')?.remove();
        this.showReviewCard();
    },
    
    getCardsForReview() { const today = new Date().toISOString().split('T')[0]; return this.cards.filter(c => c.nextReview <= today); },
    
    reviewCard(id, quality) {
        const card = this.cards.find(c => c.id === id);
        if (!card) return;
        const today = new Date();
        if (quality <= 1) { card.box = 1; card.wrongCount++; }
        else { if (card.box < 5) card.box++; card.correctCount++; }
        const d = new Date(today); d.setDate(d.getDate() + this.boxes[card.box-1].interval);
        card.nextReview = d.toISOString();
        const key = today.toISOString().split('T')[0];
        if (!this.reviewHistory[key]) this.reviewHistory[key] = [];
        this.reviewHistory[key].push({ cardId: id, quality });
        this.saveCards(); this.saveHistory();
    },
    
    getStats() {
        const byCat = {}; this.categories.forEach(c => byCat[c.id] = this.cards.filter(x => x.category === c.id).length);
        const byBox = {}; this.boxes.forEach(b => byBox[b.id] = this.cards.filter(x => x.box === b.id).length);
        const tc = this.cards.reduce((s, c) => s + c.correctCount, 0);
        const tw = this.cards.reduce((s, c) => s + c.wrongCount, 0);
        return { totalCards: this.cards.length, cardsToReview: this.getCardsForReview().length, cardsByCategory: byCat, cardsByBox: byBox, totalReviews: Object.values(this.reviewHistory).flat().length, accuracy: (tc+tw) > 0 ? Math.round((tc/(tc+tw))*100) : 0 };
    },
    
    saveCards() { localStorage.setItem('flashcards', JSON.stringify(this.cards)); },
    saveHistory() { localStorage.setItem('flashcardReviews', JSON.stringify(this.reviewHistory)); }
};