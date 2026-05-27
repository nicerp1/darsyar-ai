// ============ ADMIN PANEL PRO ============
const Admin = {
    currentTab: 'users',
    
    render() {
        const container = document.getElementById('section-admin');
        if (!container) return;
        
        container.innerHTML = `
            <div class="admin-panel">
                <div class="admin-header">
                    <h2>⚙️ پنل مدیریت</h2>
                </div>
                
                <div class="admin-tabs">
                    <button class="admin-tab ${this.currentTab === 'users' ? 'active' : ''}" data-tab="users">👥 کاربران</button>
                    <button class="admin-tab ${this.currentTab === 'articles' ? 'active' : ''}" data-tab="articles">📝 مقالات</button>
                    <button class="admin-tab ${this.currentTab === 'exams' ? 'active' : ''}" data-tab="exams">📋 آزمون‌ها</button>
                    <button class="admin-tab ${this.currentTab === 'settings' ? 'active' : ''}" data-tab="settings">⚙️ تنظیمات</button>
                </div>
                
                <div class="admin-content" id="adminTabContent">
                    ${this.getTabContent()}
                </div>
            </div>
        `;
        
        this.bindTabEvents();
    },
    
    bindTabEvents() {
        document.querySelectorAll('.admin-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.currentTab = e.target.dataset.tab;
                this.render();
            });
        });
    },
    
    getTabContent() {
        switch(this.currentTab) {
            case 'users': return this.renderUsers();
            case 'articles': return this.renderArticles();
            case 'exams': return this.renderExams();
            case 'settings': return this.renderSettings();
            default: return '';
        }
    },
    
    // ============ USERS ============
    renderUsers() {
        const users = Storage.USERS || {};
        
        return `
            <div class="card">
                <div class="card-header">
                    <span class="card-title">👥 مدیریت کاربران</span>
                    <button class="btn btn-primary btn-sm" id="addUserBtn">➕ کاربر جدید</button>
                </div>
                <div class="admin-table-wrapper">
                    <table class="admin-table">
                        <thead>
                            <tr><th>نام کاربری</th><th>نام</th><th>نقش</th><th>پیام‌ها</th><th>عملیات</th></tr>
                        </thead>
                        <tbody>
                            ${Object.entries(users).map(([username, data]) => `
                                <tr>
                                    <td><strong>${username}</strong></td>
                                    <td>${data.name}</td>
                                    <td><span class="badge ${data.role === 'admin' ? 'badge-admin' : 'badge-user'}">${data.role === 'admin' ? 'ادمین' : 'کاربر'}</span></td>
                                    <td>${data.role === 'admin' ? '∞' : '۱۰'} / ۱۰</td>
                                    <td class="admin-actions">
                                        ${username !== 'admin' ? `
                                            <button class="btn btn-sm" onclick="Admin.toggleUserRole('${username}')">🔄</button>
                                            <button class="btn btn-sm btn-danger" onclick="Admin.deleteUser('${username}')">🗑️</button>
                                        ` : '<span class="text-secondary">مدیر اصلی</span>'}
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
            <div class="card mt-2">
                <div class="card-header"><span class="card-title">➕ افزودن کاربر جدید</span></div>
                <div class="grid-2">
                    <div class="input-group"><label>نام کاربری</label><input type="text" id="newUsername" placeholder="مثلاً: ali"></div>
                    <div class="input-group"><label>نام نمایشی</label><input type="text" id="newName" placeholder="مثلاً: علی"></div>
                    <div class="input-group"><label>رمز عبور</label><input type="password" id="newPassword" placeholder="حداقل ۴ کاراکتر"></div>
                    <div class="input-group"><label>نقش</label><select id="newRole"><option value="user">کاربر</option><option value="admin">ادمین</option></select></div>
                </div>
                <button class="btn btn-primary mt-2" onclick="Admin.addUser()">💾 ذخیره کاربر</button>
            </div>
        `;
    },
    
    addUser() {
        const username = document.getElementById('newUsername')?.value.trim();
        const name = document.getElementById('newName')?.value.trim();
        const password = document.getElementById('newPassword')?.value.trim();
        const role = document.getElementById('newRole')?.value;
        
        if (!username || !name || !password) return Utils.showToast('⚠️ همه فیلدها را پر کن');
        if (Storage.USERS[username]) return Utils.showToast('⚠️ این نام کاربری وجود دارد');
        
        Storage.USERS[username] = { password, role, name };
        localStorage.setItem('users', JSON.stringify(Storage.USERS));
        
        this.render();
        Utils.showToast('✅ کاربر اضافه شد');
    },
    
    toggleUserRole(username) {
        if (username === 'admin') return;
        const user = Storage.USERS[username];
        if (!user) return;
        user.role = user.role === 'admin' ? 'user' : 'admin';
        localStorage.setItem('users', JSON.stringify(Storage.USERS));
        this.render();
        Utils.showToast('🔄 نقش تغییر کرد');
    },
    
    deleteUser(username) {
        if (username === 'admin') return Utils.showToast('⛔ نمی‌توانی ادمین اصلی را حذف کنی');
        if (!confirm(`کاربر "${username}" حذف شود؟`)) return;
        delete Storage.USERS[username];
        localStorage.setItem('users', JSON.stringify(Storage.USERS));
        this.render();
        Utils.showToast('🗑️ کاربر حذف شد');
    },
    
    // ============ ARTICLES ============
    renderArticles() {
        const articles = Storage.articles || [];
        
        return `
            <div class="card">
                <div class="card-header"><span class="card-title">📝 مدیریت مقالات (${articles.length})</span></div>
                ${articles.length === 0 ? '<p class="text-secondary text-center">هیچ مقاله‌ای نیست</p>' : 
                    articles.map((a, i) => `
                        <div class="admin-list-item">
                            <div class="admin-list-info">
                                <span>${a.cover || '📄'}</span>
                                <div><strong>${a.title}</strong><small class="text-secondary">${a.category || ''}</small></div>
                            </div>
                            <div class="admin-actions">
                                <button class="btn btn-sm" onclick="Admin.editArticle(${i})">✏️</button>
                                <button class="btn btn-sm btn-danger" onclick="Admin.deleteArticle(${i})">🗑️</button>
                            </div>
                        </div>
                    `).join('')
                }
            </div>
        `;
    },
    
    editArticle(index) {
        const a = Storage.articles[index];
        if (!a) return;
        
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal">
                <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
                <h3>✏️ ویرایش</h3>
                <div class="input-group"><label>عنوان</label><input type="text" id="editTitle" value="${a.title}"></div>
                <div class="input-group"><label>کاور</label><input type="text" id="editCover" value="${a.cover || ''}"></div>
                <div class="input-group"><label>دسته‌بندی</label><input type="text" id="editCategory" value="${a.category || ''}"></div>
                <div class="input-group"><label>خلاصه</label><textarea id="editExcerpt" rows="2">${a.excerpt || ''}</textarea></div>
                <div class="input-group"><label>متن</label><textarea id="editContent" rows="4">${a.content}</textarea></div>
                <button class="btn btn-primary" onclick="Admin.saveArticle(${index})">💾 ذخیره</button>
            </div>
        `;
        document.body.appendChild(modal);
        modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    },
    
    saveArticle(index) {
        Storage.articles[index].title = document.getElementById('editTitle')?.value || '';
        Storage.articles[index].cover = document.getElementById('editCover')?.value || '📄';
        Storage.articles[index].category = document.getElementById('editCategory')?.value || '';
        Storage.articles[index].excerpt = document.getElementById('editExcerpt')?.value || '';
        Storage.articles[index].content = document.getElementById('editContent')?.value || '';
        Storage.updateArticles();
        document.querySelector('.modal-overlay')?.remove();
        this.render();
        Utils.showToast('✅ ذخیره شد');
    },
    
    deleteArticle(index) {
        if (!confirm('حذف شود؟')) return;
        Storage.articles.splice(index, 1);
        Storage.updateArticles();
        this.render();
        Utils.showToast('🗑️ حذف شد');
    },
    
    // ============ EXAMS ============
    renderExams() {
        const exams = Storage.exams || [];
        
        return `
            <div class="card">
                <div class="card-header">
                    <span class="card-title">📋 آزمون‌ها (${exams.length})</span>
                    <button class="btn btn-primary btn-sm" onclick="Admin.showAddExam()">➕ جدید</button>
                </div>
                ${exams.length === 0 ? '<p class="text-secondary text-center">هیچ آزمونی نیست</p>' : 
                    exams.map((ex, i) => `
                        <div class="admin-list-item">
                            <div class="admin-list-info">
                                <span>📝</span>
                                <div><strong>${ex.title}</strong><small class="text-secondary">${ex.questions.length} سوال • ${ex.duration} دقیقه</small></div>
                            </div>
                            <div class="admin-actions">
                                <button class="btn btn-sm" onclick="Admin.editExam(${i})">✏️</button>
                                <button class="btn btn-sm btn-danger" onclick="Admin.deleteExamItem(${i})">🗑️</button>
                            </div>
                        </div>
                    `).join('')
                }
            </div>
        `;
    },
    
    showAddExam() {
        this.currentTab = 'exams-add';
        const container = document.getElementById('section-admin');
        container.innerHTML = `
            <div class="admin-panel">
                <button class="btn btn-sm mb-2" onclick="Admin.currentTab='exams'; Admin.render();">← برگشت</button>
                <div class="card">
                    <h3>➕ آزمون جدید</h3>
                    <div class="input-group"><label>عنوان</label><input type="text" id="examTitle"></div>
                    <div class="input-group"><label>مدت (دقیقه)</label><input type="number" id="examDuration" value="30"></div>
                    <div id="questionsContainer"></div>
                    <button class="btn btn-primary" onclick="Admin.addQuestionForm()">➕ سوال</button>
                    <button class="btn btn-success mt-2" onclick="Admin.saveNewExam()">💾 ذخیره</button>
                </div>
            </div>
        `;
    },
    
    addQuestionForm() {
        const container = document.getElementById('questionsContainer');
        if (!container) return;
        const div = document.createElement('div');
        div.className = 'question-form-card';
        div.innerHTML = `
            <div class="input-group"><label>سوال</label><input type="text" class="q-text"></div>
            ${[0,1,2,3].map(i => `<div class="input-group"><label>گزینه ${i+1}</label><input type="text" class="q-opt"></div>`).join('')}
            <div class="input-group"><label>گزینه صحیح (۱-۴)</label><input type="number" class="q-correct" value="1" min="1" max="4"></div>
            <button class="btn btn-sm btn-danger" onclick="this.parentElement.remove()">حذف</button>
        `;
        container.appendChild(div);
    },
    
    saveNewExam() {
        const title = document.getElementById('examTitle')?.value.trim();
        const duration = parseInt(document.getElementById('examDuration')?.value) || 30;
        if (!title) return Utils.showToast('⚠️ عنوان وارد کن');
        
        const questions = [];
        document.querySelectorAll('.question-form-card').forEach(form => {
            const text = form.querySelector('.q-text')?.value.trim();
            const opts = [...form.querySelectorAll('.q-opt')].map(i => i.value.trim());
            const correct = parseInt(form.querySelector('.q-correct')?.value) - 1;
            if (text && opts.every(o => o) && correct >= 0) {
                questions.push({ text, options: opts, correct });
            }
        });
        
        if (questions.length === 0) return Utils.showToast('⚠️ حداقل یک سوال');
        Storage.exams.push({ title, duration, questions, createdAt: new Date().toISOString() });
        Storage.updateExams();
        this.currentTab = 'exams';
        this.render();
        Utils.showToast('✅ ذخیره شد');
    },
    
    editExam(index) {
        const exam = Storage.exams[index];
        this.currentTab = 'exams-edit';
        document.getElementById('section-admin').innerHTML = `
            <div class="admin-panel">
                <button class="btn btn-sm mb-2" onclick="Admin.currentTab='exams'; Admin.render();">← برگشت</button>
                <div class="card">
                    <h3>✏️ ویرایش</h3>
                    <div class="input-group"><label>عنوان</label><input type="text" id="examTitle" value="${exam.title}"></div>
                    <div class="input-group"><label>مدت</label><input type="number" id="examDuration" value="${exam.duration}"></div>
                    <div id="questionsContainer">
                        ${exam.questions.map(q => `
                            <div class="question-form-card">
                                <div class="input-group"><label>سوال</label><input type="text" class="q-text" value="${q.text}"></div>
                                ${q.options.map((opt, i) => `<div class="input-group"><label>گزینه ${i+1}</label><input type="text" class="q-opt" value="${opt}"></div>`).join('')}
                                <div class="input-group"><label>صحیح (۱-۴)</label><input type="number" class="q-correct" value="${q.correct+1}"></div>
                                <button class="btn btn-sm btn-danger" onclick="this.parentElement.remove()">حذف</button>
                            </div>
                        `).join('')}
                    </div>
                    <button class="btn btn-primary" onclick="Admin.addQuestionForm()">➕ سوال</button>
                    <button class="btn btn-success mt-2" onclick="Admin.updateExam(${index})">💾 بروزرسانی</button>
                </div>
            </div>
        `;
    },
    
    updateExam(index) {
        const title = document.getElementById('examTitle')?.value.trim();
        const duration = parseInt(document.getElementById('examDuration')?.value) || 30;
        const questions = [];
        document.querySelectorAll('.question-form-card').forEach(form => {
            const text = form.querySelector('.q-text')?.value.trim();
            const opts = [...form.querySelectorAll('.q-opt')].map(i => i.value.trim());
            const correct = parseInt(form.querySelector('.q-correct')?.value) - 1;
            if (text && opts.every(o => o) && correct >= 0) questions.push({ text, options: opts, correct });
        });
        
        Storage.exams[index] = { ...Storage.exams[index], title, duration, questions };
        Storage.updateExams();
        this.currentTab = 'exams';
        this.render();
        Utils.showToast('✅ بروزرسانی شد');
    },
    
    deleteExamItem(index) {
        if (!confirm('حذف شود؟')) return;
        Storage.exams.splice(index, 1);
        Storage.updateExams();
        this.render();
        Utils.showToast('🗑️ حذف شد');
    },
    
    // ============ SETTINGS ============
    renderSettings() {
        return `
            <div class="card">
                <div class="card-header"><span class="card-title">⚙️ تنظیمات</span></div>
                <div class="input-group"><label>عنوان سایت</label><input type="text" id="siteTitle" value="${localStorage.getItem('siteTitle') || 'درسیار'}"></div>
                <div class="input-group"><label>رنگ اصلی</label><input type="color" id="siteColor" value="${localStorage.getItem('siteColor') || '#05319e'}"></div>
                <div class="input-group"><label>پومودورو (دقیقه)</label><input type="number" id="defaultPomodoro" value="${localStorage.getItem('pomodoroWork') || '25'}"></div>
                <div class="input-group"><label>سقف پیام روزانه</label><input type="number" id="dailyLimit" value="${localStorage.getItem('dailyMessageLimit') || '10'}"></div>
                <button class="btn btn-primary" onclick="Admin.saveSettings()">💾 ذخیره</button>
                <hr style="margin:2rem 0;">
                <button class="btn btn-danger" onclick="Admin.resetAll()">⚠️ ریست فکتوری</button>
            </div>
        `;
    },
    
    saveSettings() {
        localStorage.setItem('siteTitle', document.getElementById('siteTitle')?.value || 'درسیار');
        localStorage.setItem('siteColor', document.getElementById('siteColor')?.value || '#05319e');
        localStorage.setItem('pomodoroWork', document.getElementById('defaultPomodoro')?.value || '25');
        localStorage.setItem('dailyMessageLimit', document.getElementById('dailyLimit')?.value || '10');
        Utils.showToast('✅ ذخیره شد');
    },
    
    resetAll() {
        if (!confirm('همه داده‌ها پاک شود؟')) return;
        if (!confirm('مطمئنی؟')) return;
        localStorage.clear();
        location.reload();
    }
};