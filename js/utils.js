/**
 * StudyMate Pro - Helper Utilities
 */

const Utils = (function () {
    // Persian digits mapping
    const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

    function toPersianDigits(num) {
        if (num === null || num === undefined) return '';
        return String(num).replace(/[0-9]/g, w => persianDigits[+w]);
    }

    function toEnglishDigits(str) {
        if (!str) return '';
        return String(str).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
    }

    function getJalaliDate(d = new Date()) {
        try {
            const date = new Date(d);
            return new Intl.DateTimeFormat('fa-IR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            }).format(date);
        } catch (e) {
            return d.toLocaleDateString('fa-IR');
        }
    }

    function getJalaliDateNumeric(d = new Date()) {
        try {
            const date = new Date(d);
            return new Intl.DateTimeFormat('fa-IR', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            }).format(date);
        } catch (e) {
            return d.toLocaleDateString('fa-IR');
        }
    }

    function getPersianDayName(d = new Date()) {
        try {
            const date = new Date(d);
            return new Intl.DateTimeFormat('fa-IR', { weekday: 'long' }).format(date);
        } catch (e) {
            return 'امروز';
        }
    }

    function formatDuration(totalSeconds) {
        const mins = Math.floor(totalSeconds / 60);
        const secs = totalSeconds % 60;
        const pad = n => (n < 10 ? '0' + n : '' + n);
        return toPersianDigits(`${pad(mins)}:${pad(secs)}`);
    }

    function generateId(prefix = 'id') {
        return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    }

    // Web Audio API Synthesizer
    let audioCtx = null;
    function getAudioContext() {
        if (!audioCtx && typeof window !== 'undefined') {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                audioCtx = new AudioContext();
            }
        }
        if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        return audioCtx;
    }

    function playSound(type = 'click') {
        try {
            const settings = typeof Storage !== 'undefined' ? Storage.getSettings() : { soundEnabled: true };
            if (settings && settings.soundEnabled === false) return;

            const ctx = getAudioContext();
            if (!ctx) return;

            const now = ctx.currentTime;

            if (type === 'click') {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(600, now);
                osc.frequency.exponentialRampToValueAtTime(800, now + 0.05);
                gain.gain.setValueAtTime(0.1, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(now);
                osc.stop(now + 0.05);
            } else if (type === 'beep') {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(440, now);
                gain.gain.setValueAtTime(0.15, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(now);
                osc.stop(now + 0.15);
            } else if (type === 'timerEnd') {
                // Multi-tone chime: C5, E5, G5, C6
                const notes = [523.25, 659.25, 783.99, 1046.50];
                notes.forEach((freq, idx) => {
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(freq, now + idx * 0.15);
                    gain.gain.setValueAtTime(0, now + idx * 0.15);
                    gain.gain.linearRampToValueAtTime(0.2, now + idx * 0.15 + 0.03);
                    gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.15 + 0.6);
                    osc.connect(gain);
                    gain.connect(ctx.destination);
                    osc.start(now + idx * 0.15);
                    osc.stop(now + idx * 0.15 + 0.6);
                });
            } else if (type === 'success' || type === 'achievement') {
                // Triumph fanfare: G4, C5, E5, G5
                const notes = [392.00, 523.25, 659.25, 783.99];
                notes.forEach((freq, idx) => {
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.type = 'triangle';
                    osc.frequency.setValueAtTime(freq, now + idx * 0.12);
                    gain.gain.setValueAtTime(0.2, now + idx * 0.12);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.4);
                    osc.connect(gain);
                    gain.connect(ctx.destination);
                    osc.start(now + idx * 0.12);
                    osc.stop(now + idx * 0.12 + 0.4);
                });
            }
        } catch (e) {
            console.warn('Audio play error:', e);
        }
    }

    // Toast notifications
    function showToast(message, type = 'info', duration = 3500) {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            container.className = 'toast-container';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = `toast toast-${type} animate-slide-in`;

        let icon = 'info';
        if (type === 'success') icon = 'check_circle';
        else if (type === 'error') icon = 'error';
        else if (type === 'warning') icon = 'warning';

        toast.innerHTML = `
            <span class="material-symbols-outlined toast-icon">${icon}</span>
            <div class="toast-content">${message}</div>
            <button class="toast-close" onclick="this.parentElement.remove()">
                <span class="material-symbols-outlined">close</span>
            </button>
        `;

        container.appendChild(toast);
        playSound(type === 'error' ? 'beep' : 'click');

        setTimeout(() => {
            toast.classList.add('fade-out');
            setTimeout(() => {
                if (toast.parentElement) toast.remove();
            }, 300);
        }, duration);
    }

    // Markdown & KaTeX Parser
    function renderKaTeXAndMarkdown(text) {
        if (!text) return '';

        // Escape HTML
        let escaped = text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        // Block math $$...$$
        escaped = escaped.replace(/\$\$([\s\S]+?)\$\$/g, function (match, math) {
            if (typeof katex !== 'undefined') {
                try {
                    return `<div class="katex-block-wrapper">${katex.renderToString(math.trim(), { displayMode: true, throwOnError: false })}</div>`;
                } catch (e) {
                    return `<div class="katex-fallback-block">$$ ${math} $$</div>`;
                }
            }
            return `<div class="katex-fallback-block">$$ ${math} $$</div>`;
        });

        // Inline math $...$
        escaped = escaped.replace(/\$([^\$\n]+?)\$/g, function (match, math) {
            if (typeof katex !== 'undefined') {
                try {
                    return `<span class="katex-inline-wrapper">${katex.renderToString(math.trim(), { displayMode: false, throwOnError: false })}</span>`;
                } catch (e) {
                    return `<span class="katex-fallback-inline">$${math}$</span>`;
                }
            }
            return `<span class="katex-fallback-inline">$${math}$</span>`;
        });

        // Code blocks ```code```
        escaped = escaped.replace(/```([a-zA-Z]*)\n([\s\S]*?)```/g, function (match, lang, code) {
            return `<pre class="code-block"><code class="lang-${lang}">${code.trim()}</code></pre>`;
        });

        // Inline code `code`
        escaped = escaped.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');

        // Headers
        escaped = escaped.replace(/^### (.*$)/gim, '<h4 class="ai-heading-3">$1</h4>');
        escaped = escaped.replace(/^## (.*$)/gim, '<h3 class="ai-heading-2">$1</h3>');
        escaped = escaped.replace(/^# (.*$)/gim, '<h2 class="ai-heading-1">$1</h2>');

        // Bold & Italic
        escaped = escaped.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        escaped = escaped.replace(/\*(.*?)\*/g, '<em>$1</em>');

        // Lists
        escaped = escaped.replace(/^\s*[\-\*]\s+(.*)$/gim, '<li class="ai-list-item">$1</li>');
        escaped = escaped.replace(/(<li class="ai-list-item">.*<\/li>)/gms, '<ul class="ai-list">$1</ul>');

        // Paragraphs / Newlines
        escaped = escaped.replace(/\n\n/g, '<div class="paragraph-break"></div>');
        escaped = escaped.replace(/\n/g, '<br>');

        return escaped;
    }

    // Modal helpers
    function openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('active');
            document.body.classList.add('modal-open');
            playSound('click');
        }
    }

    function closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('active');
            document.body.classList.remove('modal-open');
            playSound('click');
        }
    }

    // Confetti effect using Canvas
    function launchConfetti() {
        const canvas = document.createElement('canvas');
        canvas.id = 'confetti-canvas';
        canvas.style.position = 'fixed';
        canvas.style.top = '0';
        canvas.style.left = '0';
        canvas.style.width = '100vw';
        canvas.style.height = '100vh';
        canvas.style.pointerEvents = 'none';
        canvas.style.zIndex = '9999';
        document.body.appendChild(canvas);

        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        const ctx = canvas.getContext('2d');
        const count = 120;
        const particles = [];
        const colors = ['#05319e', '#c9a03e', '#10b981', '#f59e0b', '#ec4899', '#6366f1', '#ffffff'];

        for (let i = 0; i < count; i++) {
            particles.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height - canvas.height,
                size: Math.random() * 8 + 4,
                color: colors[Math.floor(Math.random() * colors.length)],
                speedY: Math.random() * 4 + 2,
                speedX: (Math.random() - 0.5) * 4,
                rotation: Math.random() * 360,
                rotationSpeed: (Math.random() - 0.5) * 10
            });
        }

        let animationFrame;
        let opacity = 1;
        const startTime = Date.now();

        function render() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            particles.forEach(p => {
                p.y += p.speedY;
                p.x += p.speedX;
                p.rotation += p.rotationSpeed;

                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate((p.rotation * Math.PI) / 180);
                ctx.fillStyle = p.color;
                ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
                ctx.restore();
            });

            if (Date.now() - startTime > 3000) {
                opacity -= 0.03;
                canvas.style.opacity = opacity;
            }

            if (opacity > 0) {
                animationFrame = requestAnimationFrame(render);
            } else {
                cancelAnimationFrame(animationFrame);
                canvas.remove();
            }
        }

        render();
        playSound('success');
    }

    // Copy to clipboard
    function copyToClipboard(text, successMsg = 'با موفقیت در حافظه کپی شد!') {
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(text).then(() => {
                showToast(successMsg, 'success');
            }).catch(() => {
                fallbackCopy(text, successMsg);
            });
        } else {
            fallbackCopy(text, successMsg);
        }
    }

    function fallbackCopy(text, successMsg) {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
            document.execCommand('copy');
            showToast(successMsg, 'success');
        } catch (err) {
            showToast('خطا در کپی متن!', 'error');
        }
        textArea.remove();
    }

    // Print element helper
    function printElement(elementId, title = 'درسیار | StudyMate Pro') {
        const el = document.getElementById(elementId);
        if (!el) return;

        const printable = el.cloneNode(true);
        const sourceCanvases = el.querySelectorAll('canvas');
        printable.querySelectorAll('canvas').forEach((canvas, index) => {
            try {
                const image = document.createElement('img');
                image.src = sourceCanvases[index].toDataURL('image/png');
                image.alt = 'نمودار گزارش';
                canvas.replaceWith(image);
            } catch (_) { canvas.remove(); }
        });

        const printWin = window.open('', '_blank');
        printWin.document.write(`
            <!DOCTYPE html>
            <html lang="fa" dir="rtl">
            <head>
                <meta charset="UTF-8">
                <title>${title}</title>
                <link rel="stylesheet" href="fonts/kalameh.css">
                <style>
                    @page { size: A4 portrait; margin: 12mm; }
                    * { box-sizing: border-box; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
                    html, body { width: 100%; margin: 0; padding: 0; direction: rtl; color: #172033; background: #fff; font-family: 'Kalameh','Vazirmatn',Tahoma,sans-serif; font-size: 10pt; line-height: 1.55; }
                    body { padding: 0; }
                    .print-header { border-bottom: 2px solid #2349b8; padding: 0 0 7mm; margin-bottom: 7mm; display: flex; justify-content: space-between; align-items: center; }
                    .print-header h1 { color: #173895; font-size: 17pt; margin: 0; }
                    .print-badge { background: #eef2ff; border: 1px solid #c7d2fe; padding: 2mm 4mm; border-radius: 3mm; font-size: 9pt; }
                    h1,h2,h3,h4 { color: #173895; break-after: avoid; } p { orphans: 3; widows: 3; }
                    img,svg,canvas { max-width: 100% !important; height: auto !important; }
                    button,.schedule-add-task,.task-focus-button,.admin-icon-button { display: none !important; }
                    .schedule-days-list > #schedule-days-list { display: grid; grid-template-columns: 1fr 1fr; gap: 4mm; }
                    .schedule-day-card,.content-card,.kpi-card,.output-paper,.admin-report-table-wrap { border: 1px solid #d7deeb; border-radius: 3mm; padding: 3.5mm; background: #fff; break-inside: avoid; box-shadow: none; }
                    .schedule-day-card header { display:flex; justify-content:space-between; align-items:center; padding-bottom:2mm; border-bottom:1px solid #d7deeb; }
                    .schedule-day-card header div { display:flex; align-items:center; gap:2mm; } .schedule-day-card h3 { margin:0; font-size:12pt; }
                    .schedule-day-index,.day-task-number { display:inline-grid; place-items:center; width:7mm; height:7mm; border-radius:50%; background:#2349b8; color:#fff; font-weight:700; }
                    .schedule-day-tasks { display:grid; gap:2mm; margin-top:2.5mm; }
                    .day-task { border-right:1.2mm solid var(--task-color,#2349b8); background:#f8fafc; border-radius:2mm; padding:2mm; break-inside:avoid; }
                    .day-task-main { display:grid !important; grid-template-columns:auto 1fr auto; width:100%; align-items:center; gap:2mm; padding:0; color:#172033; background:transparent; border:0; text-align:right; }
                    .day-task-copy { display:grid; } .day-task-copy small { color:#64748b; } .day-task-duration { white-space:nowrap; color:#173895; font-size:8.5pt; }
                    .day-task-footer { margin-top:1mm; } .schedule-status { font-size:8pt; border:1px solid #94a3b8; border-radius:99px; padding:0 2mm; }
                    table { width:100% !important; border-collapse:collapse !important; table-layout:fixed; font-size:8.5pt; }
                    th,td { padding:2mm !important; border:1px solid #d7deeb !important; overflow-wrap:anywhere; }
                    pre,code { direction:ltr; text-align:left; white-space:pre-wrap; background:#f8fafc; padding:2mm; border-radius:2mm; }
                    @media print { a { color:inherit; text-decoration:none; } }
                </style>
            </head>
            <body>
                <div class="print-header">
                    <h1>${title}</h1>
                    <div class="print-badge">${getJalaliDate()}</div>
                </div>
                ${printable.innerHTML}
                <script>
                    window.onload = function() {
                        window.print();
                    };
                </script>
            </body>
            </html>
        `);
        printWin.document.close();
    }

    return {
        toPersianDigits,
        toEnglishDigits,
        getJalaliDate,
        getJalaliDateNumeric,
        getPersianDayName,
        formatDuration,
        generateId,
        playSound,
        showToast,
        renderKaTeXAndMarkdown,
        openModal,
        closeModal,
        launchConfetti,
        copyToClipboard,
        printElement
    };
})();

if (typeof window !== 'undefined') {
    window.Utils = Utils;
}
