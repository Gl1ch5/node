import { registerNodeType } from '../../core/nodeRegistry.js';
import { streamCompletion } from '../../core/aiUtils.js';
import { state } from '../../core/state.js';
import { gatherStoryContext } from '../../core/storyLogic.js';

export function initAiToolsNodes() {

    const sharedStyle = { border: '1px solid var(--node-border)', minWidth: '260px' };

    // Helper to create basic AI processing nodes easily
    const createAIToolNode = (id, title, category, promptTemplate, btnText) => {
        registerNodeType(id, {
            title,
            category,
            style: sharedStyle,
            setup: (node, nodeId) => {
                const el = node.el;
                const body = el.querySelector('.node-body');
                const defaultTextarea = body.querySelector('.node-textarea');
                defaultTextarea.style.display = 'none';

                const ui = document.createElement('div');
                ui.style.cssText = 'display:flex;flex-direction:column;gap:6px;';

                const generateBtn = document.createElement('button');
                generateBtn.textContent = btnText;
                generateBtn.style.cssText = `background:var(--text-main);color:var(--bg-color);border:none;border-radius:4px;padding:6px;font-size:11px;font-weight:600;cursor:pointer;`;
                ui.appendChild(generateBtn);

                const outputArea = document.createElement('textarea');
                outputArea.readOnly = true;
                outputArea.placeholder = 'Результат...';
                outputArea.style.cssText = `background:var(--input-bg);color:var(--text-main);border:1px solid var(--node-border);border-radius:4px;padding:6px;font-size:11px;width:100%;resize:vertical;min-height:80px;outline:none;`;
                ui.appendChild(outputArea);

                generateBtn.addEventListener('click', async () => {
                    const context = gatherStoryContext(nodeId);
                    if (!context) {
                        outputArea.value = '❌ Нет подключенных данных';
                        return;
                    }

                    generateBtn.disabled = true;
                    outputArea.value = '⏳...';

                    try {
                        await streamCompletion(
                            {
                                messages: [
                                    { role: 'system', content: promptTemplate },
                                    { role: 'user', content: context }
                                ]
                            },
                            (chunk) => {
                                if(outputArea.value === '⏳...') outputArea.value = '';
                                outputArea.value += chunk;
                                outputArea.scrollTop = outputArea.scrollHeight;
                            }
                        );
                        defaultTextarea.value = outputArea.value;
                    } catch (err) {
                        outputArea.value = `❌ ${err.message}`;
                    } finally {
                        generateBtn.disabled = false;
                    }
                });

                body.appendChild(ui);
            }
        });
    };

    // 7. Summary Node
    createAIToolNode(
        'ai_summary',
        '📝 AI Суммаризатор',
        'AI Tools',
        'Сделай краткую выжимку (summary) из предоставленного контекста. Выдели самое главное.',
        'Сделать выжимку'
    );

    // 8. Expander Node
    createAIToolNode(
        'ai_expander',
        '🌱 AI Расширитель',
        'AI Tools',
        'Детально опиши и расширь предоставленную идею. Добавь атмосферы, деталей и логики.',
        'Расширить идею'
    );

    // 9. Translator Node
    createAIToolNode(
        'ai_translator',
        '🌍 AI Переводчик',
        'AI Tools',
        'Переведи предоставленный текст на английский язык, сохраняя художественный стиль. Если текст уже на английском, переведи на русский.',
        'Перевести'
    );

    // 10. Image Prompt Generator Node
    createAIToolNode(
        'ai_img_prompt',
        '🖼️ AI Промпт для Изображений',
        'AI Tools',
        'На основе текста создай 3 коротких промпта (на английском языке) для генерации изображений в Midjourney/Stable Diffusion. Опиши визуальные детали, освещение и стиль.',
        'Создать промпты'
    );
}