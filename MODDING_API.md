# NodeNotes — Документация API и кастомных кнопок

Добро пожаловать в руководство по расширению NodeNotes! Здесь описаны два способа добавить свои функции: **кнопки на панели** (через вкладку Настройки) и **Mод-скрипты** (через Лабораторию).

---

## ⚙️ Кастомные кнопки панели

### Как добавить

1. Нажмите кнопку **⚙ Настройки** на верхней панели.
2. Заполните форму:
   - **Название** — текст под иконкой кнопки.
   - **SVG-иконка** (необязательно) — вставьте `<svg>...</svg>` код. Если пусто, используется иконка по умолчанию.
   - **JS-код** — код, выполняемый при нажатии кнопки.
3. Нажмите **«Добавить на панель»**.

Кнопки сохраняются в `localStorage` и появляются при каждом перезапуске.

### Контекст выполнения кода кнопки

В JS-коде кнопки доступны следующие переменные:

```javascript
// state — текущее состояние активного воркспейса
state.nodes     // { [id]: { el: HTMLElement, x, y } }
state.edges     // [{ fromNode, toNode, fromType, toType }]
state.transform // { x, y, scale }
state.selectedNodeIds // Set<string>

// Создание ноды в центре экрана
const id = createNode(x, y);

// Перерисовать все связи
renderEdges();

// AI: одиночный запрос (возвращает Promise<{content, tool_calls}>)
const msg = await complete({ model, messages });

// AI: стриминг (вызывает onChunk с каждым кусочком текста)
await streamCompletion({ model, messages }, (chunk) => { /* ... */ });

// Получить API ключ текущего провайдера
const key = getApiKey();

// Получить выбранную модель
const model = getModel();

// Получить провайдера ('groq' | 'deepseek')
const provider = getProvider();
```

### Пример 1 — Посчитать слова во всех нодах

```javascript
let total = 0;
Object.values(state.nodes).forEach(n => {
    const text = n.el.querySelector('.node-textarea')?.value || '';
    total += text.trim().split(/\s+/).filter(Boolean).length;
});
alert(`Всего слов в нодах: ${total}`);
```

### Пример 2 — Перевести выделенную ноду на английский (с AI)

```javascript
const selectedId = [...state.selectedNodeIds][0];
if (!selectedId) { alert('Выберите ноду'); return; }

const ta = state.nodes[selectedId].el.querySelector('.node-textarea');
const original = ta.value;
if (!original.trim()) return;

const msg = await complete({
    model: getModel(),
    messages: [
        { role: 'system', content: 'Translate the text to English. Return only the translation.' },
        { role: 'user', content: original }
    ]
});
ta.value = msg.content;
```

### Пример 3 — Стриминг: суммаризировать все ноды в новую ноду

```javascript
const notes = Object.values(state.nodes)
    .map(n => n.el.querySelector('.node-textarea')?.value || '')
    .join('\n\n');

const cx = state.transform.x + window.innerWidth / 2 / state.transform.scale;
const cy = state.transform.y + window.innerHeight / 2 / state.transform.scale;
const newId = createNode(cx + 100, cy);
const newTa = state.nodes[newId].el.querySelector('.node-textarea');
newTa.value = '';

await streamCompletion(
    { model: getModel(), messages: [
        { role: 'system', content: 'Summarize the following notes concisely.' },
        { role: 'user', content: notes }
    ]},
    (chunk) => { newTa.value += chunk; }
);
```

### SVG-иконка (пример)

```html
<svg viewBox="0 0 24 24">
  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
</svg>
```

---

## 🔬## Форматы модов

Мод можно загрузить двумя способами через кнопку **Загрузить Мод (.js / .zip)**:
1. **Единичный `.js` файл**: Содержит весь код мода открытым текстом.
2. **Архив `.zip`**: Если ваш мод сложный, вы можете запаковать его в ZIP. Главное требование — **код должен находиться в файле `main.js` в корне архива.** Все ресурсы и данные внутри ZIP вы сможете обрабатывать из этого JS файла (при необходимости используя JSZip напрямую для чтения других файлов из архива).

В обоих случаях код будет выполнен в изолированном контексте, куда передан объект `api`.:

```javascript
// api.createLabNode(title, description, xOffset, yOffset, setupCallback)
// api.state — состояние активного воркспейса
// api.workspaces — { main, lab }

const { createLabNode, state } = api;
```

### Пример мода — Нода реверса текста

```javascript
const { createLabNode, state } = api;
const labMenu = document.getElementById('lab-menu');

const btn = document.createElement('button');
btn.className = 'panel-btn';
btn.style.cssText = 'width:100%;justify-content:center;';
btn.textContent = '+ Reverse Text Node';

btn.addEventListener('click', () => {
    createLabNode("Reverse Text", "Reverses connected text", 150, 0, (node, id, textArea) => {
        const runBtn = document.createElement('button');
        runBtn.textContent = "Run Reverse";
        runBtn.className = "lab-btn";
        runBtn.style.cssText = "margin-top:10px;width:100%;pointer-events:auto;";

        runBtn.addEventListener('pointerdown', (e) => {
            e.stopPropagation();
            const edge = state.edges.find(e => e.toNode === id && e.toType === 'in');
            if (!edge) { textArea.value = "No input connected."; return; }
            const src = state.nodes[edge.fromNode];
            if (src) textArea.value = src.el.querySelector('.node-textarea').value.split('').reverse().join('');
        });

        node.el.querySelector('.node-body').appendChild(runBtn);
    });
});

labMenu.appendChild(btn);
```

---

## 🤖 Встроенные AI-кнопки панели

| Кнопка | Действие |
|--------|----------|
| **Авто-названия** | Называет ноды без заголовка (используя содержимое) через AI |
| **Орфография** | Исправляет орфографию в выделенных (или всех) нодах |
| **Приложение** | Генерирует полноценное HTML-приложение по содержимому нод (с закачкой) |

Все кнопки используют выбранного провайдера и API ключ из меню **Лаборатории**.

---

## 🌊 Streaming & Tool Calling (для разработчиков)

`aiUtils.js` экспортирует:

```javascript
// Стриминг SSE
await streamCompletion(body, onChunk, onToolCall?)
//   body: стандартное тело запроса OpenAI Chat Completions
//   onChunk: (textDelta: string) => void — вызывается на каждый кусочек
//   onToolCall: (name, args, id) => void — вызывается в конце при tool_calls

// One-shot запрос
const msg = await complete(body)
//   возвращает { content, tool_calls? }

// Определить инструмент для tool calling
const tool = defineTool(name, description, jsonSchemaParameters)
```

### Пример с tool calling

```javascript
import { streamCompletion, defineTool } from './js/core/aiUtils.js';

const tools = [
    defineTool('get_weather', 'Get current weather', {
        type: 'object',
        properties: { city: { type: 'string' } },
        required: ['city']
    })
];

await streamCompletion(
    { model: 'llama3-8b-8192', messages: [...], tools },
    (chunk) => console.log(chunk),
    (name, args, id) => {
        if (name === 'get_weather') {
            console.log('Tool called:', name, args);
        }
    }
);
```