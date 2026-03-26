import { createNode, selectNode } from '../components/node.js';
import { state, workspaces } from '../core/state.js';
import { streamCompletion, complete, getProvider, getApiKey, getBaseUrl, getHeaders, getModel } from '../core/aiUtils.js';

// --- Lab Node factory ---

function createLabNode(title, description, xOffset, yOffset, setupCallback) {
    const centerX = state.transform.x + (window.innerWidth / 2) / state.transform.scale;
    const centerY = state.transform.y + (window.innerHeight / 2) / state.transform.scale;

    const id = createNode(centerX + xOffset, centerY + yOffset);
    const node = state.nodes[id];

    node.el.classList.add('lab-node');
    node.el.style.border = "2px solid #5a5a5a";

    const titleInput = node.el.querySelector('.node-title');
    titleInput.value = title;
    titleInput.readOnly = true;
    titleInput.style.color = "#ffaa00";

    const textArea = node.el.querySelector('.node-textarea');
    textArea.value = description;

    if (setupCallback) setupCallback(node, id, textArea);
    return id;
}

// --- DeepSeek Chat Node ---

function createDeepSeekChatNode() {
    const centerX = state.transform.x + (window.innerWidth / 2) / state.transform.scale;
    const centerY = state.transform.y + (window.innerHeight / 2) / state.transform.scale;

    const id = createNode(centerX - 160, centerY - 120);
    const node = state.nodes[id];

    node.el.classList.add('lab-node');
    node.el.style.border = "2px solid #4a90d9";
    node.el.style.minWidth = "340px";

    const titleInput = node.el.querySelector('.node-title');
    titleInput.value = "🤖 AI Chat";
    titleInput.readOnly = true;
    titleInput.style.color = "#4a90d9";

    // Hide default textarea and inject chat UI INSIDE the body,
    // keeping all existing socket-hitboxes intact (do NOT replace body.innerHTML).
    const body = node.el.querySelector('.node-body');
    const defaultTextarea = body.querySelector('.node-textarea');
    defaultTextarea.style.display = 'none';

    // Chat UI appended after textarea
    const chatUI = document.createElement('div');
    chatUI.innerHTML = `
        <div id="chat-history-${id}" style="
            min-height: 180px; max-height: 260px; overflow-y: auto;
            background: var(--input-bg); border: 1px solid var(--node-border);
            border-radius: 8px; padding: 10px; font-size: 13px;
            line-height: 1.6; margin-bottom: 8px; display: flex; flex-direction: column; gap: 6px;
        "></div>

        <div style="display: flex; gap: 6px; align-items: flex-end;">
            <textarea id="chat-input-${id}" placeholder="Введите сообщение..." rows="2" style="
                flex: 1; background: var(--input-bg); color: var(--text-main);
                border: 1px solid var(--node-border); border-radius: 8px;
                padding: 8px; font-size: 13px; font-family: 'Inter', sans-serif;
                resize: none; outline: none; pointer-events: auto;
                user-select: text; -webkit-user-select: text; touch-action: auto;
            "></textarea>
            <button id="chat-send-${id}" style="
                background: #4a90d9; color: white; border: none; border-radius: 8px;
                padding: 10px 14px; font-size: 16px; cursor: pointer;
                font-family: 'Inter', sans-serif; white-space: nowrap; pointer-events: auto;
                transition: opacity 0.2s; line-height: 1;
            ">➤</button>
        </div>
        <div id="chat-status-${id}" style="font-size: 11px; color: var(--text-muted); margin-top: 4px; min-height: 16px;"></div>
    `;
    body.appendChild(chatUI);

    const conversationHistory = [];
    const historyEl = chatUI.querySelector(`#chat-history-${id}`);
    const inputEl = chatUI.querySelector(`#chat-input-${id}`);
    const sendBtn = chatUI.querySelector(`#chat-send-${id}`);
    const statusEl = chatUI.querySelector(`#chat-status-${id}`);

    function appendMessage(role, text) {
        const msgEl = document.createElement('div');
        msgEl.style.cssText = `
            padding: 6px 10px; border-radius: 8px; max-width: 90%; word-break: break-word;
            ${role === 'user'
                ? 'background: #4a90d9; color: white; align-self: flex-end; margin-left: auto;'
                : 'background: var(--node-bg); border: 1px solid var(--node-border); color: var(--text-main); align-self: flex-start;'
            }
        `;
        msgEl.textContent = text;
        historyEl.appendChild(msgEl);
        historyEl.scrollTop = historyEl.scrollHeight;
    }

    const sendMessage = async () => {
        const text = inputEl.value.trim();
        if (!text) return;

        const apiKey = getApiKey();
        if (!apiKey) {
            statusEl.textContent = '⚠ Введите API Key провайдера в меню Лаборатории';
            return;
        }

        inputEl.value = '';
        appendMessage('user', text);
        conversationHistory.push({ role: 'user', content: text });

        sendBtn.disabled = true;
        statusEl.textContent = '⏳ Генерация...';

        // Create assistant bubble for streaming
        const assistantBubble = document.createElement('div');
        assistantBubble.style.cssText = `padding:6px 10px;border-radius:8px;max-width:90%;word-break:break-word;background:var(--node-bg);border:1px solid var(--node-border);color:var(--text-main);align-self:flex-start;white-space:pre-wrap;`;
        historyEl.appendChild(assistantBubble);

        try {
            const provider = getProvider();
            const selectedModel = document.getElementById('lab-model-select').value;
            const model = selectedModel || (provider === 'deepseek' ? 'deepseek-chat' : 'llama3-8b-8192');

            let reply = '';
            await streamCompletion(
                { model, messages: conversationHistory },
                (chunk) => {
                    reply += chunk;
                    assistantBubble.textContent = reply;
                    historyEl.scrollTop = historyEl.scrollHeight;
                }
            );

            conversationHistory.push({ role: 'assistant', content: reply });
            statusEl.textContent = '';
        } catch (err) {
            assistantBubble.style.color = '#ff4444';
            assistantBubble.textContent = `❌ ${err.message}`;
            statusEl.textContent = '';
        } finally {
            sendBtn.disabled = false;
        }
    };

    sendBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
    sendBtn.addEventListener('click', sendMessage);
    inputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    });
    inputEl.addEventListener('pointerdown', (e) => e.stopPropagation());

    return id;
}

// --- Init ---

export function initLabNodes() {
    const labMenu = document.getElementById('lab-menu');
    const btnInput = document.getElementById('btn-add-input-node');
    const btnStory = document.getElementById('btn-add-story-node');
    const btnChat = document.getElementById('btn-add-chat-node');
    const modUpload = document.getElementById('lab-mod-upload');
    const btnFetchModels = document.getElementById('btn-fetch-models');
    const modelSelect = document.getElementById('lab-model-select');
    const providerSelect = document.getElementById('lab-provider-select');
    const groqSection = document.getElementById('lab-groq-section');
    const deepseekSection = document.getElementById('lab-deepseek-section');
    const groqKeyInput = document.getElementById('lab-api-key');
    const deepseekKeyInput = document.getElementById('lab-deepseek-key');

    // Restore saved API Keys
    if (groqKeyInput) groqKeyInput.value = localStorage.getItem('nn_groq_key') || '';
    if (deepseekKeyInput) deepseekKeyInput.value = localStorage.getItem('nn_deepseek_key') || '';
    providerSelect.value = localStorage.getItem('nn_provider') || 'groq';

    // --- Provider toggle ---
    const DEEPSEEK_MODELS = [
        { id: 'deepseek-chat', label: 'deepseek-chat (Default)' },
        { id: 'deepseek-reasoner', label: 'deepseek-reasoner' }
    ];

    providerSelect.addEventListener('change', () => {
        const isDeepSeek = providerSelect.value === 'deepseek';
        groqSection.style.display = isDeepSeek ? 'none' : 'flex';
        deepseekSection.style.display = isDeepSeek ? 'flex' : 'none';

        // Update default model list
        if (isDeepSeek) {
            modelSelect.innerHTML = '';
            DEEPSEEK_MODELS.forEach(m => {
                const opt = document.createElement('option');
                opt.value = m.id;
                opt.textContent = m.label;
                modelSelect.appendChild(opt);
            });
        } else {
            modelSelect.innerHTML = '<option value="llama3-8b-8192">llama3-8b-8192 (Default)</option>';
        }
    });

    // --- Fetch models ---
    btnFetchModels.addEventListener('click', async () => {
        const apiKey = getApiKey();
        if (!apiKey) {
            alert('Введите API Key для загрузки моделей');
            return;
        }

        const provider = getProvider();

        try {
            btnFetchModels.textContent = '...';

            if (provider === 'deepseek') {
                // DeepSeek doesn't have a public /models endpoint; use hardcoded list
                modelSelect.innerHTML = '';
                DEEPSEEK_MODELS.forEach(m => {
                    const opt = document.createElement('option');
                    opt.value = m.id;
                    opt.textContent = m.label;
                    modelSelect.appendChild(opt);
                });
            } else {
                const res = await fetch('https://api.groq.com/openai/v1/models', {
                    headers: { 'Authorization': `Bearer ${apiKey}` }
                });
                if (!res.ok) throw new Error('Ошибка при загрузке моделей');
                const data = await res.json();
                modelSelect.innerHTML = '';
                data.data.forEach(m => {
                    const opt = document.createElement('option');
                    opt.value = m.id;
                    opt.textContent = m.id;
                    modelSelect.appendChild(opt);
                });
            }
        } catch(e) {
            alert(e.message);
        } finally {
            btnFetchModels.textContent = 'Загрузить Модели';
        }
    });

    // Make menu visible only when active class is present
    const observer = new MutationObserver(() => {
        labMenu.style.display = labMenu.classList.contains('active') ? 'flex' : 'none';
    });
    observer.observe(labMenu, { attributes: true, attributeFilter: ['class'] });

    // --- Input Notes Node ---
    btnInput.addEventListener('click', () => {
        createLabNode("Main Workspace Input", "Extracted text from all notes in the Main workspace will flow out of this node.", -250, -100, (node) => {
            node.el.querySelector('.socket-hitbox.in').style.display = 'none';
            node.el.querySelector('.node-textarea').readOnly = true;
        });
    });

    // --- Book Generator Node ---
    btnStory.addEventListener('click', () => {
        const centerX = state.transform.x + (window.innerWidth / 2) / state.transform.scale;
        const centerY = state.transform.y + (window.innerHeight / 2) / state.transform.scale;
        const id = createNode(centerX - 240, centerY - 200);
        const node = state.nodes[id];

        node.el.classList.add('lab-node');
        node.el.style.border = '2px solid #a855f7';
        node.el.style.minWidth = '480px';

        const titleInput = node.el.querySelector('.node-title');
        titleInput.value = '📖 Book Generator';
        titleInput.readOnly = true;
        titleInput.style.color = '#a855f7';

        const body = node.el.querySelector('.node-body');
        const defaultTextarea = body.querySelector('.node-textarea');
        defaultTextarea.style.display = 'none';

        // ── Settings field helper ────────────────────────────────────────────
        const style = `background:var(--input-bg);color:var(--text-main);border:1px solid var(--node-border);border-radius:6px;padding:6px 8px;font-size:12px;font-family:'Inter',sans-serif;width:100%;box-sizing:border-box;outline:none;pointer-events:auto;touch-action:auto;user-select:text;-webkit-user-select:text;`;

        const mkSel = (opts, def) => {
            const s = document.createElement('select');
            s.style.cssText = style;
            opts.forEach(([v, l]) => {
                const o = document.createElement('option');
                o.value = v; o.textContent = l;
                if (v === def) o.selected = true;
                s.appendChild(o);
            });
            s.addEventListener('pointerdown', e => e.stopPropagation());
            return s;
        };
        const mkNum = (min, max, def, step = 1) => {
            const i = document.createElement('input');
            i.type = 'number'; i.min = min; i.max = max; i.value = def; i.step = step;
            i.style.cssText = style;
            i.addEventListener('pointerdown', e => e.stopPropagation());
            return i;
        };
        const mkCheck = (label, def = false) => {
            const wrap = document.createElement('label');
            wrap.style.cssText = 'display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer;color:var(--text-main);pointer-events:auto;';
            const cb = document.createElement('input');
            cb.type = 'checkbox'; cb.checked = def;
            cb.style.cssText = 'pointer-events:auto;cursor:pointer;width:14px;height:14px;accent-color:#a855f7;';
            cb.addEventListener('pointerdown', e => e.stopPropagation());
            wrap.appendChild(cb);
            wrap.appendChild(document.createTextNode(label));
            wrap._cb = cb;
            return wrap;
        };
        const mkTextarea = (ph, rows = 2) => {
            const t = document.createElement('textarea');
            t.placeholder = ph; t.rows = rows;
            t.style.cssText = style + 'resize:vertical;line-height:1.4;';
            t.addEventListener('pointerdown', e => e.stopPropagation());
            return t;
        };
        const section = (label) => {
            const d = document.createElement('div');
            d.style.cssText = 'display:flex;flex-direction:column;gap:4px;';
            const l = document.createElement('label');
            l.style.cssText = 'font-size:11px;color:var(--text-muted);font-weight:500;';
            l.textContent = label;
            d.appendChild(l);
            return d;
        };
        const row2 = (...els) => {
            const d = document.createElement('div');
            d.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:8px;';
            els.forEach(e => d.appendChild(e));
            return d;
        };
        const divider = () => {
            const d = document.createElement('div');
            d.style.cssText = 'height:1px;background:var(--node-border);margin:2px 0;';
            return d;
        };

        // ── Build UI ─────────────────────────────────────────────────────────
        const ui = document.createElement('div');
        ui.style.cssText = 'display:flex;flex-direction:column;gap:8px;';

        // 1. Genre
        const genreWrap = section('📚 Жанр'); const genre = mkSel([
            ['fantasy','Фэнтези'],['scifi','Научная фантастика'],['detective','Детектив'],
            ['thriller','Триллер'],['romance','Романтика'],['horror','Ужасы'],
            ['historical','Исторический'],['adventure','Приключения'],['drama','Драма'],
            ['literary','Литературная проза'],['mystery','Мистика'],['dystopia','Антиутопия']
        ], 'fantasy'); genreWrap.appendChild(genre); ui.appendChild(genreWrap);

        // 2. Writing style
        const styleWrap = section('✍️ Стиль написания'); const writingStyle = mkSel([
            ['classic','Классический'],['modern','Современный'],['poetic','Поэтический'],
            ['minimalist','Минималистичный'],['expressive','Экспрессивный'],
            ['journalistic','Журналистский'],['noir','Нуар'],['epic','Эпический']
        ], 'classic'); styleWrap.appendChild(writingStyle); ui.appendChild(styleWrap);

        // 3+4. Length
        ui.appendChild(divider());
        const lenLabel = document.createElement('div');
        lenLabel.style.cssText = 'font-size:11px;color:var(--text-muted);font-weight:500;';
        lenLabel.textContent = '📏 Объём'; ui.appendChild(lenLabel);

        const wordsWrap = section('Слов (прибл.)'); const wordCount = mkNum(500, 500000, 5000, 500);
        wordsWrap.appendChild(wordCount);
        const pagesWrap = section('Страниц (прибл.)'); const pageCount = mkNum(1, 2000, 20);
        pagesWrap.appendChild(pageCount);
        ui.appendChild(row2(wordsWrap, pagesWrap));

        const chapWrap = section('Глав'); const chapterCount = mkNum(1, 200, 5);
        chapWrap.appendChild(chapterCount);
        const langWrap = section('🌐 Язык текста'); const outputLang = mkSel([
            ['russian','Русский'],['english','English'],['ukrainian','Українська'],
            ['german','Deutsch'],['french','Français'],['spanish','Español']
        ], 'russian'); langWrap.appendChild(outputLang);
        ui.appendChild(row2(chapWrap, langWrap));

        // 5+6. POV + Tone
        ui.appendChild(divider());
        const povWrap = section('👁 Точка зрения'); const pov = mkSel([
            ['first','От первого лица (Я)'],['third_limited','Третье лицо ограниченное'],
            ['third_omni','Третье лицо всеведущее'],['second','Второе лицо (Ты)']
        ], 'third_limited'); povWrap.appendChild(pov);

        const toneWrap = section('🎭 Тон'); const tone = mkSel([
            ['serious','Серьёзный'],['humorous','Юмористический'],['dark','Тёмный'],
            ['lyrical','Лирический'],['dramatic','Драматический'],['satirical','Сатирический'],
            ['melancholic','Меланхоличный'],['optimistic','Оптимистичный']
        ], 'serious'); toneWrap.appendChild(tone);
        ui.appendChild(row2(povWrap, toneWrap));

        // 7+8. Pacing + Audience
        const paceWrap = section('⚡ Темп'); const pacing = mkSel([
            ['slow','Медленный'],['medium','Умеренный'],['fast','Стремительный'],['varied','Переменный']
        ], 'medium'); paceWrap.appendChild(pacing);

        const audWrap = section('👥 Аудитория'); const audience = mkSel([
            ['children','Дети (6–12)'],['ya','Подростки (12–18)'],['adult','Взрослые (18+)'],['all','Все возрасты']
        ], 'adult'); audWrap.appendChild(audience);
        ui.appendChild(row2(paceWrap, audWrap));

        // 9+10. Era + Protagonist
        ui.appendChild(divider());
        const eraWrap = section('🕰 Эпоха / Сеттинг'); const era = mkSel([
            ['modern','Современность'],['past_century','XX век'],['medieval','Средневековье'],
            ['ancient','Античность'],['future','Будущее'],['fantasy_world','Фэнтезийный мир'],
            ['post_apocalyptic','Постапокалипсис'],['alternate','Альтернативная история']
        ], 'modern'); eraWrap.appendChild(era); ui.appendChild(eraWrap);

        const protWrap = section('🦸 Главный герой (описание)');
        const protagonist = mkTextarea('Например: молодой учёный с тёмным прошлым...', 2);
        protWrap.appendChild(protagonist); ui.appendChild(protWrap);

        // 11+12. Conflict + Ending
        const conflWrap = section('⚔️ Тип конфликта'); const conflict = mkSel([
            ['person_vs_person','Человек vs Человек'],['person_vs_nature','Человек vs Природа'],
            ['person_vs_society','Человек vs Общество'],['person_vs_self','Человек vs Себя'],
            ['person_vs_fate','Человек vs Судьба'],['person_vs_tech','Человек vs Технологии']
        ], 'person_vs_person'); conflWrap.appendChild(conflict);

        const endingWrap = section('🏁 Концовка'); const ending = mkSel([
            ['happy','Счастливая'],['tragic','Трагическая'],['open','Открытая'],
            ['unexpected','Неожиданная'],['bittersweet','Горько-сладкая'],['cyclical','Циклическая']
        ], 'open'); endingWrap.appendChild(ending);
        ui.appendChild(row2(conflWrap, endingWrap));

        // 13+14. Dialogue + Descriptions
        ui.appendChild(divider());
        const dialWrap = section('💬 Диалоги'); const dialogueLevel = mkSel([
            ['minimal','Минимальные'],['moderate','Умеренные'],['heavy','Интенсивные']
        ], 'moderate'); dialWrap.appendChild(dialogueLevel);

        const descWrap = section('🖼 Описания'); const descLevel = mkSel([
            ['brief','Краткие'],['detailed','Подробные'],['very_detailed','Очень детальные']
        ], 'detailed'); descWrap.appendChild(descLevel);
        ui.appendChild(row2(dialWrap, descWrap));

        // 15. Narrative structure
        const narrWrap = section('🔀 Нарративная структура'); const narrative = mkSel([
            ['linear','Линейная'],['nonlinear','Нелинейная'],['flashbacks','С флэшбэками'],
            ['frame','Обрамляющая (рассказ в рассказе)'],['parallel','Параллельная (несколько линий)']
        ], 'linear'); narrWrap.appendChild(narrative); ui.appendChild(narrWrap);

        // 16+17+18. Prologue, Epilogue, Creativity
        ui.appendChild(divider());
        const prologueCheck = mkCheck('📜 Добавить пролог');
        const epilogueCheck = mkCheck('📜 Добавить эпилог');
        const checksRow = document.createElement('div');
        checksRow.style.cssText = 'display:flex;gap:16px;flex-wrap:wrap;';
        checksRow.appendChild(prologueCheck); checksRow.appendChild(epilogueCheck);
        ui.appendChild(checksRow);

        const creativityWrap = section('🎲 Креативность (температура)'); const creativity = mkSel([
            ['low','🧊 Низкая — точно и предсказуемо'],
            ['medium','⚖️ Средняя — баланс'],
            ['high','🔥 Высокая — нестандартно и неожиданно']
        ], 'medium'); creativityWrap.appendChild(creativity); ui.appendChild(creativityWrap);

        // 19. Themes keywords
        const themesWrap = section('🏷 Темы / Ключевые слова');
        const themes = mkTextarea('Например: одиночество, предательство, надежда...', 2);
        themesWrap.appendChild(themes); ui.appendChild(themesWrap);

        // 20. Additional notes / style reference
        const extraWrap = section('📝 Доп. инструкции для автора');
        const extraInstructions = mkTextarea('Любые пожелания: ссылки на авторов, особенности стиля...', 3);
        extraWrap.appendChild(extraInstructions); ui.appendChild(extraWrap);

        // ── Output area ───────────────────────────────────────────────────────
        ui.appendChild(divider());
        const outputArea = document.createElement('textarea');
        outputArea.readOnly = true;
        outputArea.placeholder = 'Нажмите «Написать книгу» чтобы начать генерацию...';
        outputArea.style.cssText = style + `min-height:200px;resize:vertical;line-height:1.5;font-size:13px;`;
        outputArea.addEventListener('pointerdown', e => e.stopPropagation());
        ui.appendChild(outputArea);

        // Progress / status line
        const statusEl = document.createElement('div');
        statusEl.style.cssText = 'font-size:11px;color:var(--text-muted);min-height:16px;text-align:center;';
        ui.appendChild(statusEl);

        // ── Run button ─────────────────────────────────────────────────────────
        const runBtn = document.createElement('button');
        runBtn.textContent = '📖 Написать книгу';
        runBtn.style.cssText = `background:#a855f7;color:white;border:none;border-radius:8px;padding:10px;width:100%;font-size:13px;font-weight:600;cursor:pointer;font-family:'Inter',sans-serif;pointer-events:auto;transition:opacity 0.2s;`;
        runBtn.addEventListener('pointerdown', e => e.stopPropagation());
        runBtn.addEventListener('click', async () => {
            const apiKey = getApiKey();
            if (!apiKey) { outputArea.value = 'ERROR: Введите API Key в меню Лаборатории.'; return; }

            const incomingEdges = state.edges.filter(e => e.toNode === id && e.toType === 'in');
            let inputNotes = '';
            if (incomingEdges.length > 0) {
                const sourceNodeId = incomingEdges[0].fromNode;
                const sourceNode = state.nodes[sourceNodeId];
                if (sourceNode) {
                    if (sourceNode.el.querySelector('.node-title').value.includes('Main Workspace')) {
                        inputNotes = Object.values(workspaces.main.nodes)
                            .map((n, i) => `[Заметка ${i+1}]:\n${n.el.querySelector('.node-textarea').value}`)
                            .join('\n\n');
                    } else {
                        inputNotes = sourceNode.el.querySelector('.node-textarea').value;
                    }
                }
            }

            const tempMap = { low: 0.3, medium: 0.8, high: 1.4 };
            const genreMap = {fantasy:'фэнтези',scifi:'научной фантастике',detective:'детективе',thriller:'триллере',romance:'романтике',horror:'ужасах',historical:'историческом романе',adventure:'приключенческом романе',drama:'драме',literary:'литературной прозе',mystery:'мистике',dystopia:'антиутопии'};
            const styleMap = {classic:'классическом литературном',modern:'современном разговорном',poetic:'поэтическом, образном',minimalist:'минималистичном, лаконичном',expressive:'экспрессивном, ярком',journalistic:'журналистском, репортажном',noir:'нуар, мрачном',epic:'эпическом, масштабном'};
            const povMap = {first:'от первого лица (я)',third_limited:'от третьего лица ограниченного',third_omni:'от третьего лица всеведущего',second:'от второго лица (ты)'};
            const toneMap = {serious:'серьёзный',humorous:'юмористический',dark:'тёмный',lyrical:'лирический',dramatic:'драматический',satirical:'сатирический',melancholic:'меланхоличный',optimistic:'оптимистичный'};
            const endingMap = {happy:'счастливой концовкой',tragic:'трагической концовкой',open:'открытым концом',unexpected:'неожиданной концовкой',bittersweet:'горько-сладкой концовкой',cyclical:'циклической концовкой'};
            const langMap = {russian:'русском',english:'английском',ukrainian:'украинском',german:'немецком',french:'французском',spanish:'испанском'};

            const systemPrompt = `Ты профессиональный писатель. Напиши произведение строго на ${langMap[outputLang.value]} языке, в жанре ${genreMap[genre.value]}, ${styleMap[writingStyle.value]} стиле. Тон: ${toneMap[tone.value]}. Повествование ${povMap[pov.value]}. Структура: ${narrative.value === 'linear' ? 'линейная' : narrative.value === 'nonlinear' ? 'нелинейная' : narrative.value === 'flashbacks' ? 'с флэшбэками' : narrative.value === 'frame' ? 'обрамляющая' : 'параллельные сюжетные линии'}. Объём: примерно ${wordCount.value} слов, ${pageCount.value} страниц, ${chapterCount.value} глав. Диалоги: ${dialogueLevel.value === 'minimal' ? 'минимальные' : dialogueLevel.value === 'moderate' ? 'умеренные' : 'интенсивные'}. Описания: ${descLevel.value === 'brief' ? 'краткие' : descLevel.value === 'detailed' ? 'подробные' : 'очень детальные'}. Концовка: ${endingMap[ending.value]}.${prologueCheck._cb.checked ? ' Начни с пролога.' : ''}${epilogueCheck._cb.checked ? ' Закончи эпилогом.' : ''} Аудитория: ${audience.value === 'children' ? 'дети 6–12 лет' : audience.value === 'ya' ? 'подростки 12–18 лет' : audience.value === 'adult' ? 'взрослые' : 'все возрасты'}. Тип конфликта: ${conflict.value.replace(/_/g, ' vs ')}. Сеттинг: ${era.value}.${themes.value.trim() ? ` Ключевые темы: ${themes.value.trim()}.` : ''}${protagonist.value.trim() ? ` Главный герой: ${protagonist.value.trim()}.` : ''}${extraInstructions.value.trim() ? ` Дополнительные инструкции: ${extraInstructions.value.trim()}` : ''}`;

            const userPrompt = inputNotes
                ? `На основе следующих заметок напиши книгу:\n\n${inputNotes}`
                : 'Придумай интересный оригинальный сюжет и напиши книгу согласно всем заданным параметрам.';

            runBtn.disabled = true;
            outputArea.value = '';
            statusEl.textContent = '⏳ Генерация... (может занять несколько минут для больших текстов)';

            try {
                const provider = getProvider();
                const selectedModel = document.getElementById('lab-model-select').value;
                const model = selectedModel || (provider === 'deepseek' ? 'deepseek-chat' : 'llama3-8b-8192');
                const temperature = tempMap[creativity.value] ?? 0.8;

                await streamCompletion(
                    {
                        model,
                        temperature,
                        max_tokens: 8192,
                        messages: [
                            { role: 'system', content: systemPrompt },
                            { role: 'user', content: userPrompt }
                        ]
                    },
                    (chunk) => {
                        outputArea.value += chunk;
                        outputArea.scrollTop = outputArea.scrollHeight;
                        const words = outputArea.value.split(/\s+/).filter(Boolean).length;
                        statusEl.textContent = `⏳ Генерация... ${words} слов`;
                    }
                );
                const finalWords = outputArea.value.split(/\s+/).filter(Boolean).length;
                statusEl.textContent = `✅ Готово! ${finalWords} слов`;

            } catch (err) {
                outputArea.value = '';
                statusEl.textContent = `❌ ${err.message}`;
            } finally {
                runBtn.disabled = false;
            }
        });
        ui.appendChild(runBtn);

        body.appendChild(ui);
    });

    // --- Export Node ---
    const btnExportNode = document.getElementById('btn-add-export-node');
    if (btnExportNode) {
        btnExportNode.addEventListener('click', () => {
            const id = createLabNode("📤 Export Box", "Подключите сюда ноды для экспорта", 100, 100, (node, id, ta) => {
                node.el.style.border = '2px solid #22c55e';
                const body = node.el.querySelector('.node-body');
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
            });
        });
    }

    // --- Chat Node ---
    btnChat.addEventListener('click', () => {
        createDeepSeekChatNode();
    });

    // --- Mod Loader (Persistent) ---
    const modsListEl = document.getElementById('lab-mods-list');
    let savedMods = JSON.parse(localStorage.getItem('nn_saved_mods') || '[]');

    function renderModsList() {
        if (!modsListEl) return;
        modsListEl.innerHTML = '';
        savedMods.forEach((mod, index) => {
            const btnWrap = document.createElement('div');
            btnWrap.style.cssText = 'display:flex; gap:4px;';

            const btn = document.createElement('button');
            btn.className = 'panel-btn';
            btn.style.cssText = 'flex:1; justify-content:flex-start; background:var(--node-bg); font-size:12px;';
            btn.textContent = '🧩 ' + (mod.name || `Mod ${index + 1}`);
            btn.addEventListener('click', () => {
                try {
                    const modApi = { createLabNode, state, workspaces };
                    const modFunc = new Function('api', mod.code);
                    modFunc(modApi);
                } catch (err) {
                    alert(`Ошибка в моде "${mod.name}": ${err.message}`);
                }
            });

            const delBtn = document.createElement('button');
            delBtn.style.cssText = 'background:transparent; border:none; color:#ff4444; font-size:16px; cursor:pointer; padding:0 4px;';
            delBtn.textContent = '✕';
            delBtn.title = 'Удалить мод';
            delBtn.addEventListener('click', () => {
                savedMods.splice(index, 1);
                localStorage.setItem('nn_saved_mods', JSON.stringify(savedMods));
                renderModsList();
            });

            btnWrap.appendChild(btn);
            btnWrap.appendChild(delBtn);
            modsListEl.appendChild(btnWrap);
        });
    }

    renderModsList();

    const handleFile = (file) => {
        if (!file) return;

        const processCode = (code, modName) => {
            try {
                const modApi = { createLabNode, state, workspaces };
                const modFunc = new Function('api', code);
                // test parsing
                
                savedMods.push({
                    id: 'mod_' + Date.now(),
                    name: modName,
                    code: code
                });
                localStorage.setItem('nn_saved_mods', JSON.stringify(savedMods));
                renderModsList();
                modUpload.value = '';
            } catch (err) {
                alert(`Failed to parse mod: ${err.message}`);
            }
        };

        if (file.name.endsWith('.zip')) {
            if (!window.JSZip) { alert('JSZip library not loaded'); return; }
            window.JSZip.loadAsync(file).then(zip => {
                if (!zip.file('main.js')) {
                    alert('ZIP архив должен содержать файл main.js');
                    return;
                }
                zip.file('main.js').async('string').then(code => processCode(code, file.name.replace('.zip', '')));
            }).catch(e => alert(`ZIP error: ${e.message}`));
        } else if (file.name.endsWith('.js') || file.name.endsWith('.json')) {
            const reader = new FileReader();
            reader.onload = (e) => processCode(e.target.result, file.name.replace('.js', '').replace('.json', ''));
            reader.readAsText(file);
        }
    };

    modUpload.addEventListener('change', (e) => handleFile(e.target.files[0]));

    // Global drag-and-drop for mods (and later files)
    document.body.addEventListener('dragover', e => { e.preventDefault(); e.stopPropagation(); });
    document.body.addEventListener('drop', e => {
        e.preventDefault(); e.stopPropagation();
        const file = e.dataTransfer?.files[0];
        if (file && (file.name.endsWith('.zip') || file.name.endsWith('.js'))) {
            handleFile(file);
        }
    });
}