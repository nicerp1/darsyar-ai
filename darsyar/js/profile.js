// ============ PROFILE SYSTEM ============
const Profile = {
    show() {
        const user = Storage.currentUser;
        if (!user) return;
        
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal" style="max-width:450px;">
                <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
                <div style="text-align:center;margin-bottom:1.5rem;">
                    <div style="width:70px;height:70px;border-radius:50%;background:var(--primary);display:flex;align-items:center;justify-content:center;color:#fff;font-size:2rem;font-weight:700;margin:0 auto 1rem;">${(user.name || 'U')[0].toUpperCase()}</div>
                    <h3 style="margin:0;">${user.name}</h3>
                    <p style="color:var(--text-secondary);">${user.role === 'admin' ? 'مدیر' : 'کاربر'}</p>
                </div>
                
                <div class="input-group"><label>نام نمایشی</label><input type="text" id="profileName" value="${user.name}"></div>
                <div class="input-group"><label>رمز عبور جدید</label><input type="password" id="profilePassword" placeholder="در صورت عدم تغییر خالی بگذارید"></div>
                
                <button class="btn btn-primary" onclick="Profile.save()">💾 ذخیره تغییرات</button>
            </div>
        `;
        document.body.appendChild(modal);
        modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    },
    
    save() {
        const name = document.getElementById('profileName')?.value?.trim();
        const password = document.getElementById('profilePassword')?.value?.trim();
        const user = Storage.currentUser;
        
        if (name) {
            user.name = name;
            Storage.USERS[user.username].name = name;
            document.getElementById('userDisplayName').textContent = name;
        }
        if (password && password.length >= 4) {
            user.password = password;
            Storage.USERS[user.username].password = password;
        }
        
        localStorage.setItem('users', JSON.stringify(Storage.USERS));
        document.querySelector('.modal-overlay')?.remove();
        Utils.showToast('✅ تغییرات ذخیره شد');
    }
};