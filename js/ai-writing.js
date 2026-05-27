// ============ AI WRITING TOOLS ============
const AIWriting = {
    render() {
        const container = document.getElementById('writingContainer');
        if (!container) return;
        
        container.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <span class="card-title">📄 انشانویسی هوشمند</span>
                </div>
                
                <p class="text-secondary" style="margin-bottom:1.5rem;">
                    موضوع انشا را وارد کنید تا یک انشای کامل و ساختاریافته برایتان نوشته شود.
                </p>
                
                <div class="input-group">
                    <label>موضوع انشا</label>
                    <input type="text" id="essayTopic" placeholder="مثلاً: علم بهتر است یا ثروت">
                </div>
                
                <div style="display:flex;gap:1rem;flex-wrap:wrap;">
                    <div class="input-group" style="flex:1;min-width:150px;">
                        <label>نوع انشا</label>
                        <select id="essayType">
                            <option value="short">کوتاه (۲ پاراگراف)</option>
                            <option value="medium" selected>متوسط (۴ پاراگراف)</option>
                            <option value="long">بلند (۶ پاراگراف)</option>
                        </select>
                    </div>
                    <div class="input-group" style="flex:1;min-width:150px;">
                        <label>پایه تحصیلی</label>
                        <select id="essayGrade">
                            <option value="elementary">دبستان</option>
                            <option value="middle">راهنمایی</option>
                            <option value="highschool" selected>دبیرستان</option>
                            <option value="university">دانشگاه</option>
                        </select>
                    </div>
                </div>
                
                <button class="btn btn-primary" id="essayBtn" onclick="AIWriting.generateEssay()">
                    📄 نوشتن انشا
                </button>
                
                <div id="essayResult" style="margin-top:1.5rem;"></div>
            </div>
        `;
    },
    
    async generateEssay() {
        const topic = document.getElementById('essayTopic')?.value?.trim();
        const type = document.getElementById('essayType')?.value || 'medium';
        const grade = document.getElementById('essayGrade')?.value || 'highschool';
        const btn = document.getElementById('essayBtn');
        const resultDiv = document.getElementById('essayResult');
        
        if (!topic) return Utils.showToast('⚠️ موضوع انشا را وارد کن');
        
        btn.disabled = true;
        btn.textContent = '⏳ در حال نوشتن...';
        resultDiv.innerHTML = '<div class="skeleton skeleton-card" style="height:200px;"></div>';
        
        const typeMap = { 
            short: '۲ پاراگراف (مقدمه و نتیجه‌گیری)', 
            medium: '۴ پاراگراف (مقدمه، ۲ بدنه، نتیجه‌گیری)', 
            long: '۶ پاراگراف (مقدمه، ۴ بدنه، نتیجه‌گیری)' 
        };
        const gradeMap = { 
            elementary: 'دانش‌آموز دبستانی', 
            middle: 'دانش‌آموز راهنمایی', 
            highschool: 'دانش‌آموز دبیرستانی', 
            university: 'دانشجو' 
        };
        
        try {
            const prompt = `تو یک معلم ادبیات فارسی هستی. یک انشای کامل و زیبا درباره موضوع زیر بنویس.

موضوع: ${topic}
تعداد پاراگراف: ${typeMap[type]}
سطح: ${gradeMap[grade]}

دستورالعمل‌ها:
1. از نثر زیبا و روان فارسی استفاده کن
2. حتماً از آرایه‌های ادبی (تشبیه، استعاره، کنایه) استفاده کن
3. نقل‌قول از شاعران بزرگ (سعدی، حافظ، فردوسی) اضافه کن
4. پاراگراف‌بندی منظم داشته باش
5. هر پاراگراف را با ## جدا کن
6. کلمات مهم را با ** بولد کن

قالب خروجی:
## مقدمه
(متن مقدمه...)

## بدنه ۱
(متن بدنه اول...)

## بدنه ۲
(متن بدنه دوم...)

## نتیجه‌گیری
(متن نتیجه‌گیری...)`;

            const response = await this.callAI(prompt);
            
            const formattedEssay = this.formatEssay(response);
            const wordCount = response.replace(/\s+/g, ' ').trim().split(' ').length;
            
            resultDiv.innerHTML = `
                <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;overflow:hidden;">
                    <div style="background:var(--primary);color:#fff;padding:1rem 1.5rem;display:flex;justify-content:space-between;align-items:center;">
                        <h3 style="margin:0;font-size:1.1rem;">📄 ${topic}</h3>
                        <span style="font-size:0.85rem;opacity:0.9;">${wordCount} کلمه</span>
                    </div>
                    <div style="padding:1.5rem;">
                        <div id="essayText" style="line-height:2.2;font-size:1.05rem;">
                            ${formattedEssay}
                        </div>
                    </div>
                    <div style="padding:1rem 1.5rem;border-top:1px solid var(--border);display:flex;gap:0.5rem;">
                        <button class="btn btn-sm" onclick="navigator.clipboard.writeText(document.getElementById('essayText').innerText)">📋 کپی</button>
                        <button class="btn btn-sm btn-primary" onclick="AIWriting.generateEssay()">🔄 بازنویسی</button>
                    </div>
                </div>
            `;
        } catch(e) {
            console.error(e);
            resultDiv.innerHTML = `<div style="color:var(--danger);">❌ خطا: ${e.message}</div>`;
        }
        
        btn.disabled = false;
        btn.textContent = '📄 نوشتن انشا';
    },
    
    formatEssay(text) {
        return text
            .replace(/## (.+)/g, '<h4 style="color:var(--primary);margin:1.5rem 0 0.8rem;padding-bottom:0.5rem;border-bottom:2px solid var(--primary-light);">$1</h4>')
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/\n\n/g, '<br><br>')
            .replace(/\n/g, '<br>');
    },
    
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
    }
};