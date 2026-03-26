import { state } from './core/state.js';
import { updateTransform, initWorkspaceEvents, drawGrid } from './core/workspace.js';
import { createNode, deleteNode } from './components/node.js';
import { initTopPanel } from './components/topPanel.js';
import { initPanelManager } from './core/panelManager.js';
import { initPersistence } from './core/persistence.js';
import { initModManager } from './core/modManager.js';
import { initTextNode } from './components/nodes/textNode.js';
import { initAiNode } from './components/nodes/aiNode.js';
import { initExportNode } from './components/nodes/exportNode.js';
import { initBookNode } from './components/nodes/bookNode.js';
import { renderEdges } from './components/edge.js';
import { complete, streamCompletion, getApiKey, getModel, getProvider } from './core/aiUtils.js';
import { registerNodeType } from './core/nodeRegistry.js';

function init() {
    state.transform.x = window.innerWidth / 2;
    state.transform.y = window.innerHeight / 2;
    updateTransform();

    // Init built-in nodes
    initTextNode();
    initAiNode();
    initExportNode();
    initBookNode();

    // Init Mods
    const api = {
        state,
        createNode,
        renderEdges,
        complete,
        streamCompletion,
        getApiKey,
        getModel,
        getProvider,
        registerNodeType
    };
    initModManager(api);

    // Only create the demo node on first ever launch
    const hasSave = !!localStorage.getItem('nn_workspace');

    initWorkspaceEvents();
    initTopPanel();
    initPanelManager();
    initPersistence();  // restores save if present — must run after initWorkspaceEvents

    if (!hasSave) {
        const n1 = createNode(-140, -80, 'text');
        state.nodes[n1].el.querySelector('.node-textarea').value = "👋 Добро пожаловать! Двойной клик по фону — создать ноду. Перетащите шапку — переместить. Drag из сокета — соединить. Ctrl+Z — отменить. Перетащите notes_*.json — импорт.";
    }


    window.addEventListener('keydown', (e) => {
        if ((e.code === 'Delete' || e.code === 'Backspace') && state.selectedNodeIds.size > 0) {
            const activeTag = document.activeElement.tagName;
            if (activeTag !== 'INPUT' && activeTag !== 'TEXTAREA') {
                state.selectedNodeIds.forEach(id => deleteNode(id));
                state.selectedNodeIds.clear();
            }
        }
    });
}

init();