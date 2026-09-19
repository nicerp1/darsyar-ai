/** Header notes and private advisor/student chat. */
const Communications = (function () {
    let activeTab = 'chat', selectedStudent = '', adminMessages = [], initialized = false;
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
        init();
        if (window.DarsyarPlatform?.native) document.body.classList.add('communications-page-open');
        document.getElementById('communications-overlay')?.classList.add('open');
        const drawer = document.getElementById('communications-drawer'); drawer?.classList.add('open'); drawer?.setAttribute('aria-hidden', 'false');
        switchTab(tab);
        setTimeout(() => document.getElementById(tab === 'chat' ? 'advisor-chat-input' : 'quick-note-input')?.focus(), 80);
    }

    function close() {
        document.body.classList.remove('communications-page-open');
        document.getElementById('communications-overlay')?.classList.remove('open');
        const drawer = document.getElementById('communications-drawer'); drawer?.classList.remove('open'); drawer?.setAttribute('aria-hidden', 'true');
    }

    async function switchTab(tab) {
        activeTab = tab === 'notes' ? 'notes' : 'chat';
        document.getElementById('communications-chat-panel')?.classList.toggle('hidden', activeTab !== 'chat');
        document.getElementById('communications-notes-panel')?.classList.toggle('hidden', activeTab !== 'notes');
        ['chat', 'notes'].forEach(name => { const button = document.getElementById(`communications-tab-${name}`); button?.classList.toggle('active', activeTab === name); button?.setAttribute('aria-selected', String(activeTab === name)); });
        document.getElementById('communications-title').textContent = activeTab === 'chat' ? 'گفت‌وگو با مشاور' : 'یادداشت‌های من';
        if (activeTab === 'chat') await loadChat(); else renderNotes();
    }

    async function selectStudent(username) { selectedStudent = String(username || '').trim().toLowerCase(); await loadChat(); }

    async function loadChat() {
        const status = document.getElementById('advisor-chat-status');
        if (isManager()) {
            if (!selectedStudent) { adminMessages = []; if (status) status.textContent = 'برای شروع گفت‌وگو یک دانش‌آموز انتخاب کنید.'; renderMessages([]); return; }
            if (status) status.textContent = 'در حال دریافت گفت‌وگو…';
            try {
                const response = await fetch(`/api/chat?username=${encodeURIComponent(selectedStudent)}`, { credentials: 'same-origin' });
                const payload = await response.json(); if (!response.ok) throw new Error(payload.error || 'دریافت پیام‌ها انجام نشد.');
                adminMessages = Array.isArray(payload.messages) ? payload.messages : [];
                const student = Storage.getUsers().find(user => user.username === selectedStudent);
                if (status) status.textContent = `گفت‌وگوی خصوصی با ${student?.name || selectedStudent}`; renderMessages(adminMessages);
            } catch (error) { if (status) status.textContent = 'دریافت پیام‌ها ناموفق بود.'; Utils.showToast(error.message, 'error'); }
        } else {
            try {
                const response = await fetch('/api/chat', { credentials: 'same-origin' }); const payload = await response.json(); if (!response.ok) throw new Error(payload.error);
                const messages = Array.isArray(payload.messages) ? payload.messages : []; if (status) status.textContent = 'گفت‌وگوی خصوصی شما با مشاور'; renderMessages(messages);
                Storage.set('chat_last_read', new Date().toISOString()); document.getElementById('header-chat-dot')?.classList.add('hidden');
            } catch (error) { if (status) status.textContent = 'دریافت پیام‌ها ناموفق بود.'; Utils.showToast(error.message, 'error'); }
        }
    }

    function renderMessages(messages) {
        const box = document.getElementById('advisor-chat-messages'); if (!box) return;
        const viewer = isManager() ? 'advisor' : 'student';
        box.innerHTML = messages.map(message => `<article class="advisor-message ${message.sender === viewer ? 'mine' : 'theirs'}"><strong>${esc(message.senderName || (message.sender === 'advisor' ? 'مشاور' : 'دانش‌آموز'))}</strong><p>${esc(message.text)}</p><time>${new Date(message.createdAt).toLocaleString('fa-IR')}</time></article>`).join('') || '<div class="communications-empty"><span class="material-symbols-outlined" aria-hidden="true">chat_bubble</span><p>هنوز پیامی ثبت نشده است؛ اولین پیام را ارسال کنید.</p></div>';
        box.scrollTop = box.scrollHeight;
    }

    async function sendMessage() {
        const input = document.getElementById('advisor-chat-input'), button = document.getElementById('advisor-chat-send'), text = input?.value.trim();
        if (!text) return Utils.showToast('متن پیام را وارد کنید.', 'warning');
        if (isManager() && !selectedStudent) return Utils.showToast('ابتدا دانش‌آموز را انتخاب کنید.', 'warning');
        if (button) button.disabled = true;
        try {
            const response = await fetch('/api/chat', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: isManager() ? selectedStudent : undefined, text }) });
            const payload = await response.json(); if (!response.ok) throw new Error(payload.error || 'ارسال پیام انجام نشد.');
            if (isManager()) adminMessages = payload.messages;
            renderMessages(payload.messages);
            input.value = ''; Utils.showToast('پیام ذخیره شد.', 'success');
        } catch (error) { Utils.showToast(error.message, 'error'); }
        finally { if (button) button.disabled = false; input?.focus(); }
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

    return { init, open, close, switchTab, selectStudent, sendMessage, addNote, removeNote };
})();
window.Communications = Communications;
