// ============ AI RESEARCH SYSTEM - FINAL ============
const AIResearch = {
    savedResearches: JSON.parse(localStorage.getItem('savedResearches') || '[]'),
    
    render() {
        const container = document.getElementById('researchContainer');
        if (!container) return;
        
        container.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <span class="card-title">🔬 تحقیق هوشمند</span>
                    <button class="btn btn-sm" onclick="AIResearch.showHistory()" style="${this.savedResearches.length === 0 ? 'display:none;' : ''}">
                        📋 تاریخچه (${this.savedResearches.length})
                    </button>
                </div>
                
                <p class="text-secondary" style="margin-bottom:1.5rem;">موضوع تحقیق را وارد کنید تا یک مقاله علمی با منابع واقعی برایتان نوشته شود.</p>
                
                <div class="input-group"><label>موضوع تحقیق</label><input type="text" id="researchTopic" placeholder="مثلاً: تأثیر هوش مصنوعی بر آموزش"></div>
                
                <div style="display:flex;gap:1rem;flex-wrap:wrap;">
                    <div class="input-group" style="flex:1;min-width:150px;">
                        <label>سطح</label>
                        <select id="researchLevel">
                            <option value="student">دانش‌آموزی</option>
                            <option value="university" selected>دانشگاهی</option>
                            <option value="research">پژوهشی</option>
                        </select>
                    </div>
                    <div class="input-group" style="flex:1;min-width:150px;">
                        <label>تعداد پاراگراف</label>
                        <select id="researchParagraphs">
                            <option value="3">۳ پاراگراف (کوتاه)</option>
                            <option value="5" selected>۵ پاراگراف (متوسط)</option>
                            <option value="8">۸ پاراگراف (بلند)</option>
                            <option value="12">۱۲ پاراگراف (جامع)</option>
                        </select>
                    </div>
                    <div class="input-group" style="flex:1;min-width:150px;">
                        <label>سبک استناد</label>
                        <select id="researchStyle">
                            <option value="apa" selected>APA</option>
                            <option value="harvard">Harvard</option>
                            <option value="vancouver">Vancouver</option>
                        </select>
                    </div>
                </div>
                
                <button class="btn btn-primary" id="researchBtn" onclick="AIResearch.generate()">
                    🔬 شروع تحقیق
                </button>
                
                <div id="researchResult" style="margin-top:1.5rem;"></div>
            </div>
        `;
    },
    
    async generate() {
        const topic = document.getElementById('researchTopic')?.value?.trim();
        const level = document.getElementById('researchLevel')?.value || 'university';
        const paragraphs = document.getElementById('researchParagraphs')?.value || '5';
        const style = document.getElementById('researchStyle')?.value || 'apa';
        const btn = document.getElementById('researchBtn');
        const resultDiv = document.getElementById('researchResult');
        
        if (!topic) return Utils.showToast('⚠️ موضوع را وارد کن');
        
        btn.disabled = true;
        btn.textContent = '⏳ در حال تحقیق...';
        resultDiv.innerHTML = '<div class="skeleton skeleton-card" style="height:200px;"></div>';
        
        const levelMap = { student: 'دانش‌آموز', university: 'دانشجو', research: 'پژوهشگر' };
        const styleMap = { apa: 'APA', harvard: 'Harvard', vancouver: 'Vancouver' };
        
        try {
            const prompt = `تو یک پژوهشگر حرفه‌ای هستی. یک مقاله علمی درباره "${topic}" بنویس.
سطح: ${levelMap[level]}
تعداد پاراگراف: ${paragraphs}
سبک استناد: ${styleMap[style]}

ساختار:
## 📌 چکیده
(خلاصه ۳-۴ خط)

## ۱. مقدمه

## ۲. بدنه اصلی (چندین پاراگراف)

## ۳. نتیجه‌گیری

## 📚 منابع
(۳-۵ منبع واقعی با لینک DOI یا URL)

قوانین:
1. از **bold** برای نکات مهم استفاده کن
2. از - برای لیست استفاده کن
3. از > برای نقل‌قول استفاده کن
4. فرمول‌ها را با HTML بنویس: توان با <sup>، اندیس با <sub>، کسر با <sup>/<sub>، رادیکال با √()
5. از \\frac و \\sqrt و \\sum استفاده نکن
6. منابع باید واقعی و قابل جستجو باشند`;

            const response = await this.callAI(prompt);
            this._lastResearch = { topic, content: response, level, style, paragraphs };
            resultDiv.innerHTML = this.formatResearch(response, topic, level, style, paragraphs);
            this.saveResearch(topic, response, level, style);
            
        } catch(e) {
            resultDiv.innerHTML = `<div style="color:var(--danger);padding:1rem;">❌ خطا: ${e.message}</div>`;
        }
        
        btn.disabled = false;
        btn.textContent = '🔬 شروع تحقیق';
    },
    
    formatResearch(text, topic, level, style, paragraphs, hideButtons = false) {
        let html = text;
        
        html = html.replace(/## 📌 چکیده/g, '<div class="research-abstract"><h4>📌 چکیده</h4>');
        html = html.replace(/## 📚 منابع/g, '</div><div class="research-references"><h4>📚 منابع</h4>');
        html = html.replace(/## (.+)$/gm, '</div><h4 class="research-heading">$1</h4><div class="research-section">');
        html = html.replace(/\*\*(.+?)\*\*/g, '<strong style="color:#f39c12;">$1</strong>');
        html = html.replace(/^> (.+)$/gm, '<blockquote class="research-quote">$1</blockquote>');
        html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
        html = html.replace(/(<li>.*?<\/li>)+/g, '<ul>$&</ul>');
        html = html.replace(/\$\$(.+?)\$\$/g, '<div class="research-formula">$1</div>');
        html = html.replace(/\$(.+?)\$/g, '<span class="research-inline-formula">$1</span>');
        html = html.replace(/\n\n/g, '<br><br>');
        html = html.replace(/\n/g, '<br>');
        html += '</div>';
        
        const levelNames = { student: 'دانش‌آموزی', university: 'دانشگاهی', research: 'پژوهشی' };
        
        return `
            <div class="research-paper" id="researchPaper">
                <div class="research-header">
                    <h2>📄 ${topic}</h2>
                    <div class="research-meta">
                        <span>🏷️ ${levelNames[level]}</span>
                        <span>📝 ${paragraphs} پاراگراف</span>
                        <span>📅 ${new Date().toLocaleDateString('fa-IR')}</span>
                    </div>
                </div>
                <div class="research-body">${html}</div>
                ${!hideButtons ? `
                <div class="research-footer no-print">
                    <button class="btn btn-sm" onclick="navigator.clipboard.writeText(document.querySelector('.research-body').innerText)">📋 کپی</button>
                    <button class="btn btn-sm btn-accent" onclick="AIResearch.downloadPDF()">📥 PDF</button>
                    <button class="btn btn-sm btn-primary" onclick="AIResearch.generate()">🔄 بازنویسی</button>
                </div>` : ''}
            </div>`;
    },
    
    saveResearch(topic, content, level, style) {
        this.savedResearches.unshift({ topic, content, level, style, date: new Date().toISOString() });
        if (this.savedResearches.length > 10) this.savedResearches.pop();
        localStorage.setItem('savedResearches', JSON.stringify(this.savedResearches));
    },
    
    showHistory() {
        const modal = document.createElement('div'); modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal" style="max-width:600px;">
                <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
                <h3>📋 تاریخچه تحقیق‌ها</h3>
                ${this.savedResearches.length === 0 ? '<p class="text-secondary">هیچ تحقیقی ذخیره نشده</p>' : 
                this.savedResearches.map((r, i) => `
                    <div style="padding:0.8rem;border-bottom:1px solid var(--border);cursor:pointer;" onclick="AIResearch.loadResearch(${i});this.closest('.modal-overlay').remove();">
                        <strong>📄 ${r.topic}</strong><br>
                        <small>${new Date(r.date).toLocaleDateString('fa-IR')} | ${r.level}</small>
                    </div>
                `).join('')}
            </div>`;
        document.body.appendChild(modal); modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    },
    
    loadResearch(index) {
        const r = this.savedResearches[index];
        if (!r) return;
        document.getElementById('researchTopic').value = r.topic;
        const resultDiv = document.getElementById('researchResult');
        resultDiv.innerHTML = this.formatResearch(r.content, r.topic, r.level, r.style, '?', true);
        resultDiv.scrollIntoView({ behavior: 'smooth' });
    },
    
    downloadPDF() {
        if (!this._lastResearch) return;
        const { topic, content, level, style, paragraphs } = this._lastResearch;
        const paperHTML = this.formatResearch(content, topic, level, style, paragraphs, true);
        
        const w = window.open('', '_blank');
        w.document.write(`
            <html dir="rtl">
            <head><meta charset="UTF-8"><title>${topic} - درسیار</title>
            <link rel="stylesheet" href="fonts/kalameh.css">
            <style>
                @import url('fonts/kalameh.css');
                body { font-family: 'Kalameh', Tahoma, sans-serif; direction: rtl; padding: 40px; line-height: 2.2; color: #1a1a1a; background: #fff; }
                .research-header { background: #05319e; color: #fff; padding: 20px; border-radius: 10px; margin-bottom: 20px; }
                .research-header h2 { margin: 0 0 8px; }
                .research-meta { font-size: 0.9rem; opacity: 0.9; }
                .research-abstract { background: #f5f6f8; padding: 16px; border-right: 4px solid #05319e; margin: 16px 0; border-radius: 8px; }
                .research-heading { color: #05319e; border-bottom: 2px solid #e2e5ea; padding-bottom: 6px; margin: 20px 0 12px; }
                .research-formula { background: #f5f6f8; padding: 12px; text-align: center; direction: ltr; border-radius: 8px; margin: 12px 0; font-family: monospace; }
                .research-quote { border-right: 3px solid #c9a03e; padding-right: 12px; color: #5a5a5a; margin: 12px 0; }
                .research-references { background: #f5f6f8; padding: 16px; border-radius: 8px; margin-top: 20px; }
                .research-references h4 { margin-top: 0; }
                .no-print { display: none; }
                @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
            </style></head>
            <body>${paperHTML}</body></html>
        `);
        w.document.close();
        setTimeout(() => w.print(), 500);
    },
    
    async callAI(prompt) {
        if (typeof AIAssistant !== 'undefined' && typeof AIAssistant.callGapGPT === 'function') {
            return await AIAssistant.callGapGPT(prompt);
        }
        throw new Error('AI در دسترس نیست');
    }
};