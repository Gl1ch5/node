/**
 * panelManager.js — Settings panel + custom top-panel buttons
 * Provides the ⚙ Settings panel in Node mode, custom button CRUD, and
 * built-in AI node-editing actions (auto-title, spell-check, app builder).
 */

import { state } from './state.js';
import { createNode } from '../components/node.js';
import { complete, streamCompletion, getApiKey, getModel, getProvider, getBaseUrl, getHeaders } from './aiUtils.js';

// Lazy renderEdges accessor to avoid circular import chain
function getRenderEdges() {
    return import('../components/edge.js').then(m => m.renderEdges);
}

const STORAGE_KEY = 'nn_custom_buttons';
let customButtons = [];

// ── Storage ─────────────────────────────────────────────────────────────────

function loadFromStorage() {
    try { customButtons = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
    catch { customButtons = []; }
}

function saveToStorage() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(customButtons));
}

// ── Render a custom button onto the top panel ────────────────────────────────

function mountCustomButton(btn) {
    const topPanel = document.getElementById('top-panel');
    if (document.getElementById(`custom-btn-${btn.id}`)) return;

    const el = document.createElement('button');
    el.className = 'panel-btn';
    el.id = `custom-btn-${btn.id}`;
    el.title = btn.name;
    el.innerHTML = `${btn.svg || defaultSvg()}<span>${btn.name}</span>`;
    el.addEventListener('click', () => runCustomButton(btn));
    topPanel.appendChild(el);
}

function defaultSvg() {
    return `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" fill="none"/><line x1="12" y1="8" x2="12" y2="16" stroke="currentColor" stroke-width="2"/><line x1="8" y1="12" x2="16" y2="12" stroke="currentColor" stroke-width="2"/></svg>`;
}

function runCustomButton(btn) {
    try {
        const fn = new Function(
            'state', 'createNode', 'complete', 'streamCompletion', 'getApiKey', 'getModel', 'getProvider',
            btn.code
        );
        fn(state, createNode, complete, streamCompletion, getApiKey, getModel, getProvider);
    } catch (e) {
        alert(`Ошибка в кнопке "${btn.name}":\n${e.message}`);
    }
}

// ── Settings panel DOM helpers ────────────────────────────────────────────────

function refreshCustomList() {
    const list = document.getElementById('settings-custom-list');
    if (!list) return;
    list.innerHTML = '';

    if (customButtons.length === 0) {
        list.innerHTML = '<div style="font-size:11px;color:var(--text-muted);text-align:center;padding:8px 0;">Нет кастомных кнопок</div>';
        return;
    }

    customButtons.forEach(btn => {
        const item = document.createElement('div');
        item.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:6px;padding:5px 0;border-bottom:1px solid var(--node-border);';
        const nameEl = document.createElement('span');
        nameEl.style.cssText = 'font-size:12px;flex:1;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;';
        nameEl.textContent = btn.name;

        const removeBtn = document.createElement('button');
        removeBtn.style.cssText = 'background:transparent;border:none;color:#ff4444;cursor:pointer;font-size:18px;line-height:1;padding:0 2px;pointer-events:auto;';
        removeBtn.textContent = '✕';
        removeBtn.title = 'Удалить кнопку';
        removeBtn.addEventListener('click', () => {
            customButtons = customButtons.filter(b => b.id !== btn.id);
            saveToStorage();
            const panelBtn = document.getElementById(`custom-btn-${btn.id}`);
            if (panelBtn) panelBtn.remove();
            refreshCustomList();
        });

        item.appendChild(nameEl);
        item.appendChild(removeBtn);
        list.appendChild(item);
    });
}

// ── Built-in AI Actions ───────────────────────────────────────────────────────

/** Auto-title: renames nodes that still have the default title "Заметка" using AI */
async function autoTitleNodes() {
    const key = getApiKey();
    if (!key) { alert('Для автоназвания нужен API Key (откройте Лабораторию и введите ключ)'); return; }

    const defaultTitle = 'Заметка';
    const untitled = Object.entries(state.nodes).filter(([, n]) => {
        const titleEl = n.el.querySelector('.node-title');
        return titleEl && (titleEl.value === defaultTitle || titleEl.value.trim() === '');
    });

    if (untitled.length === 0) { alert('Все ноды уже имеют названия!'); return; }

    const btn = document.getElementById('btn-auto-title');
    if (btn) { btn.disabled = true; btn.title = `Обработка: 0 / ${untitled.length}`; }

    let done = 0;
    for (const [, node] of untitled) {
        const text = node.el.querySelector('.node-textarea')?.value?.trim() || '';
        if (!text) { done++; continue; }

        try {
            const msg = await complete({
                model: getModel(),
                max_tokens: 20,
                messages: [
                    { role: 'system', content: 'Дай заметке короткое название (2–5 слов). Ответь ТОЛЬКО названием, без кавычек и пунктуации.' },
                    { role: 'user', content: text.slice(0, 400) }
                ]
            });
            const title = msg.content?.trim().replace(/^["']|["']$/g, '').slice(0, 50);
            if (title) node.el.querySelector('.node-title').value = title;
        } catch (e) {
            alert(`Ошибка автоназвания: ${e.message}`);
        }

        done++;
        if (btn) btn.title = `Обработка: ${done} / ${untitled.length}`;
    }

    if (btn) { btn.disabled = false; btn.title = 'Авто-названия нод'; }
}

/** Spell check & grammar fix on selected nodes */
async function spellCheckNodes() {
    const key = getApiKey();
    if (!key) { alert('Для проверки орфографии нужен API Key'); return; }

    const selected = Array.from(state.selectedNodeIds)
        .map(id => state.nodes[id])
        .filter(Boolean);

    const targets = selected.length > 0 ? selected : Object.values(state.nodes);
    if (targets.length === 0) { alert('Нет нод для проверки'); return; }

    const btn = document.getElementById('btn-spellcheck');
    if (btn) { btn.disabled = true; btn.title = 'Проверка...'; }

    for (const node of targets) {
        const ta = node.el.querySelector('.node-textarea');
        if (!ta || !ta.value.trim() || ta.readOnly) continue;
        const original = ta.value;
        try {
            const msg = await complete({
                model: getModel(),
                max_tokens: 1024,
                messages: [
                    { role: 'system', content: 'Исправь орфографические и грамматические ошибки в тексте. Верни ТОЛЬКО исправленный текст, без пояснений и изменений смысла.' },
                    { role: 'user', content: original }
                ]
            });
            if (msg.content?.trim()) ta.value = msg.content.trim();
        } catch (e) {
            alert(`Ошибка проверки орфографии: ${e.message}`);
        }
    }

    if (btn) { btn.disabled = false; btn.title = 'Исправить орфографию'; }
}

/** App builder: generate a downloadable single-file HTML app from all node content */
async function buildApp() {
    const key = getApiKey();
    if (!key) { alert('Для построения приложения нужен API Key'); return; }

    const allNotes = Object.entries(state.nodes).map(([, n], i) => {
        const title = n.el.querySelector('.node-title')?.value || `Нода ${i+1}`;
        const text = n.el.querySelector('.node-textarea')?.value || '';
        return `### ${title}\n${text}`;
    }).join('\n\n');

    if (!allNotes.trim()) { alert('Нет нод с содержимым'); return; }

    const btn = document.getElementById('btn-app-builder');
    if (btn) { btn.disabled = true; btn.title = 'Генерация...'; }

    // Create output node
    const cx = state.transform.x + (window.innerWidth / 2) / state.transform.scale;
    const cy = state.transform.y + (window.innerHeight / 2) / state.transform.scale;
    const newId = createNode(cx + 200, cy - 100);
    const newNode = state.nodes[newId];
    newNode.el.querySelector('.node-title').value = '🔨 Generated App';
    newNode.el.style.minWidth = '380px';
    const ta = newNode.el.querySelector('.node-textarea');
    ta.value = '⏳ Генерация приложения...';
    ta.style.minHeight = '200px';
    ta.readOnly = true;

    // Download button
    const dlBtn = document.createElement('button');
    dlBtn.textContent = '⬇ Скачать HTML';
    dlBtn.style.cssText = 'margin-top:8px;width:100%;background:#22c55e;color:white;border:none;border-radius:8px;padding:8px;font-size:12px;font-weight:600;cursor:pointer;pointer-events:auto;font-family:Inter,sans-serif;';
    dlBtn.style.display = 'none';
    dlBtn.addEventListener('pointerdown', e => e.stopPropagation());
    dlBtn.addEventListener('click', () => {
        const blob = new Blob([ta.value], { type: 'text/html' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'app.html';
        a.click();
    });
    newNode.el.querySelector('.node-body').appendChild(dlBtn);

    try {
        let generated = '';
        ta.value = '';
        await streamCompletion(
            {
                model: getModel(),
                max_tokens: 8192,
                messages: [
                    { role: 'system', content: 'Ты опытный web-разработчик. На основе предоставленных заметок создай полноценное одностраничное HTML приложение (всё в одном файле: HTML, CSS в теге <style>, JS в теге <script>). Сделай красивый современный дизайн с тёмной темой, анимациями и удобным интерфейсом. Верни ТОЛЬКО код HTML начиная с <!DOCTYPE html>, без объяснений.' },
                    { role: 'user', content: `Заметки:\n\n${allNotes}` }
                ]
            },
            (chunk) => {
                generated += chunk;
                ta.value = generated;
                ta.scrollTop = ta.scrollHeight;
            }
        );
        dlBtn.style.display = 'block';
    } catch (e) {
        ta.value = `❌ Ошибка: ${e.message}`;
    } finally {
        if (btn) { btn.disabled = false; btn.title = 'Построить приложение'; }
    }
}

// ── Init ──────────────────────────────────────────────────────────────────────

import { installedMods, removeMod, handleModFile } from './modManager.js';

export function initPanelManager() {
    loadFromStorage();

    // Mount saved custom buttons
    customButtons.forEach(mountCustomButton);

    // Settings panel toggle
    const settingsPanel = document.getElementById('settings-panel');
    const btnSettings = document.getElementById('btn-settings');

    btnSettings?.addEventListener('click', () => {
        if (!settingsPanel) return;
        settingsPanel.style.display = settingsPanel.style.display === 'none' ? 'flex' : 'none';
        settingsPanel.classList.toggle('active');
    });

    // Close settings panel when clicking outside
    document.addEventListener('pointerdown', (e) => {
        if (!settingsPanel) return;
        if (settingsPanel.classList.contains('active') && !settingsPanel.contains(e.target) && !e.target.closest('#btn-settings')) {
            settingsPanel.classList.remove('active');
            settingsPanel.style.display = 'none';
        }
    });

    // --- AI Settings Setup ---
    const providerSelect = document.getElementById('lab-provider-select');
    const groqSection = document.getElementById('lab-groq-section');
    const deepseekSection = document.getElementById('lab-deepseek-section');
    const groqKeyInput = document.getElementById('lab-api-key');
    const deepseekKeyInput = document.getElementById('lab-deepseek-key');
    const modelSelect = document.getElementById('lab-model-select');
    const btnFetchModels = document.getElementById('btn-fetch-models');

    // Restore saved API Keys
    if (groqKeyInput) groqKeyInput.value = localStorage.getItem('nn_groq_key') || '';
    if (deepseekKeyInput) deepseekKeyInput.value = localStorage.getItem('nn_deepseek_key') || '';
    if (providerSelect) providerSelect.value = localStorage.getItem('nn_provider') || 'groq';

    const DEEPSEEK_MODELS = [
        { id: 'deepseek-chat', label: 'deepseek-chat (Default)' },
        { id: 'deepseek-reasoner', label: 'deepseek-reasoner' }
    ];

    if (providerSelect) {
        providerSelect.addEventListener('change', () => {
            localStorage.setItem('nn_provider', providerSelect.value);
            const isDeepSeek = providerSelect.value === 'deepseek';
            groqSection.style.display = isDeepSeek ? 'none' : 'flex';
            deepseekSection.style.display = isDeepSeek ? 'flex' : 'none';

            if (isDeepSeek) {
                modelSelect.innerHTML = '';
                DEEPSEEK_MODELS.forEach(m => {
                    const opt = document.createElement('option');
                    opt.value = m.id; opt.textContent = m.label;
                    modelSelect.appendChild(opt);
                });
            } else {
                modelSelect.innerHTML = '<option value="llama3-8b-8192">llama3-8b-8192 (Default)</option><option value="openai/gpt-oss-120b">openai/gpt-oss-120b</option>';
            }
        });
        // Trigger initial state
        providerSelect.dispatchEvent(new Event('change'));
    }

    if (groqKeyInput) groqKeyInput.addEventListener('input', () => localStorage.setItem('nn_groq_key', groqKeyInput.value.trim()));
    if (deepseekKeyInput) deepseekKeyInput.addEventListener('input', () => localStorage.setItem('nn_deepseek_key', deepseekKeyInput.value.trim()));

    if (btnFetchModels) {
        btnFetchModels.addEventListener('click', async () => {
            const apiKey = getApiKey();
            if (!apiKey) { alert('Введите API Key для загрузки моделей'); return; }
            const provider = getProvider();
            try {
                btnFetchModels.textContent = '...';
                if (provider === 'deepseek') {
                    modelSelect.innerHTML = '';
                    DEEPSEEK_MODELS.forEach(m => {
                        const opt = document.createElement('option');
                        opt.value = m.id; opt.textContent = m.label;
                        modelSelect.appendChild(opt);
                    });
                } else {
                    const res = await fetch('https://api.groq.com/openai/v1/models', {
                        headers: { 'Authorization': `Bearer ${apiKey}` }
                    });
                    if (!res.ok) throw new Error('Ошибка при загрузке моделей');
                    const data = await res.json();
                    modelSelect.innerHTML = '';
                    data.data.forEach(m => {
                        const opt = document.createElement('option');
                        opt.value = m.id; opt.textContent = m.id;
                        modelSelect.appendChild(opt);
                    });
                }
            } catch(e) {
                alert(e.message);
            } finally {
                btnFetchModels.textContent = 'Загрузить Модели';
            }
        });
    }

    // --- Mods Setup ---
    const modsListEl = document.getElementById('settings-mods-list');
    const modUpload = document.getElementById('settings-mod-upload');

    const renderModsList = () => {
        if (!modsListEl) return;
        modsListEl.innerHTML = '';
        if (installedMods.length === 0) {
            modsListEl.innerHTML = '<div style="font-size:11px;color:var(--text-muted);text-align:center;padding:8px 0;">Нет установленных модов</div>';
            return;
        }
        installedMods.forEach((mod) => {
            const item = document.createElement('div');
            item.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:6px;padding:5px 0;border-bottom:1px solid var(--node-border);';
            const nameEl = document.createElement('span');
            nameEl.style.cssText = 'font-size:12px;flex:1;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;';
            nameEl.textContent = '🧩 ' + mod.name;

            const removeBtn = document.createElement('button');
            removeBtn.style.cssText = 'background:transparent;border:none;color:#ff4444;cursor:pointer;font-size:18px;line-height:1;padding:0 2px;pointer-events:auto;';
            removeBtn.textContent = '✕';
            removeBtn.title = 'Удалить мод';
            removeBtn.addEventListener('click', () => {
                removeMod(mod.id);
                renderModsList();
            });

            item.appendChild(nameEl);
            item.appendChild(removeBtn);
            modsListEl.appendChild(item);
        });
    };
    renderModsList();

    if (modUpload) {
        modUpload.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            // Need api wrapper to load mod
            import('./state.js').then(m => {
                import('../components/node.js').then(nm => {
                    import('../components/edge.js').then(em => {
                        import('./nodeRegistry.js').then(rm => {
                            handleModFile(file, {
                                state: m.state, createNode: nm.createNode, renderEdges: em.renderEdges,
                                complete, streamCompletion, getApiKey, getModel, getProvider,
                                registerNodeType: rm.registerNodeType
                            });
                            setTimeout(renderModsList, 500); // Wait for load
                        });
                    });
                });
            });
        });
    }

    // Add custom button
    document.getElementById('btn-custom-btn-add')?.addEventListener('click', () => {
        const nameInput = document.getElementById('settings-btn-name');
        const svgInput = document.getElementById('settings-btn-svg');
        const codeInput = document.getElementById('settings-btn-code');

        const name = nameInput?.value.trim();
        const code = codeInput?.value.trim();
        if (!name || !code) { alert('Укажите название и JS-код кнопки'); return; }

        const btn = {
            id: 'cb_' + Math.random().toString(36).substr(2, 8),
            name,
            svg: svgInput?.value.trim() || defaultSvg(),
            code
        };

        customButtons.push(btn);
        saveToStorage();
        mountCustomButton(btn);
        refreshCustomList();

        if (nameInput) nameInput.value = '';
        if (svgInput) svgInput.value = '';
        if (codeInput) codeInput.value = '';
    });

    refreshCustomList();

    // Built-in AI Buttons
    document.getElementById('btn-auto-title')?.addEventListener('click', autoTitleNodes);
    document.getElementById('btn-spellcheck')?.addEventListener('click', spellCheckNodes);
    document.getElementById('btn-app-builder')?.addEventListener('click', buildApp);
}
