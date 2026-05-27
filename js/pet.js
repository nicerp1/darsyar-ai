// ============ VIRTUAL STUDY PET ============
const StudyPet = {
    name: 'پاندی',
    type: 'panda',
    level: 1,
    happiness: 100,      // 0-100
    hunger: 0,          // 0-100 (100 = سیره)
    coins: 0,
    evolution: 'egg',   // egg -> baby -> teen -> adult -> master
    lastFed: Date.now(),
    lastInteraction: Date.now(),
    
    // حالت‌های روحی
    moods: {
        happy: { min: 70, emoji: '😊', text: 'خیلی خوشحالم که درس می‌خونی!' },
        neutral: { min: 40, emoji: '😐', text: 'آماده‌ای برای یه پومودورو؟' },
        sad: { min: 20, emoji: '😢', text: 'دلم برات تنگ شده... بیا درس بخونیم!' },
        hungry: { min: 10, emoji: '😋', text: 'گرسنمه! بهم غذا بده!' },
        angry: { min: 0, emoji: '😤', text: 'اگه درس نخونی، ناراحت می‌شم!' }
    },
    
    // شکلک‌های تکامل
    evolutions: {
        egg: { emoji: '🥚', name: 'تخم', requiredLevel: 0 },
        baby: { emoji: '🐣', name: 'جوجه', requiredLevel: 2 },
        teen: { emoji: '🐼', name: 'پاندای کوچولو', requiredLevel: 5 },
        adult: { emoji: '🐼✨', name: 'پاندای بالغ', requiredLevel: 10 },
        master: { emoji: '🐼👑', name: 'استاد پاندا', requiredLevel: 20 }
    },
    
    // دیالوگ‌های تصادفی
    dialogues: {
        startStudy: [
            'عالیه! بریم که درس بخونیم! 🚀',
            'من آماده‌ام! تو چطور؟ 💪',
            'این پومودورو رو با هم می‌ترکونیم! 🔥',
            'تمرکز کن، من مراقبتم! 👀'
        ],
        finishStudy: [
            'آفرین! فوق‌العاده بودی! 🎉',
            'بهت افتخار می‌کنم! 💖',
            'یه استراحت حسابی حقته! ☕',
            'پیشرفتت رو دوست دارم! 📈'
        ],
        idle: [
            'چرا درس نمی‌خونی؟ 🥺',
            'یه پومودورو بزنیم؟ 😊',
            'من اینجام تا کمکت کنم! 🌟',
            'آماده‌ای برای یه چالش جدید؟ 🎯'
        ],
        levelUp: [
            'داری بزرگ میشی! منم دارم بزرگتر میشم! 🎂',
            'با هم رشد می‌کنیم! 🌱',
            'حس می‌کنم قوی‌تر شدم! ⚡',
            'به تکامل نزدیک‌تر شدیم! 🦋'
        ],
        morning: [
            'صبح بخیر! آماده‌ای برای یه روز عالی؟ ☀️',
            'امروز رو با قدرت شروع کن! 💪',
            'برنامه امروزت چیه؟ 📋'
        ],
        night: [
            'شب بخیر! امروز عالی بودی! 🌙',
            'خسته نباشی، استراحت کن! 😴',
            'فردا هم منتظرتم! 💤'
        ]
    },
    
    init() {
        // لود کردن اطلاعات از localStorage
        const savedPet = JSON.parse(localStorage.getItem('studyPet') || '{}');
        if (savedPet.name) {
            Object.assign(this, savedPet);
        }
        
        this.render();
        this.startLifeCycle();
        this.bindEvents();
    },
    
    bindEvents() {
        // کلیک روی پت
        document.getElementById('petContainer').addEventListener('click', () => {
            this.interact();
        });
        
        // دکمه غذا دادن
        document.getElementById('feedPet').addEventListener('click', (e) => {
            e.stopPropagation();
            this.feed();
        });
        
        // دکمه تغییر نام
        document.getElementById('renamePet').addEventListener('click', (e) => {
            e.stopPropagation();
            this.rename();
        });
    },
    
    render() {
        const container = document.getElementById('petContainer');
        if (!container) return;
        
        const evolution = this.getCurrentEvolution();
        const mood = this.getMood();
        
        container.innerHTML = `
            <div class="pet-main">
                <div class="pet-character ${mood.emoji.includes('😢') || mood.emoji.includes('😤') ? 'pet-sad' : 'pet-happy'}">
                    <span class="pet-emoji">${evolution.emoji}</span>
                    <div class="pet-mood-bubble">${mood.emoji}</div>
                </div>
                <div class="pet-info">
                    <div class="pet-name">
                        <span>${this.name}</span>
                        <span class="pet-level">سطح ${this.level}</span>
                    </div>
                    <div class="pet-evolution">${evolution.name}</div>
                    <div class="pet-stats">
                        <div class="pet-stat">
                            <span>😊 شادی</span>
                            <div class="pet-stat-bar">
                                <div class="pet-stat-fill happiness" style="width:${this.happiness}%;"></div>
                            </div>
                        </div>
                        <div class="pet-stat">
                            <span>🍕 سیری</span>
                            <div class="pet-stat-bar">
                                <div class="pet-stat-fill hunger" style="width:${100 - this.hunger}%;"></div>
                            </div>
                        </div>
                    </div>
                    <div class="pet-coins">
                        🪙 ${this.coins} سکه
                    </div>
                </div>
            </div>
            <div class="pet-speech" id="petSpeech">
                ${this.getDialogue()}
            </div>
            <div class="pet-actions">
                <button class="btn btn-primary btn-sm" id="feedPet">
                    🍕 غذا بده (۵ سکه)
                </button>
                <button class="btn btn-sm" id="renamePet">
                    ✏️ تغییر نام
                </button>
            </div>
        `;
        
        // ری‌بایند ایونت‌ها
        this.bindEvents();
    },
    
    getCurrentEvolution() {
        for (const [key, evo] of Object.entries(this.evolutions).reverse()) {
            if (this.level >= evo.requiredLevel) {
                if (key !== this.evolution) {
                    this.evolution = key;
                    this.speak(this.randomDialogue('levelUp'));
                    this.save();
                }
                return evo;
            }
        }
        return this.evolutions.egg;
    },
    
    getMood() {
        if (this.hunger > 80) return this.moods.hungry;
        if (this.happiness < 20) return this.moods.angry;
        if (this.happiness < 40) return this.moods.sad;
        if (this.happiness < 70) return this.moods.neutral;
        return this.moods.happy;
    },
    
    getDialogue() {
        const hour = new Date().getHours();
        const timeSinceLastInteraction = Date.now() - this.lastInteraction;
        
        if (timeSinceLastInteraction > 3600000) { // بیشتر از ۱ ساعت
            return this.randomDialogue('idle');
        }
        if (hour < 12) return this.randomDialogue('morning');
        if (hour > 21) return this.randomDialogue('night');
        return this.randomDialogue('idle');
    },
    
    randomDialogue(type) {
        const dialogues = this.dialogues[type];
        return dialogues[Math.floor(Math.random() * dialogues.length)];
    },
    
    speak(message) {
        const speechBubble = document.getElementById('petSpeech');
        if (speechBubble) {
            speechBubble.textContent = message;
            speechBubble.classList.add('pet-speech-active');
            setTimeout(() => {
                speechBubble.classList.remove('pet-speech-active');
            }, 4000);
        }
    },
    
    interact() {
        this.lastInteraction = Date.now();
        this.happiness = Math.min(100, this.happiness + 2);
        
        const petChar = document.querySelector('.pet-character');
        if (petChar) {
            petChar.classList.add('pet-bounce');
            setTimeout(() => petChar.classList.remove('pet-bounce'), 500);
        }
        
        const dialogues = ['سلام! 👋', 'دوستت دارم! 💕', 'با هم موفق می‌شیم! 🤝', 'تو بهترینی! ⭐'];
        this.speak(dialogues[Math.floor(Math.random() * dialogues.length)]);
        
        this.save();
        this.render();
    },
    
    feed() {
        if (this.coins < 5) {
            this.speak('سکه کافی نداری! بیشتر درس بخون! 🪙');
            return;
        }
        
        this.coins -= 5;
        this.hunger = Math.max(0, this.hunger - 30);
        this.happiness = Math.min(100, this.happiness + 10);
        this.lastFed = Date.now();
        
        this.speak('ممنونم! خیلی خوشمزه بود! 🍕😋');
        
        this.save();
        this.render();
    },
    
    rename() {
        const newName = prompt('اسم جدید پتت رو وارد کن:', this.name);
        if (newName && newName.trim()) {
            this.name = newName.trim();
            this.speak(`حالا اسم من ${this.name} هست! 😍`);
            this.save();
            this.render();
        }
    },
    
    addCoins(amount) {
        this.coins += amount;
        this.speak(`آفرین! +${amount} سکه گرفتی! 🪙`);
        this.save();
        this.render();
    },
    
    onStudyStart() {
        this.happiness = Math.min(100, this.happiness + 5);
        this.speak(this.randomDialogue('startStudy'));
        this.save();
        this.render();
    },
    
    onStudyFinish() {
        this.happiness = Math.min(100, this.happiness + 10);
        this.hunger = Math.min(100, this.hunger + 15);
        this.addCoins(10);
        this.speak(this.randomDialogue('finishStudy'));
        this.save();
        this.render();
    },
    
    onExamComplete(score) {
        const coins = Math.floor(score / 10) + 5;
        this.happiness = Math.min(100, this.happiness + 15);
        this.addCoins(coins);
        
        if (score >= 80) {
            this.speak(`وای! ${score}٪ گرفتی! عالی بود! 🎉`);
        } else if (score >= 50) {
            this.speak(`بدک نبود! ${score}٪. دفعه بعد بهتر میشی! 💪`);
        } else {
            this.speak(`نگران نباش! با هم جبران می‌کنیم! 🤗`);
        }
        
        this.save();
        this.render();
    },
    
    onLevelUp(newLevel) {
        this.level = newLevel;
        this.getCurrentEvolution(); // چک تکامل
        this.speak(this.randomDialogue('levelUp'));
        this.save();
        this.render();
    },
    
    startLifeCycle() {
        // هر ۵ دقیقه چک کن
        setInterval(() => {
            const timeSinceFed = Date.now() - this.lastFed;
            
            // گرسنگی افزایش پیدا می‌کنه
            if (timeSinceFed > 1800000) { // ۳۰ دقیقه
                this.hunger = Math.min(100, this.hunger + 5);
            }
            
            // شادی کم میشه اگه تعامل نکرده باشه
            const timeSinceInteraction = Date.now() - this.lastInteraction;
            if (timeSinceInteraction > 7200000) { // ۲ ساعت
                this.happiness = Math.max(0, this.happiness - 3);
            }
            
            // اگه گرسنه باشه، شادی کم میشه
            if (this.hunger > 70) {
                this.happiness = Math.max(0, this.happiness - 2);
            }
            
            this.save();
            this.render();
        }, 300000); // هر ۵ دقیقه
    },
    
    save() {
        localStorage.setItem('studyPet', JSON.stringify({
            name: this.name,
            level: this.level,
            happiness: this.happiness,
            hunger: this.hunger,
            coins: this.coins,
            evolution: this.evolution,
            lastFed: this.lastFed,
            lastInteraction: this.lastInteraction
        }));
    }
};