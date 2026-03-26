import { state, screenToWorld } from './state.js';
import { createNode, selectNode } from '../components/node.js';
import { renderEdges } from '../components/edge.js';

export const workspace = document.getElementById('workspace');
export const nodesContainer = document.getElementById('nodes-container');
export const svgLayer = document.getElementById('svg-layer');
const gridCanvas = document.getElementById('grid-canvas');
const gridCtx = gridCanvas.getContext('2d');

export const resizeObserver = new ResizeObserver(() => renderEdges());

export function drawGrid() {
    gridCanvas.width = window.innerWidth;
    gridCanvas.height = window.innerHeight;

    const style = getComputedStyle(document.body);
    gridCtx.fillStyle = style.getPropertyValue('--bg-color').trim();
    gridCtx.fillRect(0, 0, gridCanvas.width, gridCanvas.height);

    const scale = state.transform.scale;
    const tx = state.transform.x;
    const ty = state.transform.y;

    const level = Math.floor(Math.log(scale) / Math.log(5));
    const worldStep = 100 / Math.pow(5, level);
    const screenStep = worldStep * scale;
    const screenStepLarge = screenStep * 5;

    gridCtx.lineWidth = 1;

    gridCtx.strokeStyle = style.getPropertyValue('--grid-sub').trim();
    gridCtx.beginPath();
    for (let x = tx % screenStep; x < gridCanvas.width; x += screenStep) { gridCtx.moveTo(x, 0); gridCtx.lineTo(x, gridCanvas.height); }
    for (let y = ty % screenStep; y < gridCanvas.height; y += screenStep) { gridCtx.moveTo(0, y); gridCtx.lineTo(gridCanvas.width, y); }
    gridCtx.stroke();

    gridCtx.strokeStyle = style.getPropertyValue('--grid-main').trim();
    gridCtx.beginPath();
    for (let x = tx % screenStepLarge; x < gridCanvas.width; x += screenStepLarge) { gridCtx.moveTo(x, 0); gridCtx.lineTo(x, gridCanvas.height); }
    for (let y = ty % screenStepLarge; y < gridCanvas.height; y += screenStepLarge) { gridCtx.moveTo(0, y); gridCtx.lineTo(gridCanvas.width, y); }
    gridCtx.stroke();
}

export function updateTransform() {
    workspace.style.transform = `translate(${state.transform.x}px, ${state.transform.y}px) scale(${state.transform.scale})`;
    drawGrid();
}

// --- ГЛОБАЛЬНЫЕ СОБЫТИЯ (ПАН И ЗУМ) ---
let activePointers = new Map();
let initialPinchDist = 0, initialPinchScale = 1;
let lastTapTime = 0;
let isPanning = false;
let isSelecting = false;
let panStartX = 0, panStartY = 0;
let selectionStartX = 0, selectionStartY = 0;
let transformStartX = 0, transformStartY = 0;

const selectionBox = document.createElement('div');
selectionBox.id = 'selection-box';
selectionBox.style.cssText = 'display:none; position:absolute; border:1px solid var(--text-main); background:rgba(128,128,128,0.2); z-index:1500; pointer-events:none;';
document.body.appendChild(selectionBox);

/**
 * Returns true if the event target is a background element (canvas, body, workspace)
 * where panning should begin.
 */
function isBackgroundTarget(el) {
    if (!el) return true;
    const tag = el.tagName;
    if (tag === 'BODY' || tag === 'HTML' || tag === 'CANVAS') return true;
    if (el.id === 'workspace' || el.id === 'svg-layer' || el.id === 'nodes-container') return true;
    return false;
}

import { initNodeSearch } from '../components/nodeSearch.js';

export function initWorkspaceEvents() {
    const searchMenu = initNodeSearch();
    // --- Touch / Pointer events on document for pan ---
    document.addEventListener('pointerdown', (e) => {
        // Middle mouse button (button === 1) always pans, regardless of target
        const isMiddleMouse = e.pointerType === 'mouse' && e.button === 1;
        const isBackgroundClick = isBackgroundTarget(e.target);

        // Skip if it's not middle-mouse and not on the background
        if (!isMiddleMouse && !isBackgroundClick) return;
        // Skip panel, lab-menu, and other UI
        if (e.target.closest('#top-panel') || e.target.closest('#lab-menu') || e.target.closest('#settings-panel') || e.target.closest('#context-menu')) return;

        e.preventDefault();
        activePointers.set(e.pointerId, e);

        // Мультитач (Пинч зум)
        if (activePointers.size === 2) {
            isPanning = false;
            isSelecting = false;
            selectionBox.style.display = 'none';
            const pts = Array.from(activePointers.values());
            initialPinchDist = Math.hypot(pts[0].clientX - pts[1].clientX, pts[0].clientY - pts[1].clientY);
            initialPinchScale = state.transform.scale;
            return;
        }

        // Двойной тап/клик по фону для создания ноды (только левая кнопка мыши / тач)
        if (!isMiddleMouse && isBackgroundClick) {
            const now = Date.now();
            if (now - lastTapTime < 300) {
                const wPos = screenToWorld(e.clientX, e.clientY);
                createNode(wPos.x, wPos.y);
                lastTapTime = 0;
                return;
            }
            lastTapTime = now;
        }

        // Pan on middle mouse, OR on touch/pen (mobile) single finger background click.
        if (isMiddleMouse || (e.pointerType !== 'mouse' && isBackgroundClick)) {
            // Начало панорамирования фона
            isPanning = true;
            panStartX = e.clientX;
            panStartY = e.clientY;
            transformStartX = state.transform.x;
            transformStartY = state.transform.y;
            // Clear selection if panning on background
            if (isBackgroundClick && !e.shiftKey) selectNode(null);
        } else if (isBackgroundClick && e.button === 0 && e.pointerType === 'mouse') {
            // Начало выделения рамкой (Только для мыши)
            isSelecting = true;
            selectionStartX = e.clientX;
            selectionStartY = e.clientY;
            selectionBox.style.left = e.clientX + 'px';
            selectionBox.style.top = e.clientY + 'px';
            selectionBox.style.width = '0px';
            selectionBox.style.height = '0px';
            selectionBox.style.display = 'block';
            if (!e.shiftKey) selectNode(null); // Clear selection unless shift is held
        }

        document.setPointerCapture && document.body.setPointerCapture?.(e.pointerId);
    }, { passive: false });

    document.addEventListener('pointermove', (e) => {
        if (!isPanning && !isSelecting && activePointers.size < 2) return;
        if (!activePointers.has(e.pointerId)) return;

        e.preventDefault();
        activePointers.set(e.pointerId, e);

        // Обработка Pinch Зума
        if (activePointers.size === 2) {
            const pts = Array.from(activePointers.values());
            const dist = Math.hypot(pts[0].clientX - pts[1].clientX, pts[0].clientY - pts[1].clientY);
            const cx = (pts[0].clientX + pts[1].clientX) / 2;
            const cy = (pts[0].clientY + pts[1].clientY) / 2;

            const newScale = Math.max(0.01, Math.min(initialPinchScale * (dist / initialPinchDist), 100));
            const ratio = newScale / state.transform.scale;

            state.transform.x = cx - (cx - state.transform.x) * ratio;
            state.transform.y = cy - (cy - state.transform.y) * ratio;
            state.transform.scale = newScale;
            updateTransform();
        }
        // Обработка Панорамирования
        else if (isPanning && activePointers.size === 1) {
            state.transform.x = transformStartX + (e.clientX - panStartX);
            state.transform.y = transformStartY + (e.clientY - panStartY);
            updateTransform();
        }
        // Обработка выделения рамкой
        else if (isSelecting && activePointers.size === 1) {
            const currentX = e.clientX;
            const currentY = e.clientY;
            const left = Math.min(selectionStartX, currentX);
            const top = Math.min(selectionStartY, currentY);
            const width = Math.abs(currentX - selectionStartX);
            const height = Math.abs(currentY - selectionStartY);
            
            selectionBox.style.left = left + 'px';
            selectionBox.style.top = top + 'px';
            selectionBox.style.width = width + 'px';
            selectionBox.style.height = height + 'px';
        }
    }, { passive: false });

    const endGlobalPointer = (e) => {
        if (isSelecting && activePointers.has(e.pointerId)) {
            isSelecting = false;
            selectionBox.style.display = 'none';
            const sx = parseFloat(selectionBox.style.left);
            const sy = parseFloat(selectionBox.style.top);
            const sw = parseFloat(selectionBox.style.width);
            const sh = parseFloat(selectionBox.style.height);

            if (sw > 5 || sh > 5) {
                requestAnimationFrame(() => {
                    Object.entries(state.nodes).forEach(([id, node]) => {
                        const rect = node.el.getBoundingClientRect();
                        if (rect.left < sx + sw && rect.right > sx && rect.top < sy + sh && rect.bottom > sy) {
                            state.selectedNodeIds.add(id);
                            node.el.classList.add('selected');
                        }
                    });
                });
            }
        }
        activePointers.delete(e.pointerId);
        if (activePointers.size === 0) isPanning = false;
    };

    document.addEventListener('pointerup', endGlobalPointer);
    document.addEventListener('pointercancel', endGlobalPointer);

    // Колесико мыши — зум
    window.addEventListener('wheel', (e) => {
        if (e.target.tagName === 'TEXTAREA') return;
        e.preventDefault();

        const oldScale = state.transform.scale;
        let newScale = oldScale * (e.deltaY > 0 ? 0.85 : 1.15);
        newScale = Math.max(0.01, Math.min(newScale, 100));

        const ratio = newScale / oldScale;
        state.transform.x = e.clientX - (e.clientX - state.transform.x) * ratio;
        state.transform.y = e.clientY - (e.clientY - state.transform.y) * ratio;
        state.transform.scale = newScale;

        updateTransform();
    }, { passive: false });

    window.addEventListener('resize', () => { drawGrid(); renderEdges(); });

    // --- CONTEXT MENU (ПКМ) ---
    const contextMenu = document.createElement('div');
    contextMenu.id = 'context-menu';
    contextMenu.style.cssText = 'display:none; position:absolute; z-index:2000; background:var(--panel-bg); backdrop-filter:blur(10px); border:1px solid var(--panel-border); border-radius:8px; padding:4px 0; width:160px; box-shadow:0 4px 12px var(--node-shadow);';
    document.body.appendChild(contextMenu);

    const createMenuItem = (text, onClick) => {
        const item = document.createElement('div');
        item.textContent = text;
        item.style.cssText = 'padding:8px 16px; font-size:13px; cursor:pointer; color:var(--text-main); font-family:Inter,sans-serif;';
        item.addEventListener('mouseover', () => item.style.background = 'var(--btn-hover)');
        item.addEventListener('mouseout', () => item.style.background = 'transparent');
        item.addEventListener('click', () => { contextMenu.style.display = 'none'; onClick(); });
        return item;
    };

    let longPressTimer;
    let isLongPress = false;

    window.addEventListener('contextmenu', (e) => {
        // Only if clicking on background or nodes layer
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return; 
        e.preventDefault();

        if (state.selectedNodeIds.size > 0) {
            // Still show standard actions if nodes are selected
            contextMenu.innerHTML = '';
            contextMenu.appendChild(createMenuItem('📋 Копировать', () => import('../components/node.js').then(m => m.copySelectedNodes())));
            contextMenu.appendChild(createMenuItem('🔗 Объединить', () => import('../components/node.js').then(m => m.groupSelectedNodes())));
            contextMenu.appendChild(createMenuItem('🗑 Удалить все', () => {
                import('../components/node.js').then(m => {
                    const ids = Array.from(state.selectedNodeIds);
                    ids.forEach(id => m.deleteNode(id));
                    state.selectedNodeIds.clear();
                });
            }));
            contextMenu.style.left = e.clientX + 'px';
            contextMenu.style.top = e.clientY + 'px';
            contextMenu.style.display = 'block';
        } else {
            // Open Blender-style Add Menu on empty space right click
            contextMenu.style.display = 'none';
            searchMenu.open(e.clientX, e.clientY);
        }
    });

    document.addEventListener('pointerdown', (e) => {
        if (!contextMenu.contains(e.target)) contextMenu.style.display = 'none';

        // Mobile long press to open search menu
        if (e.pointerType !== 'mouse' && isBackgroundTarget(e.target) && state.selectedNodeIds.size === 0) {
            isLongPress = false;
            longPressTimer = setTimeout(() => {
                isLongPress = true;
                searchMenu.open(e.clientX, e.clientY);
                // Vibrate if supported
                if (navigator.vibrate) navigator.vibrate(50);
            }, 500);
        }
    });

    document.addEventListener('pointermove', () => clearTimeout(longPressTimer));
    document.addEventListener('pointerup', () => clearTimeout(longPressTimer));
    document.addEventListener('pointercancel', () => clearTimeout(longPressTimer));
}

// Export search menu for edge connection drops
export let searchMenuInstance = null;
setTimeout(() => {
    // Wait for init
    import('../components/nodeSearch.js').then(m => {
        searchMenuInstance = m;
    });
}, 100);