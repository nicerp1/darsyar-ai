/**
 * StudyMate Pro - AI Academic Assistant Chatbot
 */

const AIAssistant = (function () {
    let isTyping = false;
    const MAX_DAILY_FREE_QUOTA = 10;

    function init() {
        renderChatHistory();
        updateQuotaDisplay();
    }

    function getTodayUsage() {
        const today = new Date().toISOString().split('T')[0];
        const usageData = Storage.get('ai_usage', { date: today, count: 0 });
        if (usageData.date !== today) {
            return { date: today, count: 0 };
        }
        return usageData;
    }

    function incrementTodayUsage() {
        const today = new Date().toISOString().split('T')[0];
        const usageData = getTodayUsage();
        usageData.date = today;
        usageData.count++;
        Storage.set('ai_usage', usageData);
        updateQuotaDisplay();
    }

    function updateQuotaDisplay() {
        const quotaEl = document.getElementById('ai-quota-text');
        const user = Storage.getCurrentUser();
        const isAdminOrVip = user && (user.role === 'admin' || user.plan === 'gold' || user.plan === 'silver');

        if (!quotaEl) return;

        if (isAdminOrVip) {
            quotaEl.innerHTML = `<span class="brand-badge">نامحدود (حساب VIP)</span>`;
            return;
        }

        const usage = getTodayUsage();
        const remaining = Math.max(0, MAX_DAILY_FREE_QUOTA - usage.count);
        const pd = typeof Utils !== 'undefined' ? Utils.toPersianDigits : (v => v);
        quotaEl.innerHTML = `اعتبار رایگان امروز: <strong>${pd(remaining)}</strong> از ${pd(MAX_DAILY_FREE_QUOTA)} پیام`;
    }

    function renderChatHistory(pending = null) {
        const feed = document.getElementById('ai-chat-messages');
        if (!feed) return;

        const messages = Storage.get('ai_chat_history', [
            { role: 'assistant', content: 'سلام! من چت‌بات روند هستم. چطور کمکت کنم؟' }
        ]);

        const display = pending ? [...messages, { role: 'user', content: pending }] : messages;
        feed.innerHTML = display.map(msg => createMessageHtml(msg.role, msg.content)).join('');
        feed.scrollTop = feed.scrollHeight;
    }

    function createMessageHtml(role, content) {
        const isUser = role === 'user';
        const user = Storage.getCurrentUser() || { avatar: '👩‍🎓' };
        const avatar = isUser ? (window.ProfileStudio ? ProfileStudio.avatarHTML(user.avatar) : '👩‍🎓') : '🤖';
        const renderedText = typeof Utils !== 'undefined' ? Utils.renderKaTeXAndMarkdown(content) : content;

        return `
            <div class="chat-bubble ${isUser ? 'user' : 'assistant'}">
                <div class="bubble-avatar">${avatar}</div>
                <div class="bubble-content">
                    ${renderedText}
                </div>
            </div>
        `;
    }

    async function sendMessage(presetText = null) {
        if (isTyping) return;

        const input = document.getElementById('ai-chat-input');
        const text = presetText || (input ? input.value.trim() : '');

        if (!text) return;

        const user = Storage.getCurrentUser();
        const isAdminOrVip = user && (user.role === 'admin' || user.plan === 'gold' || user.plan === 'silver');
        const usage = getTodayUsage();

        if (!isAdminOrVip && usage.count >= MAX_DAILY_FREE_QUOTA) {
            if (typeof Utils !== 'undefined') {
                Utils.showToast('سهمیه روزانه ابزار هوشمند تکمیل شده است؛ فردا دوباره می‌توانید رایگان استفاده کنید.', 'warning');
            }
            return;
        }

        if (input && !presetText) input.value = '';

        const history = Storage.get('ai_chat_history', []);
        const messages = [...history, { role: 'user', content: text }];
        const account = user?.username;
        isTyping = true;
        renderChatHistory(text);
        showTypingIndicator();

        try {
            const content = await generateAssistantResponse(messages);
            if (Storage.getCurrentUser()?.username !== account) return;
            Storage.set('ai_chat_history', [...messages, { role: 'assistant', content }]);
            incrementTodayUsage();
            Storage.addXP(5);
            Utils.playSound('beep');
        } catch (error) {
            if (Storage.getCurrentUser()?.username !== account) return;
            if (input && !input.value) input.value = text;
            Utils.showToast(error.message, 'error');
        } finally {
            removeTypingIndicator();
            isTyping = false;
            if (Storage.getCurrentUser()?.username === account) renderChatHistory();
        }
    }

    function showTypingIndicator() {
        const feed = document.getElementById('ai-chat-messages');
        if (!feed) return;

        const indicator = document.createElement('div');
        indicator.id = 'ai-typing-indicator';
        indicator.className = 'chat-bubble assistant';
        indicator.innerHTML = `
            <div class="bubble-avatar">🤖</div>
            <div class="bubble-content" style="display: flex; gap: 4px; align-items: center; padding: 12px 18px;">
                <span>در حال پاسخ‌دادن…</span>
                <span class="typing-dot" style="animation: pulse 1s infinite;">.</span>
                <span class="typing-dot" style="animation: pulse 1s infinite 0.2s;">.</span>
                <span class="typing-dot" style="animation: pulse 1s infinite 0.4s;">.</span>
            </div>
        `;
        feed.appendChild(indicator);
        feed.scrollTop = feed.scrollHeight;
    }

    function removeTypingIndicator() {
        const ind = document.getElementById('ai-typing-indicator');
        if (ind) ind.remove();
    }

    async function generateAssistantResponse(history) {
        const response = await fetch('/api/ai', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                mode: 'assistant',
                model: Storage.getSettings().aiModel || 'gapgpt-qwen-3.5',
                messages: history.slice(-9)
            })
        });
        if (!response.ok) {
            throw new Error(response.status === 401
                ? 'نشستت پایان یافته. دوباره وارد حساب شو.'
                : 'پاسخی دریافت نشد. پیام برای تلاش دوباره حفظ شد.');
        }
        const data = await response.json();
        const text = data.choices?.[0]?.message?.content;
        if (typeof text !== 'string' || !text.trim()) throw new Error('پاسخی دریافت نشد. دوباره تلاش کن.');
        return text.trim();
    }

    function clearChat() {
        if (isTyping) return;
        if (confirm('آیا از پاک کردن کل تاریخچه گفتگو با هوش مصنوعی اطمینان دارید؟')) {
            Storage.set('ai_chat_history', []);
            renderChatHistory();
            if (typeof Utils !== 'undefined') {
                Utils.showToast('تاریخچه گفتگو پاک شد.', 'info');
            }
        }
    }

    return {
        init,
        sendMessage,
        clearChat
    };
})();

if (typeof window !== 'undefined') {
    window.AIAssistant = AIAssistant;
}
