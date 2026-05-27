// ============ SUBSCRIPTION SYSTEM ============
const Subscription = {
    plans: [
        { id: 'free', name: 'رایگان', price: '۰', color: '#7f8c8d', features: ['۱۰ پیام AI در روز', '۵۰ فلش‌کارت', '۱ تم لو-فای', 'آمار پایه'] },
        { id: 'silver', name: 'نقره‌ای', price: '۵۰,۰۰۰', color: '#bdc3c7', features: ['۵۰ پیام AI در روز', '۲۰۰ فلش‌کارت', '۳ تم لو-فای', 'آمار پیشرفته', 'بدون تبلیغ'] },
        { id: 'gold', name: 'طلایی', price: '۱۵۰,۰۰۰', color: '#f39c12', features: ['نامحدود AI', 'نامحدود فلش‌کارت', 'همه تم‌ها', 'آمار حرفه‌ای', 'پشتیبانی ویژه', 'آپلود PDF'] }
    ],
    
    show() {
        const currentPlan = Storage.userProgress?.plan || 'free';
        
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal" style="max-width:700px;">
                <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
                <h3 style="text-align:center;margin-top:0;">⭐ ارتقاء اشتراک</h3>
                <p style="text-align:center;color:var(--text-secondary);margin-bottom:1.5rem;">با ارتقاء اشتراک، امکانات بیشتری دریافت کنید</p>
                
                <div class="grid-3">
                    ${this.plans.map(plan => `
                        <div style="border:2px solid ${plan.id === currentPlan ? plan.color : 'var(--border)'};border-radius:12px;padding:1.5rem;text-align:center;${plan.id === currentPlan ? 'background:var(--primary-light);' : ''}">
                            <h4 style="margin:0 0 0.5rem;color:${plan.color};">${plan.name}</h4>
                            <div style="font-size:1.5rem;font-weight:800;margin-bottom:1rem;">${plan.price} <small style="font-size:0.8rem;">تومان</small></div>
                            <ul style="list-style:none;padding:0;text-align:right;font-size:0.85rem;">
                                ${plan.features.map(f => `<li style="padding:0.3rem 0;">✅ ${f}</li>`).join('')}
                            </ul>
                            ${plan.id === currentPlan ? 
                                '<button class="btn btn-sm" disabled style="margin-top:1rem;width:100%;">فعال</button>' : 
                                `<button class="btn btn-primary btn-sm" onclick="Subscription.upgrade('${plan.id}')" style="margin-top:1rem;width:100%;">انتخاب</button>`
                            }
                        </div>
                    `).join('')}
                </div>
                
                <p style="text-align:center;color:var(--text-secondary);font-size:0.8rem;margin-top:1rem;">📌 درگاه پرداخت به زودی اضافه خواهد شد.</p>
            </div>
        `;
        document.body.appendChild(modal);
        modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    },
    
    upgrade(planId) {
        if (!Storage.userProgress) Storage.userProgress = {};
        Storage.userProgress.plan = planId;
        localStorage.setItem('userProgress', JSON.stringify(Storage.userProgress));
        document.querySelector('.modal-overlay')?.remove();
        Utils.showToast('✅ اشتراک با موفقیت ارتقاء یافت');
    }
};