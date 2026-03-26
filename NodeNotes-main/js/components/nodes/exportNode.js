import { registerNodeType } from '../../core/nodeRegistry.js';
import { state } from '../../core/state.js';

export function initExportNode() {
    registerNodeType('export', {
        title: '📤 Export Box',
        category: 'Output',
        style: { border: '2px solid #22c55e' },
        setup: (node, id) => {
            const el = node.el;
            const body = el.querySelector('.node-body');
            const ta = body.querySelector('.node-textarea');
            ta.style.display = 'none';

            const ui = document.createElement('div');
            ui.style.cssText = 'display:flex;flex-direction:column;gap:8px;padding:4px;';

            const fmtSelect = document.createElement('select');
            fmtSelect.style.cssText = `background:var(--input-bg);color:var(--text-main);border:1px solid var(--node-border);border-radius:6px;padding:6px;font-size:12px;width:100%;outline:none;user-select:text;`;
            ['TXT', 'Markdown', 'HTML'].forEach(f => {
                const opt = document.createElement('option');
                opt.value = opt.textContent = f;
                fmtSelect.appendChild(opt);
            });
            fmtSelect.addEventListener('pointerdown', e => e.stopPropagation());
            ui.appendChild(fmtSelect);

            const expBtn = document.createElement('button');
            expBtn.textContent = '💾 Скачать';
            expBtn.style.cssText = `background:#22c55e;color:white;border:none;border-radius:8px;padding:10px;width:100%;font-size:13px;font-weight:600;cursor:pointer;`;
            expBtn.addEventListener('pointerdown', e => e.stopPropagation());

            expBtn.addEventListener('click', () => {
                const incomingEdges = state.edges.filter(e => e.toNode === id && e.toType === 'in');
                if (incomingEdges.length === 0) { alert('Подключите хотя бы одну ноду к Export Box!'); return; }

                let content = '';
                let visited = new Set();
                let chain = [];

                // Рекурсивный обход всех предков
                const traverse = (nodeId) => {
                    if (visited.has(nodeId)) return;
                    visited.add(nodeId);

                    // Сначала обходим все входящие связи (ищем предков)
                    const parentEdges = state.edges.filter(e => e.toNode === nodeId && e.toType === 'in');
                    parentEdges.forEach(pe => traverse(pe.fromNode));

                    // Затем добавляем саму ноду (таким образом порядок будет от начала к концу)
                    const target = state.nodes[nodeId];
                    if (target) {
                        const title = target.el.querySelector('.node-title').value;
                        const text = target.el.querySelector('.node-textarea').value;
                        if (text.trim() || title !== 'Заметка') {
                            chain.push({ title, text });
                        }
                    }
                };

                incomingEdges.forEach(edge => traverse(edge.fromNode));

                chain.forEach(ch => {
                    content += `### ${ch.title}\n\n${ch.text}\n\n`;
                });

                let blobType = 'text/plain';
                let ext = '.txt';
                let output = content;

                if (fmtSelect.value === 'Markdown') ext = '.md';
                if (fmtSelect.value === 'HTML') {
                    ext = '.html';
                    blobType = 'text/html';
                    output = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body>${content.replace(/### (.*)/g, '<h2>$1</h2>').replace(/\n/g, '<br>')}</body></html>`;
                }

                const blob = new Blob([output], { type: blobType });
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = `export_${Date.now()}${ext}`;
                a.click();
            });
            ui.appendChild(expBtn);
            body.appendChild(ui);
        }
    });
}
