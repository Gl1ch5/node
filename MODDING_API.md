# NodeNotes — Документация по Модам (API)

Добро пожаловать в руководство по созданию модов для NodeNotes!
Моды — это универсальный способ добавлять новые ноды, кнопки на панель инструментов и любые другие функции в редактор без изменения его исходного кода.

---

## 📦 Формат мода

Начиная с последней версии, моды принимаются **только в формате `.zip` архивов**.

Ваш архив **обязательно** должен содержать файл `mod.json` в корне.
Пример структуры ZIP-архива:
```text
my_awesome_mod.zip
 ├── mod.json
 ├── main.js
 └── icon.png
```

### Структура `mod.json`

Файл `mod.json` — это паспорт вашего мода. Он сообщает системе, как его загружать и отображать в панели модов.

```json
{
  "name": "My Awesome Mod",
  "description": "Добавляет супер-кнопку и новую ноду для генерации списков.",
  "main": "main.js",
  "icon": "icon.png"
}
```
* **`name`** (строка, обязательно): Название мода.
* **`main`** (строка, обязательно): Имя главного JS-файла, который будет выполнен при старте.
* **`description`** (строка): Краткое описание того, что делает мод.
* **`icon`** (строка): Относительный путь к картинке внутри ZIP (например, `icon.png`, `icon.svg` или `icon.jpg`). Также можно передать строку с SVG-кодом напрямую или эмодзи.

---

## 🛠 API Модов

Когда ваш `main.js` запускается, он получает доступ к объекту `api`, который содержит все необходимые инструменты:

```javascript
const {
    state,              // { nodes: {}, edges: [], selectedNodeIds: Set, transform: {} }
    createNode,         // функция: (worldX, worldY, typeName) => nodeId
    registerNodeType,   // функция: (typeName, definitionObj) => void
    renderEdges,        // функция: () => void (перерисовывает связи на холсте)
    complete,           // AI: one-shot запрос (работает через настройки пользователя)
    streamCompletion    // AI: стриминг запрос
} = api;
```

---

## 🚀 Примеры создания модов

### 1. Добавление кастомной кнопки на верхнюю панель

В этом примере мы добавим кнопку "Объединить", которая собирает текст из всех нод и создает одну гигантскую ноду.

**`main.js`**:
```javascript
const { state, createNode } = api;

// 1. Создаем HTML элемент кнопки
const btn = document.createElement('button');
btn.className = 'panel-btn';
btn.innerHTML = `
  <svg viewBox="0 0 24 24"><path d="M4 18h16v-2H4v2zM4 13h16v-2H4v2zM4 6v2h16V6H4z"/></svg>
  Объединить
`;

// 2. Добавляем логику при клике
btn.addEventListener('click', () => {
    const nodeIds = Object.keys(state.nodes);
    if (nodeIds.length === 0) return;

    let combinedText = "";
    nodeIds.forEach(id => {
        const n = state.nodes[id];
        const text = n.el.querySelector('.node-textarea')?.value || '';
        if (text) combinedText += text + "\n\n";
    });

    // Создаем новую ноду в центре
    const cx = state.transform.x + window.innerWidth / 2 / state.transform.scale;
    const cy = state.transform.y + window.innerHeight / 2 / state.transform.scale;

    const newId = createNode(cx, cy, 'text');
    state.nodes[newId].el.querySelector('.node-title').value = "Объединенные записи";
    state.nodes[newId].el.querySelector('.node-textarea').value = combinedText;
});

// 3. Встраиваем кнопку в панель (находим разделитель и вставляем перед ним)
const topPanel = document.getElementById('top-panel');
if (topPanel) {
    const divider = topPanel.querySelector('.panel-divider');
    if (divider) {
        topPanel.insertBefore(btn, divider);
    } else {
        topPanel.appendChild(btn);
    }
}
```

### 2. Добавление новой Ноды (List Generator)

Этот мод добавляет новую ноду в меню по правому клику (в раздел `Custom`), которая генерирует нумерованный список.

**`main.js`**:
```javascript
const { registerNodeType, state } = api;

registerNodeType('list_generator', {
    title: '📝 Генератор списков',
    category: 'Custom',
    style: { border: '2px solid #4ade80', minWidth: '250px' },

    // Функция setup вызывается при создании DOM-элемента ноды
    setup: (node, id) => {
        const body = node.el.querySelector('.node-body');

        // Прячем стандартную текстовую область, если она нам не нужна
        const defaultTa = body.querySelector('.node-textarea');
        defaultTa.style.display = 'none';

        // Создаем свой интерфейс
        const ui = document.createElement('div');
        ui.style.display = 'flex';
        ui.style.flexDirection = 'column';
        ui.style.gap = '8px';

        const inputCount = document.createElement('input');
        inputCount.type = 'number';
        inputCount.min = '1';
        inputCount.max = '100';
        inputCount.value = '5';
        inputCount.style.cssText = `background:var(--input-bg);color:var(--text-main);border:1px solid var(--node-border);border-radius:4px;padding:4px;`;

        const btn = document.createElement('button');
        btn.textContent = 'Создать список';
        btn.style.cssText = `background:var(--text-main);color:var(--bg-color);border:none;border-radius:4px;padding:6px;cursor:pointer;pointer-events:auto;`;

        const output = document.createElement('textarea');
        output.style.cssText = `background:var(--input-bg);color:var(--text-main);border:1px solid var(--node-border);border-radius:4px;padding:4px;min-height:100px;`;

        // Логика кнопки
        btn.addEventListener('pointerdown', e => e.stopPropagation()); // чтобы не перетаскивалась нода при клике
        inputCount.addEventListener('pointerdown', e => e.stopPropagation());
        output.addEventListener('pointerdown', e => e.stopPropagation());

        btn.addEventListener('click', () => {
            const count = parseInt(inputCount.value) || 5;
            let list = [];
            for(let i=1; i<=count; i++) {
                list.push(`${i}. Элемент списка ${i}`);
            }
            output.value = list.join('\n');

            // Сохраняем в дефолтную текстарею для совместимости с экспортом (по желанию)
            defaultTa.value = output.value;
        });

        ui.appendChild(document.createTextNode('Количество строк:'));
        ui.appendChild(inputCount);
        ui.appendChild(btn);
        ui.appendChild(output);

        body.appendChild(ui);
    }
});
```

---

## 🤖 Работа с AI из мода

Вы можете вызывать AI-модели напрямую из вашего мода, используя `api.streamCompletion`.

```javascript
const { streamCompletion } = api;

// ... внутри обработчика клика ...
await streamCompletion(
    {
        messages: [
            { role: 'system', content: 'Ты ИИ помощник.' },
            { role: 'user', content: 'Расскажи шутку' }
        ]
    },
    (chunk) => {
        // эта функция вызывается на каждое новое слово от AI
        output.value += chunk;
    }
);
```

## Установка и Отключение

Загрузите `.zip` файл в окне "Моды" (кнопка на верхней панели). Там же вы увидите красивую плитку с вашим `icon.png` и описанием. С помощью переключателя можно легко выключать и включать мод (в большинстве случаев для применения эффекта выключения потребуется обновить страницу).