import { registerNodeType } from '../../core/nodeRegistry.js';

export function initPromptNode() {
    registerNodeType('ai_prompt', {
        title: '🎯 Промпт',
        category: 'AI Tools',
        style: { border: '2px dashed var(--text-main)', minWidth: '240px' },
        setup: (node, id) => {
            const body = node.el.querySelector('.node-body');
            const txt = node.el.querySelector('.node-textarea');

            // Re-style the default textarea to be more obvious
            txt.placeholder = "Введите вашу инструкцию или промпт для ИИ здесь...";
            txt.style.minHeight = "100px";
            txt.style.background = "var(--input-bg)";
            txt.style.color = "var(--text-main)";
            txt.style.fontFamily = "monospace";
            txt.style.fontSize = "12px";

            // Add a small label above
            const label = document.createElement('div');
            label.textContent = "Инструкция для генерации:";
            label.style.cssText = "font-size:11px; color:var(--text-muted); margin-bottom:4px; font-weight:600;";
            body.insertBefore(label, txt);
        }
    });
}
