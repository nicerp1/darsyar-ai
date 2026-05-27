// ============ AUTH SYSTEM - FIXED ============
const Auth = {
    login: function(username, password) {
        console.log('LOGIN called');
        
        if (!username || !password) {
            console.log('Empty fields');
            return false;
        }
        
        // چک localStorage برای admin
        if (typeof Storage !== 'undefined' && Storage.USERS && Storage.USERS[username] && Storage.USERS[username].password === password) {
            Storage.currentUser = { username: username, name: Storage.USERS[username].name, role: Storage.USERS[username].role };
            document.getElementById('loginOverlay').classList.add('hidden');
            document.getElementById('appContainer').classList.add('active');
            document.getElementById('userDisplayName').textContent = Storage.currentUser.name;
            if (typeof App !== 'undefined') App.init();
            return true;
        }
        
        // چک کاربرای ثبت‌نامی
        try {
            var savedUsers = JSON.parse(localStorage.getItem('serverUsers') || '{}');
            if (savedUsers[username] && savedUsers[username].password === password) {
                Storage.currentUser = { username: username, name: savedUsers[username].name, role: 'user' };
                document.getElementById('loginOverlay').classList.add('hidden');
                document.getElementById('appContainer').classList.add('active');
                document.getElementById('userDisplayName').textContent = Storage.currentUser.name;
                if (typeof App !== 'undefined') App.init();
                return true;
            }
        } catch(e) {
            console.error('Error:', e);
        }
        
        return false;
    },
    
    register: function(username, email, password, passwordConfirm, name) {
        console.log('REGISTER called');
        
        if (!username || !email || !password || !passwordConfirm) return false;
        if (password !== passwordConfirm) return false;
        
        try {
            var savedUsers = JSON.parse(localStorage.getItem('serverUsers') || '{}');
            savedUsers[username] = { password: password, email: email, name: name || username, role: 'user' };
            localStorage.setItem('serverUsers', JSON.stringify(savedUsers));
            
            Storage.currentUser = { username: username, name: name || username, role: 'user' };
            document.getElementById('loginOverlay').classList.add('hidden');
            document.getElementById('appContainer').classList.add('active');
            document.getElementById('userDisplayName').textContent = Storage.currentUser.name;
            if (typeof App !== 'undefined') App.init();
            return true;
        } catch(e) {
            console.error('Error:', e);
            return false;
        }
    },
    
    logout: function() {
        Storage.currentUser = null;
        document.getElementById('loginOverlay').classList.remove('hidden');
        document.getElementById('appContainer').classList.remove('active');
    },
    
    showRegisterForm: function() {
        document.getElementById('loginForm').style.display = 'none';
        document.getElementById('registerForm').style.display = 'block';
    },
    
    showLoginForm: function() {
        document.getElementById('loginForm').style.display = 'block';
        document.getElementById('registerForm').style.display = 'none';
    }
};
