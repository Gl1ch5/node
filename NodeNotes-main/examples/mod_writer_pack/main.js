// Мод: Writer Pack (Пакет Писателя)
// Добавляет 10 новых полезных нод-шаблонов в Лабораторию: Сценарий, Лор, Персонаж и т.д.
// И добавляет кнопки быстрого переключения/создания на верхнюю панель

const { createLabNode, state } = api;

const nodeTemplates = [
    { id: 'lore', title: '📜 Лор (Lore)', color: '#8b5cf6', desc: 'Исторические события и факты мира.' },
    { id: 'scenario', title: '🎬 Сценарий (Scenario)', color: '#3b82f6', desc: 'Основной двигатель сюжета.' },
    { id: 'character', title: '👤 Персонаж (Character)', color: '#10b981', desc: 'Досье, мотивы, характер.' },
    { id: 'location', title: '🗺 Локация (Location)', color: '#06b6d4', desc: 'Описание места и точек интереса.' },
    { id: 'item', title: '🗝 Предмет (Item)', color: '#f59e0b', desc: 'Важный артефакт или экипировка.' },
    { id: 'quest', title: '⚔ Квест (Quest)', color: '#ef4444', desc: 'Цели, награды, пути завершения.' },
    { id: 'faction', title: '🚩 Фракция (Faction)', color: '#ec4899', desc: 'Организация, их цели и враги.' },
    { id: 'dialogue', title: '💬 Диалог (Dialogue)', color: '#14b8a6', desc: 'Ветви бесед.' },
    { id: 'concept', title: '💡 Концепт (Concept)', color: '#f97316', desc: 'Базовая идея на проработку.' },
    { id: 'event', title: '⚡ Событие (Event)', color: '#6366f1', desc: 'Случайное или заскриптованное событие.' }
];

const panel = document.getElementById('top-panel');

// Создаем кнопки на панель для быстрой генерации таких нод
nodeTemplates.forEach((tpl, i) => {
    const btnBoxId = `btn-box-${tpl.id}`;
    if(document.getElementById(btnBoxId)) return;

    const btn = document.createElement('button');
    btn.className = 'panel-btn';
    btn.id = btnBoxId;
    btn.title = `Создать: ${tpl.title}`;
    btn.style.borderColor = tpl.color;
    btn.innerHTML = `<span style="color:${tpl.color}; font-size:12px; font-weight:bold;">${tpl.title.split(' ')[0]}</span>`;

    btn.addEventListener('click', () => {
        createLabNode(tpl.title, tpl.desc, (i * 120), 50, (node, id, ta) => {
            node.el.style.border = `2px solid ${tpl.color}`;
            ta.placeholder = tpl.desc;
        });
    });

    panel.appendChild(btn);
});

alert("Установлен мод: Writer Pack! Добавлено 10 новых кнопок для быстрого создания сценарных нод.");
