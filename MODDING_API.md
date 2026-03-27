# NodeNotes — Полное руководство по созданию модов

Добро пожаловать в систему модов NodeNotes! Это руководство написано так, чтобы **любой человек мог создать свой мод, не заглядывая в исходный код редактора**.

Моды позволяют вам добавлять новые кнопки на верхнюю панель, создавать совершенно новые типы нод (карточек) на холсте, подключать сторонние API или менять поведение редактора.

---

## 📦 Формат мода (Как упаковать свой мод)

Все моды в NodeNotes загружаются в формате **`.zip` архива**.

Для создания простейшего мода вам нужно создать папку, положить туда минимум два файла, выделить их и сжать в ZIP-архив.

### Структура архива:
```text
my_awesome_mod.zip
 ├── mod.json      <-- Паспорт вашего мода
 ├── main.js       <-- Ваш JavaScript код
 └── icon.png      <-- (Необязательно) Иконка для меню модов
```

### 1. Файл `mod.json`
Это обязательный файл-манифест. В нем содержится информация о вашем моде. Создайте текстовый файл `mod.json` и вставьте туда:

```json
{
  "name": "Мой Первый Мод",
  "description": "Добавляет кнопку, которая объединяет все ноды в одну.",
  "main": "main.js",
  "icon": "icon.png"
}
```
* **`name`** — Название мода (обязательно).
* **`main`** — Имя главного JS-файла (обязательно).
* **`description`** — Описание того, что делает мод (чтобы вы сами не забыли).
* **`icon`** — Путь к картинке (например, `icon.png`, `icon.svg` или `icon.jpg`). Если картинки нет, можно просто написать туда эмодзи: `"icon": "🚀"`.

### 2. Файл `main.js`
Это файл, в котором пишется сам код. Когда вы загружаете мод в редактор, система запускает этот файл и передает ему магический объект `api`. В этом объекте есть всё, что вам нужно для работы.

Напишите в `main.js` базовый шаблон:
```javascript
// Достаем нужные инструменты из api
const { state, createNode, registerNodeType } = api;

alert("Ура! Мой мод загружен и работает!");
```

### Как установить мод:
1. Выделите `mod.json`, `main.js` (и `icon.png`, если есть).
2. Создайте из них ZIP-архив.
3. Откройте NodeNotes, нажмите кнопку **Моды** на верхней панели.
4. Перетащите ваш `.zip` файл в окно или выберите его через кнопку.
Мод моментально установится и выполнится!

---

## 🛠 Справочник API (Что умеет объект `api`)

Вам не нужно искать функции по файлам проекта, все инструменты уже лежат внутри объекта `api`, который передается в ваш `main.js`.

```javascript
const {
    state,              // Главное хранилище всех данных на холсте
    createNode,         // Функция для создания новой ноды на экране
    registerNodeType,   // Функция для создания своего СОБСТВЕННОГО ТИПА нод
    renderEdges,        // Функция для обновления (перерисовки) ниточек между нодами
    complete,           // AI-функция: получить разовый ответ от нейросети
    streamCompletion,   // AI-функция: получать ответ от нейросети по словам (стриминг)
    getApiKey,          // Получить ключ API, который пользователь ввел в настройках
    getModel,           // Узнать, какая нейросеть сейчас выбрана пользователем
    getProvider         // Узнать, какой провайдер выбран (например, 'groq')
} = api;
```

### Разбор `api.state` (Как читать данные с холста)

`state` — это объект, в котором лежит текущее состояние доски.
* `state.nodes` — Объект со всеми нодами. Ключ — это ID ноды.
* `state.edges` — Массив связей (ниточек) между нодами.
* `state.selectedNodeIds` — Список (`Set`) ID нод, которые сейчас выделены мышкой.
* `state.transform` — Как сильно холст приближен (`scale`) и смещен (`x`, `y`).

**Как прочитать текст из ВСЕХ нод:**
```javascript
const { state } = api;

// Перебираем все созданные ноды
Object.values(state.nodes).forEach(nodeData => {
    // nodeData.el - это сам HTML-элемент ноды на экране

    // Пытаемся найти внутри нее текстовое поле
    const textarea = nodeData.el.querySelector('.node-textarea');

    // Читаем текст
    if (textarea) {
        console.log("Текст в ноде:", textarea.value);
    }
});
```

---

## 🚀 Примеры кода (Копируй и используй)

### Пример 1: Добавляем кнопку на верхнюю панель

Сделаем кнопку "Объединить", которая собирает текст из всех нод и создает одну гигантскую ноду по центру.

**`main.js`**:
```javascript
const { state, createNode } = api;

// 1. Создаем HTML элемент нашей кнопки
const btn = document.createElement('button');
btn.className = 'panel-btn'; // Используем стандартный класс редактора
btn.innerHTML = `
  <svg viewBox="0 0 24 24"><path d="M4 18h16v-2H4v2zM4 13h16v-2H4v2zM4 6v2h16V6H4z"/></svg>
  Объединить
`;

// 2. Добавляем логику при клике на нее
btn.addEventListener('click', () => {
    // Получаем список ID всех нод
    const nodeIds = Object.keys(state.nodes);
    if (nodeIds.length === 0) {
        alert("Нет нод для объединения!");
        return;
    }

    let combinedText = "";

    // Проходимся по всем нодам и собираем текст
    nodeIds.forEach(id => {
        const n = state.nodes[id];
        const text = n.el.querySelector('.node-textarea')?.value || '';
        if (text) combinedText += text + "\n\n";
    });

    // Вычисляем координаты центра экрана, чтобы заспавнить новую ноду там
    const cx = state.transform.x + window.innerWidth / 2 / state.transform.scale;
    const cy = state.transform.y + window.innerHeight / 2 / state.transform.scale;

    // Создаем стандартную текстовую ноду ('text')
    const newId = createNode(cx, cy, 'text');

    // Меняем в ней заголовок и вставляем наш собранный текст
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
        topPanel.appendChild(btn); // Если разделителя нет, кидаем в конец
    }
}
```

---

### Пример 2: Создание СВОЕГО ТИПА Ноды

Допустим, вы хотите, чтобы по правому клику мыши (в меню добавления) появилась ваша уникальная нода "Генератор списков". Эта нода будет иметь поле для ввода числа и кнопку, которая генерирует строки.

Функция `registerNodeType(имя_типа, настройки)` делает всю грязную работу за вас.

**`main.js`**:
```javascript
const { registerNodeType, state } = api;

// Регистрируем новый тип 'list_generator'
registerNodeType('list_generator', {
    title: '📝 Генератор списков',     // Имя в меню по правому клику
    category: 'Мои Моды',               // Категория в меню
    style: { border: '2px solid #4ade80', minWidth: '250px' }, // Кастомный дизайн

    // Функция setup вызывается один раз, когда нода спавнится на холсте
    setup: (nodeData, nodeId) => {
        // Получаем доступ к "внутренностям" ноды
        const body = nodeData.el.querySelector('.node-body');

        // Прячем стандартную текстовую область (по умолчанию она есть во всех нодах)
        const defaultTa = body.querySelector('.node-textarea');
        defaultTa.style.display = 'none';

        // --- СОЗДАЕМ СВОЙ УНИКАЛЬНЫЙ ИНТЕРФЕЙС ---
        const ui = document.createElement('div');
        ui.style.display = 'flex';
        ui.style.flexDirection = 'column';
        ui.style.gap = '8px';

        // Поле ввода цифры
        const inputCount = document.createElement('input');
        inputCount.type = 'number';
        inputCount.value = '5';
        // Оформляем в стиле редактора
        inputCount.style.cssText = `background:var(--input-bg);color:var(--text-main);border:1px solid var(--node-border);border-radius:4px;padding:4px;`;

        // Кнопка
        const btn = document.createElement('button');
        btn.textContent = 'Создать список';
        btn.style.cssText = `background:var(--text-main);color:var(--bg-color);border:none;border-radius:4px;padding:6px;cursor:pointer;pointer-events:auto;`;

        // Поле для вывода результата
        const output = document.createElement('textarea');
        output.style.cssText = `background:var(--input-bg);color:var(--text-main);border:1px solid var(--node-border);border-radius:4px;padding:4px;min-height:100px;`;

        // ВАЖНО: Останавливаем события клика, чтобы при нажатии на нашу кнопку нода не пыталась "перетаскиваться"
        btn.addEventListener('pointerdown', e => e.stopPropagation());
        inputCount.addEventListener('pointerdown', e => e.stopPropagation());
        output.addEventListener('pointerdown', e => e.stopPropagation());

        // Что происходит при клике на "Создать список"
        btn.addEventListener('click', () => {
            const count = parseInt(inputCount.value) || 5;
            let list = [];
            for(let i = 1; i <= count; i++) {
                list.push(`${i}. Элемент списка ${i}`);
            }
            output.value = list.join('\n');

            // Если вы хотите, чтобы эту ноду можно было подключать к Export Box или AI,
            // обязательно дублируйте финальный текст в скрытую defaultTa!
            defaultTa.value = output.value;
        });

        // Добавляем все элементы в наш контейнер
        ui.appendChild(document.createTextNode('Количество строк:'));
        ui.appendChild(inputCount);
        ui.appendChild(btn);
        ui.appendChild(output);

        // Вставляем контейнер в тело ноды
        body.appendChild(ui);
    }
});
```

---

### Пример 3: Запрашиваем Нейросеть (AI) из мода

Хотите, чтобы ваша кнопка или нода генерировала текст через выбранную пользователем нейросеть (Groq/DeepSeek)? Используйте `api.streamCompletion`.

**`main.js`**:
```javascript
const { streamCompletion, getModel } = api;

// Представим, что у нас есть кнопка btn и текстовое поле outputTextArea

btn.addEventListener('click', async () => {
    // Очищаем поле перед генерацией
    outputTextArea.value = "";
    btn.disabled = true;

    try {
        await streamCompletion(
            {
                model: getModel(), // Берем модель из глобальных настроек
                messages: [
                    { role: 'system', content: 'Ты веселый ИИ помощник.' },
                    { role: 'user', content: 'Расскажи короткую шутку про программистов.' }
                ]
            },
            // Эта функция вызывается каждый раз, когда от нейросети приходит новое слово
            (chunk) => {
                outputTextArea.value += chunk;
                // Авто-скролл вниз
                outputTextArea.scrollTop = outputTextArea.scrollHeight;
            }
        );
    } catch (error) {
        alert("Ошибка генерации: " + error.message);
    } finally {
        btn.disabled = false;
    }
});
```

---

## 🛑 Как удалять или обновлять моды

1. Откройте панель "Моды" (справа сверху).
2. Там вы увидите карточки (плитки) всех установленных модов.
3. Вы можете нажать кнопку выключения мода или нажать на красную иконку корзины, чтобы удалить его.
4. **Внимание:** После удаления или отключения мода вам **нужно обновить страницу в браузере**, чтобы его элементы (кнопки или ноды) окончательно стерлись из интерфейса.

Теперь вы знаете всё, чтобы написать свой первый крутой плагин для NodeNotes. Удачи в экспериментах!