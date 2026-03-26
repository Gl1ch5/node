import { getAllNodeTypes } from '../core/nodeRegistry.js';
import { createNode } from './node.js';
import { screenToWorld } from '../core/state.js';

let searchMenu = null;

export function initNodeSearch() {
    searchMenu = document.createElement('div');
    searchMenu.id = 'node-search-menu';
    searchMenu.style.cssText = `
        display: none; position: absolute; z-index: 2500;
        background: var(--panel-bg); backdrop-filter: blur(10px);
        border: 1px solid var(--panel-border); border-radius: 8px;
        width: 200px; max-height: 300px; overflow-y: auto;
        box-shadow: 0 8px 32px var(--node-shadow);
        flex-direction: column; padding: 4px;
    `;

    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = 'Search nodes...';
    searchInput.style.cssText = `
        background: var(--input-bg); color: var(--text-main);
        border: 1px solid var(--node-border); border-radius: 4px;
        padding: 6px 8px; font-size: 13px; font-family: Inter, sans-serif;
        outline: none; margin-bottom: 4px; pointer-events: auto;
    `;

    const listContainer = document.createElement('div');
    listContainer.style.cssText = 'display: flex; flex-direction: column; gap: 2px;';

    searchMenu.appendChild(searchInput);
    searchMenu.appendChild(listContainer);
    document.body.appendChild(searchMenu);

    let lastX = 0;
    let lastY = 0;
    let pendingEdge = null; // { startNodeId, startType, targetType }

    const renderList = (filter = '') => {
        listContainer.innerHTML = '';
        const types = getAllNodeTypes();
        const lowerFilter = filter.toLowerCase();

        // Group by category
        const groups = {};
        types.forEach(t => {
            if (t.title.toLowerCase().includes(lowerFilter) || t.category?.toLowerCase().includes(lowerFilter)) {
                const cat = t.category || 'Other';
                if (!groups[cat]) groups[cat] = [];
                groups[cat].push(t);
            }
        });

        Object.keys(groups).sort().forEach(cat => {
            const catLabel = document.createElement('div');
            catLabel.style.cssText = 'font-size: 10px; color: var(--text-muted); padding: 4px 8px; text-transform: uppercase; font-weight: 600;';
            catLabel.textContent = cat;
            listContainer.appendChild(catLabel);

            groups[cat].forEach(t => {
                const item = document.createElement('div');
                item.style.cssText = `
                    padding: 6px 8px; font-size: 13px; color: var(--text-main);
                    cursor: pointer; border-radius: 4px; transition: background 0.1s;
                `;
                item.textContent = t.title;
                item.addEventListener('mouseover', () => item.style.background = 'var(--btn-hover)');
                item.addEventListener('mouseout', () => item.style.background = 'transparent');

                item.addEventListener('click', () => {
                    const wPos = screenToWorld(lastX, lastY);
                    const newNodeId = createNode(wPos.x, wPos.y, t.typeName);

                    if (pendingEdge) {
                        const edgeData = { ...pendingEdge };
                        import('./edge.js').then(m => {
                            m.createEdge(edgeData.startNodeId, edgeData.startType, newNodeId, edgeData.targetType);
                        });
                    }

                    closeMenu();
                });
                listContainer.appendChild(item);
            });
        });
    };

    searchInput.addEventListener('input', e => renderList(e.target.value));

    // Handle Enter key for first item
    searchInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
            const firstItem = listContainer.querySelector('div[style*="cursor: pointer"]');
            if (firstItem) firstItem.click();
        }
    });

    const closeMenu = () => {
        searchMenu.style.display = 'none';
        searchInput.value = '';
        pendingEdge = null;
    };

    document.addEventListener('pointerdown', (e) => {
        if (searchMenu.style.display === 'flex' && !searchMenu.contains(e.target)) {
            closeMenu();
        }
    });

    const instance = {
        open: (clientX, clientY, edgeData = null) => {
            lastX = clientX;
            lastY = clientY;
            pendingEdge = edgeData;

            // Adjust dimensions for mobile constraints
            const menuWidth = 200;
            const menuHeight = 300; // max-height

            let left = clientX;
            let top = clientY;

            if (left + menuWidth > window.innerWidth) {
                left = window.innerWidth - menuWidth - 10;
            }
            if (top + menuHeight > window.innerHeight) {
                top = window.innerHeight - menuHeight - 10;
            }

            searchMenu.style.left = Math.max(10, left) + 'px';
            searchMenu.style.top = Math.max(10, top) + 'px';
            searchMenu.style.display = 'flex';

            renderList();
            setTimeout(() => searchInput.focus(), 50);
        },
        close: closeMenu
    };

    // Assign to the exported reference so getSearchMenu works
    searchMenuInstance = instance;
    return instance;
}

let searchMenuInstance = null;
export function getSearchMenu() {
    return searchMenuInstance;
}
