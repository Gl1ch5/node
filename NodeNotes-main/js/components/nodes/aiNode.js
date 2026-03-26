import { registerNodeType } from '../../core/nodeRegistry.js';
import { streamCompletion } from '../../core/aiUtils.js';
import { state } from '../../core/state.js';

export function initAiNode() {
    registerNodeType('ai_node', {
        title: '✨ AI Generator',
        category: 'AI',
        style: { border: '2px solid var(--text-main)', minWidth: '340px' },
        setup: (node, id) => {
            const el = node.el;
            const body = el.querySelector('.node-body');
            const defaultTextarea = body.querySelector('.node-textarea');
            defaultTextarea.style.display = 'none';

            const ui = document.createElement('div');
            ui.style.cssText = 'display:flex;flex-direction:column;gap:8px;';

            // Custom prompt input
            const promptInput = document.createElement('textarea');
            promptInput.placeholder = 'Введите промпт (например, напиши диздок, суммируй)...';
            promptInput.rows = 3;
            promptInput.style.cssText = `background:var(--input-bg);color:var(--text-main);border:1px solid var(--node-border);border-radius:6px;padding:8px;font-size:12px;font-family:'Inter',sans-serif;width:100%;resize:vertical;outline:none;pointer-events:auto;user-select:text;-webkit-user-select:text;`;
            promptInput.addEventListener('pointerdown', e => e.stopPropagation());
            ui.appendChild(promptInput);

            // Generate Button
            const generateBtn = document.createElement('button');
            generateBtn.textContent = '✨ Сгенерировать';
            generateBtn.style.cssText = `background:var(--text-main);color:var(--bg-color);border:none;border-radius:8px;padding:10px;width:100%;font-size:13px;font-weight:600;cursor:pointer;font-family:'Inter',sans-serif;pointer-events:auto;transition:opacity 0.2s;`;
            generateBtn.addEventListener('pointerdown', e => e.stopPropagation());
            ui.appendChild(generateBtn);

            // Output area
            const outputArea = document.createElement('textarea');
            outputArea.readOnly = true;
            outputArea.placeholder = 'Результат появится здесь...';
            outputArea.style.cssText = `background:var(--input-bg);color:var(--text-main);border:1px solid var(--node-border);border-radius:6px;padding:8px;font-size:12px;font-family:'Inter',sans-serif;width:100%;resize:vertical;min-height:150px;outline:none;pointer-events:auto;user-select:text;-webkit-user-select:text;`;
            outputArea.addEventListener('pointerdown', e => e.stopPropagation());
            ui.appendChild(outputArea);

            // Status text
            const statusEl = document.createElement('div');
            statusEl.style.cssText = 'font-size:11px;color:var(--text-muted);min-height:16px;text-align:center;';
            ui.appendChild(statusEl);

            generateBtn.addEventListener('click', async () => {
                const prompt = promptInput.value.trim();
                if (!prompt) {
                    statusEl.textContent = '❌ Пожалуйста, введите промпт';
                    return;
                }

                // Gather input context
                const incomingEdges = state.edges.filter(e => e.toNode === id && e.toType === 'in');
                let inputContext = '';

                let visited = new Set();
                let chain = [];
                const traverse = (nodeId) => {
                    if (visited.has(nodeId)) return;
                    visited.add(nodeId);
                    const parentEdges = state.edges.filter(e => e.toNode === nodeId && e.toType === 'in');
                    parentEdges.forEach(pe => traverse(pe.fromNode));
                    const target = state.nodes[nodeId];
                    if (target) {
                        const title = target.el.querySelector('.node-title').value;
                        const text = target.el.querySelector('.node-textarea')?.value || target.el.querySelector('textarea:not([readonly])')?.value || '';
                        if (text.trim() || title !== 'Заметка') {
                            chain.push({ title, text });
                        }
                    }
                };

                incomingEdges.forEach(edge => traverse(edge.fromNode));
                chain.forEach(ch => { inputContext += `[${ch.title}]:\n${ch.text}\n\n`; });

                const finalPrompt = inputContext
                    ? `Контекст (заметки и связи):\n${inputContext}\n\nЗадание: ${prompt}`
                    : `Задание: ${prompt}`;

                generateBtn.disabled = true;
                outputArea.value = '';
                statusEl.textContent = '⏳ Генерация...';

                try {
                    await streamCompletion(
                        {
                            messages: [
                                { role: 'system', content: 'Ты полезный ИИ-ассистент в нодовом редакторе. Выполняй задания на основе предоставленного контекста.' },
                                { role: 'user', content: finalPrompt }
                            ]
                        },
                        (chunk) => {
                            outputArea.value += chunk;
                            outputArea.scrollTop = outputArea.scrollHeight;
                        }
                    );
                    statusEl.textContent = '✅ Готово!';
                    // Sync default textarea for export compatibility
                    defaultTextarea.value = outputArea.value;
                } catch (err) {
                    outputArea.value = '';
                    statusEl.textContent = `❌ ${err.message}`;
                } finally {
                    generateBtn.disabled = false;
                }
            });

            body.appendChild(ui);
        }
    });
}
