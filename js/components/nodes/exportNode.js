import { registerNodeType } from '../../core/nodeRegistry.js';
import { state } from '../../core/state.js';

export function initExportNode() {
    registerNodeType('export', {
        title: '📤 Export Box',
        category: 'Output',
        style: { border: '2px solid var(--text-main)' },
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
            expBtn.style.cssText = `background:var(--text-main);color:var(--bg-color);border:none;border-radius:8px;padding:10px;width:100%;font-size:13px;font-weight:600;cursor:pointer;`;
            expBtn.addEventListener('pointerdown', e => e.stopPropagation());

            expBtn.addEventListener('click', () => {
                const incomingEdges = state.edges.filter(e => e.toNode === id && e.toType === 'in');
                if (incomingEdges.length === 0) { alert('Подключите хотя бы одну ноду к Export Box!'); return; }

                let content = '';
                let visited = new Set();
                let chain = [];

                // Helper to extract text from a node (similar to storyLogic.js)
                const extractNodeText = (targetNode) => {
                    if (!targetNode || !targetNode.el) return { title: 'Unknown', text: '' };

                    const titleEl = targetNode.el.querySelector('.node-title');
                    const title = titleEl ? titleEl.value : 'Заметка';

                    let text = '';
                    const defaultTextarea = targetNode.el.querySelector('.node-textarea');
                    if (defaultTextarea && defaultTextarea.style.display !== 'none') {
                        text = defaultTextarea.value;
                    } else {
                        const inputs = targetNode.el.querySelectorAll('.node-body input:not([type="checkbox"]):not(.node-title), .node-body textarea:not([readonly])');
                        let parts = [];
                        inputs.forEach(inp => {
                            if (inp.value && inp.value.trim()) {
                                const label = inp.placeholder ? `${inp.placeholder}: ` : '';
                                parts.push(`${label}${inp.value}`);
                            }
                        });
                        text = parts.join('\n');
                    }
                    return { title, text: text.trim() };
                };

                // Trace the main spine backwards and collect top/bottom side contexts
                const gatherChronologicalChain = (startNodeId) => {
                    let storyline = [];
                    let currentNodeId = startNodeId;

                    while (currentNodeId) {
                        if (visited.has(currentNodeId)) break;
                        visited.add(currentNodeId);

                        const node = state.nodes[currentNodeId];
                        if (!node) break;

                        let currentStep = { main: extractNodeText(node), context: [] };

                        // Find side connections to this specific node (Top / Bottom)
                        const sideEdges = state.edges.filter(e =>
                            (e.toNode === currentNodeId && (e.toType === 'top' || e.toType === 'bottom')) ||
                            (e.fromNode === currentNodeId && (e.fromType === 'top' || e.fromType === 'bottom'))
                        );

                        sideEdges.forEach(e => {
                            const otherId = e.fromNode === currentNodeId ? e.toNode : e.fromNode;
                            if (!visited.has(otherId) && state.nodes[otherId]) {
                                visited.add(otherId);
                                currentStep.context.push(extractNodeText(state.nodes[otherId]));
                            }
                        });

                        storyline.unshift(currentStep);

                        // Find the previous node in the main spine
                        const prevEdge = state.edges.find(e => e.toNode === currentNodeId && e.toType === 'in');
                        if (prevEdge) {
                            currentNodeId = prevEdge.fromNode;
                        } else {
                            break;
                        }
                    }
                    return storyline;
                };

                incomingEdges.forEach(edge => {
                    const branchStoryline = gatherChronologicalChain(edge.fromNode);
                    branchStoryline.forEach(step => {
                        if (step.main.text.trim() || step.main.title !== 'Заметка') {
                            chain.push(step.main);
                        }
                        step.context.forEach(ctx => {
                            if (ctx.text.trim() || ctx.title !== 'Заметка') {
                                chain.push(ctx);
                            }
                        });
                    });
                });

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
