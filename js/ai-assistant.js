// ============ AI STUDY ASSISTANT - FINAL ============
const AIAssistant = {
    apiKey: 'sk-1gnqq3N4Iy0FsuBS0HCeJYW0v0xrRXoNIdRK9E5twiXOKaWv',
    baseURL: 'https://api.gapgpt.app/v1',
    chatHistory: [],
    dailyMessages: JSON.parse(localStorage.getItem('aiDailyMessages') || '{}'),
    isProcessing: false,
    
    init() {
        this.resetDailyIfNeeded();
        this.render();
        this.bindEvents();
    },
    
    resetDailyIfNeeded() {
        const today = new Date().toDateString();
        if (localStorage.getItem('aiLastDate') !== today) {
            this.dailyMessages = {};
            localStorage.setItem('aiDailyMessages', '{}');
            localStorage.setItem('aiLastDate', today);
        }
    },
    
    getDailyCount() {
        return this.dailyMessages[Storage.currentUser?.username || 'guest'] || 0;
    },
    
    incrementDailyCount() {
        const key = Storage.currentUser?.username || 'guest';
        this.dailyMessages[key] = (this.dailyMessages[key] || 0) + 1;
        localStorage.setItem('aiDailyMessages', JSON.stringify(this.dailyMessages));
    },
    
    canSendMessage() {
        if (Storage.currentUser?.role === 'admin') return true;
        return this.getDailyCount() < 10;
    },
    
    bindEvents() {
        document.getElementById('aiSendBtn')?.addEventListener('click', () => this.sendMessage());
        document.getElementById('aiInput')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.sendMessage(); }
        });
    },
    
    render() {
        const container = document.getElementById('aiAssistantContainer');
        if (!container) return;
        
        const remaining = this.canSendMessage() ? (Storage.currentUser?.role === 'admin' ? '∞' : 10 - this.getDailyCount()) : 0;
        
        container.innerHTML = `
            <div class="chat-container">
                <div class="chat-header"><div class="chat-header-left"><div class="chat-avatar">🤖</div><div><div class="chat-title">دستیار درسیار</div><div class="chat-subtitle">${this.isProcessing ? 'در حال نوشتن...' : 'آنلاین'} | ${remaining} پیام</div></div></div><button class="chat-clear-btn" onclick="AIAssistant.clearChat()"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14"/></svg></button></div>
                <div class="chat-messages" id="aiChatMessages">${this.chatHistory.length === 0 ? '<div class="chat-empty"><div class="chat-empty-icon">🎓</div><h3>سلام! 👋</h3><p>سوال درسی بپرس</p></div>' : this.chatHistory.map(msg => `<div class="chat-message ${msg.role}"><div class="chat-message-avatar">${msg.role==='user'?'👤':'🤖'}</div><div class="chat-message-bubble"><div class="chat-message-text">${this.formatContent(msg.content)}</div></div></div>`).join('')}</div>
                ${!this.canSendMessage() && this.chatHistory.length > 0 ? '<div class="chat-limit-warning">⚠️ سقف ۱۰ پیام روزانه تمام شد</div>' : ''}
                <div class="chat-input-area"><textarea id="aiInput" class="chat-input" placeholder="سوال درسی..." rows="1" ${!this.canSendMessage()||this.isProcessing?'disabled':''}></textarea><button class="chat-send-btn" id="aiSendBtn" ${!this.canSendMessage()||this.isProcessing?'disabled':''}>${this.isProcessing?'⏳':'📤'}</button></div>
            </div>`;
        
        this.scrollToBottom();
        if (!this.isProcessing) setTimeout(() => document.getElementById('aiInput')?.focus(), 300);
        this.bindEvents();
    },
    
    formatContent(text) {
        if (!text) return '';
        let html = text;
        
        // فرمول‌های بلوکی $$...$$ → کادر با KaTeX
        html = html.replace(/\$\$([\s\S]+?)\$\$/g, (match, formula) => {
            return `\\[${formula.trim()}\\]`;
        });
        
        // فرمول‌های درون خطی $...$
        html = html.replace(/\$(.+?)\$/g, (match, formula) => {
            return `\\(${formula.trim()}\\)`;
        });
        
        // **bold** طلایی
        html = html.replace(/\*\*(.+?)\*\*/g, '<strong style="color:#f39c12;">$1</strong>');
        
        // ### و ##
        html = html.replace(/### (.+)/g, '<h4 style="color:#05319e;margin:0.8rem 0 0.4rem;">$1</h4>');
        html = html.replace(/## (.+)/g, '<h3 style="color:#05319e;margin:1rem 0 0.5rem;border-bottom:2px solid #e8edf5;padding-bottom:0.3rem;">$1</h3>');
        
        // کد
        html = html.replace(/```(.+?)```/g, '<pre style="background:#1e1e1e;color:#e0e0e0;padding:1rem;border-radius:8px;overflow-x:auto;"><code>$1</code></pre>');
        html = html.replace(/`(.+?)`/g, '<code style="background:rgba(0,0,0,0.08);padding:2px 6px;border-radius:4px;">$1</code>');
        
        // لیست و نقل قول
        html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
        html = html.replace(/(<li>.*?<\/li>)+/g, '<ul>$&</ul>');
        html = html.replace(/^> (.+)$/gm, '<blockquote style="border-right:3px solid #f39c12;padding-right:1rem;">$1</blockquote>');
        
        // خط جدید
        html = html.replace(/\n\n/g, '<br><br>');
        html = html.replace(/\n/g, '<br>');
        
        return html;
    },
    
    async sendMessage() {
        if (this.isProcessing) return;
        const input = document.getElementById('aiInput');
        if (!input) return;
        const message = input.value.trim();
        if (!message) return;
        if (!this.canSendMessage()) { Utils.showToast('⚠️ سقف پیام تمام شد'); return; }
        
        this.isProcessing = true;
        this.chatHistory.push({ role: 'user', content: message });
        this.incrementDailyCount();
        input.value = '';
        this.render();
        this.showTyping();
        
        try {
            const systemPrompt = `فقط به سوالات درسی جواب بده. از **bold** و ## و - استفاده کن. فرمول‌های ریاضی را داخل $$...$$ بنویس.`;
            
            const response = await fetch(`${this.baseURL}/chat/completions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.apiKey}` },
                body: JSON.stringify({ model: 'gapgpt-qwen-3.5', messages: [{ role: 'system', content: systemPrompt }, ...this.chatHistory.slice(-4).map(m => ({ role: m.role, content: m.content })), { role: 'user', content: message }], temperature: 0.7, max_tokens: 800 })
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            this.chatHistory.push({ role: 'assistant', content: data.choices[0].message.content });
        } catch(e) { Utils.showToast('❌ خطا'); }
        
        this.isProcessing = false;
        this.hideTyping();
        this.render();
        
        // رندر KaTeX بعد از نمایش
        setTimeout(() => {
            if (typeof renderMathInElement !== 'undefined') {
                const messages = document.getElementById('aiChatMessages');
                if (messages) {
                    try {
                        renderMathInElement(messages, {
                            delimiters: [
                                { left: '\\[', right: '\\]', display: true },
                                { left: '\\(', right: '\\)', display: false }
                            ],
                            throwOnError: false
                        });
                    } catch(e) {}
                }
            }
        }, 300);
    },
    
    async callGapGPT(prompt) {
        const response = await fetch(`${this.baseURL}/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.apiKey}` },
            body: JSON.stringify({ model: 'gapgpt-qwen-3.5', messages: [{ role: 'user', content: prompt }], temperature: 0.7, max_tokens: 1500 })
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        return data.choices[0].message.content;
    },
    
    showTyping() {
        const div = document.getElementById('aiChatMessages');
        if (div) { const t = document.createElement('div'); t.id = 'aiTyping'; t.className = 'chat-message assistant'; t.innerHTML = '<div class="chat-message-avatar">🤖</div><div class="chat-message-bubble typing-bubble"><div class="typing-dots"><span></span><span></span><span></span></div></div>'; div.appendChild(t); this.scrollToBottom(); }
    },
    hideTyping() { document.getElementById('aiTyping')?.remove(); },
    clearChat() { this.chatHistory = []; this.isProcessing = false; this.render(); },
    scrollToBottom() { setTimeout(() => { const d = document.getElementById('aiChatMessages'); if (d) d.scrollTop = d.scrollHeight; }, 150); }
};