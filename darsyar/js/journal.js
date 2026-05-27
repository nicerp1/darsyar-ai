// ============ BULLET JOURNAL SYSTEM ============
const Journal = {
    currentView: 'daily', // daily, weekly, monthly
    currentDate: new Date(),
    entries: JSON.parse(localStorage.getItem('journalEntries') || '{}'),
    habits: JSON.parse(localStorage.getItem('journalHabits') || '["مطالعه", "ورزش", "آب کافی", "خواب به موقع", "مرور دروس"]'),
    stickers: ['📚', '✅', '⭐', '💪', '🎯', '🔥', '💡', '🎉', '😊', '📝', '☕', '🌟', '❤️', '🎵', '🌈', '🍀'],
    moodEmojis: ['😊', '😐', '😴', '😤', '🤩', '😢', '🥰', '😎'],
    
    init() {
        this.render();
        this.bindEvents();
    },
    
    bindEvents() {
        // تغییر نما
        document.querySelectorAll('.journal-view-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.currentView = e.target.dataset.view;
                this.render();
            });
        });
        
        // تغییر تاریخ
        document.getElementById('journalPrevDay')?.addEventListener('click', () => this.changeDate(-1));
        document.getElementById('journalNextDay')?.addEventListener('click', () => this.changeDate(1));
        document.getElementById('journalPrevWeek')?.addEventListener('click', () => this.changeDate(-7));
        document.getElementById('journalNextWeek')?.addEventListener('click', () => this.changeDate(7));
        document.getElementById('journalPrevMonth')?.addEventListener('click', () => this.changeDate(-30));
        document.getElementById('journalNextMonth')?.addEventListener('click', () => this.changeDate(30));
    },
    
    changeDate(days) {
        this.currentDate.setDate(this.currentDate.getDate() + days);
        this.render();
    },
    
    getDateKey() {
        const d = this.currentDate;
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    },
    
    getWeekKey() {
        const d = new Date(this.currentDate);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(d.setDate(diff));
        return `${monday.getFullYear()}-W${Math.ceil(monday.getDate() / 7)}`;
    },
    
    getMonthKey() {
        const d = this.currentDate;
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    },
    
    getEntry(key) {
        return this.entries[key] || {
            notes: '',
            mood: '',
            gratitude: '',
            todos: [],
            habits: {},
            stickers: []
        };
    },
    
    saveEntry(key, data) {
        this.entries[key] = data;
        localStorage.setItem('journalEntries', JSON.stringify(this.entries));
    },
    
    render() {
        const container = document.getElementById('journalContainer');
        if (!container) return;
        
        switch(this.currentView) {
            case 'daily': this.renderDaily(container); break;
            case 'weekly': this.renderWeekly(container); break;
            case 'monthly': this.renderMonthly(container); break;
        }
    },
    
    // ============ نمای روزانه ============
    renderDaily(container) {
        const dateKey = this.getDateKey();
        const entry = this.getEntry(dateKey);
        const dayName = this.currentDate.toLocaleDateString('fa-IR', { weekday: 'long' });
        const dateStr = this.currentDate.toLocaleDateString('fa-IR');
        
        container.innerHTML = `
            <div class="journal-toolbar">
                <div class="journal-nav">
                    <button class="btn btn-sm" id="journalPrevDay">◀ روز قبل</button>
                    <button class="btn btn-sm" onclick="Journal.currentDate = new Date(); Journal.render();">📅 امروز</button>
                    <button class="btn btn-sm" id="journalNextDay">روز بعد ▶</button>
                </div>
                <div class="journal-view-btns">
                    <button class="btn btn-sm journal-view-btn active" data-view="daily">📆 روزانه</button>
                    <button class="btn btn-sm journal-view-btn" data-view="weekly">📊 هفتگی</button>
                    <button class="btn btn-sm journal-view-btn" data-view="monthly">📅 ماهانه</button>
                </div>
            </div>
            
            <div class="journal-daily-header">
                <h2>${dayName} - ${dateStr}</h2>
            </div>
            
            <div class="journal-grid-2">
                <!-- بخش حال و هوا -->
                <div class="card">
                    <h4>😊 حال و هوای امروز</h4>
                    <div class="mood-selector">
                        ${this.moodEmojis.map(emoji => `
                            <span class="mood-emoji ${entry.mood === emoji ? 'selected' : ''}" 
                                  onclick="Journal.setMood('${dateKey}', '${emoji}')">
                                ${emoji}
                            </span>
                        `).join('')}
                    </div>
                </div>
                
                <!-- بخش قدردانی -->
                <div class="card">
                    <h4>🙏 امروز بابت چی شکرگزاری؟</h4>
                    <textarea class="journal-input" 
                              onchange="Journal.saveGratitude('${dateKey}', this.value)"
                              placeholder="امروز بابت... ممنونم 🙏">${entry.gratitude || ''}</textarea>
                </div>
            </div>
            
            <!-- TODO List -->
            <div class="card">
                <h4>✅ کارهای امروز</h4>
                <div class="todo-list" id="todoList">
                    ${(entry.todos || []).map((todo, i) => `
                        <div class="todo-item ${todo.done ? 'done' : ''}">
                            <input type="checkbox" ${todo.done ? 'checked' : ''} 
                                   onchange="Journal.toggleTodo('${dateKey}', ${i})">
                            <span>${todo.text}</span>
                            <button class="btn btn-sm btn-danger" onclick="Journal.removeTodo('${dateKey}', ${i})">✕</button>
                        </div>
                    `).join('')}
                </div>
                <div class="add-todo">
                    <input type="text" id="newTodoInput" placeholder="کار جدید اضافه کن..." 
                           onkeypress="if(event.key==='Enter') Journal.addTodo('${dateKey}')">
                    <button class="btn btn-primary btn-sm" onclick="Journal.addTodo('${dateKey}')">➕</button>
                </div>
            </div>
            
            <!-- یادداشت‌های روزانه -->
            <div class="card">
                <h4>📝 یادداشت‌های امروز</h4>
                <textarea class="journal-input journal-notes" 
                          onchange="Journal.saveNotes('${dateKey}', this.value)"
                          placeholder="امروز چه اتفاقی افتاد؟ چی یاد گرفتی؟">${entry.notes || ''}</textarea>
            </div>
            
            <!-- استیکرها -->
            <div class="card">
                <h4>🎨 استیکرها</h4>
                <div class="sticker-picker">
                    ${this.stickers.map(sticker => `
                        <span class="sticker ${(entry.stickers || []).includes(sticker) ? 'selected' : ''}"
                              onclick="Journal.toggleSticker('${dateKey}', '${sticker}')">
                            ${sticker}
                        </span>
                    `).join('')}
                </div>
            </div>
            
            <!-- ردیاب عادت‌ها -->
            <div class="card">
                <h4>📊 ردیاب عادت‌های روزانه</h4>
                <div class="habit-tracker">
                    ${this.habits.map(habit => `
                        <div class="habit-row">
                            <span class="habit-name">${habit}</span>
                            <div class="habit-checkboxes">
                                ${[0,1,2,3,4,5,6].map(day => {
                                    const d = new Date(this.currentDate);
                                    d.setDate(d.getDate() - (6 - day));
                                    const dk = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
                                    const checked = this.entries[dk]?.habits?.[habit] || false;
                                    const isToday = dk === dateKey;
                                    return `<span class="habit-day ${isToday ? 'today' : ''} ${checked ? 'checked' : ''}"
                                                onclick="${isToday ? `Journal.toggleHabit('${dk}', '${habit}')` : ''}"
                                                title="${d.toLocaleDateString('fa-IR')}">
                                                ${checked ? '✅' : '⭕'}
                                            </span>`;
                                }).join('')}
                            </div>
                        </div>
                    `).join('')}
                </div>
                <button class="btn btn-sm" onclick="Journal.addHabit()">➕ افزودن عادت جدید</button>
            </div>
            
            <!-- دکمه پرینت -->
            <button class="btn btn-gold" onclick="Journal.printView()">🖨️ پرینت این صفحه</button>
        `;
        
        this.bindEvents();
    },
    
    // ============ نمای هفتگی ============
    renderWeekly(container) {
        const weekStart = this.getWeekStart();
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        
        let daysHtml = '';
        const days = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(weekStart);
            d.setDate(d.getDate() + i);
            const dk = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
            const entry = this.getEntry(dk);
            days.push(d);
            
            daysHtml += `
                <div class="week-day-card ${dk === this.getDateKey() ? 'today' : ''}">
                    <div class="week-day-header">
                        ${d.toLocaleDateString('fa-IR', { weekday: 'short' })}
                        <br>${d.toLocaleDateString('fa-IR', { day: 'numeric', month: 'short' })}
                    </div>
                    <div class="week-day-mood">${entry.mood || '➖'}</div>
                    <div class="week-day-notes">${(entry.notes || '').substring(0, 50)}${entry.notes?.length > 50 ? '...' : ''}</div>
                    <div class="week-day-todos">
                        ${(entry.todos || []).filter(t => t.done).length}/${(entry.todos || []).length} انجام شده
                    </div>
                </div>
            `;
        }
        
        container.innerHTML = `
            <div class="journal-toolbar">
                <div class="journal-nav">
                    <button class="btn btn-sm" id="journalPrevWeek">◀ هفته قبل</button>
                    <button class="btn btn-sm" onclick="Journal.currentDate = new Date(); Journal.render();">📅 امروز</button>
                    <button class="btn btn-sm" id="journalNextWeek">هفته بعد ▶</button>
                </div>
                <div class="journal-view-btns">
                    <button class="btn btn-sm journal-view-btn" data-view="daily">📆 روزانه</button>
                    <button class="btn btn-sm journal-view-btn active" data-view="weekly">📊 هفتگی</button>
                    <button class="btn btn-sm journal-view-btn" data-view="monthly">📅 ماهانه</button>
                </div>
            </div>
            
            <div class="journal-weekly-header">
                <h3>📊 نمای هفتگی</h3>
                <p>${weekStart.toLocaleDateString('fa-IR')} تا ${weekEnd.toLocaleDateString('fa-IR')}</p>
            </div>
            
            <div class="week-days-grid">
                ${daysHtml}
            </div>
            
            <!-- نمودار خلق و خوی هفتگی -->
            <div class="card">
                <h4>📈 نمودار خلق و خوی هفتگی</h4>
                <div class="mood-chart" id="moodChart"></div>
            </div>
            
            <button class="btn btn-gold" onclick="Journal.printView()">🖨️ پرینت این صفحه</button>
        `;
        
        this.renderMoodChart(days);
        this.bindEvents();
    },
    
    // ============ نمای ماهانه ============
    renderMonthly(container) {
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startingDay = firstDay.getDay() || 7; // تبدیل یکشنبه به ۷
        
        let calendarHtml = '<div class="month-calendar">';
        
        // هدر روزهای هفته
        ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'].forEach(day => {
            calendarHtml += `<div class="month-day-header">${day}</div>`;
        });
        
        // خونه‌های خالی قبل از اول ماه
        for (let i = 1; i < startingDay; i++) {
            calendarHtml += '<div class="month-day empty"></div>';
        }
        
        // روزهای ماه
        for (let day = 1; day <= daysInMonth; day++) {
            const d = new Date(year, month, day);
            const dk = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
            const entry = this.getEntry(dk);
            const isToday = dk === this.getDateKey();
            
            calendarHtml += `
                <div class="month-day ${isToday ? 'today' : ''}" onclick="Journal.goToDay('${dk}')">
                    <span class="month-day-num">${day}</span>
                    <span class="month-day-mood">${entry.mood || ''}</span>
                    ${(entry.todos || []).length > 0 ? `<span class="month-day-dot"></span>` : ''}
                </div>
            `;
        }
        
        calendarHtml += '</div>';
        
        container.innerHTML = `
            <div class="journal-toolbar">
                <div class="journal-nav">
                    <button class="btn btn-sm" id="journalPrevMonth">◀ ماه قبل</button>
                    <button class="btn btn-sm" onclick="Journal.currentDate = new Date(); Journal.render();">📅 امروز</button>
                    <button class="btn btn-sm" id="journalNextMonth">ماه بعد ▶</button>
                </div>
                <div class="journal-view-btns">
                    <button class="btn btn-sm journal-view-btn" data-view="daily">📆 روزانه</button>
                    <button class="btn btn-sm journal-view-btn" data-view="weekly">📊 هفتگی</button>
                    <button class="btn btn-sm journal-view-btn active" data-view="monthly">📅 ماهانه</button>
                </div>
            </div>
            
            <div class="journal-monthly-header">
                <h3>📅 ${this.currentDate.toLocaleDateString('fa-IR', { month: 'long', year: 'numeric' })}</h3>
            </div>
            
            <div class="card">
                ${calendarHtml}
            </div>
            
            <button class="btn btn-gold" onclick="Journal.printView()">🖨️ پرینت این صفحه</button>
        `;
        
        this.bindEvents();
    },
    
    // ============ توابع کمکی ============
    getWeekStart() {
        const d = new Date(this.currentDate);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        return new Date(d.setDate(diff));
    },
    
    goToDay(dateKey) {
        const [year, month, day] = dateKey.split('-');
        this.currentDate = new Date(year, month - 1, day);
        this.currentView = 'daily';
        this.render();
    },
    
    setMood(dateKey, mood) {
        const entry = this.getEntry(dateKey);
        entry.mood = mood;
        this.saveEntry(dateKey, entry);
        this.render();
    },
    
    saveGratitude(dateKey, text) {
        const entry = this.getEntry(dateKey);
        entry.gratitude = text;
        this.saveEntry(dateKey, entry);
    },
    
    saveNotes(dateKey, text) {
        const entry = this.getEntry(dateKey);
        entry.notes = text;
        this.saveEntry(dateKey, entry);
    },
    
    addTodo(dateKey) {
        const input = document.getElementById('newTodoInput');
        if (!input || !input.value.trim()) return;
        
        const entry = this.getEntry(dateKey);
        if (!entry.todos) entry.todos = [];
        entry.todos.push({ text: input.value.trim(), done: false });
        this.saveEntry(dateKey, entry);
        this.render();
    },
    
    toggleTodo(dateKey, index) {
        const entry = this.getEntry(dateKey);
        if (entry.todos && entry.todos[index]) {
            entry.todos[index].done = !entry.todos[index].done;
            this.saveEntry(dateKey, entry);
            this.render();
        }
    },
    
    removeTodo(dateKey, index) {
        const entry = this.getEntry(dateKey);
        if (entry.todos) {
            entry.todos.splice(index, 1);
            this.saveEntry(dateKey, entry);
            this.render();
        }
    },
    
    toggleSticker(dateKey, sticker) {
        const entry = this.getEntry(dateKey);
        if (!entry.stickers) entry.stickers = [];
        const index = entry.stickers.indexOf(sticker);
        if (index > -1) {
            entry.stickers.splice(index, 1);
        } else {
            entry.stickers.push(sticker);
        }
        this.saveEntry(dateKey, entry);
        this.render();
    },
    
    toggleHabit(dateKey, habit) {
        const entry = this.getEntry(dateKey);
        if (!entry.habits) entry.habits = {};
        entry.habits[habit] = !entry.habits[habit];
        this.saveEntry(dateKey, entry);
        this.render();
    },
    
    addHabit() {
        const habit = prompt('عادت جدید رو وارد کن:');
        if (habit && habit.trim() && !this.habits.includes(habit.trim())) {
            this.habits.push(habit.trim());
            localStorage.setItem('journalHabits', JSON.stringify(this.habits));
            this.render();
        }
    },
    
    renderMoodChart(days) {
        const chartDiv = document.getElementById('moodChart');
        if (!chartDiv) return;
        
        const moodValues = { '😊': 5, '🤩': 6, '🥰': 7, '😎': 5, '😐': 3, '😴': 2, '😢': 1, '😤': 0 };
        
        let html = '<div class="mood-chart-bars">';
        days.forEach(d => {
            const dk = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
            const entry = this.getEntry(dk);
            const mood = entry.mood || '😐';
            const value = moodValues[mood] || 3;
            const height = (value / 7) * 100;
            
            html += `
                <div class="mood-bar-col">
                    <div class="mood-bar" style="height:${height}%;background:${this.getMoodColor(value)};"></div>
                    <span class="mood-bar-emoji">${mood}</span>
                    <span class="mood-bar-day">${d.toLocaleDateString('fa-IR', { weekday: 'short' })}</span>
                </div>
            `;
        });
        html += '</div>';
        
        chartDiv.innerHTML = html;
    },
    
    getMoodColor(value) {
        if (value >= 6) return '#00b894';
        if (value >= 4) return '#fdcb6e';
        if (value >= 2) return '#e17055';
        return '#d63031';
    },
    
    printView() {
        window.print();
    }
};