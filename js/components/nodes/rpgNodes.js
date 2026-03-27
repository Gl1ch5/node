import { registerNodeType } from '../../core/nodeRegistry.js';

export function initRpgNodes() {

    const sharedStyle = { border: '1px solid var(--node-border)', minWidth: '220px' };

    // 1. Character Node
    registerNodeType('rpg_character', {
        title: '👤 Персонаж',
        category: 'RPG',
        style: sharedStyle,
        setup: (node, id) => {
            node.el.querySelector('.node-textarea').style.display = 'none';
            const body = node.el.querySelector('.node-body');
            body.innerHTML += `
                <div style="display:flex;flex-direction:column;gap:4px;">
                    <input type="text" placeholder="Имя" class="custom-input" style="width:100%;background:var(--input-bg);color:var(--text-main);border:1px solid var(--node-border);border-radius:4px;padding:4px;font-size:11px;outline:none;">
                    <input type="text" placeholder="Возраст" class="custom-input" style="width:100%;background:var(--input-bg);color:var(--text-main);border:1px solid var(--node-border);border-radius:4px;padding:4px;font-size:11px;outline:none;">
                    <textarea placeholder="Характер / Описание" class="custom-input" style="width:100%;background:var(--input-bg);color:var(--text-main);border:1px solid var(--node-border);border-radius:4px;padding:4px;font-size:11px;outline:none;resize:vertical;" rows="3"></textarea>
                </div>
            `;
        }
    });

    // 2. Location Node
    registerNodeType('rpg_location', {
        title: '🏰 Локация',
        category: 'RPG',
        style: sharedStyle,
        setup: (node, id) => {
            node.el.querySelector('.node-textarea').style.display = 'none';
            const body = node.el.querySelector('.node-body');
            body.innerHTML += `
                <div style="display:flex;flex-direction:column;gap:4px;">
                    <input type="text" placeholder="Название места" class="custom-input" style="width:100%;background:var(--input-bg);color:var(--text-main);border:1px solid var(--node-border);border-radius:4px;padding:4px;font-size:11px;outline:none;">
                    <textarea placeholder="Атмосфера и детали" class="custom-input" style="width:100%;background:var(--input-bg);color:var(--text-main);border:1px solid var(--node-border);border-radius:4px;padding:4px;font-size:11px;outline:none;resize:vertical;" rows="3"></textarea>
                </div>
            `;
        }
    });

    // 3. Event / Plot Point Node
    registerNodeType('rpg_event', {
        title: '⚡ Событие',
        category: 'RPG',
        style: sharedStyle,
        setup: (node, id) => {
            // Keep the default textarea but change the placeholder
            node.el.querySelector('.node-textarea').placeholder = "Что произошло в этом шаге сюжета?";
        }
    });

    // 4. Item / Artifact Node
    registerNodeType('rpg_item', {
        title: '🗡 Предмет',
        category: 'RPG',
        style: sharedStyle,
        setup: (node, id) => {
            node.el.querySelector('.node-textarea').style.display = 'none';
            const body = node.el.querySelector('.node-body');
            body.innerHTML += `
                <div style="display:flex;flex-direction:column;gap:4px;">
                    <input type="text" placeholder="Название предмета" class="custom-input" style="width:100%;background:var(--input-bg);color:var(--text-main);border:1px solid var(--node-border);border-radius:4px;padding:4px;font-size:11px;outline:none;">
                    <input type="text" placeholder="Особые свойства" class="custom-input" style="width:100%;background:var(--input-bg);color:var(--text-main);border:1px solid var(--node-border);border-radius:4px;padding:4px;font-size:11px;outline:none;">
                    <textarea placeholder="История (Лор)" class="custom-input" style="width:100%;background:var(--input-bg);color:var(--text-main);border:1px solid var(--node-border);border-radius:4px;padding:4px;font-size:11px;outline:none;resize:vertical;" rows="2"></textarea>
                </div>
            `;
        }
    });

    // 5. Chapter Node
    registerNodeType('rpg_chapter', {
        title: '📖 Глава',
        category: 'RPG',
        style: sharedStyle,
        setup: (node, id) => {
            const body = node.el.querySelector('.node-body');
            const txt = node.el.querySelector('.node-textarea');
            txt.placeholder = "Краткое описание главы...";
            txt.style.minHeight = "60px";
        }
    });

    // 6. Dialogue Node
    registerNodeType('rpg_dialogue', {
        title: '💬 Диалог',
        category: 'RPG',
        style: sharedStyle,
        setup: (node, id) => {
            node.el.querySelector('.node-textarea').style.display = 'none';
            const body = node.el.querySelector('.node-body');
            body.innerHTML += `
                <div style="display:flex;flex-direction:column;gap:4px;">
                    <input type="text" placeholder="Участники" class="custom-input" style="width:100%;background:var(--input-bg);color:var(--text-main);border:1px solid var(--node-border);border-radius:4px;padding:4px;font-size:11px;outline:none;">
                    <textarea placeholder="Тема / Реплики" class="custom-input" style="width:100%;background:var(--input-bg);color:var(--text-main);border:1px solid var(--node-border);border-radius:4px;padding:4px;font-size:11px;outline:none;resize:vertical;" rows="4"></textarea>
                </div>
            `;
        }
    });
}
