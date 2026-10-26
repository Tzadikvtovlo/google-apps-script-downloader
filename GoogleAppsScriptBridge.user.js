// ==UserScript==
// @name         GoogleAppsScript
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  מוסיף כםתורי הורדת והעלאת קבצי הקוד (GS) של גוגל סקריפט
// @author       צדיק וטוב לו & לומדעס
// @match        https://script.google.com/*
// @icon         https://www.gstatic.com/script/apps_script_1x_48dp.png
// @updateURL    https://raw.githubusercontent.com/Tzadikvtovlo/GoogleScriptBridge/main/GoogleAppsScriptBridge.user.js
// @downloadURL  https://raw.githubusercontent.com/Tzadikvtovlo/GoogleScriptBridge/main/GoogleAppsScriptBridge.user.js
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    if (window.innerWidth < 10 || window.innerHeight < 10) return;

    console.log("🚀 [GAS Ultimate Suite] גרסה 16.0 - ממשק פרימיום להעלאה והורדה, תמיכה בסייר הקבצים!");

    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    const clean = s => String(s || '').replace(/[\u200e\u200f]/g, '').trim();
    const safe = s => clean(s).replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, ' ').slice(0, 120) || 'code.gs';

    // --- מערכת SVG ואייקונים (Line Icons בלבד) ---
    function createSVG(paths, width="24", height="24", color="#5f6368") {
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("width", width);
        svg.setAttribute("height", height);
        svg.setAttribute("viewBox", "0 0 24 24");
        svg.setAttribute("fill", "none");
        svg.setAttribute("stroke", color);
        svg.setAttribute("stroke-width", "2");
        svg.setAttribute("stroke-linecap", "round");
        svg.setAttribute("stroke-linejoin", "round");
        svg.style.transition = "stroke 0.2s ease";

        paths.forEach(p => {
            const el = document.createElementNS("http://www.w3.org/2000/svg", p.tag);
            for (let k in p.attrs) el.setAttribute(k, p.attrs[k]);
            svg.appendChild(el);
        });
        return svg;
    }

    const icons = {
        upload: [
            {tag: 'line', attrs: {x1: '12', y1: '11', x2: '12', y2: '2'}},
            {tag: 'polyline', attrs: {points: '8 6 12 2 16 6'}},
            {tag: 'polyline', attrs: {points: '3 14 12 17 21 14'}},
            {tag: 'polyline', attrs: {points: '3 18 12 21 21 18'}}
        ],
        download: [
            {tag: 'line', attrs: {x1: '12', y1: '2', x2: '12', y2: '11'}},
            {tag: 'polyline', attrs: {points: '8 7 12 11 16 7'}},
            {tag: 'polyline', attrs: {points: '3 14 12 17 21 14'}},
            {tag: 'polyline', attrs: {points: '3 18 12 21 21 18'}}
        ],
        file: [
            {tag: 'path', attrs: {d: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z'}},
            {tag: 'polyline', attrs: {points: '14 2 14 8 20 8'}}
        ],
        check: [
            {tag: 'polyline', attrs: {points: '20 6 9 17 4 12'}}
        ],
        x: [
            {tag: 'line', attrs: {x1: '18', y1: '6', x2: '6', y2: '18'}},
            {tag: 'line', attrs: {x1: '6', y1: '6', x2: '18', y2: '18'}}
        ]
    };

    // --- בניית ממשק הסרגל (Sidebar) ---
    function createSidebarButton(text, iconPaths, onClickCallback) {
        const btn = document.createElement('div');
        btn.setAttribute('role', 'button');
        btn.setAttribute('title', text);

        btn.style.cssText = `
            display: flex; align-items: center; width: 100%; height: 48px; cursor: pointer; color: #3c4043;
            transition: background-color 0.2s, color 0.2s; overflow: hidden; white-space: nowrap;
            padding-inline-start: 16px; gap: 20px; box-sizing: border-box; border-radius: 0 24px 24px 0;
        `;

        const iconWrapper = document.createElement('div');
        iconWrapper.style.cssText = 'display: flex; align-items: center; justify-content: center; flex-shrink: 0; width: 24px; height: 24px;';

        const svgIcon = createSVG(iconPaths, "24", "24", "#5f6368");
        iconWrapper.appendChild(svgIcon);

        const textSpan = document.createElement('span');
        textSpan.textContent = text;
        textSpan.style.cssText = 'font-family: "Google Sans", Roboto, Arial, sans-serif; font-size: 13px; font-weight: 500;';

        btn.append(iconWrapper, textSpan);

        btn.onmouseover = () => {
            btn.style.backgroundColor = 'rgba(26,115,232,0.08)';
            svgIcon.setAttribute('stroke', '#1a73e8'); textSpan.style.color = '#1a73e8';
        };
        btn.onmouseout = () => {
            btn.style.backgroundColor = 'transparent';
            svgIcon.setAttribute('stroke', '#5f6368'); textSpan.style.color = '#3c4043';
        };

        btn.addEventListener('click', onClickCallback);
        return btn;
    }

    // בדיקה מדויקת האם הדף הנוכחי הוא עמוד עריכה פעיל
    function isEditPage() {
        try {
            const cleanUrl = window.location.href.split(/[?#]/)[0].replace(/\/+$/, '');
            return cleanUrl.startsWith('https://script.google.com/home/projects/') && cleanUrl.endsWith('/edit');
        } catch (_) {
            return false;
        }
    }

    // איתור ספציפי של כפתור הגדרות הפרויקט בסרגל הצד (בלבד!)
    function getSidebarSettingsButton() {
        const projectSettingsSelectors = [
            '[aria-label*="Project Settings" i]',
            '[aria-label*="Project settings" i]',
            '[aria-label*="הגדרות הפרויקט"]',
            '[aria-label*="הגדרות פרויקט"]',
            '[aria-label*="הגדרות הפרוייקט"]',
            '[aria-label*="הגדרות פרוייקט"]'
        ];

        for (const sel of projectSettingsSelectors) {
            const list = document.querySelectorAll(sel);
            for (const el of list) {
                const rect = el.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0) {
                    return el;
                }
            }
        }

        // גיבוי: איתור דרך כפתור העורך (Editor) בסרגל הצד הראשי
        const editorBtn = document.querySelector('[aria-label*="Editor" i], [aria-label*="עורך"]');
        if (editorBtn && editorBtn.parentElement) {
            const nav = editorBtn.parentElement;
            const children = Array.from(nav.children).filter(c => c.id !== 'gas-custom-tools-wrapper');
            if (children.length > 0) {
                const last = children[children.length - 1];
                if (last && last.getBoundingClientRect().width > 0) {
                    return last;
                }
            }
        }

        return null;
    }

    function createUI() {
        try {
            if (!document.body) return;

            // אם אנחנו לא בעמוד עריכה שנגמר ב-/edit (למשל דף בית, הגדרות וכו') – מסירים את הכפתורים מיד
            if (!isEditPage()) {
                const existing = document.getElementById('gas-custom-tools-wrapper');
                if (existing) existing.remove();
                return;
            }

            const settingsBtn = getSidebarSettingsButton();
            const existing = document.getElementById('gas-custom-tools-wrapper');

            // אם הכפתורים כבר קיימים ובמיקומם המדויק בסרגל
            if (existing) {
                if (settingsBtn && settingsBtn.nextElementSibling === existing) {
                    return;
                }
                existing.remove();
            }

            // ממתינים עד שסרגל עמוד העריכה נטען במלואו
            if (!settingsBtn) return;

            const toolsWrapper = document.createElement('div');
            toolsWrapper.id = 'gas-custom-tools-wrapper';
            toolsWrapper.style.cssText = 'display: flex; flex-direction: column; width: 100%; margin-top: 4px; padding: 0;';

            toolsWrapper.appendChild(createSidebarButton('העלאת קבצי קוד', icons.upload, openUploadModal));
            toolsWrapper.appendChild(createSidebarButton('הורדת קבצי הקוד', icons.download, openDownloadModal));

            settingsBtn.insertAdjacentElement('afterend', toolsWrapper);
        } catch (err) {
            console.error('[GAS Suite] createUI Error:', err);
        }
    }

    // --- מסגרת Overlay גלובלית ואלגנטית ---
    function createOverlay() {
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: rgba(0, 0, 0, 0.4); backdrop-filter: blur(4px);
            z-index: 2147483647; display: flex; justify-content: center; align-items: center;
            font-family: "Google Sans", Roboto, Arial, sans-serif; direction: rtl;
        `;
        return overlay;
    }

    // =========================================================================
    // מודול 1: העלאת קבצים (Upload & Inject)
    // =========================================================================
    let uploadOverlay;
    let pendingUploadFiles = [];

    function openUploadModal() {
        if (uploadOverlay) { uploadOverlay.remove(); }
        uploadOverlay = createOverlay();
        pendingUploadFiles = [];

        const modal = document.createElement('div');
        modal.style.cssText = `
            background: #ffffff; width: 550px; max-width: 90%; border-radius: 24px;
            box-shadow: 0 24px 40px rgba(0,0,0,0.2); text-align: center;
            position: relative; display: flex; flex-direction: column; overflow: hidden;
            transition: all 0.3s ease;
        `;

        const closeBtn = document.createElement('button');
        closeBtn.appendChild(createSVG(icons.x, "20", "20", "#5f6368"));
        closeBtn.style.cssText = 'position: absolute; top: 16px; right: 16px; background: none; border: none; cursor: pointer; padding: 4px; border-radius: 50%; z-index: 10;';
        closeBtn.onmouseover = () => closeBtn.style.background = '#f1f3f4';
        closeBtn.onmouseout = () => closeBtn.style.background = 'none';
        closeBtn.onclick = () => uploadOverlay.remove();
        modal.appendChild(closeBtn);

        const viewDrag = document.createElement('div');
        viewDrag.style.cssText = 'padding: 50px 40px; border: 2px dashed #a8c7fa; margin: 20px; border-radius: 16px; background: #fcfcfc; cursor: pointer; transition: background 0.2s, border-color 0.2s;';

        const upIcon = createSVG(icons.upload, "56", "56", "#1a73e8");
        upIcon.style.marginBottom = "16px";

        const title1 = document.createElement('h2');
        title1.style.cssText = 'color: #202124; margin: 0 0 8px 0; font-size: 22px; font-weight: 400; pointer-events: none;';
        title1.textContent = 'העלאת קבצים לפרויקט';

        const sub1 = document.createElement('p');
        sub1.style.cssText = 'font-size: 14px; color: #5f6368; margin: 0 0 16px 0; line-height: 1.5; pointer-events: none;';
        sub1.appendChild(document.createTextNode('גרור לכאן קבצי קוד או '));
        const clickSpan = document.createElement('span');
        clickSpan.textContent = 'לחץ לבחירה מהמחשב';
        clickSpan.style.cssText = 'color: #1a73e8; font-weight: 500; text-decoration: underline;';
        sub1.appendChild(clickSpan);

        viewDrag.append(upIcon, title1, sub1);

        // Input נסתר לבחירת קבצים דרך סייר
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.multiple = true;
        fileInput.style.display = 'none';

        fileInput.addEventListener('change', (e) => {
            if(e.target.files.length > 0) handleFilesSelected(Array.from(e.target.files));
        });

        viewDrag.onclick = () => fileInput.click();

        // חלון אישור ורשימה
        const viewConfirm = document.createElement('div');
        viewConfirm.style.cssText = 'display: none; flex-direction: column; align-items: center; padding: 30px 40px;';

        const confTitle = document.createElement('h2');
        confTitle.style.cssText = 'color: #202124; margin: 0 0 16px 0; font-size: 20px; font-weight: 500;';

        const fileList = document.createElement('div');
        fileList.style.cssText = 'width: 100%; max-height: 200px; overflow-y: auto; border: 1px solid #dadce0; border-radius: 8px; margin-bottom: 24px; text-align: right; background: #fff;';

        const btnRow = document.createElement('div');
        btnRow.style.cssText = 'display: flex; gap: 12px; justify-content: center; width: 100%;';

        const btnInject = document.createElement('button');
        btnInject.textContent = 'התחל הזרקה';
        btnInject.style.cssText = 'padding: 10px 24px; background: #1a73e8; color: white; border: none; border-radius: 20px; cursor: pointer; font-size: 14px; font-weight: 500; flex: 1;';

        const btnCancel = document.createElement('button');
        btnCancel.textContent = 'חזור';
        btnCancel.style.cssText = 'padding: 10px 24px; background: transparent; color: #5f6368; border: 1px solid #dadce0; border-radius: 20px; cursor: pointer; font-size: 14px; font-weight: 500; flex: 1;';

        btnRow.append(btnCancel, btnInject);
        viewConfirm.append(confTitle, fileList, btnRow);

        modal.append(viewDrag, fileInput, viewConfirm);
        uploadOverlay.appendChild(modal);
        document.body.appendChild(uploadOverlay);

        uploadOverlay.addEventListener('click', (e) => { if(e.target === uploadOverlay) uploadOverlay.remove(); });

        // גרירה
        viewDrag.addEventListener('dragover', (e) => { e.preventDefault(); viewDrag.style.borderColor = '#1a73e8'; viewDrag.style.background = '#e8f0fe'; });
        viewDrag.addEventListener('dragleave', (e) => { e.preventDefault(); viewDrag.style.borderColor = '#a8c7fa'; viewDrag.style.background = '#fcfcfc'; });
        viewDrag.addEventListener('drop', (e) => {
            e.preventDefault();
            viewDrag.style.borderColor = '#a8c7fa'; viewDrag.style.background = '#fcfcfc';
            if(e.dataTransfer.files.length > 0) handleFilesSelected(Array.from(e.dataTransfer.files));
        });

        function renderUploadList() {
            fileList.textContent = '';
            if(pendingUploadFiles.length === 0) {
                viewConfirm.style.display = 'none'; viewDrag.style.display = 'block'; return;
            }
            confTitle.textContent = `${pendingUploadFiles.length} קבצים ממתינים להזרקה`;

            pendingUploadFiles.forEach((f, i) => {
                const row = document.createElement('div');
                row.style.cssText = 'display: flex; align-items: center; padding: 8px 12px; border-bottom: 1px solid #f1f3f4;';
                const icon = createSVG(icons.file, "18", "18", "#5f6368");
                icon.style.marginRight = "10px";
                icon.style.marginLeft = "10px";

                const nameSpan = document.createElement('span');
                nameSpan.textContent = f.name;
                nameSpan.style.cssText = 'flex: 1; font-family: monospace; font-size: 13px; color: #3c4043; direction: ltr; text-align: left;';

                const delBtn = document.createElement('button');
                delBtn.appendChild(createSVG(icons.x, "16", "16", "#d93025"));
                delBtn.style.cssText = 'background: none; border: none; cursor: pointer; padding: 4px;';
                delBtn.onclick = () => { pendingUploadFiles.splice(i, 1); renderUploadList(); };

                row.append(icon, nameSpan, delBtn);
                fileList.appendChild(row);
            });
        }

        function handleFilesSelected(files) {
            pendingUploadFiles = files;
            viewDrag.style.display = 'none';
            viewConfirm.style.display = 'flex';
            renderUploadList();
        }

        btnCancel.onclick = () => { pendingUploadFiles = []; renderUploadList(); };

        btnInject.onclick = async () => {
            btnInject.disabled = true; btnCancel.disabled = true; closeBtn.style.display = 'none';
            uploadOverlay.style.display = 'none';

            for (let i = 0; i < pendingUploadFiles.length; i++) {
                await processFile(pendingUploadFiles[i]);
                if (document.activeElement) document.activeElement.blur();
                document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true }));
                if (i < pendingUploadFiles.length - 1) await sleep(3000);
            }
            alert('✅ הזרקת הקבצים הסתיימה בהצלחה!');
            uploadOverlay.remove();
        };
    }

    // --- לוגיקת ההזרקה נשמרת מגרסה 15.4 ללא שינוי ---
    async function processFile(file) {
        const content = await file.text();
        const name = file.name.replace(/\.[^/.]+$/, "");
        await createGasFile(name, content);
    }

    async function createGasFile(name, content) {
        try {
            let addBtn = null;
            for (let i = 0; i < 8; i++) {
                const addBtns = Array.from(document.querySelectorAll('[aria-label="Add a file"], [aria-label="הוספת קובץ"]'));
                addBtn = addBtns.find(btn => btn.getBoundingClientRect().width > 0);
                if (addBtn) break; await sleep(500);
            }
            if (!addBtn) return;
            addBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
            addBtn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
            addBtn.click();

            let scriptItem = null;
            for (let i = 0; i < 8; i++) {
                await sleep(500);
                const menuItems = Array.from(document.querySelectorAll('[role="menuitem"]'));
                scriptItem = menuItems.find(el => {
                    const rect = el.getBoundingClientRect();
                    if (rect.width > 0 && rect.height > 0) {
                        const txt = (el.innerText || el.textContent || '').trim();
                        return txt === 'Script' || txt === 'סקריפט' || txt.includes('Script') || txt.includes('סקריפט');
                    }
                    return false;
                });
                if (scriptItem) break;
            }
            if (!scriptItem) return;
            scriptItem.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
            scriptItem.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
            scriptItem.click();

            let input = null;
            for (let i = 0; i < 10; i++) {
                await sleep(500);
                if (document.activeElement && document.activeElement.tagName === 'INPUT') { input = document.activeElement; break; }
            }
            if (!input) return;

            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
            nativeInputValueSetter.call(input, name);
            input.dispatchEvent(new Event('input', { bubbles: true }));

            await sleep(500);
            input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
            input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));

            await sleep(6000);

            const monacoInput = document.querySelector('.monaco-editor textarea.inputarea');
            if (monacoInput) {
                monacoInput.focus(); await sleep(300);
                document.execCommand('selectAll', false, null); await sleep(300);

                const cleanContent = content.replace(/\r\n/g, '\n').replace(/\r/g, '');
                const dt = new DataTransfer(); dt.setData('text/plain', cleanContent);
                const pasteEvent = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true });

                if (!monacoInput.dispatchEvent(pasteEvent)) {
                    document.execCommand('insertText', false, cleanContent); await sleep(1000);
                    monacoInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', code: 'KeyF', keyCode: 70, which: 70, shiftKey: true, altKey: true, bubbles: true, cancelable: true }));
                }
            }
            await sleep(4000);
        } catch (err) { console.error(`Error injecting ${name}:`, err); }
    }

    // =========================================================================
    // מודול 2: הורדת קבצים (Download & Extract)
    // =========================================================================
    let dlOverlay, dlFileList = [], isDownloading = false;

    const visible = el => { if (!el) return false; const r = el.getBoundingClientRect(), s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden'; };
    const extractName = el => { const raw = clean(el.getAttribute('aria-label') || el.getAttribute('title') || el.innerText || el.textContent); const matches = [...raw.matchAll(/([^\n]+?\.(?:gs|html|json))(?=\n|$)/ig)]; return matches.length === 1 ? safe(matches[0][1]) : ''; };

    const discoverFiles = (overlay) => {
        const result = new Map();
        const candidates = document.querySelectorAll('[role="treeitem"], div[title], span[title], .as-file-list-item');
        const pool = candidates.length > 0 ? candidates : document.querySelectorAll('*');
        for (const el of pool) {
            if (overlay && overlay.contains(el)) continue;
            if (!visible(el)) continue;
            const name = extractName(el);
            if (!name) continue;
            const r = el.getBoundingClientRect(), score = r.width * r.height;
            const old = result.get(name);
            if (!old || score < old.score) result.set(name, { el, score });
        }
        return [...result].map(([name, x]) => ({ name, el: x.el, status: '', selected: true }));
    };

    const readMonaco = (wanted) => {
        const found = [];
        const visit = w => { try { if (w.monaco && w.monaco.editor) found.push(w); for (let i = 0; i < w.frames.length; i++) visit(w.frames[i]); } catch (_) {} };
        visit(window);
        for (const w of found) {
            const api = w.monaco.editor;
            const editors = typeof api.getEditors === 'function' ? api.getEditors() : [];
            for (const ed of editors) {
                try {
                    const model = ed.getModel(); if (!model) continue;
                    const uri = String(model.uri || '');
                    if (uri.toLowerCase().includes(wanted.toLowerCase().replace(/\.(gs|html)$/i, '')) || ed.hasTextFocus() || (ed.getDomNode() && visible(ed.getDomNode()))) {
                        return { value: model.getValue(), uri };
                    }
                } catch (_) {}
            }
        }
        return null;
    };

    const activateFile = async (f, overlay) => {
        const r = f.el.getBoundingClientRect();
        const x = Math.max(0, Math.min(innerWidth - 1, r.left + r.width / 2));
        const y = Math.max(0, Math.min(innerHeight - 1, r.top + r.height / 2));
        const hit = document.elementFromPoint(x, y) || f.el;
        const candidates = [hit, f.el, hit.parentElement, f.el.parentElement].filter(e => e && (!overlay || !overlay.contains(e)));
        for (const e of candidates) {
            try {
                e.scrollIntoView({ block: 'nearest' }); e.focus?.();
                for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) e.dispatchEvent(new MouseEvent(type, { view: window, bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 }));
                e.click?.(); await sleep(150);
            } catch (_) {}
        }
    };

    const waitForContent = async (name, beforeSignature, overlay) => {
        let last = null, stable = 0;
        for (let attempt = 1; attempt <= 20; attempt++) {
            await sleep(attempt === 1 ? 400 : 200);
            const current = readMonaco(name);
            if (current) {
                const sig = current.uri + '|' + current.value.length;
                if (!beforeSignature || sig !== beforeSignature) {
                    if (last && current.value === last.value) stable++; else stable = 0;
                    last = current;
                    if (stable >= 2) return current;
                }
            }
        }
        return last;
    };

    const downloadOne = (name, text) => {
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = name;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 10000);
    };

    async function openDownloadModal() {
        if (dlOverlay) dlOverlay.remove();
        dlOverlay = createOverlay();
        isDownloading = false;

        const modal = document.createElement('div');
        modal.style.cssText = `
            background: #ffffff; width: 550px; max-width: 90%; border-radius: 24px;
            box-shadow: 0 24px 40px rgba(0,0,0,0.2); padding: 30px 40px; text-align: center;
            display: flex; flex-direction: column; position: relative;
        `;

        const closeBtn = document.createElement('button');
        closeBtn.appendChild(createSVG(icons.x, "20", "20", "#5f6368"));
        closeBtn.style.cssText = 'position: absolute; top: 16px; right: 16px; background: none; border: none; cursor: pointer; padding: 4px; border-radius: 50%; z-index: 10;';
        closeBtn.onclick = () => { if(!isDownloading) dlOverlay.remove(); };
        modal.appendChild(closeBtn);

        const header = document.createElement('div');
        header.style.cssText = 'display: flex; align-items: center; justify-content: center; margin-bottom: 20px; gap: 12px;';
        const dlIcon = createSVG(icons.download, "32", "32", "#1a73e8");
        const title = document.createElement('h2');
        title.textContent = 'הורדת קבצי קוד';
        title.style.cssText = 'color: #202124; font-size: 22px; font-weight: 500; margin: 0;';
        header.append(dlIcon, title);

        const controls = document.createElement('div');
        controls.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; background: #f8f9fa; padding: 10px 16px; border-radius: 8px; border: 1px solid #dadce0;';

        const formatSelect = document.createElement('select');
        formatSelect.style.cssText = 'padding: 6px; border: 1px solid #dadce0; border-radius: 4px; font-family: inherit; font-size: 13px; outline: none; background: white;';
        const optOrig = document.createElement('option'); optOrig.textContent = 'שמור בפורמט מקורי (.gs/.html)'; optOrig.value = 'orig';
        const optTxt = document.createElement('option'); optTxt.textContent = 'המרה לטקסט (.txt)'; optTxt.value = 'txt';
        formatSelect.append(optOrig, optTxt);

        const labelAll = document.createElement('label');
        labelAll.style.cssText = 'display: flex; align-items: center; font-size: 13px; font-weight: 500; cursor: pointer; color: #3c4043;';
        const cbAll = document.createElement('input'); cbAll.type = 'checkbox'; cbAll.checked = true; cbAll.style.marginLeft = '8px';
        labelAll.append(cbAll, document.createTextNode('בחר הכל'));

        controls.append(labelAll, formatSelect);

        const listUI = document.createElement('div');
        listUI.style.cssText = 'width: 100%; max-height: 250px; overflow-y: auto; border: 1px solid #dadce0; border-radius: 8px; margin-bottom: 24px; background: #fff;';

        const btnRow = document.createElement('div');
        btnRow.style.cssText = 'display: flex; gap: 12px; justify-content: center;';
        const btnStart = document.createElement('button');
        btnStart.textContent = 'הורד נבחרים';
        btnStart.style.cssText = 'padding: 10px 24px; background: #1a73e8; color: white; border: none; border-radius: 20px; cursor: pointer; font-size: 14px; font-weight: 500; flex: 1;';
        const btnCancel = document.createElement('button');
        btnCancel.textContent = 'ביטול';
        btnCancel.style.cssText = 'padding: 10px 24px; background: transparent; color: #5f6368; border: 1px solid #dadce0; border-radius: 20px; cursor: pointer; font-size: 14px; font-weight: 500; flex: 1;';
        btnRow.append(btnCancel, btnStart);

        modal.append(header, controls, listUI, btnRow);
        dlOverlay.appendChild(modal);
        document.body.appendChild(dlOverlay);

        dlFileList = discoverFiles(dlOverlay);

        function renderDownloadList() {
            listUI.textContent = '';
            dlFileList.forEach(f => {
                const row = document.createElement('label');
                row.style.cssText = 'display: flex; align-items: center; padding: 8px 12px; border-bottom: 1px solid #f1f3f4; cursor: pointer; transition: background 0.2s;';
                row.onmouseover = () => row.style.background = '#f8fafd'; row.onmouseout = () => row.style.background = '#fff';

                const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = f.selected; cb.disabled = isDownloading;
                cb.style.marginLeft = '12px';
                cb.onchange = (e) => { f.selected = e.target.checked; updateCbAll(); };

                const nameSpan = document.createElement('span'); nameSpan.textContent = f.name;
                nameSpan.style.cssText = 'flex: 1; font-family: monospace; font-size: 13px; color: #3c4043; direction: ltr; text-align: left;';

                const statusSpan = document.createElement('span'); statusSpan.textContent = f.status;
                statusSpan.style.cssText = `font-size: 12px; font-weight: 500; margin-right: 12px; color: ${f.status.includes('✓') ? '#188038' : '#5f6368'};`;

                row.append(cb, nameSpan, statusSpan);
                listUI.appendChild(row);
            });
        }

        function updateCbAll() {
            const all = dlFileList.every(f => f.selected);
            const none = dlFileList.every(f => !f.selected);
            cbAll.checked = all; cbAll.indeterminate = !all && !none;
        }

        cbAll.onchange = (e) => { dlFileList.forEach(f => f.selected = e.target.checked); renderDownloadList(); };
        btnCancel.onclick = () => { if(!isDownloading) dlOverlay.remove(); };

        renderDownloadList();

        btnStart.onclick = async () => {
            const selected = dlFileList.filter(f => f.selected);
            if(selected.length === 0 || isDownloading) return;

            isDownloading = true; btnStart.disabled = true; btnCancel.disabled = true; closeBtn.style.display = 'none'; formatSelect.disabled = true; cbAll.disabled = true;
            btnStart.textContent = 'מוריד...';

            const format = formatSelect.value;
            dlOverlay.style.opacity = '0.7';

            for (let i = 0; i < selected.length; i++) {
                const f = selected[i];
                f.status = 'קורא...'; renderDownloadList();

                const before = readMonaco('');
                const beforeSig = before ? before.uri + '|' + before.value.length : '';

                await activateFile(f, dlOverlay);
                const result = await waitForContent(f.name, beforeSig, dlOverlay);

                if (result && result.value != null) {
                    let dlName = f.name;
                    if (format === 'txt') dlName = dlName.replace(/\.(gs|html|json)$/i, '') + '.txt';
                    downloadOne(dlName, result.value);
                    f.status = 'הורד ✓';
                } else {
                    f.status = 'שגיאה ✗';
                }
                renderDownloadList();
                await sleep(400);
            }

            dlOverlay.style.opacity = '1';
            btnStart.textContent = 'הסתיים';
            setTimeout(() => { dlOverlay.remove(); }, 2000);
        };
    }

    // --- מעקב רציף ומיידי אחרי שינויי ניווט וכתובת ב-SPA ---
    window.addEventListener('popstate', () => setTimeout(createUI, 50));

    const origPushState = history.pushState;
    history.pushState = function() {
        origPushState.apply(this, arguments);
        setTimeout(createUI, 50);
    };

    const origReplaceState = history.replaceState;
    history.replaceState = function() {
        origReplaceState.apply(this, arguments);
        setTimeout(createUI, 50);
    };

    // בדיקה מחזורית קבועה (כל 250 מ"ש) להבטחת הזרקה או הסרה מיידית
    setInterval(createUI, 250);

})();
