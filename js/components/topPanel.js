import { state } from '../core/state.js';
import { updateTransform, drawGrid } from '../core/workspace.js';
import { groupSelectedNodes } from './node.js';
import { applySnapshot, triggerSave } from '../core/persistence.js';

export function initTopPanel() {

    document.getElementById('btn-group').addEventListener('click', () => {
        groupSelectedNodes();
    });

    document.getElementById('btn-focus').addEventListener('click', () => {
        const nodeIds = Object.keys(state.nodes);
        if (nodeIds.length === 0) {
            state.transform = { x: window.innerWidth / 2, y: window.innerHeight / 2, scale: 1 };
            updateTransform();
            return;
        }

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        nodeIds.forEach(id => {
            const n = state.nodes[id];
            const w = 280;
            const h = n.el.offsetHeight || 150;
            if (n.x < minX) minX = n.x;
            if (n.y < minY) minY = n.y;
            if (n.x + w > maxX) maxX = n.x + w;
            if (n.y + h > maxY) maxY = n.y + h;
        });

        const padding = 100;
        const w = maxX - minX + padding * 2;
        const h = maxY - minY + padding * 2;

        const scaleX = window.innerWidth / w;
        const scaleY = window.innerHeight / h;
        let newScale = Math.min(scaleX, scaleY);
        newScale = Math.max(0.1, Math.min(newScale, 2));

        const centerX = minX + (maxX - minX) / 2;
        const centerY = minY + (maxY - minY) / 2;

        state.transform.scale = newScale;
        state.transform.x = window.innerWidth / 2 - centerX * newScale;
        state.transform.y = window.innerHeight / 2 - centerY * newScale;
        updateTransform();
    });

    document.getElementById('btn-theme').addEventListener('click', () => {
        const html = document.documentElement;
        html.setAttribute('data-theme', html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
        setTimeout(() => drawGrid(), 50);
    });

    document.getElementById('btn-import').addEventListener('click', () => {
        document.getElementById('import-file-input').click();
    });

    document.getElementById('import-file-input').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const data = JSON.parse(evt.target.result);
                if (!data.nodes) throw new Error('Invalid file format');
                await applySnapshot(data);

                // Show toast via custom event or global dispatch if needed, but applySnapshot manages it visually
            } catch (err) {
                alert(`Import error: ${err.message}`);
            }
        };
        reader.readAsText(file);
        e.target.value = ''; // Reset input
    });

    document.getElementById('btn-export').addEventListener('click', () => {
        // We can just rely on the existing persistence logic to build the JSON
        // but we need to do it without modifying the localStorage cache directly here.
        // It's cleaner to reuse the serialise logic from persistence, but since
        // it's not exported, we replicate the updated node serialization here for export.
        const exportData = {
            nodes: Object.entries(state.nodes).map(([id, n]) => {
                const nodeData = {
                    id, x: Math.round(n.x), y: Math.round(n.y),
                    type: n.type || 'text',
                    title: n.el.querySelector('.node-title')?.value || '',
                    customFields: {}
                };
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
            edges: state.edges,
            transform: { ...state.transform }
        };
        const a = document.createElement('a');
        a.href = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
        a.download = `notes_${new Date().toISOString().slice(0,10)}.json`;
        document.body.appendChild(a); a.click(); a.remove();
    });
}