/** Header notes and private advisor/student chat. */
const Communications = (function () {
    let activeTab = 'chat', selectedStudent = '', adminMessages = [], chatBlocked = null, initialized = false;
    let chatRequest = 0, chatReady = false, sending = false;
    const esc = value => String(value ?? '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
    const isManager = () => Storage.isManager();

    function init() {
        if (!Storage.getCurrentUser()) return;
        populateStudents(); updateUnread(); renderNotes();
        if (!initialized) {
            document.addEventListener('keydown', event => { if (event.key === 'Escape') close(); });
            initialized = true;
        }
    }

    function populateStudents() {
        const picker = document.getElementById('advisor-student-picker'), select = document.getElementById('advisor-student-select');
        picker?.classList.toggle('hidden', !isManager());
        if (!select || !isManager()) return;
        const students = Storage.getUsers().filter(user => user.accountType !== 'advisor' && user.username !== 'kiankaki');
        select.innerHTML = '<option value="">انتخاب دانش‌آموز</option>' + students.map(user => `<option value="${esc(user.username)}">${esc(user.name || user.username)} (@${esc(user.username)})</option>`).join('');
        if (selectedStudent && students.some(user => user.username === selectedStudent)) select.value = selectedStudent;
    }

    function open(tab = 'chat') {
        if (window.WebStudio?.enabled()) { activeTab = tab === 'notes' ? 'notes' : 'chat'; App.navigate('chat'); return; }
        init();
        if (window.DarsyarPlatform?.native) document.body.classList.add('communications-page-open');
        document.getElementById('communications-overlay')?.classList.add('open');
        const drawer = document.getElementById('communications-drawer'); drawer?.classList.add('open'); drawer?.setAttribute('aria-hidden', 'false');
        switchTab(tab);
        setTimeout(() => document.getElementById(tab === 'chat' ? 'advisor-chat-input' : 'quick-note-input')?.focus(), 80);
    }

    function close() {
        if (window.WebStudio?.enabled()) return;
        document.body.classList.remove('communications-page-open');
        document.getElementById('communications-overlay')?.classList.remove('open');
        const drawer = document.getElementById('communications-drawer'); drawer?.classList.remove('open'); drawer?.setAttribute('aria-hidden', 'true');
    }

    function showPage() {
        init();
        const drawer = document.getElementById('communications-drawer');
        drawer?.classList.add('open'); drawer?.setAttribute('aria-hidden', 'false');
        window.WebStudio?.chatContext();
        switchTab(activeTab);
    }

    async function switchTab(tab) {
        activeTab = tab === 'notes' ? 'notes' : 'chat';
        document.getElementById('communications-chat-panel')?.classList.toggle('hidden', activeTab !== 'chat');
        document.getElementById('communications-notes-panel')?.classList.toggle('hidden', activeTab !== 'notes');
        ['chat', 'notes'].forEach(name => { const button = document.getElementById(`communications-tab-${name}`); button?.classList.toggle('active', activeTab === name); button?.setAttribute('aria-selected', String(activeTab === name)); });
        document.getElementById('communications-title').textContent = activeTab === 'chat' ? (isManager() ? 'گفت‌وگو با دانش‌آموز' : 'گفت‌وگو با مشاور') : 'یادداشت‌های من';
        if (activeTab === 'chat') await loadChat(); else renderNotes();
    }

    async function selectStudent(username) {
        if (sending) return;
        selectedStudent = String(username || '').trim().toLowerCase();
        const input = document.getElementById('advisor-chat-input'); if (input) input.value = '';
        await loadChat();
    }

    async function loadChat() {
        window.Community?.chatPeer(isManager() ? Storage.getUsers().find(u=>u.username===selectedStudent) : Storage.getCurrentUser()?.advisor);
        const requestId = ++chatRequest;
        chatReady = false; chatBlocked = null; syncChatState();
        const status = document.getElementById('advisor-chat-status');
        const box = document.getElementById('advisor-chat-messages');
        if (box) box.innerHTML = '<div class="communications-empty" role="status">در حال دریافت پیام‌ها…</div>';
        if (window.WebStudio?.enabled() && !isManager() && !Storage.getCurrentUser()?.advisor) {
            if (status) status.textContent = 'هنوز به مشاوری متصل نیستی.';
            if (box) box.innerHTML = '<div class="communications-empty"><p>این‌جا جای گفت‌وگو با مشاور توست.</p><small>نام کاربری خودت را به مشاورت بده تا تو را به فهرست دانش‌آموزانش اضافه کند.</small><button class="studio-button secondary" type="button" onclick="App.navigate(\'profile\')">مشاهده پروفایل</button></div>';
            return;
        }
        if (isManager()) {
            if (!selectedStudent) { adminMessages = []; chatBlocked = null; if (status) status.textContent = 'برای شروع گفت‌وگو یک دانش‌آموز انتخاب کنید.'; renderMessages([]); syncChatState(); return; }
            if (status) status.textContent = 'در حال دریافت گفت‌وگو…';
            try {
                const response = await fetch(`/api/chat?username=${encodeURIComponent(selectedStudent)}`, { credentials: 'same-origin' });
                const payload = await response.json(); if (!response.ok) throw new Error(payload.error || 'دریافت پیام‌ها انجام نشد.');
                if (requestId !== chatRequest) return;
                chatReady = true;
                adminMessages = Array.isArray(payload.messages) ? payload.messages : []; chatBlocked = payload.blocked || null;
                const student = Storage.getUsers().find(user => user.username === selectedStudent);
                if (status) status.textContent = `گفت‌وگوی خصوصی با ${student?.name || selectedStudent}`; renderMessages(adminMessages); syncChatState();
            } catch (error) { if (requestId === chatRequest) showChatError(status); }
        } else {
            try {
                const response = await fetch('/api/chat', { credentials: 'same-origin' }); const payload = await response.json(); if (!response.ok) throw new Error(payload.error);
                if (requestId !== chatRequest) return;
                chatReady = true;
                const messages = Array.isArray(payload.messages) ? payload.messages : []; chatBlocked = payload.blocked || null; if (status) status.textContent = 'گفت‌وگوی خصوصی شما با مشاور'; renderMessages(messages); syncChatState();
                Storage.set('chat_last_read', new Date().toISOString()); document.getElementById('header-chat-dot')?.classList.add('hidden');
            } catch (error) { if (requestId === chatRequest) showChatError(status); }
        }
    }

    function showChatError(status) {
        chatReady = false; syncChatState();
        if (status) status.textContent = 'پیام‌ها دریافت نشدند؛ اتصال اینترنت را بررسی کنید.';
        const box = document.getElementById('advisor-chat-messages');
        if (box) box.innerHTML = '<div class="communications-empty"><p>ارتباط برقرار نشد.</p><button type="button" class="studio-button secondary" onclick="Communications.switchTab(\'chat\')">تلاش دوباره</button></div>';
    }

    function renderMessages(messages) {
        const box = document.getElementById('advisor-chat-messages'); if (!box) return;
        const viewer = isManager() ? 'advisor' : 'student';
        box.innerHTML = messages.map(message => `<article class="advisor-message ${message.sender === viewer ? 'mine' : 'theirs'}"><strong>${esc(message.senderName || (message.sender === 'advisor' ? 'مشاور' : 'دانش‌آموز'))}</strong><p>${esc(message.text)}</p><div class="advisor-message-meta"><time>${new Date(message.createdAt).toLocaleString('fa-IR')}</time>${message.sender !== viewer ? `<button type="button" onclick="Communications.reportMessage('${esc(message.id)}')" aria-label="گزارش پیام"><span class="material-symbols-outlined" aria-hidden="true">flag</span> گزارش</button>` : ''}</div></article>`).join('') || '<div class="communications-empty"><span class="material-symbols-outlined" aria-hidden="true">chat_bubble</span><p>هنوز پیامی ثبت نشده است؛ اولین پیام را ارسال کنید.</p></div>';
        box.scrollTop = box.scrollHeight;
        box.querySelectorAll('.advisor-message').forEach((node,index)=>{
            const message=messages[index];
            const person=message.sender===viewer ? Storage.getCurrentUser() : isManager() ? Storage.getUsers().find(u=>u.username===selectedStudent) : Storage.getCurrentUser()?.advisor;
            if(!person || (message.senderUsername && message.senderUsername!==person.username))return;
            const avatar=document.createElement('span');avatar.className='community-mini';node.prepend(avatar);window.Community?.bind(avatar,person);
        });
    }

    async function sendMessage() {
        if (sending || !chatReady || chatBlocked) return;
        const recipient = selectedStudent, requestId = chatRequest;
        const input = document.getElementById('advisor-chat-input'), button = document.getElementById('advisor-chat-send'), text = input?.value.trim();
        if (!text) return Utils.showToast('متن پیام را وارد کنید.', 'warning');
        if (isManager() && !selectedStudent) return Utils.showToast('ابتدا دانش‌آموز را انتخاب کنید.', 'warning');
        if (button) button.disabled = true;
        sending = true;
        syncChatState();
        try {
            const response = await fetch('/api/chat', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: isManager() ? selectedStudent : undefined, text }) });
            const payload = await response.json(); if (!response.ok) throw new Error(payload.error || 'ارسال پیام انجام نشد.');
            if (requestId !== chatRequest || recipient !== selectedStudent) return;
            if (isManager()) adminMessages = payload.messages;
            renderMessages(payload.messages);
            input.value = ''; Utils.showToast('پیام ذخیره شد.', 'success');
        } catch (error) { Utils.showToast(error.message, 'error'); }
        finally { sending = false; syncChatState(); if (requestId === chatRequest) input?.focus(); }
    }

    function syncChatState() {
        const input = document.getElementById('advisor-chat-input'), send = document.getElementById('advisor-chat-send'), block = document.getElementById('advisor-chat-block'), status = document.getElementById('advisor-chat-status');
        if (input) input.disabled = !chatReady || Boolean(chatBlocked) || sending;
        if (send) send.disabled = !chatReady || Boolean(chatBlocked) || sending;
        if (block) block.disabled = !chatReady || sending;
        const picker = document.getElementById('advisor-student-select'); if (picker) picker.disabled = sending;
        if (block) block.textContent = chatBlocked ? 'ادامه گفت‌وگو' : 'توقف گفت‌وگو';
        if (chatBlocked && status) status.textContent = 'این گفت‌وگو متوقف شده است.';
    }

    async function reportMessage(messageId) {
        if (!window.confirm('این پیام به‌عنوان محتوای نامناسب گزارش شود؟')) return;
        try {
            const response = await fetch('/api/chat', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: isManager() ? selectedStudent : undefined, action: 'report', messageId, reason: 'محتوای نامناسب یا نقض حریم خصوصی' }) });
            const payload = await response.json(); if (!response.ok) throw new Error(payload.error || 'ثبت گزارش انجام نشد.');
            Utils.showToast('گزارش شما برای بررسی ثبت شد.', 'success');
        } catch (error) { Utils.showToast(error.message, 'error'); }
    }

    async function toggleBlock() {
        if (isManager() && !selectedStudent) return Utils.showToast('ابتدا دانش‌آموز را انتخاب کنید.', 'warning');
        const next = !chatBlocked;
        if (next && !window.confirm('ارسال پیام در این گفت‌وگو متوقف شود؟')) return;
        try {
            const response = await fetch('/api/chat', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: isManager() ? selectedStudent : undefined, action: 'block', blocked: next }) });
            const payload = await response.json(); if (!response.ok) throw new Error(payload.error || 'تغییر وضعیت گفت‌وگو انجام نشد.');
            chatBlocked = payload.blocked || null; syncChatState(); Utils.showToast(next ? 'گفت‌وگو متوقف شد.' : 'گفت‌وگو دوباره فعال شد.', 'success');
        } catch (error) { Utils.showToast(error.message, 'error'); }
    }

    function updateUnread() {
        const dot = document.getElementById('header-chat-dot'); if (!dot || isManager()) return dot?.classList.add('hidden');
        const lastRead = new Date(Storage.get('chat_last_read', 0)).getTime();
        const unread = (Storage.get('advisor_chat', []) || []).some(message => message.sender === 'advisor' && new Date(message.createdAt).getTime() > lastRead);
        dot.classList.toggle('hidden', !unread);
    }

    function renderNotes() {
        const box = document.getElementById('quick-notes-list'); if (!box) return;
        const notes = Array.isArray(Storage.get('quick_notes', [])) ? Storage.get('quick_notes', []) : [];
        box.innerHTML = notes.slice().reverse().map(note => `<article class="quick-note-item"><p>${esc(note.text)}</p><div><time>${new Date(note.createdAt).toLocaleString('fa-IR')}</time><button type="button" class="admin-icon-button" aria-label="حذف یادداشت" onclick="Communications.removeNote('${esc(note.id)}')"><span class="material-symbols-outlined" aria-hidden="true">delete</span></button></div></article>`).join('') || '<div class="communications-empty"><span class="material-symbols-outlined" aria-hidden="true">note_stack</span><p>هنوز یادداشتی ندارید.</p></div>';
    }

    function addNote() {
        const input = document.getElementById('quick-note-input'), text = input?.value.trim(); if (!text) return;
        const notes = Array.isArray(Storage.get('quick_notes', [])) ? Storage.get('quick_notes', []) : [];
        notes.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, text: text.slice(0, 500), createdAt: new Date().toISOString() });
        Storage.set('quick_notes', notes); input.value = ''; renderNotes(); Utils.showToast('یادداشت در دیتابیس ذخیره شد.', 'success');
    }

    function removeNote(id) {
        if (!window.confirm('این یادداشت حذف شود؟')) return;
        Storage.set('quick_notes', (Storage.get('quick_notes', []) || []).filter(note => note.id !== id)); renderNotes(); Utils.showToast('یادداشت حذف شد.', 'info');
    }

    return { init, open, close, showPage, switchTab, selectStudent, sendMessage, reportMessage, toggleBlock, addNote, removeNote };
})();
window.Communications = Communications;
