/**
 * persistence.js — Auto-save, undo history, and JSON drag-drop import
 *
 * Auto-save: debounced save of nodes+edges to localStorage on every mutation.
 * History:   Ctrl+Z snaps back through a ring buffer of JSON snapshots.
 * Import:    Drag a .json export file onto the canvas to restore nodes.
 */

import { state } from './state.js';

const SAVE_KEY   = 'nn_workspace';
const HISTORY_KEY = 'nn_history';
const MAX_HISTORY = 30;
const DEBOUNCE_MS = 800;

// ── Internal history ring ────────────────────────────────────────────────────
let historyStack = [];
let saveTimer    = null;
let suppressSave = false;  // prevent re-saving while restoring

// ── Serialise current workspace (nodes + edges + transform) ─────────────────
function serialise() {
    return {
        nodes: Object.entries(state.nodes).map(([id, n]) => {
            const nodeData = {
                id,
                x: Math.round(n.x),
                y: Math.round(n.y),
                type: n.type || 'text',
                title: n.el.querySelector('.node-title')?.value ?? '',
                customFields: {}
            };

            // Serialize all input fields, textareas, and selects inside the node body
            const body = n.el.querySelector('.node-body');
            if (body) {
                const inputs = body.querySelectorAll('input, textarea, select');
                inputs.forEach((input, index) => {
                    if (input.type === 'checkbox') {
                        nodeData.customFields[index] = input.checked;
                    } else {
                        nodeData.customFields[index] = input.value;
                    }
                });
            }
            return nodeData;
        }),
        edges: state.edges.map(e => ({ ...e })),
        transform: { ...state.transform }
    };
}

// ── Apply a snapshot (clear workspace, recreate nodes+edges) ─────────────────
export async function applySnapshot(data, { keepHistory = false } = {}) {
    suppressSave = true;

    const { createNode } = await import('../components/node.js');
    const { renderEdges } = await import('../components/edge.js');
    const { updateTransform } = await import('./workspace.js');

    // Clear existing nodes
    Object.keys(state.nodes).forEach(id => {
        state.nodes[id].el.remove();
        delete state.nodes[id];
    });
    state.edges.length = 0;

    // Restore transform
    if (data.transform) {
        state.transform.x     = data.transform.x;
        state.transform.y     = data.transform.y;
        state.transform.scale = data.transform.scale;
        updateTransform();
    }

    // Recreate nodes — build an id-remap table in case ids clash
    const idMap = {};
    (data.nodes || []).forEach(n => {
        const newId = createNode(n.x, n.y, n.type || 'text');
        idMap[n.id] = newId;
        const nodeEl = state.nodes[newId].el;
        const titleEl = nodeEl.querySelector('.node-title');

        if (titleEl) titleEl.value = n.title || '';

        // Restore custom fields (inputs, textareas, selects)
        if (n.customFields) {
            const body = nodeEl.querySelector('.node-body');
            if (body) {
                const inputs = body.querySelectorAll('input, textarea, select');
                inputs.forEach((input, index) => {
                    if (n.customFields[index] !== undefined) {
                        if (input.type === 'checkbox') {
                            input.checked = n.customFields[index];
                        } else {
                            input.value = n.customFields[index];
                        }
                    }
                });
            }
        } else {
            // Backwards compatibility with old format
            const textEl = nodeEl.querySelector('.node-textarea');
            if (textEl) textEl.value = n.text || '';
        }
    });

    // Recreate edges with remapped ids
    (data.edges || []).forEach(e => {
        const from = idMap[e.fromNode] ?? e.fromNode;
        const to   = idMap[e.toNode]   ?? e.toNode;
        if (state.nodes[from] && state.nodes[to]) {
            state.edges.push({ fromNode: from, toNode: to, fromType: e.fromType, toType: e.toType });
        }
    });

    renderEdges();
    suppressSave = false;

    if (!keepHistory) triggerSave();
}

// ── Push current state onto history stack ────────────────────────────────────
function pushHistory() {
    const snap = serialise();
    historyStack.push(snap);
    if (historyStack.length > MAX_HISTORY) historyStack.shift();
    try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(historyStack));
    } catch { /* quota exceeded — drop oldest */ }
}

// ── Debounced auto-save ──────────────────────────────────────────────────────
export function triggerSave() {
    if (suppressSave) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
        pushHistory();
        const snap = serialise();
        try {
            localStorage.setItem(SAVE_KEY, JSON.stringify(snap));
        } catch { /* storage full */ }
    }, DEBOUNCE_MS);
}


async function undo() {
    if (historyStack.length < 2) {
        showToast('Нет истории для отмены');
        return;
    }
    historyStack.pop(); // discard current state
    const prev = historyStack[historyStack.length - 1];
    try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(historyStack));
    } catch {}
    await applySnapshot(prev, { keepHistory: true });
    showToast('↩ Отменено');
}

// ── Toast notification ───────────────────────────────────────────────────────
function showToast(msg, duration = 2000) {
    let el = document.getElementById('nn-toast');
    if (!el) {
        el = document.createElement('div');
        el.id = 'nn-toast';
        el.style.cssText = `
            position: fixed; bottom: 28px; left: 50%; transform: translateX(-50%);
            background: rgba(30,30,40,0.92); color: #fff; padding: 8px 20px;
            border-radius: 20px; font-size: 13px; font-family: Inter, sans-serif;
            pointer-events: none; z-index: 9999; opacity: 0;
            transition: opacity 0.2s; backdrop-filter: blur(8px);
            border: 1px solid rgba(255,255,255,0.12);
        `;
        document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.opacity = '1';
    clearTimeout(el._timer);
    el._timer = setTimeout(() => { el.style.opacity = '0'; }, duration);
}

// ── Drag & drop JSON import ──────────────────────────────────────────────────
function setupDragDrop() {
    const body = document.body;

    body.addEventListener('dragover', e => {
        if ([...e.dataTransfer.items].some(i => i.kind === 'file')) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
        }
    });

    body.addEventListener('drop', e => {
        const file = [...e.dataTransfer.files].find(f => f.name.endsWith('.json'));
        if (!file) return;
        e.preventDefault();

        const reader = new FileReader();
        reader.onload = evt => {
            try {
                const data = JSON.parse(evt.target.result);
                if (!data.nodes) throw new Error('Неверный формат файла');
                pushHistory();           // save current state before import
                applySnapshot(data);
                showToast(`✅ Импортировано: ${data.nodes.length} нод`);
            } catch (err) {
                showToast(`❌ Ошибка импорта: ${err.message}`, 3500);
            }
        };
        reader.readAsText(file);
    });

    // Visual drag overlay
    let dragoverEl = null;
    body.addEventListener('dragenter', e => {
        if (![...e.dataTransfer.items].some(i => i.kind === 'file')) return;
        if (!dragoverEl) {
            dragoverEl = document.createElement('div');
            dragoverEl.style.cssText = `
                position: fixed; inset: 0; z-index: 8888;
                background: rgba(100,140,255,0.08);
                border: 3px dashed rgba(100,140,255,0.5);
                border-radius: 12px; pointer-events: none;
                display: flex; align-items: center; justify-content: center;
            `;
            dragoverEl.innerHTML = `<div style="color:#a0b8ff;font-size:22px;font-family:Inter,sans-serif;font-weight:500;">📂 Отпустите JSON-файл для импорта</div>`;
            document.body.appendChild(dragoverEl);
        }
    });

    body.addEventListener('dragleave', e => {
        if (e.relatedTarget === null || !body.contains(e.relatedTarget)) {
            dragoverEl?.remove(); dragoverEl = null;
        }
    });

    body.addEventListener('drop', () => { dragoverEl?.remove(); dragoverEl = null; }, true);
}

// ── Init ─────────────────────────────────────────────────────────────────────
export function initPersistence() {
    // Restore history ring from storage
    try {
        const h = localStorage.getItem(HISTORY_KEY);
        if (h) historyStack = JSON.parse(h);
    } catch { historyStack = []; }

    // Restore last saved workspace
    const saved = localStorage.getItem(SAVE_KEY);
    if (saved) {
        try {
            const data = JSON.parse(saved);
            if (data.nodes?.length > 0 || data.edges?.length > 0) {
                applySnapshot(data, { keepHistory: true });
                showToast(`💾 Восстановлено: ${data.nodes.length} нод`, 3000);
            }
        } catch { /* corrupt save — ignore */ }
    }

    // Undo with Ctrl+Z / Cmd+Z
    window.addEventListener('keydown', e => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
            const tag = document.activeElement.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA') return; // let browser handle
            e.preventDefault();
            undo();
        }
    });

    setupDragDrop();

    // Watch for mutations to auto-save
    setupAutoSaveObserver();
}

// ── MutationObserver: save on title/text changes ─────────────────────────────
function setupAutoSaveObserver() {
    const container = document.getElementById('nodes-container');
    if (!container) return;

    // Text input changes
    container.addEventListener('input', () => triggerSave());

    // Node added / removed — observe container children
    const mo = new MutationObserver(() => triggerSave());
    mo.observe(container, { childList: true });
}

// ── Export helper (called from topPanel to also push history) ─────────────────
export function saveBeforeExport() {
    pushHistory();
}
