/* ========================================================================
   Edmond Yang — macOS desktop portfolio
   Window manager, dock, menubar
   ====================================================================== */
(() => {
'use strict';

/* ---------- WINDOW REGISTRY ----------
   id maps to a <template id="tpl-{id}"> in the DOM.
   ------------------------------------------------ */
const APPS = {
    about:          { title: 'About Me',        appName: 'Notes',      w: 900, h: 660, x: 0.18, y: 0.14 },
    resume:         { title: 'Resume.pdf',      appName: 'Preview',    w: 680, h: 540, x: 0.22, y: 0.10 },
    experience:     { title: 'Experience',      appName: 'Finder',     w: 620, h: 400, x: 0.20, y: 0.18 },
    portfolio:      { title: 'Portfolio',       appName: 'Finder',     w: 640, h: 440, x: 0.16, y: 0.12 },
    contact:        { title: 'New Message',     appName: 'Mail',       w: 560, h: 480, x: 0.26, y: 0.16 },
    terminal:       { title: 'ghostty',          appName: 'Ghostty',    w: 600, h: 380, x: 0.30, y: 0.22 },
    trash:          { title: 'Trash',           appName: 'Finder',     w: 360, h: 260, x: 0.40, y: 0.28 },
    'proj-salon':   { title: 'Perfect Salon',   appName: 'Safari',     w: 580, h: 540, x: 0.34, y: 0.10 },
    'proj-loofi':   { title: 'LooFi',           appName: 'Safari',     w: 580, h: 540, x: 0.36, y: 0.10 },
    'proj-planttum':{ title: 'Planttum',        appName: 'Safari',     w: 580, h: 540, x: 0.38, y: 0.10 },
};

/* ---------- WINDOW MANAGER ---------- */
class WindowManager {
    constructor(layer) {
        this.layer = layer;
        this.windows = new Map();   // id -> { el, app }
        this.zCounter = 100;
        this.activeId = null;
    }

    open(id) {
        if (this.windows.has(id)) { this.focus(id); return; }
        const app = APPS[id];
        if (!app) { console.warn('Unknown app:', id); return; }
        const tpl = document.getElementById(`tpl-${id}`);
        if (!tpl) { console.warn('Missing template for:', id); return; }

        const win = document.createElement('section');
        win.className = 'window';
        win.dataset.id = id;
        win.style.width = `${app.w}px`;
        win.style.height = `${app.h}px`;

        // Position (relative coords, with viewport clamping)
        const maxX = window.innerWidth - app.w - 20;
        const maxY = window.innerHeight - app.h - 80;
        const baseX = clamp(window.innerWidth * app.x, 20, Math.max(20, maxX));
        const baseY = clamp(window.innerHeight * app.y + 26, 40, Math.max(40, maxY));
        // Cascade open windows so they don't perfectly stack
        const cascade = this.windows.size * 22;
        win.style.left = `${clamp(baseX + cascade, 10, maxX)}px`;
        win.style.top = `${clamp(baseY + cascade, 32, maxY)}px`;

        // Chrome
        win.innerHTML = `
            <header class="titlebar">
                <div class="traffic">
                    <span class="close" data-action="close" title="Close"></span>
                    <span class="min" data-action="min" title="Minimize"></span>
                    <span class="max" data-action="max" title="Maximize"></span>
                </div>
                <div class="title-text">${escapeHtml(app.title)}</div>
                <div class="title-spacer"></div>
            </header>
            <div class="window-body"></div>
            <div class="resize-handle resize-n"  data-resize="n"></div>
            <div class="resize-handle resize-s"  data-resize="s"></div>
            <div class="resize-handle resize-e"  data-resize="e"></div>
            <div class="resize-handle resize-w"  data-resize="w"></div>
            <div class="resize-handle resize-nw" data-resize="nw"></div>
            <div class="resize-handle resize-ne" data-resize="ne"></div>
            <div class="resize-handle resize-sw" data-resize="sw"></div>
            <div class="resize-handle resize-se" data-resize="se"></div>
        `;
        win.querySelector('.window-body').appendChild(tpl.content.cloneNode(true));

        this.layer.appendChild(win);
        this.windows.set(id, { el: win, app });

        this._wireWindow(id, win);
        this.focus(id);
        this._markDockActive();
    }

    close(id) {
        const w = this.windows.get(id);
        if (!w) return;
        w.el.classList.add('closing');
        setTimeout(() => {
            w.el.remove();
            this.windows.delete(id);
            if (this.activeId === id) {
                this.activeId = null;
                // Promote topmost remaining window
                const last = [...this.windows.keys()].pop();
                if (last) this.focus(last);
            }
            this._markDockActive();
        }, 140);
    }

    minimize(id) {
        const w = this.windows.get(id);
        if (!w) return;
        w.el.classList.add('minimizing');
        setTimeout(() => {
            w.el.style.display = 'none';
            w.el.classList.remove('minimizing');
            if (this.activeId === id) {
                this.activeId = null;
            }
        }, 320);
    }

    toggleMax(id) {
        const w = this.windows.get(id);
        if (!w) return;
        const el = w.el;
        if (el.dataset.maxed === '1') {
            const r = JSON.parse(el.dataset.restore);
            Object.assign(el.style, r);
            delete el.dataset.maxed;
            delete el.dataset.restore;
        } else {
            el.dataset.restore = JSON.stringify({
                left: el.style.left, top: el.style.top,
                width: el.style.width, height: el.style.height,
            });
            el.style.left = '20px';
            el.style.top = '40px';
            el.style.width = `${window.innerWidth - 40}px`;
            el.style.height = `${window.innerHeight - 100}px`;
            el.dataset.maxed = '1';
        }
    }

    fitContent(id, { center = true } = {}) {
        const w = this.windows.get(id);
        if (!w) return;
        const titlebar = w.el.querySelector('.titlebar');
        const body = w.el.querySelector('.window-body');
        if (!titlebar || !body) return;
        const titleH = titlebar.offsetHeight;
        const desiredH = body.scrollHeight + titleH + 4;
        const newH = clamp(desiredH, 240, window.innerHeight - 80);
        w.el.style.height = `${newH}px`;
        if (center) {
            const rect = w.el.getBoundingClientRect();
            const newTop = clamp((window.innerHeight - newH) / 2, 32, window.innerHeight - newH - 40);
            const newLeft = clamp((window.innerWidth - rect.width) / 2, 10, window.innerWidth - rect.width - 10);
            w.el.style.top = `${newTop}px`;
            w.el.style.left = `${newLeft}px`;
        }
    }

    focus(id) {
        const w = this.windows.get(id);
        if (!w) return;
        // Un-minimize if hidden
        if (w.el.style.display === 'none') {
            w.el.style.display = '';
        }
        // Mark all inactive
        for (const [otherId, other] of this.windows) {
            if (otherId !== id) other.el.classList.add('inactive');
        }
        w.el.classList.remove('inactive');
        w.el.style.zIndex = ++this.zCounter;
        this.activeId = id;
    }

    _markDockActive() {
        const openAppKeys = new Set(this.windows.keys());
        document.querySelectorAll('.dock-app[data-open]').forEach(btn => {
            const target = btn.dataset.open;
            btn.classList.toggle('active', openAppKeys.has(target));
        });
    }

    _wireWindow(id, win) {
        // Traffic lights
        win.querySelector('[data-action="close"]').addEventListener('click', e => {
            e.stopPropagation();
            this.close(id);
        });
        win.querySelector('[data-action="min"]').addEventListener('click', e => {
            e.stopPropagation();
            this.minimize(id);
        });
        win.querySelector('[data-action="max"]').addEventListener('click', e => {
            e.stopPropagation();
            this.toggleMax(id);
        });

        // Focus on any click
        win.addEventListener('mousedown', () => this.focus(id));

        // Drag by titlebar
        const tb = win.querySelector('.titlebar');
        let drag = null;
        tb.addEventListener('mousedown', e => {
            if (e.target.closest('.traffic')) return;
            if (win.dataset.maxed === '1') return;
            const rect = win.getBoundingClientRect();
            drag = { dx: e.clientX - rect.left, dy: e.clientY - rect.top };
            document.body.style.userSelect = 'none';
        });
        const onMove = e => {
            if (!drag) return;
            const x = clamp(e.clientX - drag.dx, -win.offsetWidth + 80, window.innerWidth - 80);
            const y = clamp(e.clientY - drag.dy, 26, window.innerHeight - 60);
            win.style.left = `${x}px`;
            win.style.top = `${y}px`;
        };
        const onUp = () => {
            if (drag) document.body.style.userSelect = '';
            drag = null;
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
        win.addEventListener('remove', () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        });

        // Double-click titlebar to toggle max
        tb.addEventListener('dblclick', e => {
            if (e.target.closest('.traffic')) return;
            this.toggleMax(id);
        });

        // Resize handles
        const MIN_W = 320, MIN_H = 200;
        win.querySelectorAll('.resize-handle').forEach(handle => {
            handle.addEventListener('mousedown', e => {
                e.stopPropagation();
                e.preventDefault();
                if (win.dataset.maxed === '1') return;
                this.focus(id);
                const dir = handle.dataset.resize;
                const rect = win.getBoundingClientRect();
                const start = {
                    x: e.clientX, y: e.clientY,
                    w: rect.width, h: rect.height,
                    left: rect.left, top: rect.top,
                };

                const onResize = ev => {
                    const dx = ev.clientX - start.x;
                    const dy = ev.clientY - start.y;
                    let w = start.w, h = start.h, l = start.left, t = start.top;
                    if (dir.includes('e')) w = Math.max(MIN_W, start.w + dx);
                    if (dir.includes('s')) h = Math.max(MIN_H, start.h + dy);
                    if (dir.includes('w')) {
                        w = Math.max(MIN_W, start.w - dx);
                        l = start.left + (start.w - w);
                    }
                    if (dir.includes('n')) {
                        h = Math.max(MIN_H, start.h - dy);
                        t = Math.max(0, start.top + (start.h - h));
                    }
                    win.style.width = `${w}px`;
                    win.style.height = `${h}px`;
                    win.style.left = `${l}px`;
                    win.style.top = `${t}px`;
                };
                const onUpResize = () => {
                    document.removeEventListener('mousemove', onResize);
                    document.removeEventListener('mouseup', onUpResize);
                    document.body.style.userSelect = '';
                    document.body.style.cursor = '';
                };
                document.body.style.userSelect = 'none';
                document.body.style.cursor = handle.style.cursor || getComputedStyle(handle).cursor;
                document.addEventListener('mousemove', onResize);
                document.addEventListener('mouseup', onUpResize);
            });
        });

        // Wire any in-window data-open buttons (e.g. portfolio tiles → project windows)
        win.querySelectorAll('[data-open]').forEach(btn => {
            btn.addEventListener('click', e => {
                e.stopPropagation();
                this.open(btn.dataset.open);
            });
        });

        // Wire contact form to submit via AJAX so it stays in-window
        const form = win.querySelector('#contact-form');
        if (form) wireMailForm(form, win);
    }
}

/* ---------- MAIL (contact) FORM ---------- */
function wireMailForm(form, win) {
    form.addEventListener('submit', async e => {
        e.preventDefault();
        const sendBtn = form.querySelector('.mail-send');
        const originalText = sendBtn.innerHTML;
        sendBtn.disabled = true;
        sendBtn.textContent = 'Sending…';

        // Pull values from fields outside the <form> (they reference it via form="contact-form")
        const data = new FormData(form);
        // Mail "From:" + "Subject:" inputs live outside <form> but reference it via form attr,
        // so FormData picks them up automatically when the browser supports it.
        // Fallback: read explicitly.
        win.querySelectorAll('.mail-fields input[name]').forEach(inp => {
            if (!data.has(inp.name)) data.append(inp.name, inp.value);
        });

        try {
            const res = await fetch(form.action, {
                method: 'POST',
                body: data,
                headers: { Accept: 'application/json' },
            });
            if (res.ok) {
                sendBtn.classList.add('success');
                sendBtn.innerHTML = '✓ Sent';
                form.reset();
                setTimeout(() => {
                    sendBtn.classList.remove('success');
                    sendBtn.disabled = false;
                    sendBtn.innerHTML = originalText;
                }, 2400);
            } else {
                throw new Error('Form submission failed');
            }
        } catch (err) {
            sendBtn.disabled = false;
            sendBtn.innerHTML = originalText;
            alert('Could not send. Try again or email edmondyang11@gmail.com directly.');
        }
    });
}

/* ---------- DESKTOP ICONS: SELECT + DOUBLE-CLICK ---------- */
function wireDesktopIcons(wm) {
    const icons = document.querySelectorAll('.desktop-icon');
    icons.forEach(icon => {
        icon.addEventListener('click', e => {
            e.stopPropagation();
            icons.forEach(i => i.classList.remove('selected'));
            icon.classList.add('selected');
        });
        icon.addEventListener('dblclick', () => {
            launchWithBounce(icon.dataset.open);
            wm.open(icon.dataset.open);
        });
    });
    // Click outside deselects
    document.getElementById('desktop').addEventListener('click', e => {
        if (e.target.id === 'desktop' || e.target.classList.contains('window-layer')) {
            icons.forEach(i => i.classList.remove('selected'));
        }
    });
}

/* ---------- DOCK ---------- */
function wireDock(wm) {
    document.querySelectorAll('.dock-app[data-open]').forEach(btn => {
        btn.addEventListener('click', () => {
            launchWithBounce(btn.dataset.open);
            wm.open(btn.dataset.open);
        });
    });
}

function launchWithBounce(id) {
    const btn = document.querySelector(`.dock-app[data-open="${id}"]`);
    if (!btn) return;
    btn.classList.remove('launching');
    void btn.offsetWidth;
    btn.classList.add('launching');
    setTimeout(() => btn.classList.remove('launching'), 700);
}

/* ---------- MOBILE FALLBACK ---------- */
function wireMobile() {
    const view = document.getElementById('mobile-view');
    const sheet = document.getElementById('mobile-sheet');
    const sheetBody = document.getElementById('mobile-sheet-body');
    const closeBtn = document.getElementById('mobile-close');

    const isMobile = () => window.matchMedia('(max-width: 768px), (pointer: coarse) and (max-width: 1024px)').matches;
    if (isMobile()) view.hidden = false;

    document.querySelectorAll('.mobile-app[data-open]').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.open;
            const tpl = document.getElementById(`tpl-${id}`);
            if (!tpl) return;
            const app = APPS[id];
            sheetBody.innerHTML = '';
            const header = document.createElement('div');
            header.style.cssText = 'padding: 18px 20px 8px; font-size: 17px; font-weight: 700;';
            header.textContent = app ? app.title : id;
            sheetBody.appendChild(header);
            sheetBody.appendChild(tpl.content.cloneNode(true));
            // Wire any nested data-open inside the sheet (e.g. portfolio → project)
            sheetBody.querySelectorAll('[data-open]').forEach(b => {
                b.addEventListener('click', () => {
                    const childTpl = document.getElementById(`tpl-${b.dataset.open}`);
                    const childApp = APPS[b.dataset.open];
                    if (childTpl) {
                        sheetBody.innerHTML = '';
                        const h2 = document.createElement('div');
                        h2.style.cssText = 'padding: 18px 20px 8px; font-size: 17px; font-weight: 700;';
                        h2.textContent = childApp ? childApp.title : b.dataset.open;
                        sheetBody.appendChild(h2);
                        sheetBody.appendChild(childTpl.content.cloneNode(true));
                    }
                });
            });
            // Wire contact form
            const f = sheetBody.querySelector('#contact-form');
            if (f) wireMailForm(f, sheetBody);
            sheet.hidden = false;
        });
    });
    closeBtn.addEventListener('click', () => { sheet.hidden = true; });
}

/* ---------- HELPERS ---------- */
function clamp(v, min, max) { return Math.min(Math.max(v, min), max); }
function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

/* ---------- BOOT ---------- */
document.addEventListener('DOMContentLoaded', () => {
    const layer = document.getElementById('window-layer');
    const wm = new WindowManager(layer);
    window.__wm = wm;  // expose for debugging

    wireDesktopIcons(wm);
    wireDock(wm);
    wireMobile();

    // Greeter: open the About window on first load (delay so layout settles)
    if (!window.matchMedia('(max-width: 768px)').matches) {
        setTimeout(() => {
            wm.open('about');
            requestAnimationFrame(() => wm.fitContent('about'));
        }, 250);
    }
});

})();
