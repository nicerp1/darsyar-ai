// ============ RICH TEXT EDITOR (Word-Style) ============
const RichEditor = {
    textarea: null,
    editor: null,
    
    init(selector) {
        const textarea = document.querySelector(selector);
        if (!textarea) return;
        
        textarea.style.display = 'none';
        
        const editorHTML = `
            <div class="rte-container">
                <div class="rte-toolbar">
                    <div class="rte-toolbar-group">
                        <button class="rte-btn" data-cmd="bold" title="Bold (Ctrl+B)"><b>B</b></button>
                        <button class="rte-btn" data-cmd="italic" title="Italic (Ctrl+I)"><i>I</i></button>
                        <button class="rte-btn" data-cmd="underline" title="Underline (Ctrl+U)"><u>U</u></button>
                        <button class="rte-btn" data-cmd="strikeThrough" title="Strikethrough"><s>S</s></button>
                    </div>
                    <div class="rte-toolbar-group">
                        <select class="rte-select" data-cmd="formatBlock">
                            <option value="p">متن معمولی</option>
                            <option value="h2">تیتر ۱</option>
                            <option value="h3">تیتر ۲</option>
                            <option value="h4">تیتر ۳</option>
                            <option value="blockquote">نقل قول</option>
                            <option value="pre">کد</option>
                        </select>
                    </div>
                    <div class="rte-toolbar-group">
                        <select class="rte-select" data-cmd="fontSize">
                            <option value="1">خیلی کوچک</option>
                            <option value="2">کوچک</option>
                            <option value="3" selected>معمولی</option>
                            <option value="4">بزرگ</option>
                            <option value="5">خیلی بزرگ</option>
                            <option value="6">عنوان</option>
                        </select>
                    </div>
                    <div class="rte-toolbar-group">
                        <input type="color" class="rte-color" data-cmd="foreColor" value="#000000" title="رنگ متن">
                        <input type="color" class="rte-color" data-cmd="hiliteColor" value="#ffff00" title="رنگ پس‌زمینه">
                    </div>
                    <div class="rte-toolbar-group">
                        <button class="rte-btn" data-cmd="justifyRight" title="راست‌چین">≡</button>
                        <button class="rte-btn" data-cmd="justifyCenter" title="وسط‌چین">≡</button>
                        <button class="rte-btn" data-cmd="justifyLeft" title="چپ‌چین">≡</button>
                    </div>
                    <div class="rte-toolbar-group">
                        <button class="rte-btn" data-cmd="insertUnorderedList" title="لیست">•</button>
                        <button class="rte-btn" data-cmd="insertOrderedList" title="لیست شمارشی">۱.</button>
                    </div>
                    <div class="rte-toolbar-group">
                        <button class="rte-btn" data-cmd="insertImage" title="درج عکس">🖼️</button>
                        <button class="rte-btn" data-cmd="createLink" title="لینک">🔗</button>
                        <button class="rte-btn" data-cmd="insertHorizontalRule" title="خط افقی">—</button>
                    </div>
                    <div class="rte-toolbar-group">
                        <button class="rte-btn" data-cmd="undo" title="برگشت">↩️</button>
                        <button class="rte-btn" data-cmd="redo" title="انجام مجدد">↪️</button>
                        <button class="rte-btn" data-cmd="removeFormat" title="پاک کردن فرمت">🧹</button>
                    </div>
                </div>
                <div class="rte-editor" contenteditable="true" dir="rtl"></div>
                <div class="rte-statusbar">
                    <span id="rteWordCount">۰ کلمه</span>
                    <span id="rteCharCount">۰ کاراکتر</span>
                </div>
            </div>
        `;
        
        textarea.insertAdjacentHTML('beforebegin', editorHTML);
        
        this.textarea = textarea;
        this.editor = textarea.previousElementSibling.querySelector('.rte-editor');
        
        if (textarea.value) this.editor.innerHTML = textarea.value;
        
        this.bindToolbar();
        this.bindEditor();
        this.updateStatus();
    },
    
    bindToolbar() {
        const toolbar = document.querySelector('.rte-toolbar');
        if (!toolbar) return;
        
        toolbar.addEventListener('click', (e) => {
            const btn = e.target.closest('.rte-btn');
            if (!btn) return;
            const cmd = btn.dataset.cmd;
            if (cmd === 'insertImage') this.insertImage();
            else if (cmd === 'createLink') this.createLink();
            else { document.execCommand(cmd, false, null); if (this.editor) this.editor.focus(); }
        });
        
        toolbar.addEventListener('change', (e) => {
            const select = e.target.closest('.rte-select');
            if (!select) return;
            document.execCommand(select.dataset.cmd, false, select.value);
            if (this.editor) this.editor.focus();
        });
        
        toolbar.addEventListener('input', (e) => {
            const color = e.target.closest('.rte-color');
            if (!color) return;
            document.execCommand(color.dataset.cmd, false, color.value);
            if (this.editor) this.editor.focus();
        });
    },
    
    bindEditor() {
        if (!this.editor) return;
        
        this.editor.addEventListener('input', () => {
            if (this.textarea) this.textarea.value = this.editor.innerHTML;
            this.updateStatus();
        });
        
        this.editor.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'b') { e.preventDefault(); document.execCommand('bold'); }
            if (e.ctrlKey && e.key === 'i') { e.preventDefault(); document.execCommand('italic'); }
            if (e.ctrlKey && e.key === 'u') { e.preventDefault(); document.execCommand('underline'); }
            if (e.ctrlKey && e.key === 'z') { e.preventDefault(); document.execCommand('undo'); }
            if (e.ctrlKey && e.key === 'y') { e.preventDefault(); document.execCommand('redo'); }
        });
        
        this.editor.addEventListener('paste', (e) => {
            e.preventDefault();
            const text = (e.clipboardData || window.clipboardData).getData('text/plain');
            document.execCommand('insertText', false, text);
        });
    },
    
    insertImage() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                document.execCommand('insertHTML', false, `<img src="${ev.target.result}" style="max-width:100%;border-radius:8px;margin:1rem 0;">`);
            };
            reader.readAsDataURL(file);
        };
        input.click();
    },
    
    createLink() {
        const url = prompt('آدرس لینک:', 'https://');
        if (url) document.execCommand('createLink', false, url);
    },
    
    updateStatus() {
        const text = this.editor ? (this.editor.innerText || '') : '';
        const words = text.trim() ? text.trim().split(/\s+/).length : 0;
        const chars = text.length;
        const wc = document.getElementById('rteWordCount');
        const cc = document.getElementById('rteCharCount');
        if (wc) wc.textContent = `${words} کلمه`;
        if (cc) cc.textContent = `${chars} کاراکتر`;
    },
    
    getContent() { return this.editor ? this.editor.innerHTML : ''; },
    setContent(html) { if (this.editor) this.editor.innerHTML = html || ''; }
};