// ============ DATA STORAGE ============
const Storage = {
    USERS: {
        admin: { password: '1234', role: 'admin', name: 'مدیر' },
        user: { password: '1234', role: 'user', name: 'کاربر' }
    },
    
    currentUser: null,
    studySessions: JSON.parse(localStorage.getItem('studySessions') || '[]'),
    exams: JSON.parse(localStorage.getItem('exams') || '[]'),
    weeklySchedule: JSON.parse(localStorage.getItem('weeklySchedule') || '{}'),
    articles: JSON.parse(localStorage.getItem('articles') || '[]'),
    examResults: JSON.parse(localStorage.getItem('examResults') || '[]'),
    userProgress: JSON.parse(localStorage.getItem('userProgress') || '{"xp":0,"level":1,"achievements":[],"dailyChallenges":[],"lastChallengeDate":""}'),
    
    save(key, data) {
        localStorage.setItem(key, JSON.stringify(data));
        this[key] = data;
    },
    
    get(key) {
        return this[key];
    },
    
    updateProgress() {
        this.save('userProgress', this.userProgress);
    },
    
    updateStudySessions() {
        this.save('studySessions', this.studySessions);
    },
    
    updateExamResults() {
        this.save('examResults', this.examResults);
    },
    
    updateExams() {
        this.save('exams', this.exams);
    },
    
    updateSchedule() {
        this.save('weeklySchedule', this.weeklySchedule);
    },
    
    updateArticles() {
        this.save('articles', this.articles);
    }
};